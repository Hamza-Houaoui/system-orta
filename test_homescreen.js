const code = `
  const loadData = async () => {
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
         const manualDebt = c.credit - depositDebt;
         if (manualDebt > 0.01) {
            manualDebtors.push({ ...c, displayCredit: manualDebt });
         }
      });

      setDebtors(manualDebtors.sort((a,b) => b.displayCredit - a.displayCredit));
      
      const orders = await db.orders.orderBy('date').reverse().limit(5).toArray();
      setRecentOrders(orders);
      setPreorders(pre);
    } catch (e) { console.error(e); }
  };
`;
