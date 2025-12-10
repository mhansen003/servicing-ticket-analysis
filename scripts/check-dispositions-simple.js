const fs = require('fs');

const data = JSON.parse(fs.readFileSync('data/Servicing Transcript Messages.json', 'utf-8'));
const dispositions = {};

data.forEach(t => {
  const d = t.disposition || 'No Disposition';
  dispositions[d] = (dispositions[d] || 0) + 1;
});

const sorted = Object.entries(dispositions).sort((a,b) => b[1] - a[1]).slice(0, 20);

console.log('\nTop 20 Agent Manual Dispositions:\n');
sorted.forEach(([d, count], i) => {
  console.log(`   ${i+1}. ${d} - ${count} calls`);
});
console.log('');
