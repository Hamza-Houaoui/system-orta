const fs = require('fs');
let code = fs.readFileSync('src/screens/HistoryScreen.jsx', 'utf8');

const oldComm = `        if (commissionVal > 0) {
           await db.transactions.add({
             id: crypto.randomUUID(), date: Date.now(), type: 'out', amount: commissionVal, category: 'Commission Paid',
             description: \`Commission - \${payingOrder.customerName} - \${payingOrder.number}\`, 
             orderId: payingOrder.id, customerId: payingOrder.customerId
           });
        }`;

const newComm = `        if (commissionVal > 0) {
           await db.transactions.add({
             id: crypto.randomUUID(), date: Date.now(), type: 'out', amount: commissionVal, category: 'Commission Paid',
             description: \`Commission - \${payingOrder.customerName} - \${payingOrder.number}\`, 
             orderId: payingOrder.id, customerId: payingOrder.customerId
           });
           
           try {
             const allTxForCasa = await db.transactions.orderBy('date').toArray();
             const _settings = await db.settings.toArray();
             const _startBudget = parseFloat((_settings[0] || {}).startBudget) || 0;
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
        }`;

code = code.replace(oldComm, newComm);
fs.writeFileSync('src/screens/HistoryScreen.jsx', code);
console.log('✅ fixed history commission');
