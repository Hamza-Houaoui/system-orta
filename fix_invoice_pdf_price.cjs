const fs = require('fs');
let code = fs.readFileSync('src/screens/NewOrderScreen.jsx', 'utf8');

code = code.replace(/item\.price/g, '(item.unitPrice || 0)');

fs.writeFileSync('src/screens/NewOrderScreen.jsx', code);
console.log('Fixed item.unitPrice in PDF and Text');
