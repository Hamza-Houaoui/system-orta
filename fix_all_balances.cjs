const fs = require('fs');

// The single correct formula block to replace all bad ones
// Used when variable is named casaBalanceBefore
const correctBlock = (varName) => `const _settings = await db.settings.toArray();
          const _startBudget = parseFloat((_settings[0] || {}).startBudget) || 0;
          const _allIn  = allTxForCasa.filter(t => t.type === 'in').reduce((s,t) => s + (t.amount||0), 0);
          const _allOut = allTxForCasa.filter(t => t.type === 'out').reduce((s,t) => s + (t.amount||0), 0);
          const ${varName} = _startBudget + _allIn - _allOut;`;

const files = {
  'src/screens/HistoryScreen.jsx': [
    {
      wrong: `const casaBalanceBefore = allTxForCasa.reduce((s, t) => s + (t.type === 'in' ? t.amount : -t.amount), 0);`,
      right: correctBlock('casaBalanceBefore'),
    }
  ],
  'src/screens/CustomerDetailScreen.jsx': [
    {
      wrong: `const casaBalanceBefore = allTxForCasa.reduce((s, t) => s + (t.type === 'in' ? t.amount : -t.amount), 0);`,
      right: correctBlock('casaBalanceBefore'),
    }
  ],
  'src/screens/TreasuryScreen.jsx': [
    {
      wrong: `const casaBalanceBefore = allTxForCasa.reduce((s, t) => s + (t.type === 'in' ? t.amount : -t.amount), 0);`,
      right: correctBlock('casaBalanceBefore'),
    }
  ],
};

for (const [filePath, patches] of Object.entries(files)) {
  let code = fs.readFileSync(filePath, 'utf8');
  let changed = false;
  for (const { wrong, right } of patches) {
    if (code.includes(wrong)) {
      code = code.replaceAll(wrong, right);
      changed = true;
      console.log(`✅ Fixed in ${filePath}`);
    } else {
      console.log(`⚠️  Pattern not found in ${filePath}`);
    }
  }
  if (changed) fs.writeFileSync(filePath, code);
}
