# Deep AI Analysis System

**Comprehensive AI-powered analysis of 23k+ servicing tickets**

## Overview

This system performs advanced AI analysis on all helpdesk tickets to extract:

1. **Dual Sentiment Analysis**: Separate sentiment scores for Agent vs Customer
2. **AI-Discovered Topics**: Intelligent topic discovery beyond manual categorization
3. **Performance Metrics**: Agent performance tracking based on interaction quality
4. **Granular Subcategories**: Deeper categorization than disposition codes

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    INPUT DATA (23,167 tickets)              │
│                                                             │
│  data/tickets.csv                                           │
│   ├─ ticket_title                                           │
│   ├─ ticket_description                                     │
│   ├─ assigned_user_name (agent)                             │
│   ├─ ticket_status                                          │
│   └─ custom_fields (disposition)                            │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                   BATCH PROCESSOR                           │
│                                                             │
│  scripts/deep-analysis.mjs                                  │
│                                                             │
│  • Batches of 50 tickets                                    │
│  • 5 concurrent API calls                                   │
│  • Automatic retry (3 attempts)                             │
│  • Progress checkpoints                                     │
│  • Resume capability                                        │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│              AI ANALYSIS (OpenRouter API)                   │
│                                                             │
│  Model: Claude 3.5 Sonnet                                   │
│                                                             │
│  For each ticket:                                           │
│   1. Extract last 1000 characters                           │
│   2. Analyze agent sentiment (positive/neutral/negative)    │
│   3. Analyze customer sentiment                             │
│   4. Discover true topic from content                       │
│   5. Identify granular subcategory                          │
│   6. Extract key issues and tags                            │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                    OUTPUT DATA                              │
│                                                             │
│  public/data/deep-analysis.json                             │
│                                                             │
│  {                                                          │
│    metadata: { cost, tokens, time, model }                  │
│    summary: {                                               │
│      agentSentiment: { positive, neutral, negative }        │
│      customerSentiment: { positive, neutral, negative }     │
│      avgAgentScore: 0.0-1.0                                 │
│      avgCustomerScore: 0.0-1.0                              │
│    }                                                        │
│    topics: {                                                │
│      mainTopics: [{ name, count, avgConfidence }]           │
│      subcategories: [{ name, count, parentTopic }]          │
│    }                                                        │
│    tickets: [{ ticketKey, agentSentiment, ... }]            │
│  }                                                          │
└─────────────────────────────────────────────────────────────┘
```

## Features

### 1. Dual Sentiment Analysis

**Problem**: Traditional analysis only looks at overall sentiment, missing the nuance of agent performance vs customer satisfaction.

**Solution**: Separate sentiment scores for both parties:

```javascript
{
  "agentSentiment": "positive",
  "agentSentimentScore": 0.85,
  "agentSentimentReason": "Agent was professional, responsive, and resolved issue efficiently",

  "customerSentiment": "negative",
  "customerSentimentScore": 0.35,
  "customerSentimentReason": "Customer frustrated about repeated callbacks needed"
}
```

**Use Cases**:
- Identify excellent agents dealing with difficult situations
- Flag poor agent performance even when customer is satisfied
- Track customer satisfaction trends independent of resolution
- Coach agents on specific interaction patterns

### 2. AI-Discovered Topics

**Problem**: Disposition codes are limited, inconsistent, and may not reflect actual issue.

**Solution**: AI analyzes full ticket content to discover the TRUE topic:

```javascript
{
  "originalDisposition": "Payment Issues",
  "aiDiscoveredTopic": "Autopay Enrollment Confusion",
  "aiDiscoveredSubcategory": "Portal Navigation - Autopay Setup",
  "topicConfidence": 0.92
}
```

**Benefits**:
- Uncover hidden patterns in ticket data
- Identify emerging issues before they become trends
- Better routing and automation opportunities
- More accurate knowledge base recommendations

### 3. Performance Metrics

**Agent Performance Quadrants**:

| Agent Sentiment | Customer Sentiment | Interpretation |
|-----------------|-------------------|----------------|
| ✅ Positive | ✅ Positive | **Star Performance** - Great agent, happy customer |
| ✅ Positive | ❌ Negative | **Difficult Situation** - Good agent handling tough case |
| ❌ Negative | ✅ Positive | **Lucky Resolution** - Issue resolved despite poor service |
| ❌ Negative | ❌ Negative | **Training Needed** - Both parties dissatisfied |

### 4. Resume Capability

**Problem**: Processing 23k tickets takes time and may be interrupted.

**Solution**: Automatic checkpointing:

```
📦 Processing batch 15...
   Progress: 750/23167 (3.2%)
   [System crashes]

📂 Resuming from previous run...
   Already processed: 750 tickets
