const fs = require('fs');
let code = fs.readFileSync('src/screens/NewOrderScreen.jsx', 'utf8');

code = code.replace(/\`\$\{\(item.unitPrice \|\| 0\).toFixed\(2\)\}\`/g, '\`$${(item.unitPrice || 0).toFixed(2)}\`');
code = code.replace(/\`\$\{\(item.totalQty \* \(item.unitPrice \|\| 0\)\).toFixed\(2\)\}\`/g, '\`$${(item.totalQty * (item.unitPrice || 0)).toFixed(2)}\`');

fs.writeFileSync('src/screens/NewOrderScreen.jsx', code);
