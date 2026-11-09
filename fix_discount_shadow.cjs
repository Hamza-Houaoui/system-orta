const fs = require('fs');
let code = fs.readFileSync('src/screens/NewOrderScreen.jsx', 'utf8');

code = code.replace(/const discount = parseFloat\(discount\) \|\| 0;/g, 'const discountVal = parseFloat(discount) || 0;');
code = code.replace(/const finalTotal = subtotal - discount;/g, 'const finalTotal = subtotal - discountVal;');
code = code.replace(/if \(discount > 0\) doc.text\(\`Discount: \$\\\$\{discount\.toFixed\(2\)\}\`, 140, finalY \+ 17\);/g, 'if (discountVal > 0) doc.text(\`Discount: $${discountVal.toFixed(2)}\`, 140, finalY + 17);');

fs.writeFileSync('src/screens/NewOrderScreen.jsx', code);
