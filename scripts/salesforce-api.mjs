#!/usr/bin/env node

/**
 * Salesforce REST API Client
 *
 * Provides authentication and querying capabilities for Salesforce VoiceCallRecording data.
 * Uses OAuth 2.0 Client Credentials Flow for server-to-server authentication.
 */

import fetch from 'node-fetch';

export class SalesforceAPI {
  constructor(instanceUrl, clientId, clientSecret, apiVersion = 'v61.0', username = null, password = null) {
    this.instanceUrl = instanceUrl;
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.apiVersion = apiVersion;
    this.username = username;
    this.password = password;
    this.accessToken = null;
    this.tokenExpiry = null;
  }

  /**
   * Authenticate using OAuth 2.0 Client Credentials Flow
   *
   * @returns {Promise<string>} Access token
   */
  async authenticateClientCredentials() {
    const tokenUrl = `${this.instanceUrl}/services/oauth2/token`;

    const params = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: this.clientId,
      client_secret: this.clientSecret,
    });

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Salesforce Client Credentials authentication failed: ${response.status} - ${error}`);
    }

    const data = await response.json();
    this.accessToken = data.access_token;
    this.instanceUrl = data.instance_url; // Use returned instance URL

    // Token expires in 2 hours by default, set expiry with 5 min buffer
    this.tokenExpiry = Date.now() + (115 * 60 * 1000);

    console.log('✅ Authenticated with Salesforce API (Client Credentials)');
    return this.accessToken;
  }

  /**
   * Authenticate using OAuth 2.0 Username-Password Flow
   *
   * @returns {Promise<string>} Access token
   */
  async authenticateUsernamePassword() {
    if (!this.username || !this.password) {
      throw new Error('Username and password are required for Username-Password flow');
    }

    const tokenUrl = `${this.instanceUrl}/services/oauth2/token`;

    const params = new URLSearchParams({
      grant_type: 'password',
      client_id: this.clientId,
      client_secret: this.clientSecret,
      username: this.username,
      password: this.password,
    });

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Salesforce Username-Password authentication failed: ${response.status} - ${error}`);
    }

    const data = await response.json();
    this.accessToken = data.access_token;
    this.instanceUrl = data.instance_url; // Use returned instance URL

    // Token expires in 2 hours by default, set expiry with 5 min buffer
    this.tokenExpiry = Date.now() + (115 * 60 * 1000);

    console.log('✅ Authenticated with Salesforce API (Username-Password)');
    return this.accessToken;
  }

  /**
   * Authenticate using the best available method
   *
   * @returns {Promise<string>} Access token
   */
  async authenticate() {
    // Try Username-Password flow first if credentials are available
    if (this.username && this.password) {
      try {
        return await this.authenticateUsernamePassword();
      } catch (error) {
        console.warn('⚠️  Username-Password authentication failed, trying Client Credentials...');
        console.warn(`   Error: ${error.message}`);
      }
    }

    // Fall back to Client Credentials flow
    return await this.authenticateClientCredentials();
  }

  /**
   * Get valid access token (authenticate if needed)
   *
   * @returns {Promise<string>} Valid access token
   */
  async getAccessToken() {
    if (!this.accessToken || Date.now() >= this.tokenExpiry) {
      await this.authenticate();
    }
    return this.accessToken;
  }

  /**
   * Execute SOQL Query
   *
   * @param {string} soql - SOQL query string
   * @returns {Promise<Object>} Query results
   */
  async query(soql) {
    const token = await this.getAccessToken();
    const encodedQuery = encodeURIComponent(soql);
    const url = `${this.instanceUrl}/services/data/${this.apiVersion}/query/?q=${encodedQuery}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Salesforce query failed: ${response.status} - ${error}`);
    }

    return await response.json();
  }

  /**
   * Get recording URL for a single VoiceCall
   *
   * @param {string} voiceCallId - Salesforce VoiceCall ID
   * @returns {Promise<Object|null>} Recording data or null if not found
   */
  async getRecordingUrl(voiceCallId) {
    // Query VoiceCallRecording with MediaContentId
    const soql = `SELECT Id, VoiceCallId, MediaContentId, DurationInSeconds, CreatedDate
                  FROM VoiceCallRecording
                  WHERE VoiceCallId = '${voiceCallId}'
                  LIMIT 1`;

    const result = await this.query(soql);

    if (result.totalSize === 0) {
      return null;
    }

    const recording = result.records[0];

    // If there's a MediaContentId, get the ContentVersion URL
    let downloadUrl = null;
    if (recording.MediaContentId) {
      const contentQuery = `SELECT Id, ContentDocumentId, VersionData
                           FROM ContentVersion
                           WHERE ContentDocumentId = '${recording.MediaContentId}'
                           AND IsLatest = true
                           LIMIT 1`;

      const contentResult = await this.query(contentQuery);

      if (contentResult.totalSize > 0) {
        const contentVersionId = contentResult.records[0].Id;
        // Construct download URL
        downloadUrl = `${this.instanceUrl}/services/data/${this.apiVersion}/sobjects/ContentVersion/${contentVersionId}/VersionData`;
      }
    }

    return {
      recordingId: recording.Id,
      voiceCallId: recording.VoiceCallId,
      mediaContentId: recording.MediaContentId,
      downloadUrl: downloadUrl,
      durationInSeconds: recording.DurationInSeconds,
      createdDate: recording.CreatedDate,
    };
  }

  /**
   * Batch get recording URLs for multiple VoiceCalls
   *
   * @param {string[]} voiceCallIds - Array of Salesforce VoiceCall IDs
   * @returns {Promise<Array>} Array of recording data with download URLs
   */
  async getRecordingUrls(voiceCallIds) {
    if (!voiceCallIds || voiceCallIds.length === 0) {
      return [];
    }

    // Salesforce SOQL has a limit on IN clause items (~1000)
    const batchSize = 500;
    const recordings = [];

    for (let i = 0; i < voiceCallIds.length; i += batchSize) {
      const batch = voiceCallIds.slice(i, i + batchSize);
      const ids = batch.map(id => `'${id}'`).join(',');

      const soql = `SELECT Id, VoiceCallId, MediaContentId, DurationInSeconds, CreatedDate
                    FROM VoiceCallRecording
                    WHERE VoiceCallId IN (${ids})`;

      console.log(`   Querying VoiceCallRecording batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(voiceCallIds.length / batchSize)}...`);

      const result = await this.query(soql);
      recordings.push(...result.records);
    }

    // Get ContentVersion URLs for recordings that have MediaContentId
    const mediaContentIds = recordings
      .filter(r => r.MediaContentId)
      .map(r => r.MediaContentId);

    const contentVersionMap = new Map();

    if (mediaContentIds.length > 0) {
      console.log(`   Fetching ContentVersion URLs for ${mediaContentIds.length} recordings...`);

      for (let i = 0; i < mediaContentIds.length; i += batchSize) {
        const batch = mediaContentIds.slice(i, i + batchSize);
        const ids = batch.map(id => `'${id}'`).join(',');

        const contentQuery = `SELECT Id, ContentDocumentId
                             FROM ContentVersion
                             WHERE ContentDocumentId IN (${ids})
                             AND IsLatest = true`;

        const contentResult = await this.query(contentQuery);

        contentResult.records.forEach(cv => {
          const downloadUrl = `${this.instanceUrl}/services/data/${this.apiVersion}/sobjects/ContentVersion/${cv.Id}/VersionData`;
          contentVersionMap.set(cv.ContentDocumentId, downloadUrl);
        });
      }
    }

    // Combine recording data with download URLs
    return recordings.map(rec => ({
      recordingId: rec.Id,
      voiceCallId: rec.VoiceCallId,
      mediaContentId: rec.MediaContentId,
      downloadUrl: rec.MediaContentId ? contentVersionMap.get(rec.MediaContentId) : null,
      durationInSeconds: rec.DurationInSeconds,
      createdDate: rec.CreatedDate,
    }));
  }

  /**
   * Get VoiceCall details by VoiceCallId
   *
   * @param {string} voiceCallId - Salesforce VoiceCall ID
   * @returns {Promise<Object|null>} VoiceCall data or null if not found
   */
  async getVoiceCall(voiceCallId) {
    const soql = `SELECT Id, VendorCallKey, CallStartDateTime, CallEndDateTime,
                         CallDurationInSeconds, CallDisposition
                  FROM VoiceCall
                  WHERE Id = '${voiceCallId}'
                  LIMIT 1`;

    const result = await this.query(soql);

    if (result.totalSize === 0) {
      return null;
    }

    return result.records[0];
  }

  /**
   * Describe VoiceCallRecording object to see available fields
   *
   * @returns {Promise<Object>} Object metadata
   */
  async describeVoiceCallRecording() {
    const token = await this.getAccessToken();
    const url = `${this.instanceUrl}/services/data/${this.apiVersion}/sobjects/VoiceCallRecording/describe`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Salesforce describe failed: ${response.status} - ${error}`);
    }

    return await response.json();
  }
}
