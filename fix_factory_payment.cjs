const fs = require('fs');
let code = fs.readFileSync('src/screens/FactoryDetailScreen.jsx', 'utf8');

code = code.replace(
  /const f = await db\.factories\.get\(id\);\n\s*if \(amount > \(f\.runningDebt \|\| 0\)\) \{ toast\.error\('Payment exceeds current debt'\); setSaving\(false\); return; \}/g,
  `const f = await db.factories.get(id);`
);

fs.writeFileSync('src/screens/FactoryDetailScreen.jsx', code);
console.log('Fixed factory payment restriction');
