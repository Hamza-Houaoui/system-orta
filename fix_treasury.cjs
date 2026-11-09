const fs = require('fs');
let code = fs.readFileSync('src/screens/NewOrderScreen.jsx', 'utf8');

const targetBlock = `          if (orderType === 'paid' || orderType === 'deposit') {
            await db.transactions.add({
              id: uuidv4(), date: now, type: 'in', amount: parseFloat(total.toFixed(2)),
              category: orderType === 'paid' ? 'Sale' : 'Deposit',
              description: \`\${orderType === 'paid' ? 'Sale' : 'Deposit'} - \${customer.name} - \${number}\`,
              orderId, customerId: customer.id,
            });

            const amountPaid = orderType === 'paid' ? (parseFloat(paidExact) || total) : (parseFloat(depositAmount) || 0);
            const unpaid = total - amountPaid;
            
            if (unpaid > 0) {
              await db.transactions.add({
                id: uuidv4(), date: now + 1, type: 'out', amount: parseFloat(unpaid.toFixed(2)),
                category: 'Unpaid Balance', description: \`Unpaid balance - \${customer.name} - \${number}\`,
                orderId, customerId: customer.id,
              });
            }
          }`;

const replacementBlock = `          const amountPaid = orderType === 'paid' ? (parseFloat(paidExact) || total) : (parseFloat(depositAmount) || 0);
          if (orderType === 'paid' || orderType === 'deposit') {
            await db.transactions.add({
              id: uuidv4(), date: now, type: 'in', amount: parseFloat(amountPaid.toFixed(2)),
              category: orderType === 'paid' ? 'Sale' : 'Deposit',
              description: \`\${orderType === 'paid' ? 'Sale' : 'Deposit'} - \${customer.name} - \${number}\`,
              orderId, customerId: customer.id,
            });
          }`;

code = code.replace(targetBlock, replacementBlock);
fs.writeFileSync('src/screens/NewOrderScreen.jsx', code);
console.log('Fixed treasury logic in NewOrderScreen');
