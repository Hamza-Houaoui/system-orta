const fs = require('fs');
let code = fs.readFileSync('src/screens/NewOrderScreen.jsx', 'utf8');

const target = `const actualAmountPaid = finalOrderType === 'paid' ? (parseFloat(paidExact) || total) : (parseFloat(depositAmount) || 0);
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
          }`;

const replacement = `const actualAmountPaid = finalOrderType === 'paid' ? (parseFloat(paidExact) || total) : (parseFloat(depositAmount) || 0);
          if (finalOrderType === 'paid') {
            // Only the actual amount paid enters Casa
            await db.transactions.add({
              id: uuidv4(), date: now, type: 'in', amount: parseFloat(actualAmountPaid.toFixed(2)),
              category: 'Sale',
              description: \`Sale - \${customer.name} - \${number}\`,
              orderId, customerId: customer.id,
            });
            // No OUT transaction for the difference, it's just a discount/commission
          }`;

code = code.replace(target, replacement);
fs.writeFileSync('src/screens/NewOrderScreen.jsx', code);
console.log('Fixed NewOrderScreen Casa');
