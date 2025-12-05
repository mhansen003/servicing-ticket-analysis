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
      transcriptIds: []
    };
  }
  agents[name].count++;
  agents[name].totalDuration += t.durationSeconds || 0;
  agents[name].transcriptIds.push(t.id);

  const sentiment = t.aiAnalysis?.sentiment || t.basicSentiment;
  if (sentiment === 'positive') agents[name].positive++;
  else if (sentiment === 'negative') agents[name].negative++;
  else agents[name].neutral++;
});

// Calculate metrics and sort
const agentList = Object.entries(agents).map(([name, stats]) => ({
  name,
  email: stats.email,
  department: stats.department,
  callCount: stats.count,
  avgDuration: Math.round(stats.totalDuration / stats.count),
  positiveRate: Math.round(stats.positive / stats.count * 100),
  negativeRate: Math.round(stats.negative / stats.count * 100),
  neutralRate: Math.round(stats.neutral / stats.count * 100),
  sentimentScore: Math.round((stats.positive - stats.negative) / stats.count * 100),
  transcriptIds: stats.transcriptIds.slice(0, 20) // Keep last 20 for quick access
}));

// Sort by call count
const byCallCount = [...agentList].sort((a, b) => b.callCount - a.callCount).slice(0, 15);
console.log('\n=== TOP AGENTS BY CALL VOLUME ===');
byCallCount.forEach((a, i) => {
  console.log(`${i+1}. ${a.name}: ${a.callCount} calls, Score: ${a.sentimentScore > 0 ? '+' : ''}${a.sentimentScore}`);
});

// Sort by sentiment score (best)
const byBestSentiment = [...agentList].filter(a => a.callCount >= 5).sort((a, b) => b.sentimentScore - a.sentimentScore).slice(0, 10);
console.log('\n=== TOP PERFORMERS (min 5 calls) ===');
byBestSentiment.forEach((a, i) => {
  console.log(`${i+1}. ${a.name}: Score +${a.sentimentScore}, ${a.callCount} calls`);
});

// Sort by sentiment score (worst - opportunities for improvement)
const byWorstSentiment = [...agentList].filter(a => a.callCount >= 5).sort((a, b) => a.sentimentScore - b.sentimentScore).slice(0, 10);
console.log('\n=== NEEDS IMPROVEMENT (min 5 calls) ===');
byWorstSentiment.forEach((a, i) => {
  console.log(`${i+1}. ${a.name}: Score ${a.sentimentScore}, ${a.callCount} calls, ${a.negativeRate}% negative`);
});

console.log('\nTotal unique agents:', agentList.length);
