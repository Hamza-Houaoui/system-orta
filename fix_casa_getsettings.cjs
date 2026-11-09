const fs = require('fs');

const files = [
  'src/screens/NewOrderScreen.jsx',
  'src/screens/HistoryScreen.jsx',
  'src/screens/TreasuryScreen.jsx',
  'src/screens/FactoryDetailScreen.jsx',
  'src/screens/CustomerDetailScreen.jsx',
  'src/screens/CustomerCreditScreen.jsx',
  'src/components/InvoiceDetailModal.jsx',
];

for (const f of files) {
  let code = fs.readFileSync(f, 'utf8');
  let changed = false;

  // 1. Add getSettings import if missing
  if (!code.includes("getSettings") && code.includes("from '../core/store'")) {
    code = code.replace(
      /import \{([^}]+)\} from '\.\.\/core\/store'/,
      (m, imports) => `import {${imports}, getSettings } from '../core/store'`
    );
    changed = true;
    console.log(`  📦 Added getSettings import to ${f}`);
  } else if (!code.includes("getSettings") && !code.includes("from '../core/store'")) {
    // Insert import after first import line
    code = code.replace(
      /^(import .*\n)/,
      `$1import { getSettings } from '../core/store';\n`
    );
    changed = true;
    console.log(`  📦 Inserted getSettings import in ${f}`);
  }

  // 2. Replace bad db.settings.toArray pattern with getSettings()
  const badPattern = /const _settings = await db\.settings\.toArray\(\);\s*\n\s*const _startBudget = parseFloat\(\(_settings\[0\] \|\| \{\}\)\.startBudget\) \|\| 0;/g;
  const goodReplacement = `const _startBudget = parseFloat(getSettings().startBudget) || 0;`;
  
  if (badPattern.test(code)) {
    code = code.replace(badPattern, goodReplacement);
    changed = true;
    console.log(`  ✅ Fixed db.settings pattern in ${f}`);
  }

  // Also fix alternate patterns (with different whitespace/variable names)
  const badPattern2 = /const _settRet = await db\.settings\.toArray\(\);\s*\n\s*const _sbRet = parseFloat\(\(_settRet\[0\] \|\| \{\}\)\.startBudget\) \|\| 0;/g;
  if (badPattern2.test(code)) {
    code = code.replace(badPattern2, `const _sbRet = parseFloat(getSettings().startBudget) || 0;`);
    changed = true;
    console.log(`  ✅ Fixed _sbRet pattern in ${f}`);
  }

  const badPattern3 = /const _settings2 = await db\.settings\.toArray\(\);\s*\n\s*const _startBudget2 = parseFloat\(\(_settings2\[0\] \|\| \{\}\)\.startBudget\) \|\| 0;/g;
  if (badPattern3.test(code)) {
    code = code.replace(badPattern3, `const _startBudget2 = parseFloat(getSettings().startBudget) || 0;`);
    changed = true;
    console.log(`  ✅ Fixed _startBudget2 pattern in ${f}`);
  }

  if (changed) {
    fs.writeFileSync(f, code);
    console.log(`✅ Saved ${f}`);
  } else {
    console.log(`⚠️  No changes needed in ${f}`);
  }
}
