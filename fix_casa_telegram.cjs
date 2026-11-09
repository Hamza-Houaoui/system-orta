const fs = require('fs');

// ─── 1. Add formatCasaTransaction to telegramFormatter.js ───
let formatter = fs.readFileSync('src/toolbox/telegramFormatter.js', 'utf8');
const casaFn = `
export const formatCasaTransaction = ({ type, amount, category, description, balance }) => {
  const isIn = type === 'in';
  const icon = isIn ? '💚' : '🔴';
  const label = isIn ? 'IN' : 'OUT';
  let msg = \`\${icon} <b>CASA \${label}</b>\\n\`;
  msg += \`━━━━━━━━━━━━━━━━━━━━━\\n\`;
  msg += \`📋 <b>\${category || 'Transaction'}</b>\\n\`;
  if (description) msg += \`📝 \${description}\\n\`;
  msg += \`💰 Amount: <b>$\${parseFloat(amount || 0).toFixed(2)}</b>\\n\`;
  if (balance !== undefined && balance !== null) msg += \`📊 Balance: <b>$\${parseFloat(balance).toFixed(2)}</b>\\n\`;
  msg += \`📅 \${new Date().toLocaleDateString('en-GB')} \${new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}\\n\`;
  msg += \`━━━━━━━━━━━━━━━━━━━━━\\n\`;
  msg += \`🐝 System Orta\`;
  return msg;
};
`;
formatter = formatter + casaFn;
fs.writeFileSync('src/toolbox/telegramFormatter.js', formatter);
console.log('✅ formatCasaTransaction added to telegramFormatter.js');

// ─── 2. Patch NewOrderScreen.jsx — send to casaChatId after save ───
let newOrder = fs.readFileSync('src/screens/NewOrderScreen.jsx', 'utf8');

// Add import
newOrder = newOrder.replace(
  `import { formatOrderMessage } from '../toolbox/telegramFormatter';`,
  `import { formatOrderMessage, formatCasaTransaction } from '../toolbox/telegramFormatter';`
);

// After factureChatId queue, add casaChatId queue
const afterFacture = `          Logger.debug('invoices', 'saveOrder', \`Queued invoice \${number} to factureChatId\`);
        } catch(tgErr) {
          Logger.warn('invoices', 'saveOrder', \`Failed to queue Telegram facture: \${tgErr.message}\`);
        }
      }`;

const withCasa = `          Logger.debug('invoices', 'saveOrder', \`Queued invoice \${number} to factureChatId\`);
        } catch(tgErr) {
          Logger.warn('invoices', 'saveOrder', \`Failed to queue Telegram facture: \${tgErr.message}\`);
        }
        // ── Send to Casa Channel ─────────────────────────────────────────
        try {
          const allTx = await db.transactions.orderBy('date').toArray();
          const casaBalance = allTx.reduce((s, t) => s + (t.type === 'in' ? t.amount : -t.amount), 0);
          const casaDesc = finalOrderType === 'deposit'
            ? \`Deposit — \${customer.name} #\${number}\`
            : \`Sale — \${customer.name} #\${number}\`;
          await db.telegramQueue.add({
            priority: 3, type: 'text', status: 'pending',
            createdAt: Date.now(), attemptCount: 0,
            chatIdKey: 'casaChatId',
            text: formatCasaTransaction({
              type: 'in',
              amount: actualAmountPaid,
              category: finalOrderType === 'deposit' ? 'Deposit' : 'Sale',
              description: casaDesc,
              balance: casaBalance
            }),
          });
        } catch(tgErr) {
          Logger.warn('invoices', 'saveOrder', \`Failed to queue Telegram casa: \${tgErr.message}\`);
        }
      }`;

newOrder = newOrder.replace(afterFacture, withCasa);
fs.writeFileSync('src/screens/NewOrderScreen.jsx', newOrder);
console.log('✅ NewOrderScreen.jsx patched');

// ─── 3. Patch HistoryScreen.jsx — send to casaChatId on return & pay balance ───
let history = fs.readFileSync('src/screens/HistoryScreen.jsx', 'utf8');

// Add import
history = history.replace(
  `import { formatReturnMessage } from '../toolbox/telegramFormatter';`,
  `import { formatReturnMessage, formatCasaTransaction } from '../toolbox/telegramFormatter';`
);

