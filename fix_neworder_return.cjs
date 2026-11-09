const fs = require('fs');
let code = fs.readFileSync('src/screens/NewOrderScreen.jsx', 'utf8');

const oldReturn = `          // Refund treasury
          const refundAmt = Math.max(0, Math.min(original.paidAmount || 0, original.totalPrice || 0) - (original.commission || 0));
          if (refundAmt > 0) {
            await db.transactions.add({
              id: uuidv4(), date: now, type: 'out', amount: refundAmt,
              category: 'Customer Return',
              description: \`Return (Edit) - \${original.customerName} - \${original.number}\`,
              orderId: original.id, customerId: original.customerId,
            });
          }`;

const newReturn = `          // Refund treasury
          const refundAmt = Math.max(0, Math.min(original.paidAmount || 0, original.totalPrice || 0) - (original.commission || 0));
          if (refundAmt > 0) {
            await db.transactions.add({
              id: uuidv4(), date: now, type: 'out', amount: refundAmt,
              category: 'Customer Return',
              description: \`Return (Edit) - \${original.customerName} - \${original.number}\`,
              orderId: original.id, customerId: original.customerId,
            });
            // ── Casa Telegram for Return (Edit) ─────────────────────
            try {
              const allTxRetCasa = await db.transactions.orderBy('date').toArray();
              const _settRet = await db.settings.toArray();
              const _sbRet = parseFloat((_settRet[0] || {}).startBudget) || 0;
              const _aiRet = allTxRetCasa.filter(t => t.type === 'in').reduce((s,t) => s + (t.amount||0), 0);
              const _aoRet = allTxRetCasa.filter(t => t.type === 'out').reduce((s,t) => s + (t.amount||0), 0);
              const retBal = _sbRet + _aiRet - _aoRet;
              const todayStartRet = new Date(); todayStartRet.setHours(0,0,0,0);
              const todayTxRet = allTxRetCasa.filter(t => t.date >= todayStartRet.getTime());
              const cTodayInRet = todayTxRet.filter(t => t.type === 'in').reduce((s,t) => s + t.amount, 0);
              const cTodayOutRet = todayTxRet.filter(t => t.type === 'out').reduce((s,t) => s + t.amount, 0);
              await db.telegramQueue.add({
                priority: 3, type: 'text', status: 'pending',
                createdAt: Date.now(), attemptCount: 0,
                chatIdKey: 'casaChatId',
                text: formatCasaTransaction({
                  type: 'out',
                  amount: refundAmt,
                  category: 'Return Refund',
                  customerName: original.customerName,
                  balanceBefore: retBal + refundAmt,
                  balance: retBal,
                  todayIn: cTodayInRet,
                  todayOut: cTodayOutRet,
                }),
              });
            } catch(tgRetErr) { Logger.warn('invoices', 'saveOrder', \`Casa telegram error: \${tgRetErr.message}\`); }
          }`;

if (code.includes(oldReturn)) {
  code = code.replace(oldReturn, newReturn);
  fs.writeFileSync('src/screens/NewOrderScreen.jsx', code);
  console.log('✅ fixed NewOrderScreen Return Casa');
} else {
  console.log('⚠️ Not found');
}
