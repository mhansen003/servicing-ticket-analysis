#!/usr/bin/env node

/**
 * Domo API Client
 *
 * Handles authentication and data fetching from Domo datasets
 * Documentation: https://developer.domo.com/
 */

import fetch from 'node-fetch';
import csvParser from 'csv-parser';
import { Readable } from 'stream';

export class DomoAPI {
  constructor(clientId, clientSecret, environment = 'cmgfi') {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.environment = environment;
    this.baseUrl = `https://${environment}.domo.com/api`;
    this.accessToken = null;
    this.tokenExpiry = null;
  }

  /**
   * Authenticate with Domo using OAuth 2.0 client credentials flow
   */
  async authenticate() {
    const authUrl = 'https://api.domo.com/oauth/token';
    const credentials = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');

    try {
      const response = await fetch(`${authUrl}?grant_type=client_credentials`, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${credentials}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Authentication failed: ${response.status} - ${error}`);
      }

      const data = await response.json();
      this.accessToken = data.access_token;
      // Token expires in seconds, set expiry time
      this.tokenExpiry = Date.now() + (data.expires_in * 1000);

      console.log('✅ Authenticated with Domo API');
      return true;
    } catch (error) {
      console.error('❌ Domo authentication error:', error.message);
      throw error;
    }
  }

  /**
   * Ensure we have a valid access token
   */
  async ensureAuthenticated() {
    if (!this.accessToken || Date.now() >= this.tokenExpiry - 60000) {
      await this.authenticate();
    }
  }

  /**
   * Fetch data from a Domo dataset with optional filters
   * @param {string} datasetId - The dataset GUID
   * @param {object} options - Query options
   * @param {string} options.startDate - Filter records after this date (YYYY-MM-DD)
   * @param {string} options.endDate - Filter records before this date (YYYY-MM-DD)
   * @param {number} options.limit - Maximum number of records to fetch
   * @param {number} options.offset - Number of records to skip
   * @returns {Promise<Array>} Array of records
   */
  async fetchDataset(datasetId, options = {}) {
    await this.ensureAuthenticated();

    const { startDate, endDate, limit = 10000, offset = 0 } = options;

    // Build SQL query
    let query = `SELECT * FROM table`;
    const whereClauses = [];

    if (startDate) {
      whereClauses.push(`\`CallStartDateTime\` >= '${startDate}'`);
    }
    if (endDate) {
      whereClauses.push(`\`CallStartDateTime\` <= '${endDate}'`);
    }

    if (whereClauses.length > 0) {
      query += ` WHERE ${whereClauses.join(' AND ')}`;
    }

    query += ` ORDER BY \`CallStartDateTime\` DESC`;
    query += ` LIMIT ${limit} OFFSET ${offset}`;

    const url = `https://api.domo.com/v1/datasets/query/execute/${datasetId}`;

    try {
      console.log(`🔍 Fetching data from Domo dataset: ${datasetId}`);
      console.log(`   Query: ${query}`);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ sql: query })
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to fetch dataset: ${response.status} - ${error}`);
      }

      const data = await response.json();
      console.log(`✅ Fetched ${data.rows?.length || 0} records from Domo`);

      // Transform rows to objects using columns
      if (data.columns && data.rows) {
        return data.rows.map(row => {
          const obj = {};
          data.columns.forEach((col, idx) => {
            obj[col] = row[idx];
          });
          return obj;
        });
      }

      return data.rows || [];
    } catch (error) {
      console.error('❌ Error fetching Domo dataset:', error.message);
      throw error;
    }
  }

  /**
   * Fetch all records in batches
   */
  async fetchAllRecords(datasetId, options = {}) {
    const batchSize = 10000;
    let offset = 0;
    let allRecords = [];
    let hasMore = true;

    while (hasMore) {
      const batch = await this.fetchDataset(datasetId, {
        ...options,
        limit: batchSize,
        offset
      });

      allRecords = allRecords.concat(batch);

      if (batch.length < batchSize) {
        hasMore = false;
      } else {
        offset += batchSize;
        console.log(`   Fetched ${allRecords.length} records so far...`);
      }
    }

    return allRecords;
  }

  /**
   * Get dataset metadata
   */
  async getDatasetInfo(datasetId) {
    await this.ensureAuthenticated();

    const url = `https://api.domo.com/v1/datasets/${datasetId}`;

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to get dataset info: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('❌ Error getting dataset info:', error.message);
      throw error;
    }
  }

  /**
   * Export full dataset data (no truncation) with streaming and filtering
   * Uses the Data Export API which returns complete records including full text fields
   * @param {string} datasetId - The dataset GUID
   * @param {Object} options - Filter options
   * @param {string} options.startDate - Only return records >= this date (YYYY-MM-DD)
   * @param {string} options.endDate - Only return records <= this date (YYYY-MM-DD)
   * @param {number} options.limit - Maximum records to return
   * @returns {Promise<Array>} Array of complete filtered records
   */
  async exportDatasetFull(datasetId, options = {}) {
    await this.ensureAuthenticated();

    const { startDate, endDate, limit } = options;
    const url = `https://api.domo.com/v1/datasets/${datasetId}/data?includeHeader=true`;

    try {
      console.log(`📥 Exporting full dataset with streaming (no truncation)...`);
      if (startDate || endDate) {
        console.log(`   Filtering: ${startDate || 'beginning'} to ${endDate || 'now'}`);
      }

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Accept': 'text/csv'
        }
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to export dataset: ${response.status} - ${error}`);
      }

      // Stream the CSV response
      const records = [];
      let totalProcessed = 0;
      let filteredCount = 0;

      await new Promise((resolve, reject) => {
        // response.body is already a Node.js readable stream in node-fetch
        const parser = csvParser();

        response.body
          .pipe(parser)
          .on('data', (record) => {
            totalProcessed++;

            // Apply date filters
            let include = true;

            if (startDate || endDate) {
              const callDate = record.CallStartDateTime;
              if (!callDate) {
                include = false;
              } else {
                const date = new Date(callDate);

                if (startDate && date < new Date(startDate)) {
                  include = false;
                }

                if (endDate && date >= new Date(new Date(endDate).getTime() + 24 * 60 * 60 * 1000)) {
                  include = false;
                }
              }
            }

            // Add to results if it passes filters
            if (include) {
              filteredCount++;
              records.push(record);

              // Check limit
              if (limit && filteredCount >= limit) {
                parser.destroy(); // Stop reading more data
                resolve(); // Resolve immediately when limit reached
              }
            }

            // Progress indicator every 10K records
            if (totalProcessed % 10000 === 0) {
              console.log(`   Processed ${totalProcessed.toLocaleString()} records, kept ${filteredCount.toLocaleString()}...`);
            }
          })
          .on('end', () => {
            console.log(`✅ Processed ${totalProcessed.toLocaleString()} total records`);
            console.log(`✅ Filtered to ${filteredCount.toLocaleString()} matching records`);
            resolve();
          })
          .on('error', (error) => {
            reject(error);
          });
      });

      return records;

    } catch (error) {
      console.error('❌ Error exporting dataset:', error.message);
      throw error;
    }
  }
}
