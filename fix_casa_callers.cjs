const fs = require('fs');

// Helper function text to compute casa stats (to inject before each call)
const casaHelper = `
          // ── Compute Casa Stats ───────────────────────────────────────────
          const allTxForCasa = await db.transactions.orderBy('date').toArray();
          const casaBalanceBefore = allTxForCasa.reduce((s, t) => s + (t.type === 'in' ? t.amount : -t.amount), 0);
          const todayStart = new Date(); todayStart.setHours(0,0,0,0);
          const todayTx = allTxForCasa.filter(t => t.date >= todayStart.getTime());
          const casaTodayIn = todayTx.filter(t => t.type === 'in').reduce((s,t) => s + t.amount, 0);
          const casaTodayOut = todayTx.filter(t => t.type === 'out').reduce((s,t) => s + t.amount, 0);
`;

// ─── 1. NewOrderScreen.jsx ───
let newOrder = fs.readFileSync('src/screens/NewOrderScreen.jsx', 'utf8');

const oldNewOrderCasa = `        // ── Send to Casa Channel ─────────────────────────────────────────
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
        }`;

const newNewOrderCasa = `        // ── Send to Casa Channel ─────────────────────────────────────────
        try {
          const allTxForCasa = await db.transactions.orderBy('date').toArray();
          const casaBalanceBefore = allTxForCasa.reduce((s, t) => s + (t.type === 'in' ? t.amount : -t.amount), 0);
          const todayStart = new Date(); todayStart.setHours(0,0,0,0);
          const todayTx = allTxForCasa.filter(t => t.date >= todayStart.getTime());
          const casaTodayIn = todayTx.filter(t => t.type === 'in').reduce((s,t) => s + t.amount, 0);
          const casaTodayOut = todayTx.filter(t => t.type === 'out').reduce((s,t) => s + t.amount, 0);
          const casaBalanceAfter = casaBalanceBefore + actualAmountPaid;
          await db.telegramQueue.add({
            priority: 3, type: 'text', status: 'pending',
            createdAt: Date.now(), attemptCount: 0,
            chatIdKey: 'casaChatId',
            text: formatCasaTransaction({
              type: 'in',
              amount: actualAmountPaid,
              category: finalOrderType === 'deposit' ? 'Deposit' : 'Sale',
              customerName: customer.name,
              balanceBefore: casaBalanceBefore,
              balance: casaBalanceAfter,
              todayIn: casaTodayIn + actualAmountPaid,
              todayOut: casaTodayOut,
            }),
          });
        } catch(tgErr) {
          Logger.warn('invoices', 'saveOrder', \`Failed to queue Telegram casa: \${tgErr.message}\`);
        }`;

newOrder = newOrder.replace(oldNewOrderCasa, newNewOrderCasa);
fs.writeFileSync('src/screens/NewOrderScreen.jsx', newOrder);
console.log('✅ NewOrderScreen.jsx updated');

// ─── 2. HistoryScreen.jsx — Return ───
let history = fs.readFileSync('src/screens/HistoryScreen.jsx', 'utf8');

const oldHistoryReturn = `      // ── Send RETURN to Casa Channel ──────────────────────────────────
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
      } catch(tgErr) {}`;

const newHistoryReturn = `      // ── Send RETURN to Casa Channel ──────────────────────────────────
      try {
        const allTxForCasa = await db.transactions.orderBy('date').toArray();
        const casaBalanceBefore = allTxForCasa.reduce((s, t) => s + (t.type === 'in' ? t.amount : -t.amount), 0);
        const todayStart = new Date(); todayStart.setHours(0,0,0,0);
        const todayTx = allTxForCasa.filter(t => t.date >= todayStart.getTime());
        const casaTodayIn = todayTx.filter(t => t.type === 'in').reduce((s,t) => s + t.amount, 0);
        const casaTodayOut = todayTx.filter(t => t.type === 'out').reduce((s,t) => s + t.amount, 0);
        const casaBalanceAfter = casaBalanceBefore - refundAmount;
        await db.telegramQueue.add({
          priority: 3, type: 'text', status: 'pending',
          createdAt: Date.now(), attemptCount: 0,
          chatIdKey: 'casaChatId',
          text: formatCasaTransaction({
            type: 'out',
            amount: refundAmount,
            category: 'Return Refund',
            customerName: order.customerName,
            balanceBefore: casaBalanceBefore,
            balance: casaBalanceAfter,
            todayIn: casaTodayIn,
            todayOut: casaTodayOut + refundAmount,
          }),
        });
      } catch(tgErr) {}`;

