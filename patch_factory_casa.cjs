const fs = require('fs');

let factoryDetail = fs.readFileSync('src/screens/FactoryDetailScreen.jsx', 'utf8');

// Ensure formatCasaTransaction is imported
if (!factoryDetail.includes('formatCasaTransaction')) {
  factoryDetail = factoryDetail.replace(
    /import \{([^}]+)\} from '\.\.\/toolbox\/telegramFormatter'/,
    (match, imports) => {
      if (!imports.includes('formatCasaTransaction')) {
        return `import {${imports}, formatCasaTransaction } from '../toolbox/telegramFormatter'`;
      }
      return match;
    }
  );
}

// Find the factory payment block and patch it to send a telegram queue message to casaChatId
const oldPaymentLogic = `      if (type === 'payment') {
        await db.transactions.add({
          id: uuidv4(),
          date: Date.now(),
          type: 'out',
          amount: parseFloat(form.amount) || 0,
          category: 'Factory Payment',
          description: \`Factory Payment - \${factory.name} - #\${inv.number}\`,
          factoryId: factory.id,
        });
      }`;

const newPaymentLogic = `      if (type === 'payment') {
        const amt = parseFloat(form.amount) || 0;
        await db.transactions.add({
          id: uuidv4(),
          date: Date.now(),
          type: 'out',
          amount: amt,
          category: 'Factory Payment',
          description: \`Factory Payment - \${factory.name} - #\${inv.number}\`,
          factoryId: factory.id,
        });
        
        // ── Send FACTORY PAYMENT to Casa Channel ──────────────────────
        try {
          const allTxForCasa = await db.transactions.orderBy('date').toArray();
          const casaBalanceBefore = allTxForCasa.reduce((s, t) => s + (t.type === 'in' ? t.amount : -t.amount), 0);
          const todayStart = new Date(); todayStart.setHours(0,0,0,0);
          const todayTx = allTxForCasa.filter(t => t.date >= todayStart.getTime());
          const casaTodayIn = todayTx.filter(t => t.type === 'in').reduce((s,t) => s + t.amount, 0);
          const casaTodayOut = todayTx.filter(t => t.type === 'out').reduce((s,t) => s + t.amount, 0);
          const casaBalanceAfter = casaBalanceBefore - amt; // Since it's 'out'
          
          await db.telegramQueue.add({
            priority: 3, type: 'text', status: 'pending',
            createdAt: Date.now(), attemptCount: 0,
            chatIdKey: 'casaChatId',
            text: formatCasaTransaction({
              type: 'out',
              amount: amt,
              category: 'Factory Payment',
              customerName: factory.name,
              balanceBefore: casaBalanceBefore,
              balance: casaBalanceAfter,
              todayIn: casaTodayIn,
              todayOut: casaTodayOut + amt,
            }),
          });
        } catch(tgErr) {
          Logger.warn('factories', 'saveInvoice', \`Failed to queue Telegram casa: \${tgErr.message}\`);
        }
      }`;

factoryDetail = factoryDetail.replace(oldPaymentLogic, newPaymentLogic);
fs.writeFileSync('src/screens/FactoryDetailScreen.jsx', factoryDetail);
console.log('✅ FactoryDetailScreen.jsx updated');
