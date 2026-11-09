const fs = require('fs');
let code = fs.readFileSync('src/screens/FactoryDetailScreen.jsx', 'utf8');

// There are multiple db interactions in handleSaveInvoice. We'll wrap the core in a transaction.
// The easiest way is to wrap lines 112 to 223 in db.transaction
// But since there are many awaits, we can just replace the whole body of the function or do a targeted replace.
// Actually, it's easier to use a regex or string replacement for the specific logic.
const targetCode = `      await db.factoryInvoices.add(inv);
      // Update stock
      const stockLogs = [];
      if (type === 'in') {`;

const newCode = `      const catalogIdsToUpdate = new Set();
      
      await db.transaction('rw', [db.factoryInvoices, db.modelColors, db.stockLog, db.transactions, db.catalog, db.sizeSeries], async () => {
        await db.factoryInvoices.add(inv);
        const stockLogs = [];
        if (type === 'in') {`;

code = code.replace(targetCode, newCode);

code = code.replace(
  `              onStockChanged(cat.id);`,
  `              catalogIdsToUpdate.add(cat.id);`
);

// We need to close the transaction block just before the telegramQueue part.
// So replace:
//       if (type === 'payment') {
//         ...
//       }
//       let tgmType = 'text';
const closingTarget = `      if (type === 'payment') {
        await db.transactions.add({
          id: uuidv4(),
          date: Date.now(),
          type: 'out',
          amount: parseFloat(form.amount) || 0,
          category: 'Factory Payment',
          description: \`Factory Payment - \${factory.name} - #\${inv.number}\`,
          factoryId: factory.id,
        });
      }

      let tgmType = 'text';`;

const closingNew = `      if (type === 'payment') {
        await db.transactions.add({
          id: uuidv4(),
          date: Date.now(),
          type: 'out',
          amount: parseFloat(form.amount) || 0,
          category: 'Factory Payment',
          description: \`Factory Payment - \${factory.name} - #\${inv.number}\`,
          factoryId: factory.id,
        });
      }
      }); // End transaction
      
      // Update Telegram for all modified catalogs outside the transaction
      for (const catId of catalogIdsToUpdate) {
        onStockChanged(catId).catch(() => {});
      }

      let tgmType = 'text';`;

code = code.replace(closingTarget, closingNew);
fs.writeFileSync('src/screens/FactoryDetailScreen.jsx', code);
console.log('Fixed factory transaction');
