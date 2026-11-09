const fs = require('fs');
let code = fs.readFileSync('src/components/InvoiceDetailModal.jsx', 'utf8');

const payTarget = `    try {
      const newPaid = (order.paidAmount || 0) + amt;
      const total = order.totalPrice || 0;
      const isNowPaid = newPaid >= total;

      await db.orders.update(order.id, {
        paidAmount: newPaid,
        type: isNowPaid ? 'paid' : 'deposit',
        status: isNowPaid ? 'paid' : 'deposit'
      });

      await db.transactions.add({
        id: crypto.randomUUID(), date: Date.now(), type: 'in', amount: amt, category: 'Deposit Balance',
        description: \`Balance Payment - \${order.customerName} - \${order.number}\`, orderId: order.id, customerId: order.customerId
      });

      if (order.customerId) {
        const cust = await db.customers.get(order.customerId);
        if (cust) {
          await db.customers.update(order.customerId, { credit: Math.max(0, (cust.credit || 0) - amt) });
        }
      }`;

const payReplacement = `    try {
      await db.transaction('rw', [db.orders, db.transactions, db.customers], async () => {
        const newPaid = (order.paidAmount || 0) + amt;
        const total = order.totalPrice || 0;
        const isNowPaid = newPaid >= total;

        await db.orders.update(order.id, {
          paidAmount: newPaid,
          type: isNowPaid ? 'paid' : 'deposit',
          status: isNowPaid ? 'paid' : 'deposit'
        });

        await db.transactions.add({
          id: crypto.randomUUID(), date: Date.now(), type: 'in', amount: amt, category: 'Deposit Balance',
          description: \`Balance Payment - \${order.customerName} - \${order.number}\`, orderId: order.id, customerId: order.customerId
        });

        if (order.customerId) {
          const cust = await db.customers.get(order.customerId);
          if (cust) {
            await db.customers.update(order.customerId, { credit: Math.max(0, (cust.credit || 0) - amt) });
          }
        }
      });`;

code = code.replace(payTarget, payReplacement);
fs.writeFileSync('src/components/InvoiceDetailModal.jsx', code);
console.log('Fixed handlePayBalance transaction in modal');
