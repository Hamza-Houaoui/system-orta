const fs = require('fs');
let code = fs.readFileSync('src/components/InvoiceDetailModal.jsx', 'utf8');

// The commission telegramQueue.add is INSIDE db.transaction which doesn't include db.telegramQueue
// This will throw and abort the whole transaction!
// Move it outside the transaction

const oldBlock = `        // The OUT transaction subtracts the unpaid difference
        if (commissionVal > 0) {
           await db.transactions.add({
             id: crypto.randomUUID(), date: Date.now(), type: 'out', amount: commissionVal, category: 'Commission Paid',
             description: \`Commission - \${order.customerName} - \${order.number}\`, orderId: order.id, customerId: order.customerId
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
                 customerName: order.customerName,
                 balanceBefore: previousBalance,
                 balance: currentBalance,
                 todayIn: casaTodayIn,
                 todayOut: casaTodayOut,
               }),
             });
           } catch(tgErr) { Logger.warn('invoices', 'payBalance', \`Telegram queue error: \${tgErr.message}\`); }
        }

        if (order.customerId) {`;

const newBlock = `        // The OUT transaction subtracts the unpaid difference
        if (commissionVal > 0) {
           await db.transactions.add({
             id: crypto.randomUUID(), date: Date.now(), type: 'out', amount: commissionVal, category: 'Commission Paid',
             description: \`Commission - \${order.customerName} - \${order.number}\`, orderId: order.id, customerId: order.customerId
           });
        }

        if (order.customerId) {`;

// Also need to add the commission casa telegram AFTER the transaction
const oldAfterTransaction = `      // ── Send payment to Casa + Facture channels ────────────────────────`;
const newAfterTransaction = `      // ── Send Commission to Casa Channel (outside transaction) ──────────────
      if (commissionVal > 0) {
        try {
          const allTxComm = await db.transactions.orderBy('date').toArray();
          const _sbComm = parseFloat(getSettings().startBudget) || 0;
          const _aiComm = allTxComm.filter(t => t.type === 'in').reduce((s,t) => s + (t.amount||0), 0);
          const _aoComm = allTxComm.filter(t => t.type === 'out').reduce((s,t) => s + (t.amount||0), 0);
          const commBalance = _sbComm + _aiComm - _aoComm;
          const todayStartComm = new Date(); todayStartComm.setHours(0,0,0,0);
          const todayTxComm = allTxComm.filter(t => t.date >= todayStartComm.getTime());
          await db.telegramQueue.add({
            priority: 3, type: 'text', status: 'pending',
            createdAt: Date.now(), attemptCount: 0,
            chatIdKey: 'casaChatId',
            text: formatCasaTransaction({
              type: 'out',
              amount: commissionVal,
              category: 'Commission Paid',
              customerName: order.customerName,
              balanceBefore: commBalance + commissionVal,
              balance: commBalance,
              todayIn: todayTxComm.filter(t => t.type === 'in').reduce((s,t) => s + t.amount, 0),
              todayOut: todayTxComm.filter(t => t.type === 'out').reduce((s,t) => s + t.amount, 0),
            }),
          });
        } catch(tgErr) { Logger.warn('invoices', 'payBalance', \`Telegram commission error: \${tgErr.message}\`); }
      }

      // ── Send payment to Casa + Facture channels ────────────────────────`;

if (code.includes(oldBlock)) {
  code = code.replace(oldBlock, newBlock);
  code = code.replace(oldAfterTransaction, newAfterTransaction);
  fs.writeFileSync('src/components/InvoiceDetailModal.jsx', code);
  console.log('✅ Fixed InvoiceDetailModal - Commission moved outside transaction');
} else {
  console.log('⚠️ Pattern not found');
  // Debug: find the block
  const idx = code.indexOf('The OUT transaction subtracts');
  if (idx !== -1) {
    console.log('Found at:', code.substring(idx, idx + 100));
  }
}
