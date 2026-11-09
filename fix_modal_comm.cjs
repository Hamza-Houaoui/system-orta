const fs = require('fs');

// Fix InvoiceDetailModal
let code = fs.readFileSync('src/components/InvoiceDetailModal.jsx', 'utf8');
let target = `        await db.orders.update(order.id, {
          paidAmount: total, // Show as fully paid
          type: 'paid',
          status: 'paid'
        });`;
let replacement = `        await db.orders.update(order.id, {
          paidAmount: total,
          type: 'paid',
          status: 'paid',
          commission: (order.commission || 0) + (commissionVal > 0 ? commissionVal : 0)
        });`;
code = code.replace(target, replacement);
fs.writeFileSync('src/components/InvoiceDetailModal.jsx', code);

// Fix HistoryScreen
let hCode = fs.readFileSync('src/screens/HistoryScreen.jsx', 'utf8');
let hTarget = `        await db.orders.update(payingOrder.id, {
          paidAmount: total, // fully paid
          type: 'paid', 
          status: 'paid'
        });`;
let hReplacement = `        await db.orders.update(payingOrder.id, {
          paidAmount: total,
          type: 'paid', 
          status: 'paid',
          commission: (payingOrder.commission || 0) + (commissionVal > 0 ? commissionVal : 0)
        });`;
hCode = hCode.replace(hTarget, hReplacement);
fs.writeFileSync('src/screens/HistoryScreen.jsx', hCode);

console.log('Fixed Modal and History order commission update');
