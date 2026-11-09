const fs = require('fs');
let code = fs.readFileSync('src/screens/NewOrderScreen.jsx', 'utf8');

// 1. Remove the finalOrderType conversion logic
code = code.replace(
  /const tmpAmountPaid = orderType === 'paid' \? \(parseFloat\(paidExact\) \|\| total\) : \(parseFloat\(depositAmount\) \|\| 0\);\n\s*const finalOrderType = \(orderType === 'paid' && tmpAmountPaid < total\) \? 'deposit' : orderType;/g,
  `const finalOrderType = orderType;`
);

// 2. Modify the Casa transactions block
const transactionTarget = /const actualAmountPaid = finalOrderType === 'paid' \? \(parseFloat\(paidExact\) \|\| total\) : \(parseFloat\(depositAmount\) \|\| 0\);\n\s*if \(finalOrderType === 'paid' \|\| finalOrderType === 'deposit'\) \{\n\s*await db\.transactions\.add\(\{\n\s*id: uuidv4\(\), date: now, type: 'in', amount: parseFloat\(actualAmountPaid\.toFixed\(2\)\),\n\s*category: finalOrderType === 'paid' \? 'Sale' : 'Deposit',\n\s*description: `\$\{finalOrderType === 'paid' \? 'Sale' : 'Deposit'\} - \$\{customer\.name\} - \$\{number\}`,\n\s*orderId, customerId: customer\.id,\n\s*\}\);\n\s*const unpaid = total - actualAmountPaid;\n\s*if \(unpaid > 0 && customer\.id\) \{\n\s*const cust = await db\.customers\.get\(customer\.id\);\n\s*if \(cust\) \{\n\s*await db\.customers\.update\(cust\.id, \{\n\s*credit: \(cust\.credit \|\| 0\) \+ unpaid\n\s*\}\);\n\s*\}\n\s*\}\n\s*\}/;

const transactionReplacement = `const actualAmountPaid = finalOrderType === 'paid' ? (parseFloat(paidExact) || total) : (parseFloat(depositAmount) || 0);
          if (finalOrderType === 'paid') {
            const inAmount = actualAmountPaid < total ? total : actualAmountPaid;
            await db.transactions.add({
              id: uuidv4(), date: now, type: 'in', amount: parseFloat(inAmount.toFixed(2)),
              category: 'Sale',
              description: \`Sale - \${customer.name} - \${number}\`,
              orderId, customerId: customer.id,
            });
            if (actualAmountPaid < total) {
              const commissionVal = total - actualAmountPaid;
              await db.transactions.add({
                id: uuidv4(), date: now, type: 'out', amount: parseFloat(commissionVal.toFixed(2)),
                category: 'Commission Paid',
                description: \`Commission - \${customer.name} - \${number}\`,
                orderId, customerId: customer.id,
              });
            }
          } else if (finalOrderType === 'deposit') {
            await db.transactions.add({
              id: uuidv4(), date: now, type: 'in', amount: parseFloat(actualAmountPaid.toFixed(2)),
              category: 'Deposit',
              description: \`Deposit - \${customer.name} - \${number}\`,
              orderId, customerId: customer.id,
            });
            const unpaid = total - actualAmountPaid;
            if (unpaid > 0 && customer.id) {
              const cust = await db.customers.get(customer.id);
              if (cust) {
                await db.customers.update(cust.id, {
                  credit: (cust.credit || 0) + unpaid
                });
              }
            }
          }`;

code = code.replace(transactionTarget, transactionReplacement);

fs.writeFileSync('src/screens/NewOrderScreen.jsx', code);
console.log('Fixed NewOrderScreen commission logic');
