const fs = require('fs');

function fixRefund(filePath) {
  let code = fs.readFileSync(filePath, 'utf8');
  let target = /const refundAmount = Math\.min\(order\.paidAmount \|\| 0, order\.totalPrice \|\| 0\);/g;
  let replacement = `const refundAmount = Math.max(0, Math.min(order.paidAmount || 0, order.totalPrice || 0) - (order.commission || 0));`;
  code = code.replace(target, replacement);
  fs.writeFileSync(filePath, code);
}

fixRefund('src/components/InvoiceDetailModal.jsx');
fixRefund('src/screens/HistoryScreen.jsx');

console.log('Fixed refundAmount calculation');
