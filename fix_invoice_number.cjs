const fs = require('fs');
let code = fs.readFileSync('src/screens/NewOrderScreen.jsx', 'utf8');

const target1 = `      if (!number) {
        number = await generateInvoiceNumber(getDeviceId(), now);
      }`;

const replacement1 = `      // Number generation moved inside transaction`;

code = code.replace(target1, replacement1);

const target2 = `      await db.transaction('rw', [db.orders, db.modelColors, db.stockLog, db.transactions, db.telegramQueue, db.telegramMessages, db.catalog, db.customers], async () => {
        await db.orders.put(order);`;

const replacement2 = `      await db.transaction('rw', [db.orders, db.modelColors, db.stockLog, db.transactions, db.telegramQueue, db.telegramMessages, db.catalog, db.customers], async () => {
        if (!number) {
          const dateStr = formatInvoiceDate(now);
          const prefix = \`INV-D\${getDeviceId()}-\${dateStr}-\`;
          const todayOrders = await db.orders.where('number').startsWith(prefix).toArray();
          let maxSeq = 0;
          todayOrders.forEach(o => {
            const parts = o.number.split('-');
            const seqStr = parts[parts.length - 1];
            const seq = parseInt(seqStr, 10);
            if (!isNaN(seq) && seq > maxSeq) maxSeq = seq;
          });
          number = \`\${prefix}\${String(maxSeq + 1).padStart(4, '0')}\`;
          order.number = number;
        }
        
        await db.orders.put(order);`;

code = code.replace(target2, replacement2);
fs.writeFileSync('src/screens/NewOrderScreen.jsx', code);
console.log('Fixed invoice number uniqueness');
