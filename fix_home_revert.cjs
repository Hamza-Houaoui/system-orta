const fs = require('fs');
let code = fs.readFileSync('src/screens/HomeScreen.jsx', 'utf8');

const targetLoad = `  const loadData = async () => {
    try {
      const customers = await db.customers.toArray();
      const pre = await db.orders.where('type').equals('deposit').toArray();
      
      const depositUnpaidByCustomer = {};
      pre.forEach(o => {
        if (!o.customerId) return;
        const total = o.totalPrice || 0;
        const paid = o.paidAmount || o.depositAmount || 0;
        depositUnpaidByCustomer[o.customerId] = (depositUnpaidByCustomer[o.customerId] || 0) + (total - paid);
      });

      const manualDebtors = [];
      customers.forEach(c => {
         const depositDebt = depositUnpaidByCustomer[c.id] || 0;
         const manualDebt = (c.credit || 0) - depositDebt;
         if (manualDebt > 0.01) {
            manualDebtors.push({ ...c, displayCredit: manualDebt });
         }
      });

      setDebtors(manualDebtors.sort((a,b) => b.displayCredit - a.displayCredit));
      
      const orders = await db.orders.orderBy('date').reverse().limit(5).toArray();
      setRecentOrders(orders);
      setPreorders(pre);
    } catch (e) { console.error(e); }
  };`;

const replacementLoad = `  const loadData = async () => {
    try {
      const customers = await db.customers.toArray();
      setDebtors(customers.filter(c => c.credit > 0).sort((a,b) => b.credit - a.credit));
      const orders = await db.orders.orderBy('date').reverse().limit(5).toArray();
      setRecentOrders(orders);
      const pre = await db.orders.where('type').equals('deposit').toArray();
      setPreorders(pre);
    } catch (e) { console.error(e); }
  };`;

code = code.replace(targetLoad, replacementLoad);

const targetJSX = `<span className="text-red text-bold" style={{ flexShrink: 0 }}>\${c.displayCredit?.toFixed(2)}</span>`;
const replacementJSX = `<span className="text-red text-bold" style={{ flexShrink: 0 }}>\${c.credit?.toFixed(2)}</span>`;

code = code.replace(targetJSX, replacementJSX);

fs.writeFileSync('src/screens/HomeScreen.jsx', code);
