const fs = require('fs');

let code = fs.readFileSync('src/screens/CustomerDetailScreen.jsx', 'utf8');

if (!code.includes('formatCasaTransaction')) {
  code = code.replace(
    /import \{([^}]+)\} from '\.\.\/toolbox\/telegramFormatter'/,
    (match, imports) => {
      if (!imports.includes('formatCasaTransaction')) {
        return `import {${imports}, formatCasaTransaction } from '../toolbox/telegramFormatter'`;
      }
      return match;
    }
  );
}

const oldCode = `      await db.transactions.add({
        id: crypto.randomUUID(), date: Date.now(), type: 'in',
        amount: amt, category: 'Debt Payment',
        description: \`Debt payment — \${customer.name}\`,
        customerId: id,
      });`;

const newCode = `      await db.transactions.add({
        id: crypto.randomUUID(), date: Date.now(), type: 'in',
        amount: amt, category: 'Debt Payment',
        description: \`Debt payment — \${customer.name}\`,
        customerId: id,
      });

      // ── Send Debt Payment to Casa Channel ──
      try {
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
          priority: 3, type: 'text', status: 'pending', createdAt: Date.now(), attemptCount: 0,
          chatIdKey: 'casaChatId',
          text: formatCasaTransaction({
            type: 'in',
            amount: amt,
            category: 'Customer Payment',
            customerName: customer.name,
            balanceBefore: casaBalance - amt,
            balance: casaBalance,
            todayIn: casaTodayIn,
            todayOut: casaTodayOut,
          }),
        });
      } catch(tgErr) {
        Logger.warn('customers', 'recordPayment', \`Telegram queue error: \${tgErr.message}\`);
      }`;

if (code.includes(oldCode)) {
  code = code.replace(oldCode, newCode);
  fs.writeFileSync('src/screens/CustomerDetailScreen.jsx', code);
  console.log('✅ CustomerDetailScreen.jsx fixed');
} else {
  console.log('⚠️  CustomerDetailScreen.jsx not found');
}
