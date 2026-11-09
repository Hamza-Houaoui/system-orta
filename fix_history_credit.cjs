const fs = require('fs');
let code = fs.readFileSync('src/screens/HistoryScreen.jsx', 'utf8');

const targetHistory = `        if (payingOrder.customerId) {
          const cust = await db.customers.get(payingOrder.customerId);
          if (cust) {
            await db.customers.update(payingOrder.customerId, { credit: Math.max(0, (cust.credit || 0) - remaining) });
          }
        }`;

code = code.replace(targetHistory, "");
fs.writeFileSync('src/screens/HistoryScreen.jsx', code);

// Same for InvoiceDetailModal.jsx
if (fs.existsSync('src/components/InvoiceDetailModal.jsx')) {
  let modalCode = fs.readFileSync('src/components/InvoiceDetailModal.jsx', 'utf8');
  modalCode = modalCode.replace(targetHistory, "");
  fs.writeFileSync('src/components/InvoiceDetailModal.jsx', modalCode);
}
