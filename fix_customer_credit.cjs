const fs = require('fs');
let code = fs.readFileSync('src/screens/NewOrderScreen.jsx', 'utf8');

const txOld = `await db.transaction('rw', [db.orders, db.modelColors, db.stockLog, db.transactions, db.telegramQueue, db.telegramMessages, db.catalog], async () => {`;
const txNew = `await db.transaction('rw', [db.orders, db.modelColors, db.stockLog, db.transactions, db.telegramQueue, db.telegramMessages, db.catalog, db.customers], async () => {`;
code = code.replace(txOld, txNew);

const creditOld = `          if (orderType === 'paid' || orderType === 'deposit') {
            await db.transactions.add({
              id: uuidv4(), date: now, type: 'in', amount: parseFloat(amountPaid.toFixed(2)),
              category: orderType === 'paid' ? 'Sale' : 'Deposit',
              description: \`\${orderType === 'paid' ? 'Sale' : 'Deposit'} - \${customer.name} - \${number}\`,
              orderId, customerId: customer.id,
            });
          }`;

const creditNew = `          if (orderType === 'paid' || orderType === 'deposit') {
            await db.transactions.add({
              id: uuidv4(), date: now, type: 'in', amount: parseFloat(amountPaid.toFixed(2)),
              category: orderType === 'paid' ? 'Sale' : 'Deposit',
              description: \`\${orderType === 'paid' ? 'Sale' : 'Deposit'} - \${customer.name} - \${number}\`,
              orderId, customerId: customer.id,
            });
            
            const unpaid = total - amountPaid;
            if (unpaid > 0 && customer.id) {
               const cust = await db.customers.get(customer.id);
               if (cust) {
                  await db.customers.update(customer.id, { credit: (cust.credit || 0) + unpaid });
               }
            }
          }`;

code = code.replace(creditOld, creditNew);
fs.writeFileSync('src/screens/NewOrderScreen.jsx', code);
console.log('Fixed customer credit in NewOrderScreen');
