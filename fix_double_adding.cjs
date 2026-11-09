const fs = require('fs');

const files = {
  'src/screens/TreasuryScreen.jsx': {
    wrong: `const amt = parseFloat(form.amount) || 0;
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
            todayOut: type === 'out' ? casaTodayOut + amt : casaTodayOut,`,
    right: `const amt = parseFloat(form.amount) || 0;
        // allTxForCasa already includes the new transaction, so casaBalanceBefore is actually the NEW balance
        const currentBalance = casaBalanceBefore;
        const previousBalance = type === 'in' ? currentBalance - amt : currentBalance + amt;
        
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
            balanceBefore: previousBalance,
            balance: currentBalance,
            todayIn: casaTodayIn,
            todayOut: casaTodayOut,`
  },
  'src/screens/NewOrderScreen.jsx': {
    wrong: `const casaBalanceBefore = _startBudget + _allIn - _allOut;
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
            category: isDeposit ? 'Deposit' : 'Sale',
            customerName: \`\${order.customerName} - \${order.number}\`,
            balanceBefore: casaBalanceBefore,
            balance: casaBalanceAfter,
            todayIn: casaTodayIn + actualAmountPaid,
            todayOut: casaTodayOut,`,
    right: `// allTxForCasa already includes the new transaction
        const currentBalance = _startBudget + _allIn - _allOut;
        const previousBalance = currentBalance - actualAmountPaid;
        
        const todayStart = new Date(); todayStart.setHours(0,0,0,0);
        const todayTx = allTxForCasa.filter(t => t.date >= todayStart.getTime());
        const casaTodayIn = todayTx.filter(t => t.type === 'in').reduce((s,t) => s + t.amount, 0);
        const casaTodayOut = todayTx.filter(t => t.type === 'out').reduce((s,t) => s + t.amount, 0);
        
        await db.telegramQueue.add({
          priority: 3, type: 'text', status: 'pending',
          createdAt: Date.now(), attemptCount: 0,
          chatIdKey: 'casaChatId',
          text: formatCasaTransaction({
            type: 'in',
            amount: actualAmountPaid,
            category: isDeposit ? 'Deposit' : 'Sale',
            customerName: \`\${order.customerName} - \${order.number}\`,
            balanceBefore: previousBalance,
            balance: currentBalance,
            todayIn: casaTodayIn,
            todayOut: casaTodayOut,`
  },
  'src/screens/HistoryScreen.jsx': {
    wrong: `const casaBalanceBefore = _startBudget + _allIn - _allOut;
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
            todayOut: casaTodayOut + refundAmount,`,
    right: `// allTxForCasa already includes the new transaction
        const currentBalance = _startBudget + _allIn - _allOut;
        const previousBalance = currentBalance + refundAmount;
        
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
            amount: refundAmount,
            category: 'Return Refund',
            customerName: order.customerName,
            balanceBefore: previousBalance,
            balance: currentBalance,
            todayIn: casaTodayIn,
            todayOut: casaTodayOut,`
  }
};

for (const [f, d] of Object.entries(files)) {
  let code = fs.readFileSync(f, 'utf8');
  if (code.includes(d.wrong)) {
    code = code.replace(d.wrong, d.right);
    fs.writeFileSync(f, code);
    console.log(`✅ Fixed: ${f}`);
  } else {
    console.log(`⚠️ Not found in ${f}`);
  }
}
