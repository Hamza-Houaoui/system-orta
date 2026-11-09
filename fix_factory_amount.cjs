const fs = require('fs');
let code = fs.readFileSync('src/screens/FactoryDetailScreen.jsx', 'utf8');

code = code.replace(
  /amount = parseFloat\(form\.amount\) \|\| 0;\n/g,
  "amount = parseFloat(form.amount) || 0;\n        if (amount <= 0) { toast.error('Amount must be positive'); setSaving(false); return; }\n"
);

fs.writeFileSync('src/screens/FactoryDetailScreen.jsx', code);
console.log('Fixed factory amount');
