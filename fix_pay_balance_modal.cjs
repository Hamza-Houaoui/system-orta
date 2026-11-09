const fs = require('fs');
let code = fs.readFileSync('src/components/InvoiceDetailModal.jsx', 'utf8');

const target = `  const handlePayBalance = async () => {
    const amt = parseFloat(payAmount);
    if (!amt || amt <= 0) return toast.error('Enter a valid amount');
    
    try {
      await db.transaction('rw', [db.orders, db.transactions, db.customers], async () => {
        const newPaid = (order.paidAmount || 0) + amt;
        const total = order.totalPrice || 0;
        if (newPaid > total) { toast.error('Payment exceeds remaining balance'); return; }
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

const replacement = `  const handlePayBalance = async () => {
    const amt = parseFloat(payAmount);
    if (!amt || amt <= 0) return toast.error('Enter a valid amount');
    
    try {
      await db.transaction('rw', [db.orders, db.transactions, db.customers], async () => {
        const total = order.totalPrice || 0;
        const remaining = total - (order.paidAmount || 0);
        if (amt > remaining) { toast.error('Payment exceeds remaining balance'); return; }
        
        const newPaid = (order.paidAmount || 0) + amt;
        const commissionVal = total - newPaid;

        await db.orders.update(order.id, {
          paidAmount: total, // Set to total because the rest is written off as commission
          type: 'paid', // ALWAYS becomes paid now
          status: 'paid'
        });

        // The actual amount received
        await db.transactions.add({
          id: crypto.randomUUID(), date: Date.now(), type: 'in', amount: amt, category: 'Sale',
          description: \`Balance Payment - \${order.customerName} - \${order.number}\`, orderId: order.id, customerId: order.customerId
        });

        // The forgiven difference is a commission
        if (commissionVal > 0) {
           await db.transactions.add({
             id: crypto.randomUUID(), date: Date.now(), type: 'out', amount: commissionVal, category: 'Commission Paid',
             description: \`Commission - \${order.customerName} - \${order.number}\`, orderId: order.id, customerId: order.customerId
           });
        }

        if (order.customerId) {
          const cust = await db.customers.get(order.customerId);
          if (cust) {
            await db.customers.update(order.customerId, { credit: Math.max(0, (cust.credit || 0) - remaining) });
          }
        }
      });`;

code = code.replace(target, replacement);
fs.writeFileSync('src/components/InvoiceDetailModal.jsx', code);
console.log('Fixed InvoiceDetailModal pay balance');
