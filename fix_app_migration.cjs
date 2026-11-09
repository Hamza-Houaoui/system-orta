const fs = require('fs');
let code = fs.readFileSync('src/App.jsx', 'utf8');

const targetInit = `    const init = async () => {
      Logger.info('app', 'init', '🚀 System Orta starting...');`;

const replacementInit = `    const init = async () => {
      Logger.info('app', 'init', '🚀 System Orta starting...');
      
      // ONE-TIME MIGRATION: Separate Deposit debt from Manual Debt
      try {
        if (!localStorage.getItem('migrated_deposit_debts_v1')) {
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
               const manualDebt = Math.max(0, (c.credit || 0) - depositDebt);
               await db.customers.update(c.id, { credit: manualDebt });
               Logger.info('app', 'migration', \`Fixed \${c.name}: credit \${c.credit} -> \${manualDebt}\`);
            }
          }
          localStorage.setItem('migrated_deposit_debts_v1', 'true');
          Logger.info('app', 'migration', 'Deposit debts successfully separated from Manual Debts.');
        }
      } catch (e) {
        Logger.error('app', 'migration', e.message);
      }`;

code = code.replace(targetInit, replacementInit);
fs.writeFileSync('src/App.jsx', code);
