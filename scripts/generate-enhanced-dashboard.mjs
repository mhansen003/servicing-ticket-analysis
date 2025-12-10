#!/usr/bin/env node

/**
 * Enhanced Dashboard Generator
 * Uses the new TranscriptAnalysis schema to create comprehensive reports
 */

import dotenv from 'dotenv';
import fs from 'fs';
import pg from 'pg';

dotenv.config({ path: '.env.local' });

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function generateEnhancedDashboard() {
  console.log('📊 Generating Enhanced Dashboard with Advanced Analytics...\n');

  // Get comprehensive statistics
  const stats = await pool.query(`
    SELECT
      (SELECT COUNT(*) FROM transcripts) as total_transcripts,
      (SELECT COUNT(*) FROM "TranscriptAnalysis") as analyzed_count,
      (SELECT COUNT(DISTINCT "aiDiscoveredTopic") FROM "TranscriptAnalysis") as unique_topics,
      (SELECT COUNT(DISTINCT "agentName") FROM "TranscriptAnalysis" WHERE "agentName" IS NOT NULL) as unique_agents,
      (SELECT AVG("agentSentimentScore") FROM "TranscriptAnalysis") as avg_agent_score,
      (SELECT AVG("customerSentimentScore") FROM "TranscriptAnalysis") as avg_customer_score,
      (SELECT AVG("topicConfidence") FROM "TranscriptAnalysis") as avg_confidence
  `);

  // Get sentiment distribution
  const agentSentiment = await pool.query(`
    SELECT "agentSentiment", COUNT(*) as count
    FROM "TranscriptAnalysis"
    WHERE "agentSentiment" IS NOT NULL
    GROUP BY "agentSentiment"
    ORDER BY count DESC
  `);

  const customerSentiment = await pool.query(`
    SELECT "customerSentiment", COUNT(*) as count
    FROM "TranscriptAnalysis"
    WHERE "customerSentiment" IS NOT NULL
    GROUP BY "customerSentiment"
    ORDER BY count DESC
  `);

  // Get top topics with detailed stats
  const topTopics = await pool.query(`
    SELECT
      "aiDiscoveredTopic",
      COUNT(*) as count,
      AVG("topicConfidence") as avg_confidence,
      AVG("agentSentimentScore") as avg_agent_score,
      AVG("customerSentimentScore") as avg_customer_score
    FROM "TranscriptAnalysis"
    WHERE "aiDiscoveredTopic" IS NOT NULL
    GROUP BY "aiDiscoveredTopic"
    ORDER BY count DESC
    LIMIT 15
  `);

  // Get top subcategories
  const topSubcategories = await pool.query(`
    SELECT
      "aiDiscoveredSubcategory",
      COUNT(*) as count,
      AVG("topicConfidence") as avg_confidence
    FROM "TranscriptAnalysis"
    WHERE "aiDiscoveredSubcategory" IS NOT NULL
    GROUP BY "aiDiscoveredSubcategory"
    ORDER BY count DESC
    LIMIT 15
  `);

  // Get most common key issues
  const commonIssues = await pool.query(`
    SELECT issue, COUNT(*) as count
    FROM "TranscriptAnalysis", unnest("keyIssues") as issue
    WHERE "keyIssues" IS NOT NULL
    GROUP BY issue
    ORDER BY count DESC
    LIMIT 20
  `);

  // Get most common tags with performance metrics
  const commonTags = await pool.query(`
    SELECT
      tag,
      COUNT(*) as count,
      AVG("agentSentimentScore") as avg_agent_score,
      AVG("customerSentimentScore") as avg_customer_score,
      AVG("topicConfidence") as avg_confidence
    FROM "TranscriptAnalysis", unnest(tags) as tag
    WHERE tags IS NOT NULL
    GROUP BY tag
    ORDER BY count DESC
    LIMIT 50
  `);

  // Get resolution status distribution
  const resolutions = await pool.query(`
    SELECT resolution, COUNT(*) as count
    FROM "TranscriptAnalysis"
    WHERE resolution IS NOT NULL
    GROUP BY resolution
    ORDER BY count DESC
    LIMIT 10
  `);

  // Get top performing agents
  const topAgents = await pool.query(`
    SELECT
      "agentName",
      COUNT(*) as call_count,
      AVG("agentSentimentScore") as avg_agent_score,
      AVG("customerSentimentScore") as avg_customer_score
    FROM "TranscriptAnalysis"
    WHERE "agentName" IS NOT NULL AND "agentName" != 'Unknown'
    GROUP BY "agentName"
    HAVING COUNT(*) >= 5
    ORDER BY avg_customer_score DESC
    LIMIT 20
  `);

  // Get sample analyzed records for detailed view
  const sampleRecords = await pool.query(`
    SELECT
      t.vendor_call_key,
      t.agent_name,
      t.department,
      t.disposition,
      t.duration_seconds,
      t.call_start,
      t.messages,
      a.*
    FROM transcripts t
    INNER JOIN "TranscriptAnalysis" a ON t.vendor_call_key = a."vendorCallKey"
    ORDER BY t.call_start DESC
    LIMIT 20
  `);

  const html = generateHTML(stats.rows[0], {
    agentSentiment: agentSentiment.rows,
    customerSentiment: customerSentiment.rows,
    topTopics: topTopics.rows,
    topSubcategories: topSubcategories.rows,
    commonIssues: commonIssues.rows,
    commonTags: commonTags.rows,
    resolutions: resolutions.rows,
    topAgents: topAgents.rows,
    sampleRecords: sampleRecords.rows
  });

  const outputPath = 'C:\\Users\\Mark Hansen\\Desktop\\enhanced-transcript-dashboard.html';
  fs.writeFileSync(outputPath, html);
  console.log(`✅ Enhanced Dashboard saved to: ${outputPath}\n`);

  await pool.end();
}

