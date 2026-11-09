const fs = require('fs');
let code = fs.readFileSync('src/screens/HistoryScreen.jsx', 'utf8');

// Remove commission telegram from INSIDE the transaction
const oldComm = `        if (commissionVal > 0) {
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

const newComm = `        if (commissionVal > 0) {
           await db.transactions.add({
             id: crypto.randomUUID(), date: Date.now(), type: 'out', amount: commissionVal, category: 'Commission Paid',
             description: \`Commission - \${payingOrder.customerName} - \${payingOrder.number}\`, 
             orderId: payingOrder.id, customerId: payingOrder.customerId
           });
        }
      });`;

const oldAfter = `      try {
        const allTxForCasa = await db.transactions.orderBy('date').toArray();
        const _startBudget = parseFloat(getSettings().startBudget) || 0;
        const _allIn  = allTxForCasa.filter(t => t.type === 'in').reduce((s,t) => s + (t.amount||0), 0);
        const _allOut = allTxForCasa.filter(t => t.type === 'out').reduce((s,t) => s + (t.amount||0), 0);
        const casaBalance = _startBudget + _allIn - _allOut;
        const todayStart = new Date(); todayStart.setHours(0,0,0,0);
        const todayTx = allTxForCasa.filter(t => t.date >= todayStart.getTime());
        const casaTodayIn = todayTx.filter(t => t.type === 'in').reduce((s,t) => s + t.amount, 0);
        const casaTodayOut = todayTx.filter(t => t.type === 'out').reduce((s,t) => s + t.amount, 0);

        await db.telegramQueue.add({
          priority: 2, type: 'text', status: 'pending', createdAt: Date.now(), attemptCount: 0,
          chatIdKey: 'casaChatId',
          text: formatCasaTransaction({
            type: 'in',
            amount: amt,
            category: 'Balance Payment',
            customerName: payingOrder.customerName,
            balanceBefore: casaBalance - amt,
            balance: casaBalance,
            todayIn: casaTodayIn,
            todayOut: casaTodayOut,
          }),
        });`;

const newAfter = `      try {
        const allTxForCasa = await db.transactions.orderBy('date').toArray();
        const _startBudget = parseFloat(getSettings().startBudget) || 0;
        const _allIn  = allTxForCasa.filter(t => t.type === 'in').reduce((s,t) => s + (t.amount||0), 0);
        const _allOut = allTxForCasa.filter(t => t.type === 'out').reduce((s,t) => s + (t.amount||0), 0);
        const casaBalance = _startBudget + _allIn - _allOut;
        const todayStart = new Date(); todayStart.setHours(0,0,0,0);
        const todayTx = allTxForCasa.filter(t => t.date >= todayStart.getTime());
        const casaTodayIn = todayTx.filter(t => t.type === 'in').reduce((s,t) => s + t.amount, 0);
        const casaTodayOut = todayTx.filter(t => t.type === 'out').reduce((s,t) => s + t.amount, 0);

        // IN: Balance Payment
        await db.telegramQueue.add({
          priority: 2, type: 'text', status: 'pending', createdAt: Date.now(), attemptCount: 0,
          chatIdKey: 'casaChatId',
          text: formatCasaTransaction({
            type: 'in',
            amount: amt,
            category: 'Balance Payment',
            customerName: payingOrder.customerName,
            balanceBefore: casaBalance - amt,
            balance: casaBalance,
            todayIn: casaTodayIn,
            todayOut: casaTodayOut,
          }),
        });
        // OUT: Commission (if any)
        const commVal = (payingOrder.totalPrice || 0) - (payingOrder.paidAmount || 0) - amt;
        if (commVal > 0) {
          await db.telegramQueue.add({
            priority: 3, type: 'text', status: 'pending', createdAt: Date.now() + 2, attemptCount: 0,
            chatIdKey: 'casaChatId',
            text: formatCasaTransaction({
              type: 'out',
              amount: commVal,
              category: 'Commission Paid',
              customerName: payingOrder.customerName,
              balanceBefore: casaBalance + commVal,
              balance: casaBalance,
              todayIn: casaTodayIn,
              todayOut: casaTodayOut,
            }),
          });
        }`;

if (code.includes(oldComm)) {
  code = code.replace(oldComm, newComm);
  console.log('✅ Removed commission from inside transaction');
} else {
  console.log('⚠️ oldComm not found');
}

if (code.includes(oldAfter)) {
  code = code.replace(oldAfter, newAfter);
  console.log('✅ Added commission outside transaction');
} else {
  console.log('⚠️ oldAfter not found');
}

fs.writeFileSync('src/screens/HistoryScreen.jsx', code);
console.log('✅ Saved HistoryScreen.jsx');
