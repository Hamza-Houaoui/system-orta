const fs = require('fs');

let code = fs.readFileSync('src/components/InvoiceDetailModal.jsx', 'utf8');

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

const oldTg = `      // ── Send payment to Casa + Facture channels ────────────────────────
      try {
        await db.telegramQueue.add({
          priority: 2, type: 'text', status: 'pending', createdAt: Date.now(), attemptCount: 0,
          chatIdKey: 'casaChatId',
          text: formatPaymentMessage(\`\${order.customerName} (\${order.number})\`, amt.toFixed(2), 'in'),
        });
        await db.telegramQueue.add({
          priority: 2, type: 'text', status: 'pending', createdAt: Date.now() + 1, attemptCount: 0,
          chatIdKey: 'factureChatId',
          text: formatPaymentMessage(\`Balance paid: \${order.customerName} - \${order.number}\`, amt.toFixed(2), 'in'),
        });
      } catch(tgErr) { Logger.warn('invoices', 'payBalance', \`Telegram queue error: \${tgErr.message}\`); }`;

const newTg = `      // ── Send payment to Casa + Facture channels ────────────────────────
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
          priority: 2, type: 'text', status: 'pending', createdAt: Date.now(), attemptCount: 0,
          chatIdKey: 'casaChatId',
          text: formatCasaTransaction({
            type: 'in',
            amount: amt,
            category: 'Balance Payment',
            customerName: order.customerName,
            balanceBefore: casaBalance - amt,
            balance: casaBalance,
            todayIn: casaTodayIn,
            todayOut: casaTodayOut,
          }),
        });
        await db.telegramQueue.add({
          priority: 2, type: 'text', status: 'pending', createdAt: Date.now() + 1, attemptCount: 0,
          chatIdKey: 'factureChatId',
          text: formatPaymentMessage(\`Balance paid: \${order.customerName} - \${order.number}\`, amt.toFixed(2), 'in'),
        });
      } catch(tgErr) { Logger.warn('invoices', 'payBalance', \`Telegram queue error: \${tgErr.message}\`); }`;

if (code.includes(oldTg)) {
  code = code.replace(oldTg, newTg);
  fs.writeFileSync('src/components/InvoiceDetailModal.jsx', code);
  console.log('✅ InvoiceDetailModal.jsx fixed');
} else {
  console.log('⚠️  InvoiceDetailModal.jsx not found');
}