📦 Processing batch 16 (starting from ticket 751)...
```

## Usage

### Step 1: Test on Sample Data (10 tickets)

```bash
# Test the analysis on 10 diverse tickets first
cd C:\GitHub\servicing-ticket-analysis
node scripts/test-deep-analysis.mjs
```

**Expected output**:
```
🧪 Testing Deep Analysis on 10 sample tickets

Sample tickets selected:
1. SH-95999: Hard Credit Inquiry...
2. SH-96002: I cannot access my loan...
...

[1/10] Analyzing SH-95999...
   ✅ Agent: positive (85%)
   ✅ Customer: negative (40%)
   ✅ Topic: Credit Report Inquiry Removal
   ✅ Subcategory: Unauthorized Hard Pull Dispute

✅ Test complete! Results saved to: data/test-analysis-results.json
```

### Step 2: Review Test Results

```bash
# View the test results
cat data/test-analysis-results.json
```

Look for:
- ✅ JSON parsing successful
- ✅ Sentiment scores reasonable (0.0-1.0)
- ✅ Topics make sense
- ✅ Subcategories are granular

### Step 3: Run Full Analysis (23k tickets)

**IMPORTANT**: This will make ~23k API calls and cost approximately **$15-25**.

```bash
# Set your OpenRouter API key first
echo "OPENROUTER_API_KEY=your_key_here" >> .env.local

# Run the full analysis
node scripts/deep-analysis.mjs
```

**Expected output**:
```
🚀 Deep AI Analysis Script for Servicing Tickets

📊 Loading ticket data...
   Loaded 23,167 tickets

💰 Cost Estimate:
   Remaining tickets: 23,167
   Estimated tokens: 18,533,600
   Estimated cost: $18.53
   Estimated time: 77 minutes

📦 Processing 464 batches of 50 tickets each

📦 Processing batch 1 (50 tickets)...
   Progress: 50/23167 (0.2%)
   ✅ Batch complete: 50 success, 0 failed

   📊 Stats: 50 API calls, 40,250 tokens, $0.04 cost
   ⏱️  Rate: 38.5 tickets/min, ETA: 76 minutes

[... processing continues ...]

✅ ANALYSIS COMPLETE!

📁 Output saved to: public/data/deep-analysis.json
📊 Analyzed: 23,167 tickets
💰 Total cost: $18.45
⏱️  Total time: 78 minutes
```

### Step 4: Integrate with Dashboard

The deep analysis results are automatically available at:
```
/data/deep-analysis.json
```

**Dashboard Integration**:
```typescript
// Load deep analysis data
const deepAnalysis = await fetch('/data/deep-analysis.json');
const { summary, topics, tickets } = await deepAnalysis.json();

// Show agent performance quadrant
<PerformanceQuadrant
  starPerformers={tickets.filter(t =>
    t.agentSentiment === 'positive' && t.customerSentiment === 'positive'
  )}
  needsTraining={tickets.filter(t =>
    t.agentSentiment === 'negative' && t.customerSentiment === 'negative'
  )}
/>

// Show AI-discovered topics
<TopicCloud topics={topics.mainTopics} />

// Show agent leaderboard
<AgentLeaderboard
  agents={groupByAgent(tickets)}
  sortBy="agentSentimentScore"
/>
```

## Cost Optimization

### Option 1: Claude 3.5 Sonnet (Current)
- **Model**: `anthropic/claude-3.5-sonnet`
- **Cost**: ~$18-25 for 23k tickets
- **Speed**: ~40 tickets/min
- **Quality**: ⭐⭐⭐⭐⭐ (Best)

### Option 2: Claude 3.5 Haiku (Budget)
- **Model**: `anthropic/claude-3.5-haiku`
- **Cost**: ~$2-3 for 23k tickets
- **Speed**: ~60 tickets/min
- **Quality**: ⭐⭐⭐⭐ (Very Good)

**To switch to Haiku**:
```javascript
// In scripts/deep-analysis.mjs, line 17:
MODEL: 'anthropic/claude-3.5-haiku', // Change from sonnet
```

### Option 3: GPT-4o Mini (Ultra Budget)
- **Model**: `openai/gpt-4o-mini`
- **Cost**: ~$0.50-1 for 23k tickets
- **Speed**: ~80 tickets/min
- **Quality**: ⭐⭐⭐ (Good)

## Interruption & Resume

The script automatically saves progress every batch:

```json
// data/analysis-progress.json
{
  "processed": 1500,
  "results": [...],
  "lastUpdated": "2025-12-08T18:30:00Z"
}
```

**To resume after interruption**:
```bash
# Just run the script again - it will automatically resume
node scripts/deep-analysis.mjs

# Output:
📂 Resuming from previous run...
   Already processed: 1,500 tickets
   Skipping first 1500 tickets (already processed)
