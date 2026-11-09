const fs = require('fs');
let code = fs.readFileSync('src/components/InvoiceDetailModal.jsx', 'utf8');

const target = `    try {
      const now = Date.now();
      await db.orders.update(order.id, { type: 'returned', status: 'returned' });

      // Restore stock + log movements
      const stockLogs = [];
      for (const item of order.items || []) {
        const mc = await db.modelColors
          .where('catalogId').equals(item.catalogId)
          .and(mc => mc.colorId === item.colorId).first();
        if (mc) {
          const stockMap = {};
          (mc.stock || []).forEach(s => stockMap[s.size] = s.qty);
          const sizesChanged = {};
          (item.sizes || []).forEach(({ size, qty }) => {
            stockMap[size] = (stockMap[size] || 0) + qty;
            sizesChanged[size] = qty;
          });
          const newStock = Object.entries(stockMap).map(([size, qty]) => ({ size, qty }));
          await db.modelColors.update(mc.id, { stock: newStock });
          
          const newBalance = newStock.reduce((s, c) => s + c.qty, 0);
          stockLogs.push({
            id: crypto.randomUUID(), date: now, type: 'customer_return', ref: order.number,
            catalogCode: item.catalogCode, colorName: item.colorName,
            change: (item.sizes || []).reduce((s, x) => s + x.qty, 0),
            sizesChanged, balance: newBalance
          });
          
          onStockChanged(item.catalogId);
        }
      }
      if (stockLogs.length > 0) await db.stockLog.bulkAdd(stockLogs);

      const refundAmount = order.paidAmount || 0;
      if (refundAmount > 0) {
        await db.transactions.add({
          id: crypto.randomUUID(), date: now, type: 'out', amount: refundAmount, category: 'Customer Return',
          description: \`Return - \${order.customerName} - \${order.number}\`, orderId: order.id, customerId: order.customerId,
        });
      }

      if (order.customerId && order.type === 'deposit') {
        const cust = await db.customers.get(order.customerId);
        if (cust) {
          const remaining = (order.totalPrice || 0) - (order.paidAmount || 0);
          if (remaining > 0) {
            await db.customers.update(order.customerId, { credit: Math.max(0, (cust.credit || 0) - remaining) });
          }
        }
      }`;

const replacement = `    try {
      const now = Date.now();
      const catalogIdsToUpdate = new Set();
      
      await db.transaction('rw', [db.orders, db.modelColors, db.stockLog, db.transactions, db.customers, db.catalog, db.sizeSeries], async () => {
        const currentOrder = await db.orders.get(order.id);
        if (currentOrder.type === 'returned') {
          throw new Error('Order already returned');
        }
      
        await db.orders.update(order.id, { type: 'returned', status: 'returned' });

        const stockLogs = [];
        for (const item of order.items || []) {
          const mc = await db.modelColors
            .where('catalogId').equals(item.catalogId)
            .and(mc => mc.colorId === item.colorId).first();
          if (mc) {
            const stockMap = {};
            (mc.stock || []).forEach(s => stockMap[s.size] = s.qty);
            const sizesChanged = {};
            (item.sizes || []).forEach(({ size, qty }) => {
              stockMap[size] = (stockMap[size] || 0) + qty;
              sizesChanged[size] = qty;
            });
            const newStock = Object.entries(stockMap).map(([size, qty]) => ({ size, qty }));
            await db.modelColors.update(mc.id, { stock: newStock });
            
            const newBalance = newStock.reduce((s, c) => s + c.qty, 0);
            stockLogs.push({
              id: crypto.randomUUID(), date: now, type: 'customer_return', ref: order.number,
              catalogCode: item.catalogCode, colorName: item.colorName,
              change: (item.sizes || []).reduce((s, x) => s + x.qty, 0),
              sizesChanged, balance: newBalance
            });
            
            catalogIdsToUpdate.add(item.catalogId);
          }
        }
        if (stockLogs.length > 0) await db.stockLog.bulkAdd(stockLogs);

        const refundAmount = order.paidAmount || 0;
        if (refundAmount > 0) {
          await db.transactions.add({
            id: crypto.randomUUID(), date: now, type: 'out', amount: refundAmount, category: 'Customer Return',
            description: \`Return - \${order.customerName} - \${order.number}\`, orderId: order.id, customerId: order.customerId,
          });
        }

        if (order.customerId && order.type === 'deposit') {
          const cust = await db.customers.get(order.customerId);
          if (cust) {
            const remaining = (order.totalPrice || 0) - (order.paidAmount || 0);
            if (remaining > 0) {
              await db.customers.update(order.customerId, { credit: Math.max(0, (cust.credit || 0) - remaining) });
            }
          }
        }
      });
      
      for (const catId of catalogIdsToUpdate) {
        onStockChanged(catId).catch(()=>{});
      }`;

code = code.replace(target, replacement);
fs.writeFileSync('src/components/InvoiceDetailModal.jsx', code);
console.log('Fixed handleReturn transaction in modal');
