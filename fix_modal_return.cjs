const fs = require('fs');
let code = fs.readFileSync('src/components/InvoiceDetailModal.jsx', 'utf8');

const oldReturn = `      for (const catId of catalogIdsToUpdate) {
        onStockChanged(catId).catch(()=>{});
      }`;

const newReturn = `      for (const catId of catalogIdsToUpdate) {
        onStockChanged(catId).catch(()=>{});
      }

      if (refundAmount > 0) {
        try {
          const allTxForCasa = await db.transactions.orderBy('date').toArray();
          const _settings = await db.settings.toArray();
          const _startBudget = parseFloat((_settings[0] || {}).startBudget) || 0;
          const _allIn  = allTxForCasa.filter(t => t.type === 'in').reduce((s,t) => s + (t.amount||0), 0);
          const _allOut = allTxForCasa.filter(t => t.type === 'out').reduce((s,t) => s + (t.amount||0), 0);
          const currentBalance = _startBudget + _allIn - _allOut;
          const previousBalance = currentBalance + refundAmount;
          
          const todayStart = new Date(); todayStart.setHours(0,0,0,0);
          const todayTx = allTxForCasa.filter(t => t.date >= todayStart.getTime());
          const casaTodayIn = todayTx.filter(t => t.type === 'in').reduce((s,t) => s + t.amount, 0);
          const casaTodayOut = todayTx.filter(t => t.type === 'out').reduce((s,t) => s + t.amount, 0);
          
          await db.telegramQueue.add({
            priority: 3, type: 'text', status: 'pending',
            createdAt: Date.now(), attemptCount: 0,
            chatIdKey: 'casaChatId',
            text: formatCasaTransaction({
              type: 'out',
              amount: refundAmount,
              category: 'Return Refund',
              customerName: order.customerName,
              balanceBefore: previousBalance,
              balance: currentBalance,
              todayIn: casaTodayIn,
              todayOut: casaTodayOut,
            }),
          });
        } catch(tgErr) { Logger.warn('invoices', 'returnOrder', tgErr.message); }
      }`;

code = code.replace(oldReturn, newReturn);
fs.writeFileSync('src/components/InvoiceDetailModal.jsx', code);
console.log('✅ fixed modal return');
