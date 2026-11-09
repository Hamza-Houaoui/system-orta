const fs = require('fs');
let code = fs.readFileSync('src/screens/NewOrderScreen.jsx', 'utf8');

// 1. Add editCloneId param
code = code.replace(
  `  const editId = searchParams.get('editId');
  const cloneId = searchParams.get('cloneId');`,
  `  const editId = searchParams.get('editId');
  const cloneId = searchParams.get('cloneId');
  const editCloneId = searchParams.get('editCloneId');`
);

// 2. Update reset useEffect to include editCloneId
code = code.replace(
  `if (items.length === 0 && !editId && !cloneId) {`,
  `if (items.length === 0 && !editId && !cloneId && !editCloneId) {`
);
code = code.replace(
  `}, [items.length, editId, cloneId]);`,
  `}, [items.length, editId, cloneId, editCloneId]);`
);

// 3. Add editCloneId load in useEffect
code = code.replace(
  `    if (editId) loadOrderForEdit(editId);
    if (cloneId) loadOrderForEdit(cloneId);`,
  `    if (editId) loadOrderForEdit(editId);
    if (cloneId) loadOrderForEdit(cloneId);
    if (editCloneId) loadOrderForEdit(editCloneId);`
);

// 4. In saveOrder, after building `order` object and before db transaction, add auto-return logic for editCloneId
const TARGET_SAVE = `if (editId) {
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

const REPLACEMENT_SAVE = `if (editId) {
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
      }

      // editCloneId: auto-return the original order silently, then create new
      if (editCloneId) {
        const original = await db.orders.get(editCloneId);
        if (original && original.type !== 'returned') {
          // Restore stock
          for (const item of original.items || []) {
            const mc = await db.modelColors.where('catalogId').equals(item.catalogId).and(m => m.colorId === item.colorId).first();
            if (mc) {
              const stockMap = {};
              (mc.stock || []).forEach(s => stockMap[s.size] = s.qty);
              (item.sizes || []).forEach(({ size, qty }) => { stockMap[size] = (stockMap[size] || 0) + qty; });
              await db.modelColors.update(mc.id, { stock: Object.entries(stockMap).map(([size, qty]) => ({ size, qty })) });
            }
          }
          // Refund treasury
          const refundAmt = Math.max(0, Math.min(original.paidAmount || 0, original.totalPrice || 0) - (original.commission || 0));
          if (refundAmt > 0) {
            await db.transactions.add({
              id: uuidv4(), date: now, type: 'out', amount: refundAmt,
              category: 'Customer Return',
              description: \`Return (Edit) - \${original.customerName} - \${original.number}\`,
              orderId: original.id, customerId: original.customerId,
            });
          }
          // Mark original as returned
          await db.orders.update(editCloneId, { type: 'returned', status: 'returned' });
        }
      }`;

code = code.replace(TARGET_SAVE, REPLACEMENT_SAVE);

fs.writeFileSync('src/screens/NewOrderScreen.jsx', code);
console.log('Done');