history = history.replace(oldHistoryReturn, newHistoryReturn);

// ── HistoryScreen — Pay Balance ──
const oldHistoryPay = `      // ── Send PAY BALANCE to Casa Channel ────────────────────────────
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

const newHistoryPay = `      // ── Send PAY BALANCE to Casa Channel ────────────────────────────
      try {
        const allTxForCasa = await db.transactions.orderBy('date').toArray();
        const casaBalanceBefore = allTxForCasa.reduce((s, t) => s + (t.type === 'in' ? t.amount : -t.amount), 0);
        const todayStart = new Date(); todayStart.setHours(0,0,0,0);
        const todayTx = allTxForCasa.filter(t => t.date >= todayStart.getTime());
        const casaTodayIn = todayTx.filter(t => t.type === 'in').reduce((s,t) => s + t.amount, 0);
        const casaTodayOut = todayTx.filter(t => t.type === 'out').reduce((s,t) => s + t.amount, 0);
        const casaBalanceAfter = casaBalanceBefore + remaining;
        await db.telegramQueue.add({
          priority: 3, type: 'text', status: 'pending',
          createdAt: Date.now(), attemptCount: 0,
          chatIdKey: 'casaChatId',
          text: formatCasaTransaction({
            type: 'in',
            amount: remaining,
            category: 'Balance Payment',
            customerName: payingOrder.customerName,
            balanceBefore: casaBalanceBefore,
            balance: casaBalanceAfter,
            todayIn: casaTodayIn + remaining,
            todayOut: casaTodayOut,
          }),
        });
      } catch(tgErr) {}`;

history = history.replace(oldHistoryPay, newHistoryPay);
fs.writeFileSync('src/screens/HistoryScreen.jsx', history);
console.log('✅ HistoryScreen.jsx updated');

// ─── 3. CustomerDetailScreen.jsx ───
let cust = fs.readFileSync('src/screens/CustomerDetailScreen.jsx', 'utf8');

const oldCustPay = `      // ── Send CUSTOMER PAYMENT to Casa Channel ───────────────────────
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

const newCustPay = `      // ── Send CUSTOMER PAYMENT to Casa Channel ───────────────────────
      try {
        const allTxForCasa = await db.transactions.orderBy('date').toArray();
        const casaBalanceBefore = allTxForCasa.reduce((s, t) => s + (t.type === 'in' ? t.amount : -t.amount), 0);
        const todayStart = new Date(); todayStart.setHours(0,0,0,0);
        const todayTx = allTxForCasa.filter(t => t.date >= todayStart.getTime());
        const casaTodayIn = todayTx.filter(t => t.type === 'in').reduce((s,t) => s + t.amount, 0);
        const casaTodayOut = todayTx.filter(t => t.type === 'out').reduce((s,t) => s + t.amount, 0);
        const casaBalanceAfter = casaBalanceBefore + amt;
        await db.telegramQueue.add({
          priority: 3, type: 'text', status: 'pending',
          createdAt: Date.now(), attemptCount: 0,
          chatIdKey: 'casaChatId',
          text: formatCasaTransaction({
            type: 'in',
            amount: amt,
            category: 'Customer Payment',
            customerName: customer?.name,
            balanceBefore: casaBalanceBefore,
            balance: casaBalanceAfter,
            todayIn: casaTodayIn + amt,
            todayOut: casaTodayOut,
          }),
        });
      } catch(tgErr) {}`;

cust = cust.replace(oldCustPay, newCustPay);
fs.writeFileSync('src/screens/CustomerDetailScreen.jsx', cust);
console.log('✅ CustomerDetailScreen.jsx updated');

// ─── 4. Update TreasuryScreen too (manual IN/OUT) ───
let treasury = fs.readFileSync('src/screens/TreasuryScreen.jsx', 'utf8');
// Check what the treasury screen sends
console.log('Treasury casa calls:', (treasury.match(/casaChatId/g) || []).length);
fs.writeFileSync('src/screens/TreasuryScreen.jsx', treasury);
console.log('✅ All files updated!');
