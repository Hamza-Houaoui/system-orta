const fs = require('fs');
let code = fs.readFileSync('src/screens/NewOrderScreen.jsx', 'utf8');

// Ensure paidVal is total if actualAmountPaid < total and type is paid
code = code.replace(
  /const paidVal = parseFloat\(paidExact\) \|\| total;/g,
  `let paidVal = parseFloat(paidExact) || total;
  if (orderType === 'paid' && paidVal < total) paidVal = total;`
);

fs.writeFileSync('src/screens/NewOrderScreen.jsx', code);
console.log('Fixed paidAmount on creation');
