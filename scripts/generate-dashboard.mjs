#!/usr/bin/env node

import dotenv from 'dotenv';
import fs from 'fs';
import pg from 'pg';

dotenv.config({ path: '.env.local' });

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function generateDashboard() {
  console.log('📊 Generating HTML Dashboard...\n');

  // Get analyzed transcripts with AI data
  const analyzed = await pool.query(`
    SELECT
      t.vendor_call_key,
      t.agent_name,
      t.department,
      t.disposition,
      t.duration_seconds,
      t.call_start,
      t.messages,
      a."agentSentiment",
      a."agentSentimentScore",
      a."customerSentiment",
      a."customerSentimentScore",
      a."aiDiscoveredTopic",
      a."aiDiscoveredSubcategory",
      a."topicConfidence",
      a."keyIssues",
      a.resolution,
      a.tags
    FROM transcripts t
    INNER JOIN "TranscriptAnalysis" a ON t.vendor_call_key = a."vendorCallKey"
    ORDER BY t.call_start DESC
    LIMIT 100
  `);

  // Get unanalyzed transcripts
  const unanalyzed = await pool.query(`
    SELECT
      t.vendor_call_key,
      t.agent_name,
      t.department,
      t.disposition,
      t.duration_seconds,
      t.call_start,
      t.messages
    FROM transcripts t
    LEFT JOIN "TranscriptAnalysis" a ON t.vendor_call_key = a."vendorCallKey"
    WHERE a."vendorCallKey" IS NULL
    ORDER BY t.call_start DESC
    LIMIT 100
  `);

  // Get statistics
  const stats = await pool.query(`
    SELECT
      (SELECT COUNT(*) FROM transcripts) as total_transcripts,
      (SELECT COUNT(*) FROM "TranscriptAnalysis") as analyzed_count,
      (SELECT COUNT(DISTINCT "aiDiscoveredTopic") FROM "TranscriptAnalysis") as unique_topics,
      (SELECT AVG("agentSentimentScore") FROM "TranscriptAnalysis") as avg_agent_score,
      (SELECT AVG("customerSentimentScore") FROM "TranscriptAnalysis") as avg_customer_score
  `);

  // Get sentiment distribution
  const sentiments = await pool.query(`
    SELECT
      "agentSentiment",
      COUNT(*) as count
    FROM "TranscriptAnalysis"
    GROUP BY "agentSentiment"
    ORDER BY count DESC
  `);

  // Get top topics
  const topics = await pool.query(`
    SELECT
      "aiDiscoveredTopic",
      COUNT(*) as count,
      AVG("topicConfidence") as avg_confidence
    FROM "TranscriptAnalysis"
    GROUP BY "aiDiscoveredTopic"
    ORDER BY count DESC
    LIMIT 10
  `);

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Transcript Analysis Dashboard</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: 20px;
      color: #333;
    }
    .container { max-width: 1400px; margin: 0 auto; }
    h1 {
      color: white;
      text-align: center;
      margin-bottom: 30px;
      font-size: 2.5rem;
      text-shadow: 2px 2px 4px rgba(0,0,0,0.2);
    }
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
      margin-bottom: 30px;
    }
    .stat-card {
      background: white;
      padding: 25px;
      border-radius: 12px;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
      text-align: center;
    }
    .stat-number {
      font-size: 2.5rem;
      font-weight: bold;
      color: #667eea;
      margin-bottom: 5px;
    }
    .stat-label {
      font-size: 0.9rem;
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
    }
    table {
      width: 100%;
      border-collapse: collapse;
    }
    th {
      background: #f8f9fa;
      padding: 12px;
      text-align: left;
      font-weight: 600;
      border-bottom: 2px solid #dee2e6;
      position: sticky;
      top: 0;
    }
    td {
      padding: 10px 12px;
      border-bottom: 1px solid #e9ecef;
    }
    tr:hover {
      background: #f8f9fa;
    }
    .badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 0.85rem;
      font-weight: 500;
    }
    .badge-positive { background: #d4edda; color: #155724; }
    .badge-neutral { background: #fff3cd; color: #856404; }
    .badge-negative { background: #f8d7da; color: #721c24; }
    .badge-tag { background: #e7f3ff; color: #004085; margin: 2px; }
    .score {
      font-weight: bold;
      font-size: 1.1rem;
    }
    .comparison-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      margin-bottom: 20px;
    }
    .comparison-card {
      background: white;
      border-radius: 8px;
      overflow: hidden;
    }
    .comparison-header {
      padding: 15px;
      font-weight: bold;
      font-size: 1.1rem;
    }
    .enhanced { background: #d4edda; color: #155724; }
    .raw { background: #f8d7da; color: #721c24; }
    .table-container {
      max-height: 400px;
      overflow-y: auto;
    }
    .progress-bar {
      width: 100%;
      height: 30px;
      background: #e9ecef;
      border-radius: 15px;
      overflow: hidden;
      margin: 10px 0;
    }
    .progress-fill {
      height: 100%;
      background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-weight: bold;
      transition: width 0.3s ease;
    }
    .topic-bar {
      margin: 10px 0;
    }
    .topic-name {
      font-weight: 500;
      margin-bottom: 5px;
    }
    .topic-bar-fill {
      height: 25px;
      background: #667eea;
      border-radius: 5px;
      display: flex;
      align-items: center;
      padding: 0 10px;
      color: white;
      font-size: 0.9rem;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>📊 Transcript Analysis Dashboard</h1>

    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-number">${stats.rows[0].total_transcripts.toLocaleString()}</div>
        <div class="stat-label">Total Transcripts</div>
      </div>
      <div class="stat-card">
        <div class="stat-number">${stats.rows[0].analyzed_count.toLocaleString()}</div>
        <div class="stat-label">AI Enhanced</div>
      </div>
      <div class="stat-card">
        <div class="stat-number">${stats.rows[0].unique_topics}</div>
        <div class="stat-label">Unique Topics</div>
      </div>
      <div class="stat-card">
        <div class="stat-number">${(parseFloat(stats.rows[0].avg_agent_score) * 100).toFixed(1)}%</div>
        <div class="stat-label">Avg Agent Score</div>
      </div>
      <div class="stat-card">
        <div class="stat-number">${(parseFloat(stats.rows[0].avg_customer_score) * 100).toFixed(1)}%</div>
        <div class="stat-label">Avg Customer Score</div>
      </div>
    </div>

    <div class="section">
      <h2>Analysis Progress</h2>
      <div class="progress-bar">
        <div class="progress-fill" style="width: ${(stats.rows[0].analyzed_count / stats.rows[0].total_transcripts * 100).toFixed(1)}%">
          ${(stats.rows[0].analyzed_count / stats.rows[0].total_transcripts * 100).toFixed(1)}% Complete
        </div>
      </div>
      <p style="text-align: center; margin-top: 10px; color: #666;">
        ${stats.rows[0].analyzed_count.toLocaleString()} of ${stats.rows[0].total_transcripts.toLocaleString()} transcripts analyzed
        (${(stats.rows[0].total_transcripts - stats.rows[0].analyzed_count).toLocaleString()} remaining)
      </p>
    </div>

    <div class="comparison-grid">
      <div class="section">
        <h2>Top 10 Topics Discovered</h2>
        ${topics.rows.map(t => `
          <div class="topic-bar">
            <div class="topic-name">${t.aiDiscoveredTopic} (${t.count} calls)</div>
            <div class="topic-bar-fill" style="width: ${(t.count / topics.rows[0].count * 100)}%">
              ${(parseFloat(t.avg_confidence) * 100).toFixed(0)}% confidence
            </div>
          </div>
        `).join('')}
      </div>

      <div class="section">
        <h2>Agent Sentiment Distribution</h2>
        ${sentiments.rows.map(s => `
          <div class="topic-bar">
            <div class="topic-name">${s.agentSentiment} (${s.count} calls)</div>
            <div class="topic-bar-fill" style="width: ${(s.count / sentiments.rows[0].count * 100)}%; background: ${
              s.agentSentiment === 'positive' ? '#28a745' :
              s.agentSentiment === 'negative' ? '#dc3545' : '#ffc107'
            }">
              ${((s.count / stats.rows[0].analyzed_count) * 100).toFixed(1)}%
            </div>
          </div>
        `).join('')}
      </div>
    </div>

    <div class="comparison-grid">
      <div class="comparison-card">
        <div class="comparison-header enhanced">✅ AI-Enhanced Transcripts (${analyzed.rows.length} shown)</div>
        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th>Call ID</th>
                <th>Agent</th>
                <th>Agent Score</th>
                <th>Customer Score</th>
                <th>Topic</th>
                <th>Tags</th>
              </tr>
            </thead>
            <tbody>
              ${analyzed.rows.map(row => `
                <tr>
                  <td>${row.vendor_call_key.substring(0, 8)}...</td>
                  <td>${row.agent_name || 'Unknown'}</td>
                  <td>
                    <span class="badge badge-${row.agentSentiment}">${row.agentSentiment}</span>
                    <span class="score">${(row.agentSentimentScore * 100).toFixed(0)}%</span>
                  </td>
                  <td>
                    <span class="badge badge-${row.customerSentiment}">${row.customerSentiment}</span>
                    <span class="score">${(row.customerSentimentScore * 100).toFixed(0)}%</span>
                  </td>
                  <td>${row.aiDiscoveredTopic}</td>
                  <td>
                    ${row.tags.slice(0, 3).map(tag => `<span class="badge badge-tag">${tag}</span>`).join(' ')}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <div class="comparison-card">
        <div class="comparison-header raw">⏳ Raw Transcripts (Not Yet Analyzed - ${unanalyzed.rows.length} shown)</div>
        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th>Call ID</th>
                <th>Agent</th>
                <th>Department</th>
                <th>Disposition</th>
                <th>Duration</th>
                <th>Messages</th>
              </tr>
            </thead>
            <tbody>
              ${unanalyzed.rows.map(row => `
                <tr>
                  <td>${row.vendor_call_key.substring(0, 8)}...</td>
                  <td>${row.agent_name || 'Unknown'}</td>
                  <td>${row.department || 'Unknown'}</td>
                  <td>${row.disposition || 'Unknown'}</td>
                  <td>${row.duration_seconds || 0}s</td>
                  <td>${row.messages.length} msgs</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <div class="section">
      <h2>Sample AI-Enhanced Records (Full Detail) - 10 Examples</h2>
      ${analyzed.rows.slice(0, 10).map((row, idx) => `
        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-top: 15px; ${idx > 0 ? 'border-top: 3px solid #667eea; padding-top: 30px;' : ''}">
          <h3 style="color: #667eea; margin-bottom: 15px;">Example ${idx + 1} of 10 - Call ID: ${row.vendor_call_key}</h3>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px;">
            <div>
              <h4 style="color: #333; margin-bottom: 10px;">📊 Basic Info</h4>
              <p><strong>Agent:</strong> ${row.agent_name || 'Unknown'}</p>
              <p><strong>Department:</strong> ${row.department || 'Unknown'}</p>
              <p><strong>Duration:</strong> ${row.duration_seconds || 0} seconds</p>
              <p><strong>Messages:</strong> ${row.messages.length} total</p>
            </div>

            <div>
              <h4 style="color: #333; margin-bottom: 10px;">🤖 AI Analysis</h4>
              <p><strong>Topic:</strong> ${row.aiDiscoveredTopic} / ${row.aiDiscoveredSubcategory}</p>
              <p><strong>Confidence:</strong> ${(row.topicConfidence * 100).toFixed(0)}%</p>
              <p><strong>Resolution:</strong> ${row.resolution || 'N/A'}</p>
            </div>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px;">
            <div>
              <h4 style="color: #333; margin-bottom: 10px;">👤 Agent Performance</h4>
              <p><span class="badge badge-${row.agentSentiment}">${row.agentSentiment}</span> <span class="score">${(row.agentSentimentScore * 100).toFixed(0)}%</span></p>
            </div>

            <div>
              <h4 style="color: #333; margin-bottom: 10px;">😊 Customer Satisfaction</h4>
              <p><span class="badge badge-${row.customerSentiment}">${row.customerSentiment}</span> <span class="score">${(row.customerSentimentScore * 100).toFixed(0)}%</span></p>
            </div>
          </div>

          <div style="margin-bottom: 20px;">
            <h4 style="color: #333; margin-bottom: 10px;">🔑 Key Issues</h4>
            <ul style="margin-left: 20px;">
              ${row.keyIssues.map(issue => `<li>${issue}</li>`).join('')}
            </ul>
          </div>

          <div>
            <h4 style="color: #333; margin-bottom: 10px;">🏷️ Tags</h4>
            ${row.tags.map(tag => `<span class="badge badge-tag">${tag}</span>`).join(' ')}
          </div>

          <div style="margin-top: 20px;">
            <h4 style="color: #333; margin-bottom: 10px;">💬 Complete Conversation (${row.messages.length} messages)</h4>
            <div style="background: white; padding: 15px; border-radius: 5px; max-height: 500px; overflow-y: auto;">
              ${row.messages.map((msg, i) => `
                <p style="margin-bottom: 10px; padding: 10px; background: ${msg.speaker === 'Agent' ? '#e7f3ff' : '#f8f9fa'}; border-radius: 4px; border-left: 4px solid ${msg.speaker === 'Agent' ? '#667eea' : '#6c757d'};">
                  <strong style="color: ${msg.speaker === 'Agent' ? '#667eea' : '#6c757d'};">${msg.speaker} (Message ${i + 1}):</strong><br/>
                  ${msg.text}
                </p>
              `).join('')}
            </div>
          </div>
        </div>
      `).join('')}
    </div>

    <div style="text-align: center; color: white; margin-top: 30px; padding: 20px;">
      <p style="font-size: 0.9rem;">Generated on ${new Date().toLocaleString()}</p>
      <p style="font-size: 0.9rem; margin-top: 5px;">Database: Neon PostgreSQL | AI Model: Claude 3.5 Sonnet</p>
    </div>
  </div>
</body>
</html>`;

  const outputPath = 'C:\\Users\\Mark Hansen\\Desktop\\transcript-analysis-dashboard.html';
  fs.writeFileSync(outputPath, html);
  console.log(`✅ Dashboard saved to: ${outputPath}\n`);

  await pool.end();
}

generateDashboard().catch(error => {
  console.error('Error:', error);
  pool.end();
  process.exit(1);
});
