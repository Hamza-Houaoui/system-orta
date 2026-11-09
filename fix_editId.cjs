const fs = require('fs');
let code = fs.readFileSync('src/screens/NewOrderScreen.jsx', 'utf8');

const target = `      if (editId) {
        const existing = await db.orders.get(editId);
        if (existing) {
          orderId = existing.id;
          number = existing.number;
          createdAt = existing.createdAt || now;
        }
      }`;

const replacement = `      if (editId) {
        const existing = await db.orders.get(editId);
        if (existing) {
          if (existing.type !== 'preforma') {
            toast.error('Cannot edit a finalized order directly. Please return it first.');
            setSaving(false);
            return;
          }
          orderId = existing.id;
          number = existing.number;
          createdAt = existing.createdAt || now;
        }
      }`;

code = code.replace(target, replacement);
fs.writeFileSync('src/screens/NewOrderScreen.jsx', code);
console.log('Fixed editId vulnerability');
