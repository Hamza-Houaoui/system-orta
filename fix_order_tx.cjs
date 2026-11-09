const fs = require('fs');
let code = fs.readFileSync('src/screens/NewOrderScreen.jsx', 'utf8');

const targetCode = `      await db.orders.put(order);

      // Only deduct stock and log transactions if NOT a preforma quote
      if (orderType !== 'preforma') {
        // Deduct stock
        const stockLogs = [];
        for (const item of items) {
          const mc = await db.modelColors.where('catalogId').equals(item.catalogId)
            .and(mc => mc.colorId === item.colorId).first();
          if (mc) {
            const stockMap = {};
            (mc.stock || []).forEach(s => stockMap[s.size] = s.qty);
            const sizesChanged = {};
            item.sizes.forEach(({ size, qty }) => {
              stockMap[size] = (stockMap[size] || 0) - qty;
              sizesChanged[size] = (sizesChanged[size] || 0) - qty;
            });
            const newStock = Object.entries(stockMap).map(([size, qty]) => ({ size, qty }));
            await db.modelColors.update(mc.id, {
              stock: newStock
            });
            
            const newBalance = newStock.reduce((s, c) => s + c.qty, 0);
            stockLogs.push({
              id: uuidv4(), date: now, type: 'sale', ref: number,
              catalogCode: item.catalogCode, colorName: item.colorName,
              change: -item.totalQty, sizesChanged, balance: newBalance
            });

            // Re-evaluate Telegram channels after stock change
            onStockChanged(item.catalogId);
          }
        }
        if (stockLogs.length > 0) await db.stockLog.bulkAdd(stockLogs);

        // Treasury: 2-line method
        // Line 1: Full invoice value IN
        if (orderType === 'paid' || orderType === 'deposit') {
          await db.transactions.add({
            id: uuidv4(),
            date: now,
            type: 'in',
            amount: parseFloat(total.toFixed(2)),
            category: orderType === 'paid' ? 'Sale' : 'Deposit',
            description: \`\${orderType === 'paid' ? 'Sale' : 'Deposit'} - \${customer.name} - \${number}\`,
            orderId,
            customerId: customer.id,
          });

          // Line 2: Unpaid difference OUT (if customer paid less than total)
          const amountPaid = orderType === 'paid' ? (parseFloat(paidExact) || total) : (parseFloat(depositAmount) || 0);
          const unpaid = total - amountPaid;
          
          if (unpaid > 0) {
            await db.transactions.add({
              id: uuidv4(),
              date: now + 1, // Add 1ms to ensure it appears AFTER the IN transaction in the timeline
              type: 'out',
              amount: parseFloat(unpaid.toFixed(2)),
              category: 'Unpaid Balance',
              description: \`Unpaid balance - \${customer.name} - \${number}\`,
              orderId,
              customerId: customer.id,
            });
          }
        }

        // Commission out (when customer paid MORE than invoice = seller got commission)
        if (commission > 0) {
          await db.transactions.add({
            id: uuidv4(), date: now, type: 'out',
            amount: commission, category: 'Commission Paid',
            description: \`Commission for \${number}\`,
            orderId, customerId: customer.id,
          });
        }
      }`;

const txReplacementCode = `      const catalogIdsToUpdate = new Set();
      
      await db.transaction('rw', [db.orders, db.modelColors, db.stockLog, db.transactions, db.telegramQueue, db.telegramMessages, db.catalog], async () => {
        await db.orders.put(order);

        if (orderType !== 'preforma') {
          const stockLogs = [];
          for (const item of items) {
            const mc = await db.modelColors.where('catalogId').equals(item.catalogId)
              .and(mc => mc.colorId === item.colorId).first();
            if (mc) {
              const stockMap = {};
              (mc.stock || []).forEach(s => stockMap[s.size] = s.qty);
              const sizesChanged = {};
              item.sizes.forEach(({ size, qty }) => {
                stockMap[size] = (stockMap[size] || 0) - qty;
                sizesChanged[size] = (sizesChanged[size] || 0) - qty;
              });
              const newStock = Object.entries(stockMap).map(([size, qty]) => ({ size, qty }));
              await db.modelColors.update(mc.id, { stock: newStock });
              
              const newBalance = newStock.reduce((s, c) => s + c.qty, 0);
              stockLogs.push({
                id: uuidv4(), date: now, type: 'sale', ref: number,
                catalogCode: item.catalogCode, colorName: item.colorName,
                change: -item.totalQty, sizesChanged, balance: newBalance
              });

              catalogIdsToUpdate.add(item.catalogId);
            }
          }
          if (stockLogs.length > 0) await db.stockLog.bulkAdd(stockLogs);

          if (orderType === 'paid' || orderType === 'deposit') {
            await db.transactions.add({
              id: uuidv4(), date: now, type: 'in', amount: parseFloat(total.toFixed(2)),
              category: orderType === 'paid' ? 'Sale' : 'Deposit',
              description: \`\${orderType === 'paid' ? 'Sale' : 'Deposit'} - \${customer.name} - \${number}\`,
              orderId, customerId: customer.id,
            });

            const amountPaid = orderType === 'paid' ? (parseFloat(paidExact) || total) : (parseFloat(depositAmount) || 0);
            const unpaid = total - amountPaid;
            
            if (unpaid > 0) {
              await db.transactions.add({
                id: uuidv4(), date: now + 1, type: 'out', amount: parseFloat(unpaid.toFixed(2)),
                category: 'Unpaid Balance', description: \`Unpaid balance - \${customer.name} - \${number}\`,
                orderId, customerId: customer.id,
              });
            }
          }

          if (commission > 0) {
            await db.transactions.add({
              id: uuidv4(), date: now, type: 'out', amount: commission, category: 'Commission Paid',
              description: \`Commission for \${number}\`, orderId, customerId: customer.id,
            });
          }
        }
      });
      
      // Run outside transaction to avoid blocking UI during Telegram queue logic
      for (const catId of catalogIdsToUpdate) {
        onStockChanged(catId).catch(() => {});
      }`;

code = code.replace(targetCode, txReplacementCode);
fs.writeFileSync('src/screens/NewOrderScreen.jsx', code);
console.log('Fixed NewOrderScreen transaction');