function generateHTML(stats, data) {
  const progressPercent = (stats.analyzed_count / stats.total_transcripts * 100).toFixed(1);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Enhanced Transcript Analysis Dashboard</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: 20px;
      color: #333;
    }
    .container { max-width: 1600px; margin: 0 auto; }
    h1 {
      color: white;
      text-align: center;
      margin-bottom: 10px;
      font-size: 2.8rem;
      text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
    }
    .subtitle {
      color: rgba(255,255,255,0.9);
      text-align: center;
      margin-bottom: 30px;
      font-size: 1.1rem;
    }
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 15px;
      margin-bottom: 25px;
    }
    .stat-card {
      background: white;
      padding: 20px;
      border-radius: 12px;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
      text-align: center;
      transition: transform 0.2s;
    }
    .stat-card:hover { transform: translateY(-5px); }
    .stat-number {
      font-size: 2.2rem;
      font-weight: bold;
      color: #667eea;
      margin-bottom: 5px;
    }
    .stat-label {
      font-size: 0.85rem;
      color: #666;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    .section {
      background: white;
      border-radius: 12px;
      padding: 25px;
      margin-bottom: 20px;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    }
    .section h2 {
      margin-bottom: 20px;
      color: #667eea;
      border-bottom: 3px solid #667eea;
      padding-bottom: 10px;
      font-size: 1.5rem;
    }
    .grid-2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
    }
    .grid-3 {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 20px;
    }
    @media (max-width: 1200px) {
      .grid-2, .grid-3 { grid-template-columns: 1fr; }
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.9rem;
    }
    th {
      background: #f8f9fa;
      padding: 12px 10px;
      text-align: left;
      font-weight: 600;
      border-bottom: 2px solid #dee2e6;
      position: sticky;
      top: 0;
    }
    td {
      padding: 10px;
      border-bottom: 1px solid #e9ecef;
    }
    tr:hover { background: #f8f9fa; }
    .badge {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 15px;
      font-size: 0.8rem;
      font-weight: 500;
    }
    .badge-positive { background: #d4edda; color: #155724; }
    .badge-neutral { background: #fff3cd; color: #856404; }
    .badge-negative { background: #f8d7da; color: #721c24; }
    .badge-tag { background: #e7f3ff; color: #004085; margin: 2px; }
    .progress-bar {
      width: 100%;
      height: 35px;
      background: #e9ecef;
      border-radius: 20px;
      overflow: hidden;
      margin: 15px 0;
    }
    .progress-fill {
      height: 100%;
      background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-weight: bold;
      font-size: 1.1rem;
      transition: width 0.3s ease;
    }
    .bar-chart {
      margin: 15px 0;
    }
    .bar-item {
      margin-bottom: 12px;
    }
    .bar-label {
      display: flex;
      justify-content: space-between;
      margin-bottom: 5px;
      font-size: 0.9rem;
      font-weight: 500;
    }
    .bar-fill {
      height: 28px;
      background: #667eea;
      border-radius: 5px;
      display: flex;
      align-items: center;
      padding: 0 12px;
      color: white;
      font-size: 0.85rem;
      font-weight: 500;
    }
    .score-badge {
      font-weight: bold;
      font-size: 1rem;
    }
    .tag-cloud {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 15px;
    }
    .tag-item {
      padding: 8px 16px;
      background: #e7f3ff;
      border-radius: 20px;
      font-size: 0.9rem;
      color: #004085;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .tag-count {
      background: #667eea;
      color: white;
      padding: 2px 8px;
      border-radius: 10px;
      font-size: 0.75rem;
      font-weight: bold;
    }
    .info-box {
      background: #f8f9fa;
      padding: 15px;
      border-radius: 8px;
      border-left: 4px solid #667eea;
      margin: 15px 0;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>📊 Enhanced Transcript Analysis Dashboard</h1>
    <p class="subtitle">Comprehensive AI-Powered Customer Service Analytics</p>

    <!-- Key Statistics -->
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-number">${stats.total_transcripts.toLocaleString()}</div>
        <div class="stat-label">Total Transcripts</div>
      </div>
      <div class="stat-card">
        <div class="stat-number">${stats.analyzed_count.toLocaleString()}</div>
        <div class="stat-label">AI Analyzed</div>
      </div>
      <div class="stat-card">
        <div class="stat-number">${stats.unique_topics}</div>
        <div class="stat-label">Unique Topics</div>
      </div>
      <div class="stat-card">
        <div class="stat-number">${stats.unique_agents}</div>
        <div class="stat-label">Agents Tracked</div>
      </div>
      <div class="stat-card">
        <div class="stat-number">${(parseFloat(stats.avg_agent_score || 0) * 100).toFixed(1)}%</div>
        <div class="stat-label">Avg Agent Score</div>
      </div>
      <div class="stat-card">
        <div class="stat-number">${(parseFloat(stats.avg_customer_score || 0) * 100).toFixed(1)}%</div>
        <div class="stat-label">Avg Customer Score</div>
      </div>
      <div class="stat-card">
        <div class="stat-number">${(parseFloat(stats.avg_confidence || 0) * 100).toFixed(0)}%</div>
        <div class="stat-label">Avg Topic Confidence</div>
      </div>
    </div>

    <!-- Progress -->
    <div class="section">
      <h2>📈 Analysis Progress</h2>
      <div class="progress-bar">
        <div class="progress-fill" style="width: ${progressPercent}%">
          ${progressPercent}% Complete (${stats.analyzed_count.toLocaleString()} / ${stats.total_transcripts.toLocaleString()})
        </div>
      </div>
      <div class="info-box">
        <strong>Status:</strong> ${stats.analyzed_count < stats.total_transcripts ?
          `Analysis in progress... ${(stats.total_transcripts - stats.analyzed_count).toLocaleString()} transcripts remaining` :
          'All transcripts fully analyzed!'
        }
      </div>
    </div>

    <!-- Sentiment Analysis -->
    <div class="grid-2">
      <div class="section">
        <h2>👤 Agent Performance Distribution</h2>
        <div class="bar-chart">
          ${data.agentSentiment.map(s => `
            <div class="bar-item">
              <div class="bar-label">
                <span>${s.agentSentiment.charAt(0).toUpperCase() + s.agentSentiment.slice(1)}</span>
                <span>${s.count.toLocaleString()} calls</span>
              </div>
              <div class="bar-fill" style="width: ${(s.count / data.agentSentiment[0].count * 100)}%; background: ${
                s.agentSentiment === 'positive' ? '#28a745' :
                s.agentSentiment === 'negative' ? '#dc3545' : '#ffc107'
              }">
                ${((s.count / stats.analyzed_count) * 100).toFixed(1)}% of total
              </div>
            </div>
          `).join('')}
        </div>
      </div>

      <div class="section">
        <h2>😊 Customer Satisfaction Distribution</h2>
        <div class="bar-chart">
          ${data.customerSentiment.map(s => `
            <div class="bar-item">
              <div class="bar-label">
                <span>${s.customerSentiment.charAt(0).toUpperCase() + s.customerSentiment.slice(1)}</span>
                <span>${s.count.toLocaleString()} calls</span>
              </div>
              <div class="bar-fill" style="width: ${(s.count / data.customerSentiment[0].count * 100)}%; background: ${
                s.customerSentiment === 'positive' ? '#28a745' :
                s.customerSentiment === 'negative' ? '#dc3545' : '#ffc107'
              }">
                ${((s.count / stats.analyzed_count) * 100).toFixed(1)}% of total
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    </div>

    <!-- Top Topics -->
    <div class="section">
      <h2>🎯 Top 15 Call Topics (AI-Discovered)</h2>
      <table>
        <thead>
          <tr>
            <th>Rank</th>
            <th>Topic</th>
            <th>Call Count</th>
            <th>% of Total</th>
            <th>Avg Confidence</th>
            <th>Avg Agent Score</th>
            <th>Avg Customer Score</th>
          </tr>
        </thead>
        <tbody>
          ${data.topTopics.map((t, i) => `
            <tr>
              <td><strong>${i + 1}</strong></td>
              <td><strong>${t.aiDiscoveredTopic}</strong></td>
              <td>${t.count.toLocaleString()}</td>
              <td>${((t.count / stats.analyzed_count) * 100).toFixed(1)}%</td>
              <td><span class="score-badge">${(parseFloat(t.avg_confidence) * 100).toFixed(0)}%</span></td>
              <td><span class="score-badge">${(parseFloat(t.avg_agent_score) * 100).toFixed(0)}%</span></td>
              <td><span class="score-badge">${(parseFloat(t.avg_customer_score) * 100).toFixed(0)}%</span></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>

    <!-- Top Subcategories -->
    <div class="section">
      <h2>📂 Top 15 Subcategories</h2>
      <table>
        <thead>
          <tr>
            <th>Rank</th>
            <th>Subcategory</th>
            <th>Call Count</th>
            <th>% of Total</th>
            <th>Avg Confidence</th>
          </tr>
        </thead>
        <tbody>
          ${data.topSubcategories.map((s, i) => `
            <tr>
              <td><strong>${i + 1}</strong></td>
              <td>${s.aiDiscoveredSubcategory}</td>
              <td>${s.count.toLocaleString()}</td>
              <td>${((s.count / stats.analyzed_count) * 100).toFixed(1)}%</td>
              <td><span class="score-badge">${(parseFloat(s.avg_confidence) * 100).toFixed(0)}%</span></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>

    <!-- Common Issues -->
    <div class="section">
      <h2>🔑 Top 20 Most Common Key Issues</h2>
      <table>
        <thead>
          <tr>
            <th>Rank</th>
            <th>Issue</th>
            <th>Occurrence Count</th>
            <th>% of Analyzed Calls</th>
          </tr>
        </thead>
        <tbody>
          ${data.commonIssues.map((issue, i) => `
            <tr>
              <td><strong>${i + 1}</strong></td>
              <td>${issue.issue}</td>
              <td>${issue.count.toLocaleString()}</td>
              <td>${((issue.count / stats.analyzed_count) * 100).toFixed(1)}%</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>

    <!-- AI-Discovered Tags Breakdown -->
    <div class="section">
      <h2>🏷️ Top 50 AI-Discovered Tags with Performance Metrics</h2>
      <table>
        <thead>
          <tr>
            <th>Rank</th>
            <th>Tag</th>
            <th>Call Count</th>
            <th>% of Total</th>
            <th>Avg Confidence</th>
            <th>Avg Agent Score</th>
            <th>Avg Customer Score</th>
          </tr>
        </thead>
        <tbody>
          ${data.commonTags.map((tag, i) => `
            <tr>
              <td><strong>${i + 1}</strong></td>
              <td><strong>${tag.tag}</strong></td>
              <td>${tag.count.toLocaleString()}</td>
              <td>${((tag.count / stats.analyzed_count) * 100).toFixed(1)}%</td>
              <td><span class="score-badge">${(parseFloat(tag.avg_confidence || 0) * 100).toFixed(0)}%</span></td>
              <td><span class="score-badge">${(parseFloat(tag.avg_agent_score || 0) * 100).toFixed(0)}%</span></td>
              <td><span class="score-badge">${(parseFloat(tag.avg_customer_score || 0) * 100).toFixed(0)}%</span></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>

    <!-- Resolution Status -->
    <div class="section">
      <h2>✅ Resolution Status Distribution</h2>
      <div class="bar-chart">
        ${data.resolutions.map(r => `
          <div class="bar-item">
            <div class="bar-label">
              <span>${r.resolution}</span>
              <span>${r.count.toLocaleString()} calls</span>
            </div>
            <div class="bar-fill" style="width: ${(r.count / data.resolutions[0].count * 100)}%">
              ${((r.count / stats.analyzed_count) * 100).toFixed(1)}% of total
            </div>
          </div>
        `).join('')}
      </div>
    </div>

    <!-- Top Performing Agents -->
    <div class="section">
      <h2>⭐ Top 20 Performing Agents (by Customer Satisfaction)</h2>
      <table>
        <thead>
          <tr>
            <th>Rank</th>
            <th>Agent Name</th>
            <th>Total Calls</th>
            <th>Avg Agent Performance</th>
            <th>Avg Customer Satisfaction</th>
          </tr>
        </thead>
        <tbody>
          ${data.topAgents.map((agent, i) => `
            <tr>
              <td><strong>${i + 1}</strong></td>
              <td>${agent.agentName}</td>
              <td>${agent.call_count}</td>
              <td><span class="score-badge">${(parseFloat(agent.avg_agent_score) * 100).toFixed(0)}%</span></td>
              <td><span class="score-badge" style="color: #28a745;">${(parseFloat(agent.avg_customer_score) * 100).toFixed(0)}%</span></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>

    <!-- Sample Records -->
    <div class="section">
      <h2>📋 Recent Analyzed Transcripts (Latest 20)</h2>
      <table>
        <thead>
          <tr>
            <th>Call ID</th>
            <th>Agent</th>
            <th>Topic / Subcategory</th>
            <th>Agent Performance</th>
            <th>Customer Satisfaction</th>
            <th>Resolution</th>
            <th>Analyzed</th>
          </tr>
        </thead>
        <tbody>
          ${data.sampleRecords.map(r => `
            <tr>
              <td>${r.vendor_call_key.substring(0, 8)}...</td>
              <td>${r.agentName || 'Unknown'}</td>
              <td><strong>${r.aiDiscoveredTopic}</strong> / ${r.aiDiscoveredSubcategory}</td>
              <td>
                <span class="badge badge-${r.agentSentiment}">${r.agentSentiment}</span>
                <span class="score-badge">${(r.agentSentimentScore * 100).toFixed(0)}%</span>
              </td>
              <td>
                <span class="badge badge-${r.customerSentiment}">${r.customerSentiment}</span>
                <span class="score-badge">${(r.customerSentimentScore * 100).toFixed(0)}%</span>
              </td>
              <td>${r.resolution || 'N/A'}</td>
              <td>${new Date(r.analyzedAt).toLocaleDateString()}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>

    <!-- Footer -->
    <div style="text-align: center; color: white; margin-top: 30px; padding: 20px;">
      <p style="font-size: 0.95rem;">Generated on ${new Date().toLocaleString()}</p>
      <p style="font-size: 0.9rem; margin-top: 5px;">Database: Neon PostgreSQL | AI Model: Claude 3.5 Sonnet via OpenRouter</p>
      <p style="font-size: 0.85rem; margin-top: 5px; opacity: 0.8;">Total API Cost: ~$${((stats.analyzed_count * 0.012)).toFixed(2)}</p>
    </div>
  </div>
</body>
</html>`;
}

generateEnhancedDashboard().catch(error => {
  console.error('Error:', error);
  pool.end();
  process.exit(1);
});
