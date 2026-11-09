const fs = require('fs');
let code = fs.readFileSync('src/screens/NewOrderScreen.jsx', 'utf8');

const targetLogic = `            const unpaid = total - actualAmountPaid;
            if (unpaid > 0 && customer.id) {
              const cust = await db.customers.get(customer.id);
              if (cust) {
                await db.customers.update(cust.id, {
                  credit: (cust.credit || 0) + unpaid
                });
              }
            }`;

code = code.replace(targetLogic, "");
fs.writeFileSync('src/screens/NewOrderScreen.jsx', code);