// Check if import exists at all
if (!history.includes('formatCasaTransaction')) {
  history = history.replace(
    `from '../toolbox/telegramFormatter'`,
    `from '../toolbox/telegramFormatter'`
  );
  // find any import from telegramFormatter and add formatCasaTransaction
  history = history.replace(
    /import \{([^}]+)\} from '\.\.\/toolbox\/telegramFormatter'/,
    (match, imports) => {
      if (!imports.includes('formatCasaTransaction')) {
        return `import {${imports}, formatCasaTransaction } from '../toolbox/telegramFormatter'`;
      }
      return match;
    }
  );
}

// After return toast, add casaChatId
const afterReturnToast = `      toast.success(\`Order \${order.number} returned — \${refundAmount} refunded\`);
      Logger.info('invoices', 'returnOrder', \`Order returned, refund: \${refundAmount}\`, { id: order.id });
      load();`;

const withCasaReturn = `      toast.success(\`Order \${order.number} returned — \${refundAmount} refunded\`);
      Logger.info('invoices', 'returnOrder', \`Order returned, refund: \${refundAmount}\`, { id: order.id });
      // ── Send RETURN to Casa Channel ──────────────────────────────────
      try {
        const allTx = await db.transactions.orderBy('date').toArray();
        const casaBalance = allTx.reduce((s, t) => s + (t.type === 'in' ? t.amount : -t.amount), 0);
        await db.telegramQueue.add({
          priority: 3, type: 'text', status: 'pending',
          createdAt: Date.now(), attemptCount: 0,
          chatIdKey: 'casaChatId',
          text: formatCasaTransaction({
            type: 'out',
            amount: refundAmount,
            category: 'Return Refund',
            description: \`Return — \${order.customerName} #\${order.number}\`,
            balance: casaBalance
          }),
        });
      } catch(tgErr) {}
      load();`;

history = history.replace(afterReturnToast, withCasaReturn);

// After pay balance toast, add casaChatId
const afterPayToast = `      toast.success('Balance paid — order is now paid in full');`;
const withCasaPay = `      toast.success('Balance paid — order is now paid in full');
      // ── Send PAY BALANCE to Casa Channel ────────────────────────────
      try {
        const allTx = await db.transactions.orderBy('date').toArray();
        const casaBalance = allTx.reduce((s, t) => s + (t.type === 'in' ? t.amount : -t.amount), 0);
        await db.telegramQueue.add({
          priority: 3, type: 'text', status: 'pending',
          createdAt: Date.now(), attemptCount: 0,
          chatIdKey: 'casaChatId',
          text: formatCasaTransaction({
            type: 'in',
            amount: remaining,
            category: 'Balance Payment',
            description: \`Balance — \${payingOrder.customerName} #\${payingOrder.number}\`,
            balance: casaBalance
          }),
        });
      } catch(tgErr) {}`;

history = history.replace(afterPayToast, withCasaPay);
fs.writeFileSync('src/screens/HistoryScreen.jsx', history);
console.log('✅ HistoryScreen.jsx patched');

// ─── 4. Patch CustomerDetailScreen.jsx — send to casaChatId on payment ───
let cust = fs.readFileSync('src/screens/CustomerDetailScreen.jsx', 'utf8');
if (!cust.includes('formatCasaTransaction')) {
  cust = cust.replace(
    /import \{([^}]+)\} from '\.\.\/toolbox\/telegramFormatter'/,
    (match, imports) => `import {${imports}, formatCasaTransaction } from '../toolbox/telegramFormatter'`
  );
}

// After customer payment toast
const custPayToast = `      toast.success(\`Payment recorded: $\${amt.toFixed(2)}\`);`;
const withCasaCustPay = `      toast.success(\`Payment recorded: $\${amt.toFixed(2)}\`);
      // ── Send CUSTOMER PAYMENT to Casa Channel ───────────────────────
      try {
        const allTx = await db.transactions.orderBy('date').toArray();
        const casaBalance = allTx.reduce((s, t) => s + (t.type === 'in' ? t.amount : -t.amount), 0);
        await db.telegramQueue.add({
          priority: 3, type: 'text', status: 'pending',
          createdAt: Date.now(), attemptCount: 0,
          chatIdKey: 'casaChatId',
          text: formatCasaTransaction({
            type: 'in',
            amount: amt,
            category: 'Customer Payment',
            description: \`Payment — \${customer?.name}\`,
            balance: casaBalance
          }),
        });
      } catch(tgErr) {}`;

cust = cust.replace(custPayToast, withCasaCustPay);
fs.writeFileSync('src/screens/CustomerDetailScreen.jsx', cust);
console.log('✅ CustomerDetailScreen.jsx patched');

console.log('✅ All patches done!');
