const fs = require('fs');

let code = fs.readFileSync('src/screens/HistoryScreen.jsx', 'utf8');

const oldTg = `      try {
        await db.telegramQueue.add({
          priority: 2, type: 'text', status: 'pending', createdAt: Date.now(), attemptCount: 0,
          chatIdKey: 'casaChatId',
          text: \`💰 <b>Payment In</b>\\nAmount: \${amt.toFixed(2)}\\nFrom: \${payingOrder.customerName} (\${payingOrder.number})\`,
        });
        await db.telegramQueue.add({
          priority: 2, type: 'text', status: 'pending', createdAt: Date.now() + 1, attemptCount: 0,
          chatIdKey: 'factureChatId',
          text: \`💰 <b>Balance paid</b>\\nAmount: \${amt.toFixed(2)}\\nFrom: \${payingOrder.customerName} - \${payingOrder.number}\`,
        });
      } catch(tgErr) { Logger.warn('invoices', 'payBalance', tgErr.message); }`;

const newTg = `      try {
        const allTxForCasa = await db.transactions.orderBy('date').toArray();
        const _settings = await db.settings.toArray();
        const _startBudget = parseFloat((_settings[0] || {}).startBudget) || 0;
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
        });
        await db.telegramQueue.add({
          priority: 2, type: 'text', status: 'pending', createdAt: Date.now() + 1, attemptCount: 0,
          chatIdKey: 'factureChatId',
          text: \`💰 <b>Balance paid</b>\\nAmount: \${amt.toFixed(2)}\\nFrom: \${payingOrder.customerName} - \${payingOrder.number}\`,
        });
      } catch(tgErr) { Logger.warn('invoices', 'payBalance', tgErr.message); }`;

if (code.includes(oldTg)) {
  code = code.replace(oldTg, newTg);
  fs.writeFileSync('src/screens/HistoryScreen.jsx', code);
  console.log('✅ HistoryScreen.jsx fixed');
} else {
  console.log('⚠️  HistoryScreen.jsx not found');
}
