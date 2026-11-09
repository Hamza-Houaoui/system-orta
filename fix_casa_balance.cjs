const fs = require('fs');

// The correct balance calculation (matches TreasuryScreen exactly):
// balance = startBudget + allIN - allOUT
// - balance_confirm is IGNORED
// - startBudget comes from settings

// The wrong formula used everywhere in telegram code:
// reduce((s,t) => s + (t.type === 'in' ? t.amount : -t.amount))
// This treats balance_confirm as OUT and subtracts it!

// Fix in all files: replace wrong formula with correct one

const wrongFormula = `const allTxForCasa = await db.transactions.orderBy('date').toArray();
          const casaBalanceBefore = allTxForCasa.reduce((s, t) => s + (t.type === 'in' ? t.amount : -t.amount), 0);
          const todayStart = new Date(); todayStart.setHours(0,0,0,0);
          const todayTx = allTxForCasa.filter(t => t.date >= todayStart.getTime());
          const casaTodayIn = todayTx.filter(t => t.type === 'in').reduce((s,t) => s + t.amount, 0);
          const casaTodayOut = todayTx.filter(t => t.type === 'out').reduce((s,t) => s + t.amount, 0);`;

const correctFormula = `const allTxForCasa = await db.transactions.orderBy('date').toArray();
          const _settings = await db.settings.toArray();
          const _startBudget = parseFloat((_settings[0] || {}).startBudget) || 0;
          const _allIn  = allTxForCasa.filter(t => t.type === 'in').reduce((s,t) => s + (t.amount||0), 0);
          const _allOut = allTxForCasa.filter(t => t.type === 'out').reduce((s,t) => s + (t.amount||0), 0);
          const casaBalanceBefore = _startBudget + _allIn - _allOut;
          const todayStart = new Date(); todayStart.setHours(0,0,0,0);
          const todayTx = allTxForCasa.filter(t => t.date >= todayStart.getTime());
          const casaTodayIn = todayTx.filter(t => t.type === 'in').reduce((s,t) => s + t.amount, 0);
          const casaTodayOut = todayTx.filter(t => t.type === 'out').reduce((s,t) => s + t.amount, 0);`;

const files = [
  'src/screens/NewOrderScreen.jsx',
  'src/screens/HistoryScreen.jsx',
  'src/screens/CustomerDetailScreen.jsx',
  'src/screens/TreasuryScreen.jsx',
];

let fixedCount = 0;
for (const f of files) {
  let code = fs.readFileSync(f, 'utf8');
  if (code.includes(wrongFormula)) {
    code = code.replaceAll(wrongFormula, correctFormula);
    fs.writeFileSync(f, code);
    console.log(`✅ Fixed: ${f}`);
    fixedCount++;
  } else {
    console.log(`⚠️  Not found in: ${f} (may already be correct or different format)`);
  }
}

// Fix FactoryDetailScreen which has slightly different context
let factory = fs.readFileSync('src/screens/FactoryDetailScreen.jsx', 'utf8');
const wrongFactory = `const allTxForCasa = await db.transactions.orderBy('date').toArray();
          const casaBalance = allTxForCasa.reduce((s, t) => s + (t.type === 'in' ? t.amount : -t.amount), 0);
          const todayStart = new Date(); todayStart.setHours(0,0,0,0);
          const todayTx = allTxForCasa.filter(t => t.date >= todayStart.getTime());
          const casaTodayIn = todayTx.filter(t => t.type === 'in').reduce((s,t) => s + t.amount, 0);
          const casaTodayOut = todayTx.filter(t => t.type === 'out').reduce((s,t) => s + t.amount, 0);`;

const correctFactory = `const allTxForCasa = await db.transactions.orderBy('date').toArray();
          const _settings = await db.settings.toArray();
          const _startBudget = parseFloat((_settings[0] || {}).startBudget) || 0;
          const _allIn  = allTxForCasa.filter(t => t.type === 'in').reduce((s,t) => s + (t.amount||0), 0);
          const _allOut = allTxForCasa.filter(t => t.type === 'out').reduce((s,t) => s + (t.amount||0), 0);
          const casaBalance = _startBudget + _allIn - _allOut;
          const todayStart = new Date(); todayStart.setHours(0,0,0,0);
          const todayTx = allTxForCasa.filter(t => t.date >= todayStart.getTime());
          const casaTodayIn = todayTx.filter(t => t.type === 'in').reduce((s,t) => s + t.amount, 0);
          const casaTodayOut = todayTx.filter(t => t.type === 'out').reduce((s,t) => s + t.amount, 0);`;

if (factory.includes(wrongFactory)) {
  factory = factory.replaceAll(wrongFactory, correctFactory);
  fs.writeFileSync('src/screens/FactoryDetailScreen.jsx', factory);
  console.log('✅ Fixed: FactoryDetailScreen.jsx');
} else {
  console.log('⚠️  FactoryDetailScreen.jsx - pattern not found, checking manually...');
  // Show what's there
  const idx = factory.indexOf('casaBalance');
  if (idx !== -1) console.log('Found casaBalance at:', factory.substring(idx, idx + 300));
}

console.log(`\n✅ Total fixed: ${fixedCount} files`);
