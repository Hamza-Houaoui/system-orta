const fs = require('fs');
let code = fs.readFileSync('src/screens/NewOrderScreen.jsx', 'utf8');

// Fix commission paid transaction in NewOrderScreen 
const oldComm = `          if (commission > 0) {
            await db.transactions.add({
              id: uuidv4(), date: now, type: 'out', amount: commission, category: 'Commission Paid',
              description: \`Commission for \${number}\`, orderId, customerId: customer.id,
            });
          }
        }
      });
      
      // Run outside transaction to avoid blocking UI during Telegram queue logic`;

const newComm = `          if (commission > 0) {
            await db.transactions.add({
              id: uuidv4(), date: now, type: 'out', amount: commission, category: 'Commission Paid',
              description: \`Commission for \${number}\`, orderId, customerId: customer.id,
            });
          }
        }
      });
      
      // ── Send Commission Paid to Casa Channel ─────────────────────────
      if (commission > 0 && finalOrderType !== 'preforma') {
        try {
          const allTxForCasa2 = await db.transactions.orderBy('date').toArray();
          const _settings2 = await db.settings.toArray();
          const _startBudget2 = parseFloat((_settings2[0] || {}).startBudget) || 0;
          const _allIn2  = allTxForCasa2.filter(t => t.type === 'in').reduce((s,t) => s + (t.amount||0), 0);
          const _allOut2 = allTxForCasa2.filter(t => t.type === 'out').reduce((s,t) => s + (t.amount||0), 0);
          const commBalance = _startBudget2 + _allIn2 - _allOut2;
          const todayStart2 = new Date(); todayStart2.setHours(0,0,0,0);
          const todayTx2 = allTxForCasa2.filter(t => t.date >= todayStart2.getTime());
          const cTodayIn2 = todayTx2.filter(t => t.type === 'in').reduce((s,t) => s + t.amount, 0);
          const cTodayOut2 = todayTx2.filter(t => t.type === 'out').reduce((s,t) => s + t.amount, 0);
          
          await db.telegramQueue.add({
            priority: 3, type: 'text', status: 'pending',
            createdAt: Date.now() + 2, attemptCount: 0,
            chatIdKey: 'casaChatId',
            text: formatCasaTransaction({
              type: 'out',
              amount: commission,
              category: 'Commission Paid',
              customerName: customer.name,
              balanceBefore: commBalance + commission,
              balance: commBalance,
              todayIn: cTodayIn2,
              todayOut: cTodayOut2,
            }),
          });
        } catch(tgErr) {
          Logger.warn('invoices', 'saveOrder', \`Failed to queue Telegram commission: \${tgErr.message}\`);
        }
      }

      // Run outside transaction to avoid blocking UI during Telegram queue logic`;

if (code.includes(oldComm)) {
  code = code.replace(oldComm, newComm);
  fs.writeFileSync('src/screens/NewOrderScreen.jsx', code);
  console.log('✅ fixed NewOrderScreen commission');
} else {
  console.log('⚠️ Not found in NewOrderScreen.jsx');
}
