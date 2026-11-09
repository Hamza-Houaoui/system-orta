import db from './src/core/db.js';

async function run() {
  const customers = await db.customers.toArray();
  const pre = await db.orders.where('type').equals('deposit').toArray();
  
  const depositUnpaidByCustomer = {};
  pre.forEach(o => {
    if (!o.customerId) return;
    const total = o.totalPrice || 0;
    const paid = o.paidAmount || o.depositAmount || 0;
    depositUnpaidByCustomer[o.customerId] = (depositUnpaidByCustomer[o.customerId] || 0) + (total - paid);
  });

  for (const c of customers) {
    const depositDebt = depositUnpaidByCustomer[c.id] || 0;
    if (depositDebt > 0) {
       console.log(\`Fixing \${c.name}: credit \${c.credit} - \${depositDebt}\`);
       const manualDebt = Math.max(0, (c.credit || 0) - depositDebt);
       await db.customers.update(c.id, { credit: manualDebt });
    }
  }
  console.log('Done fixing credits!');
  process.exit(0);
}
// I will not run this in Node because it's using dexie which needs browser environment.
// I will inject this into App.jsx to run once on startup!
