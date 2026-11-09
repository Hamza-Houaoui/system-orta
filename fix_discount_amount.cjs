const fs = require('fs');
let code = fs.readFileSync('src/screens/NewOrderScreen.jsx', 'utf8');

code = code.replace(/discountAmount/g, 'discount');

fs.writeFileSync('src/screens/NewOrderScreen.jsx', code);
