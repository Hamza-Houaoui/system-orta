const fs = require('fs');
let code = fs.readFileSync('src/screens/NewOrderScreen.jsx', 'utf8');

code = code.replace(/doc.text\(\`Subtotal: \$\{subtotal.toFixed\(2\)\}\`/g, 'doc.text(\`Subtotal: $${subtotal.toFixed(2)}\`');
code = code.replace(/doc.text\(\`Total: \$\{finalTotal.toFixed\(2\)\}\`/g, 'doc.text(\`Total: $${finalTotal.toFixed(2)}\`');
code = code.replace(/doc.text\(\`Deposit: \$\{deposit.toFixed\(2\)\}\`/g, 'doc.text(\`Deposit: $${deposit.toFixed(2)}\`');
code = code.replace(/doc.text\(\`Remaining: \$\{\(finalTotal - deposit\).toFixed\(2\)\}\`/g, 'doc.text(\`Remaining: $${(finalTotal - deposit).toFixed(2)}\`');

fs.writeFileSync('src/screens/NewOrderScreen.jsx', code);
