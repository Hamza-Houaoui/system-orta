const fs = require('fs');

function fixPayBalance(file) {
  let code = fs.readFileSync(file, 'utf8');
  code = code.replace(
    /const isNowPaid = newPaid >= total;/g,
    `if (newPaid > total) { toast.error('Payment exceeds remaining balance'); return; }\n        const isNowPaid = newPaid >= total;`
  );
  code = code.replace(
    /const refundAmount = \(order\.paidAmount \|\| 0\) - \(order\.commission \|\| 0\);/g,
    `const refundAmount = Math.min(order.paidAmount || 0, order.totalPrice || 0);`
  );
  fs.writeFileSync(file, code);
}

fixPayBalance('src/components/InvoiceDetailModal.jsx');
fixPayBalance('src/screens/HistoryScreen.jsx');
console.log('Fixed Pay Balance and Return Refund');
