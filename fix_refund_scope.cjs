const fs = require('fs');

function fixScope(filePath) {
  let code = fs.readFileSync(filePath, 'utf8');
  
  // Replace the scoped const with assigning to an outer variable
  code = code.replace(
    /const now = Date\.now\(\);\n\s*const catalogIdsToUpdate = new Set\(\);/,
    `const now = Date.now();
      const catalogIdsToUpdate = new Set();
      let refundAmount = 0;`
  );
  
  code = code.replace(
    /const refundAmount = Math\.max\(0,\s*Math\.min\(order\.paidAmount \|\| 0,\s*order\.totalPrice \|\| 0\)\s*-\s*\(order\.commission \|\| 0\)\);/g,
    `refundAmount = Math.max(0, Math.min(order.paidAmount || 0, order.totalPrice || 0) - (order.commission || 0));`
  );

  fs.writeFileSync(filePath, code);
}

fixScope('src/components/InvoiceDetailModal.jsx');
fixScope('src/screens/HistoryScreen.jsx');

console.log('Fixed refundAmount scope');
