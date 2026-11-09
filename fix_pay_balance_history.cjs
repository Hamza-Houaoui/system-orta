const fs = require('fs');
let code = fs.readFileSync('src/screens/HistoryScreen.jsx', 'utf8');

const target = `  const handlePayBalance = async () => {
    const amt = parseFloat(payAmount);
    if (!amt || amt <= 0) return toast.error('Enter a valid amount');
    
    try {
      await db.transaction('rw', [db.orders, db.transactions, db.customers], async () => {
        const newPaid = (payingOrder.paidAmount || 0) + amt;
        const total = payingOrder.totalPrice || 0;
        if (newPaid > total) { toast.error('Payment exceeds remaining balance'); return; }
        const isNowPaid = newPaid >= total;

        await db.orders.update(payingOrder.id, {
          paidAmount: newPaid,
          type: isNowPaid ? 'paid' : 'deposit',
          status: isNowPaid ? 'paid' : 'deposit'
        });

        await db.transactions.add({
          id: crypto.randomUUID(), date: Date.now(), type: 'in', amount: amt, category: 'Deposit Balance',
          description: \`Balance Payment - \${payingOrder.customerName} - \${payingOrder.number}\`, 
          orderId: payingOrder.id, customerId: payingOrder.customerId
        });

        if (payingOrder.customerId) {
          const cust = await db.customers.get(payingOrder.customerId);
          if (cust) {
            await db.customers.update(payingOrder.customerId, { credit: Math.max(0, (cust.credit || 0) - amt) });
          }
        }
      });`;

const replacement = `  const handlePayBalance = async () => {
    const amt = parseFloat(payAmount);
    if (!amt || amt <= 0) return toast.error('Enter a valid amount');
    
    try {
      await db.transaction('rw', [db.orders, db.transactions, db.customers], async () => {
        const total = payingOrder.totalPrice || 0;
        const remaining = total - (payingOrder.paidAmount || 0);
        if (amt > remaining) { toast.error('Payment exceeds remaining balance'); return; }
        
        const newPaid = (payingOrder.paidAmount || 0) + amt;
        const commissionVal = total - newPaid;

        await db.orders.update(payingOrder.id, {
          paidAmount: total, // always total now since it is paid
          type: 'paid', // always paid
          status: 'paid'
        });

        await db.transactions.add({
          id: crypto.randomUUID(), date: Date.now(), type: 'in', amount: amt, category: 'Sale',
          description: \`Balance Payment - \${payingOrder.customerName} - \${payingOrder.number}\`, 
          orderId: payingOrder.id, customerId: payingOrder.customerId
        });
        
        if (commissionVal > 0) {
           await db.transactions.add({
             id: crypto.randomUUID(), date: Date.now(), type: 'out', amount: commissionVal, category: 'Commission Paid',
             description: \`Commission - \${payingOrder.customerName} - \${payingOrder.number}\`, orderId: payingOrder.id, customerId: payingOrder.customerId
           });
        }

        if (payingOrder.customerId) {
          const cust = await db.customers.get(payingOrder.customerId);
          if (cust) {
            await db.customers.update(payingOrder.customerId, { credit: Math.max(0, (cust.credit || 0) - remaining) });
          }
        }
      });`;

code = code.replace(target, replacement);
fs.writeFileSync('src/screens/HistoryScreen.jsx', code);
console.log('Fixed HistoryScreen pay balance');
