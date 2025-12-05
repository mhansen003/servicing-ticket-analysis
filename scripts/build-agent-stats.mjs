import fs from 'fs';

const data = JSON.parse(fs.readFileSync('./public/data/transcript-analysis.json', 'utf-8'));
console.log('Total transcripts:', data.length);

// Group by agent
const agents = {};
data.forEach(t => {
  const name = t.agentName || 'Unknown';
  if (!agents[name]) {
    agents[name] = {
      count: 0,
      positive: 0,
      negative: 0,
      neutral: 0,
      totalDuration: 0,
      email: t.agentEmail || '',
      department: t.department || '',
      recentCalls: []
    };
  }
  agents[name].count++;
  agents[name].totalDuration += t.durationSeconds || 0;

  const sentiment = t.aiAnalysis?.sentiment || t.basicSentiment;
  if (sentiment === 'positive') agents[name].positive++;
  else if (sentiment === 'negative') agents[name].negative++;
  else agents[name].neutral++;

  // Store recent calls (up to 20)
  if (agents[name].recentCalls.length < 20) {
    agents[name].recentCalls.push({
      id: t.id,
      date: t.callStart,
      duration: t.durationSeconds,
      sentiment: sentiment,
      summary: t.aiAnalysis?.summary || ''
    });
  }
});

// Calculate metrics
const agentList = Object.entries(agents).map(([name, stats]) => {
  const positiveRate = Math.round(stats.positive / stats.count * 100);
  const negativeRate = Math.round(stats.negative / stats.count * 100);
  const neutralRate = Math.round(stats.neutral / stats.count * 100);
  const sentimentScore = Math.round((stats.positive - stats.negative) / stats.count * 100);

  // Determine performance tier
  let performanceTier;
  if (sentimentScore >= 30) performanceTier = 'top';
  else if (sentimentScore >= 15) performanceTier = 'good';
  else if (sentimentScore >= 0) performanceTier = 'average';
  else if (sentimentScore >= -30) performanceTier = 'needs-improvement';
  else performanceTier = 'critical';

  return {
    name,
    email: stats.email,
    department: stats.department,
    callCount: stats.count,
    avgDuration: Math.round(stats.totalDuration / stats.count),
    positiveRate,
    negativeRate,
    neutralRate,
    sentimentScore,
    performanceTier,
    recentCalls: stats.recentCalls.slice(0, 10) // Keep 10 for display
  };
});

// Sort by call count (primary list)
const byCallCount = [...agentList].sort((a, b) => b.callCount - a.callCount);

// Build rankings
const rankings = {
  totalAgents: agentList.length,
  totalCalls: data.length,

  // Top performers (min 5 calls)
  topPerformers: [...agentList]
    .filter(a => a.callCount >= 5)
    .sort((a, b) => b.sentimentScore - a.sentimentScore)
    .slice(0, 15),

  // Needs improvement (min 5 calls)
  needsImprovement: [...agentList]
    .filter(a => a.callCount >= 5)
    .sort((a, b) => a.sentimentScore - b.sentimentScore)
    .slice(0, 15),

  // Highest volume
  highestVolume: byCallCount.slice(0, 15),

  // All agents (sorted by call count)
  allAgents: byCallCount,

  // Performance distribution
  distribution: {
    top: agentList.filter(a => a.performanceTier === 'top').length,
    good: agentList.filter(a => a.performanceTier === 'good').length,
    average: agentList.filter(a => a.performanceTier === 'average').length,
    needsImprovement: agentList.filter(a => a.performanceTier === 'needs-improvement').length,
    critical: agentList.filter(a => a.performanceTier === 'critical').length
  }
};

console.log('\n=== PERFORMANCE DISTRIBUTION ===');
console.log(`Top: ${rankings.distribution.top}`);
console.log(`Good: ${rankings.distribution.good}`);
console.log(`Average: ${rankings.distribution.average}`);
console.log(`Needs Improvement: ${rankings.distribution.needsImprovement}`);
console.log(`Critical: ${rankings.distribution.critical}`);

// Write output
fs.writeFileSync('./public/data/agent-rankings.json', JSON.stringify(rankings, null, 2));
console.log('\n✓ Agent rankings saved to public/data/agent-rankings.json');
