const fs = require('fs');
let code = fs.readFileSync('src/screens/NewOrderScreen.jsx', 'utf8');

const target = `    try {
      let orderId = uuidv4();`;
      
const replacement = `    try {
      let finalOrderType = orderType;
      const amountPaid = orderType === 'paid' ? (parseFloat(paidExact) || total) : (parseFloat(depositAmount) || 0);
      if (finalOrderType === 'paid' && amountPaid < total) {
        finalOrderType = 'deposit'; // Force to deposit if underpaid
      }

      let orderId = uuidv4();`;

code = code.replace(target, replacement);

// Also need to replace all usages of `orderType` with `finalOrderType` inside `saveOrder` block!
code = code.replace(/orderType === 'preforma'/g, `finalOrderType === 'preforma'`);
code = code.replace(/orderType !== 'preforma'/g, `finalOrderType !== 'preforma'`);
code = code.replace(/type: orderType,/g, `type: finalOrderType,`);
code = code.replace(/status: orderType,/g, `status: finalOrderType,`);
code = code.replace(/const amountPaid = orderType/g, `const actualAmountPaid = finalOrderType`);
code = code.replace(/amountPaid/g, `actualAmountPaid`); // Rename to avoid conflict with top-level `amountPaid`
code = code.replace(/const actualactualAmountPaid = finalOrderType === 'paid' \? \(parseFloat\(paidExact\) \|\| total\) : \(parseFloat\(depositAmount\) \|\| 0\);/g, `const actualAmountPaid = finalOrderType === 'paid' ? (parseFloat(paidExact) || total) : (parseFloat(depositAmount) || 0);`);
code = code.replace(/finalOrderType === 'paid' \|\| finalOrderType === 'deposit'/g, `finalOrderType === 'paid' || finalOrderType === 'deposit'`);
code = code.replace(/category: finalOrderType === 'paid' \? 'Sale' : 'Deposit',/g, `category: finalOrderType === 'paid' ? 'Sale' : 'Deposit',`);
code = code.replace(/description: \\\`\\\$\\{finalOrderType === 'paid' \? 'Sale' : 'Deposit'\\} - \\\$\\{customer.name\\} - \\\$\\{number\\}\\\`,/g, `description: \`\${finalOrderType === 'paid' ? 'Sale' : 'Deposit'} - \${customer.name} - \${number}\`,`);

fs.writeFileSync('src/screens/NewOrderScreen.jsx', code);
console.log('Forced deposit for underpayments');
