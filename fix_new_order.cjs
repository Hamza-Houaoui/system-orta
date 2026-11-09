const fs = require('fs');

let code = fs.readFileSync('src/screens/NewOrderScreen.jsx', 'utf8');

const wrong = `          const casaBalanceBefore = _startBudget + _allIn - _allOut;
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
              todayOut: casaTodayOut,`;

const right = `          const currentBalance = _startBudget + _allIn - _allOut;
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
              category: finalOrderType === 'deposit' ? 'Deposit' : 'Sale',
              customerName: customer.name,
              balanceBefore: previousBalance,
              balance: currentBalance,
              todayIn: casaTodayIn,
              todayOut: casaTodayOut,`;

if (code.includes(wrong)) {
  code = code.replace(wrong, right);
  fs.writeFileSync('src/screens/NewOrderScreen.jsx', code);
  console.log('✅ Fixed: NewOrderScreen.jsx');
} else {
  console.log('⚠️ Not found in NewOrderScreen.jsx');
}
