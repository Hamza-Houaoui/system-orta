const fs = require('fs');
let code = fs.readFileSync('src/screens/NewOrderScreen.jsx', 'utf8');

// Remove the `let finalOrderType = orderType;` from inside saveOrder
code = code.replace(/      let finalOrderType = orderType;\n      const actualAmountPaid = finalOrderType === 'paid' \? \(parseFloat\(paidExact\) \|\| total\) : \(parseFloat\(depositAmount\) \|\| 0\);\n      if \(finalOrderType === 'paid' && actualAmountPaid < total\) {\n        finalOrderType = 'deposit'; \/\/ Force to deposit if underpaid\n      }/, '');

// Insert it right before `const commission = ...`
const target = `  const commission = finalOrderType === 'paid' ? paidVal - total : 0;`;
const replacement = `  const tmpAmountPaid = orderType === 'paid' ? (parseFloat(paidExact) || total) : (parseFloat(depositAmount) || 0);
  const finalOrderType = (orderType === 'paid' && tmpAmountPaid < total) ? 'deposit' : orderType;
  
  const commission = finalOrderType === 'paid' ? paidVal - total : 0;`;

code = code.replace(target, replacement);

fs.writeFileSync('src/screens/NewOrderScreen.jsx', code);
console.log('Fixed finalOrderType scope');
