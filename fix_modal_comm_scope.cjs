const fs = require('fs');
let code = fs.readFileSync('src/components/InvoiceDetailModal.jsx', 'utf8');

const oldScope = `      await db.transaction('rw', [db.orders, db.transactions, db.customers], async () => {
        const total = order.totalPrice || 0;
        const remaining = total - (order.paidAmount || 0);
        if (amt > remaining) { toast.error('Payment exceeds remaining balance'); return; }
        
        const newPaid = (order.paidAmount || 0) + amt;
        const commissionVal = total - newPaid;`;

const newScope = `      const total = order.totalPrice || 0;
      const remaining = total - (order.paidAmount || 0);
      if (amt > remaining) { toast.error('Payment exceeds remaining balance'); return; }
      
      const newPaid = (order.paidAmount || 0) + amt;
      const commissionVal = total - newPaid;

      await db.transaction('rw', [db.orders, db.transactions, db.customers], async () => {`;

if (code.includes(oldScope)) {
  code = code.replace(oldScope, newScope);
  fs.writeFileSync('src/components/InvoiceDetailModal.jsx', code);
  console.log('✅ Fixed InvoiceDetailModal commissionVal scope');
} else {
  console.log('⚠️ Pattern not found');
}
