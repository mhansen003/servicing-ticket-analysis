/**
 * Merge Professionalism Analysis into Agent Rankings
 *
 * Takes the new professionalism scores and updates the agent rankings
 * to reflect professionalism-based scoring instead of sentiment-based.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const INPUT = {
  professionalism: path.join(__dirname, '..', 'public', 'data', 'professionalism-batches', 'all-agents.json'),
  rankings: path.join(__dirname, '..', 'public', 'data', 'agent-rankings.json'),
};

const OUTPUT = {
  rankings: path.join(__dirname, '..', 'public', 'data', 'agent-rankings.json'),
  professionalism: path.join(__dirname, '..', 'public', 'data', 'agent-professionalism.json'),
};

function main() {
  console.log('🔄 Merging professionalism scores into agent rankings...\n');

  // Load data
  const profData = JSON.parse(fs.readFileSync(INPUT.professionalism, 'utf-8'));
  const rankings = JSON.parse(fs.readFileSync(INPUT.rankings, 'utf-8'));

  console.log(`📊 Professionalism data: ${Object.keys(profData).length} agents`);
  console.log(`📊 Rankings data: ${rankings.totalAgents} agents`);

  // Map tier to performance tier
  const tierMap = {
    'exemplary': 'top',
    'professional': 'good',
    'adequate': 'average',
    'needs-coaching': 'needs-improvement',
    'critical': 'critical',
  };

  // Update each agent in allAgents
  let updated = 0;
  rankings.allAgents = rankings.allAgents.map(agent => {
    const profAgent = profData[agent.name];
    if (profAgent) {
      updated++;
      return {
        ...agent,
        // Professionalism-based scores
        professionalismScore: parseFloat(profAgent.overallScore),
        professionalism: profAgent.scores.professionalism,
        empathy: profAgent.scores.empathy,
        clarity: profAgent.scores.clarity,
        listening: profAgent.scores.listening,
        deEscalation: profAgent.scores.deEscalation,
        frustrationCaused: profAgent.frustrationCaused,
        frustrationRate: parseFloat(profAgent.frustrationRate),
        // Update performance tier based on professionalism
        performanceTier: tierMap[profAgent.tier] || agent.performanceTier,
        professionalismTier: profAgent.tier,
        // Keep original sentiment score for reference
        sentimentScoreOriginal: agent.sentimentScore,
        // Use professionalism as the main score (normalized to 0-100)
        sentimentScore: parseFloat(profAgent.overallScore) * 20,
        // Common issues and strengths
        commonIssues: profAgent.commonIssues,
        commonStrengths: profAgent.commonStrengths,
        analyzedCalls: profAgent.analyzedCalls,
      };
    }
    return agent;
  });

  console.log(`✅ Updated ${updated} agents with professionalism scores`);

  // Re-sort by professionalism score
  rankings.allAgents.sort((a, b) => (b.professionalismScore || 0) - (a.professionalismScore || 0));

  // Update distribution based on new tiers
  const distribution = {
    top: 0,
    good: 0,
    average: 0,
    needsImprovement: 0,
    critical: 0,
  };

  rankings.allAgents.forEach(agent => {
    const tier = agent.performanceTier;
    if (tier === 'top') distribution.top++;
    else if (tier === 'good') distribution.good++;
    else if (tier === 'average') distribution.average++;
    else if (tier === 'needs-improvement') distribution.needsImprovement++;
    else if (tier === 'critical') distribution.critical++;
  });

  rankings.distribution = distribution;

  // Update top performers / needs improvement
  rankings.topPerformers = rankings.allAgents.filter(a =>
    a.performanceTier === 'top' || a.performanceTier === 'good'
  ).slice(0, 10);

  rankings.needsImprovement = rankings.allAgents.filter(a =>
    a.performanceTier === 'needs-improvement' || a.performanceTier === 'critical'
  );

  // Add methodology note
  rankings.methodology = 'professionalism-based';
  rankings.scoringNotes = {
    description: 'Scores based on agent PROFESSIONALISM, not call outcomes',
    metrics: [
      'professionalism (weight: 3)',
      'empathy (weight: 2)',
      'listening (weight: 2)',
      'clarity (weight: 1.5)',
      'de-escalation (weight: 1.5)',
    ],
    penalty: 'frustration caused: -2% per incident',
    tiers: {
      top: 'exemplary (4.2+)',
      good: 'professional (3.5-4.2)',
      average: 'adequate (2.8-3.5)',
      needsImprovement: 'needs-coaching (2.0-2.8)',
      critical: 'critical (<2.0)',
    },
  };

  // Save updated rankings
  fs.writeFileSync(OUTPUT.rankings, JSON.stringify(rankings, null, 2));
  console.log(`💾 Saved updated rankings to ${OUTPUT.rankings}`);

  // Also save as dedicated professionalism file
  const profOutput = {
    generatedAt: new Date().toISOString(),
    methodology: 'AI-based professionalism analysis',
    description: 'Agents scored on behavior, not call outcomes. Frustration penalty applied when agent CAUSED customer frustration.',
    totalAgentsAnalyzed: Object.keys(profData).length,
    scoringWeights: {
      professionalism: 3,
      empathy: 2,
      activeListening: 2,
      communicationClarity: 1.5,
      deEscalation: 1.5,
      frustrationPenalty: '-2% per incident',
    },
    tiers: {
      exemplary: '4.2+',
      professional: '3.5-4.2',
      adequate: '2.8-3.5',
      'needs-coaching': '2.0-2.8',
      critical: '<2.0',
    },
    agents: profData,
  };

  fs.writeFileSync(OUTPUT.professionalism, JSON.stringify(profOutput, null, 2));
  console.log(`💾 Saved professionalism data to ${OUTPUT.professionalism}`);

  // Summary
  console.log('\n📊 TIER DISTRIBUTION:');
  console.log(`   🌟 Top (Exemplary): ${distribution.top}`);
  console.log(`   ✅ Good (Professional): ${distribution.good}`);
  console.log(`   📝 Average (Adequate): ${distribution.average}`);
  console.log(`   ⚠️ Needs Improvement: ${distribution.needsImprovement}`);
  console.log(`   🚨 Critical: ${distribution.critical}`);

  console.log('\n🏆 TOP PERFORMERS:');
  rankings.topPerformers.slice(0, 5).forEach((agent, i) => {
    console.log(`   ${i + 1}. ${agent.name}: ${agent.professionalismScore?.toFixed(2) || 'N/A'} (Prof: ${agent.professionalism}, Frust: ${agent.frustrationRate}%)`);
  });

  console.log('\n⚠️ NEEDS COACHING:');
  rankings.needsImprovement.slice(0, 5).forEach((agent, i) => {
    console.log(`   ${i + 1}. ${agent.name}: ${agent.professionalismScore?.toFixed(2) || 'N/A'} (Prof: ${agent.professionalism}, Frust: ${agent.frustrationRate}%)`);
  });

  console.log('\n✨ Done!');
}

main();
