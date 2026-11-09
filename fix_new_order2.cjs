const fs = require('fs');
let code = fs.readFileSync('src/screens/NewOrderScreen.jsx', 'utf8');

// 1. Remove the tmpAmountPaid conversion
code = code.replace(
  /const tmpAmountPaid = orderType === 'paid' \? \(parseFloat\(paidExact\) \|\| total\) : \(parseFloat\(depositAmount\) \|\| 0\);\n\s*const finalOrderType = \(orderType === 'paid' && tmpAmountPaid < total\) \? 'deposit' : orderType;/g,
  `const finalOrderType = orderType;`
);

// 2. Replace transaction logic
const target = `const actualAmountPaid = finalOrderType === 'paid' ? (parseFloat(paidExact) || total) : (parseFloat(depositAmount) || 0);
          if (finalOrderType === 'paid' || finalOrderType === 'deposit') {
            await db.transactions.add({
              id: uuidv4(), date: now, type: 'in', amount: parseFloat(actualAmountPaid.toFixed(2)),
              category: finalOrderType === 'paid' ? 'Sale' : 'Deposit',
              description: \`\${finalOrderType === 'paid' ? 'Sale' : 'Deposit'} - \${customer.name} - \${number}\`,
              orderId, customerId: customer.id,
            });
            
            const unpaid = total - actualAmountPaid;
            if (unpaid > 0 && customer.id) {
               const cust = await db.customers.get(customer.id);
               if (cust) {
                  await db.customers.update(customer.id, { credit: (cust.credit || 0) + unpaid });
               }
            }
          }`;

const replacement = `const actualAmountPaid = finalOrderType === 'paid' ? (parseFloat(paidExact) || total) : (parseFloat(depositAmount) || 0);
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

code = code.replace(target, replacement);
fs.writeFileSync('src/screens/NewOrderScreen.jsx', code);
console.log('Fixed transaction logic in NewOrderScreen');