```

## Output Data Structure

### Metadata
```json
{
  "metadata": {
    "totalTickets": 23167,
    "analyzedTickets": 23167,
    "failedTickets": 12,
    "apiCalls": 23167,
    "totalTokens": 18500000,
    "totalCost": 18.45,
    "analysisDate": "2025-12-08T20:15:30Z",
    "model": "anthropic/claude-3.5-sonnet",
    "processingTime": 4680000
  }
}
```

### Summary Statistics
```json
{
  "summary": {
    "agentSentiment": {
      "positive": 18234,
      "neutral": 3890,
      "negative": 1043
    },
    "customerSentiment": {
      "positive": 15678,
      "neutral": 5432,
      "negative": 2057
    },
    "avgAgentScore": 0.82,
    "avgCustomerScore": 0.74
  }
}
```

### Discovered Topics
```json
{
  "topics": {
    "mainTopics": [
      {
        "name": "Payment Processing Issues",
        "count": 5234,
        "avgConfidence": 0.89,
        "tickets": ["SH-95999", "SH-96002", ...]
      },
      {
        "name": "Escrow Analysis Inquiry",
        "count": 3456,
        "avgConfidence": 0.92,
        "tickets": [...]
      }
    ],
    "subcategories": [
      {
        "name": "Autopay Setup - Portal Navigation",
        "count": 1234,
        "parentTopic": "Payment Processing Issues",
        "tickets": [...]
      }
    ],
    "totalTopics": 87,
    "totalSubcategories": 342
  }
}
```

### Individual Ticket Analysis
```json
{
  "tickets": [
    {
      "ticketKey": "SH-95999",
      "ticketTitle": "Cannot access autopay",
      "assignedAgent": "Davis, Jon",
      "originalDisposition": "Payment Issues",

      "agentSentiment": "positive",
      "agentSentimentScore": 0.85,
      "agentSentimentReason": "Agent provided clear step-by-step instructions and followed up proactively",

      "customerSentiment": "neutral",
      "customerSentimentScore": 0.65,
      "customerSentimentReason": "Customer appreciative but had to make multiple attempts",

      "aiDiscoveredTopic": "Autopay Enrollment - Portal Navigation",
      "aiDiscoveredSubcategory": "Multi-Factor Authentication Confusion",
      "topicConfidence": 0.92,

      "keyIssues": [
        "Portal login difficulties with MFA",
        "Autopay button not visible on mobile",
        "Confirmation email delayed"
      ],
      "resolution": "Resolved - Agent walked customer through desktop enrollment",
      "tags": ["autopay", "portal-issue", "mobile-ux", "resolved"],

      "analyzedAt": "2025-12-08T18:45:12Z"
    }
  ]
}
```

## Performance Metrics

### Expected Throughput

| Batch Size | Concurrent | Tickets/Min | Time for 23k |
|------------|-----------|-------------|--------------|
| 50 | 5 | ~40 | 78 min |
| 100 | 10 | ~80 | 39 min |
| 25 | 3 | ~20 | 156 min |

**Current Configuration**: 50 tickets/batch, 5 concurrent = **~78 minutes**

### Cost Breakdown

**Claude 3.5 Sonnet Pricing**:
- Input: $3 / 1M tokens
- Output: $15 / 1M tokens

**Per Ticket Estimate**:
- Input tokens: ~600 (prompt + ticket data)
- Output tokens: ~400 (JSON response)
- Cost per ticket: ~$0.0008

**Total for 23,167 tickets**: ~$18.45

## Troubleshooting

### Error: "OPENROUTER_API_KEY not found"
```bash
# Add to .env.local
echo "OPENROUTER_API_KEY=sk-or-..." >> .env.local
```

### Error: "API error: 429 Rate Limit"
```javascript
// Reduce concurrent calls in deep-analysis.mjs:
MAX_CONCURRENT: 3, // Down from 5
```

### Error: "JSON parse error"
```
// This is handled automatically with retry logic
// Failed tickets are logged and skipped
// Check output.metadata.failedTickets for count
```

### Script crashes mid-run
```bash
# Just run again - it will resume from checkpoint
node scripts/deep-analysis.mjs
```

## Next Steps

After running the analysis:

1. **Create visualization components**:
   - Agent performance quadrant chart
   - Topic discovery word cloud
   - Sentiment trend over time
   - Agent leaderboard

2. **Agent coaching reports**:
   - Individual agent sentiment scores
   - Common issues by agent
   - Improvement opportunities

3. **Topic-based routing**:
   - Use AI-discovered topics for auto-routing
   - Build knowledge base around discovered topics
   - Create specialized teams per topic cluster

4. **Predictive analytics**:
   - Predict ticket resolution time from sentiment
   - Identify escalation risk from customer sentiment
   - Forecast agent performance trends

---

**Last Updated**: December 8, 2025
**Version**: 1.0.0
**Status**: Ready for Production
