const fs = require('fs');

let code = fs.readFileSync('src/screens/NewOrderScreen.jsx', 'utf8');

const wrongDef = `          const actualAmountPaid = finalOrderType === 'paid' ? (parseFloat(paidExact) || total) : (parseFloat(depositAmount) || 0);
          if (finalOrderType === 'paid') {`;

const rightDef = `          if (finalOrderType === 'paid') {`;

const wrongScope = `      const catalogIdsToUpdate = new Set();
      
      await db.transaction('rw', [db.orders, db.modelColors, db.stockLog, db.transactions, db.telegramQueue, db.telegramMessages, db.catalog, db.customers], async () => {`;

const rightScope = `      const catalogIdsToUpdate = new Set();
      const actualAmountPaid = finalOrderType === 'paid' ? (parseFloat(paidExact) || total) : (parseFloat(depositAmount) || 0);
      
      await db.transaction('rw', [db.orders, db.modelColors, db.stockLog, db.transactions, db.telegramQueue, db.telegramMessages, db.catalog, db.customers], async () => {`;


if (code.includes(wrongDef) && code.includes(wrongScope)) {
  code = code.replace(wrongDef, rightDef);
  code = code.replace(wrongScope, rightScope);
  fs.writeFileSync('src/screens/NewOrderScreen.jsx', code);
  console.log('✅ Fixed actualAmountPaid scope');
} else {
  console.log('⚠️ Pattern not found');
}
