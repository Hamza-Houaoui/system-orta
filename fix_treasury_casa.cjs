const fs = require('fs');
let treasury = fs.readFileSync('src/screens/TreasuryScreen.jsx', 'utf8');

// Update import to include formatCasaTransaction
treasury = treasury.replace(
  /import \{([^}]+)\} from '\.\.\/toolbox\/telegramFormatter'/,
  (match, imports) => {
    if (!imports.includes('formatCasaTransaction')) {
      return `import {${imports}, formatCasaTransaction } from '../toolbox/telegramFormatter'`;
    }
    return match;
  }
);

// Replace manual transaction telegram call
const oldManualTg = `      // ── Send to Casa Channel on Telegram ───────────────────────────
      try {
        const tgText = formatPaymentMessage(
          form.description || (type === 'in' ? 'Manual Income' : 'Manual Expense'),
          parseFloat(form.amount).toFixed(2),
          type
        );
        await db.telegramQueue.add({
          priority: 2,
          type: 'text',
          status: 'pending',
          createdAt: Date.now(),
          attemptCount: 0,
          chatIdKey: 'casaChatId',
          text: tgText,
        });
        Logger.debug('treasury', 'addTransaction', \`Queued \${type} $\${form.amount} to casaChatId\`);
      } catch(tgErr) {
        Logger.warn('treasury', 'addTransaction', \`Failed to queue Telegram casa: \${tgErr.message}\`);
      }`;

const newManualTg = `      // ── Send to Casa Channel on Telegram ───────────────────────────
      try {
        const allTxForCasa = await db.transactions.orderBy('date').toArray();
        const casaBalanceBefore = allTxForCasa.reduce((s, t) => s + (t.type === 'in' ? t.amount : -t.amount), 0);
        const todayStart = new Date(); todayStart.setHours(0,0,0,0);
        const todayTx = allTxForCasa.filter(t => t.date >= todayStart.getTime());
        const casaTodayIn = todayTx.filter(t => t.type === 'in').reduce((s,t) => s + t.amount, 0);
        const casaTodayOut = todayTx.filter(t => t.type === 'out').reduce((s,t) => s + t.amount, 0);
        const amt = parseFloat(form.amount) || 0;
        const casaBalanceAfter = type === 'in' ? casaBalanceBefore + amt : casaBalanceBefore - amt;
        await db.telegramQueue.add({
          priority: 2,
          type: 'text',
          status: 'pending',
          createdAt: Date.now(),
          attemptCount: 0,
          chatIdKey: 'casaChatId',
          text: formatCasaTransaction({
            type,
            amount: amt,
            category: type === 'in' ? 'Manual IN' : 'Manual OUT',
            customerName: form.description || null,
            balanceBefore: casaBalanceBefore,
            balance: casaBalanceAfter,
            todayIn: type === 'in' ? casaTodayIn + amt : casaTodayIn,
            todayOut: type === 'out' ? casaTodayOut + amt : casaTodayOut,
          }),
        });
        Logger.debug('treasury', 'addTransaction', \`Queued \${type} $\${form.amount} to casaChatId\`);
      } catch(tgErr) {
        Logger.warn('treasury', 'addTransaction', \`Failed to queue Telegram casa: \${tgErr.message}\`);
      }`;

treasury = treasury.replace(oldManualTg, newManualTg);
fs.writeFileSync('src/screens/TreasuryScreen.jsx', treasury);
console.log('✅ TreasuryScreen.jsx updated');
