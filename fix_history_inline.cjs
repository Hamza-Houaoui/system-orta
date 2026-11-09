const fs = require('fs');
let code = fs.readFileSync('src/screens/HistoryScreen.jsx', 'utf8');

// Remove the entire telegramQueue.add block from INSIDE the transaction
// leaving only the db.transactions.add for commission
const oldInside = `        if (commissionVal > 0) {
           await db.transactions.add({
             id: crypto.randomUUID(), date: Date.now(), type: 'out', amount: commissionVal, category: 'Commission Paid',
             description: \`Commission - \${payingOrder.customerName} - \${payingOrder.number}\`, 
             orderId: payingOrder.id, customerId: payingOrder.customerId
           });
           
           try {
             const allTxForCasa = await db.transactions.orderBy('date').toArray();
             const _startBudget = parseFloat(getSettings().startBudget) || 0;
             const _allIn  = allTxForCasa.filter(t => t.type === 'in').reduce((s,t) => s + (t.amount||0), 0);
             const _allOut = allTxForCasa.filter(t => t.type === 'out').reduce((s,t) => s + (t.amount||0), 0);
             const currentBalance = _startBudget + _allIn - _allOut;
             const previousBalance = currentBalance + commissionVal;
             
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
                 amount: commissionVal,
                 category: 'Commission Paid',
                 customerName: payingOrder.customerName,
                 balanceBefore: previousBalance,
                 balance: currentBalance,
                 todayIn: casaTodayIn,
                 todayOut: casaTodayOut,
               }),
             });
           } catch(tgErr) { Logger.warn('invoices', 'payBalance', tgErr.message); }
        }
        
\r\n      });`;

const newInside = `        if (commissionVal > 0) {
           await db.transactions.add({
             id: crypto.randomUUID(), date: Date.now(), type: 'out', amount: commissionVal, category: 'Commission Paid',
             description: \`Commission - \${payingOrder.customerName} - \${payingOrder.number}\`, 
             orderId: payingOrder.id, customerId: payingOrder.customerId
           });
        }
      });`;

if (code.includes(oldInside)) {
  code = code.replace(oldInside, newInside);
  fs.writeFileSync('src/screens/HistoryScreen.jsx', code);
  console.log('✅ Fixed HistoryScreen - commission telegram removed from inside transaction');
} else {
  // Try without \r\n
  const oldInside2 = oldInside.replace('        \n\r\n      });', '\n\n      });');
  if (code.includes(oldInside2)) {
    code = code.replace(oldInside2, newInside);
    fs.writeFileSync('src/screens/HistoryScreen.jsx', code);
    console.log('✅ Fixed (alt) HistoryScreen');
  } else {
    console.log('⚠️ Pattern not found - checking what is there...');
    const idx = code.indexOf('if (commissionVal > 0)');
    if (idx !== -1) console.log(JSON.stringify(code.substring(idx, idx+300)));
  }
}
