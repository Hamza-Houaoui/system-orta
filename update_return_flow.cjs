const fs = require('fs');

// ============================================================
// 1. Add formatReturnMessage to telegramFormatter.js
// ============================================================
let formatter = fs.readFileSync('src/toolbox/telegramFormatter.js', 'utf8');

const oldReturnMsg = `export const formatReturnMessage = (order) => {
  let msg = \`↩️ <b>ORDER RETURNED</b>\\n\`;
  msg += \`━━━━━━━━━━━━━━━━━━━━━\\n\`;
  msg += \`📄 \${order.number}\\n\`;
  msg += \`👤 \${order.customerName}\\n\`;
  msg += \`💰 Refund: <b>$\${order.paidAmount || 0}</b>\\n\`;
  msg += \`━━━━━━━━━━━━━━━━━━━━━\\n\`;
  msg += \`🐝 System Orta\`;
  return msg;
};`;

const newReturnMsg = `export const formatReturnMessage = (order) => {
  let msg = \`⭕️ \${order.number}\\n\`;
  msg += \`⭕️ <b>#Return</b>\\n\`;
  msg += \`━━━━━━━━━━━━━━━━━━━━━\\n\`;
  msg += \`👤 \${order.customerName}\\n\`;
  if (order.customerPhone) msg += \`📞 \${order.customerPhone}\\n\`;
  msg += \`📅 \${new Date(order.date).toLocaleDateString('en-GB')} \${new Date(order.date).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}\\n\\n\`;
  (order.items || []).forEach(item => {
    const totalQty = (item.sizes||[]).reduce((s,x) => s + x.qty, 0);
    msg += \`▫️ \${item.catalogCode} | \${item.colorName} × \${totalQty} pcs = \${item.totalPrice}\\n\`;
  });
  msg += \`--------------------------------------\\n\`;
  msg += \`💰 Total: \${order.totalPrice} \$\\n\`;
  msg += \`____________________________\\n\`;
  msg += \`💵 Return: \${order.paidAmount || 0} "\$"\\n\`;
  msg += \`━━━━━━━━━━━━━━━━━━━━━\\n\`;
  return msg;
};`;

if (formatter.includes(oldReturnMsg)) {
  formatter = formatter.replace(oldReturnMsg, newReturnMsg);
  fs.writeFileSync('src/toolbox/telegramFormatter.js', formatter);
  console.log('✅ Updated formatReturnMessage in telegramFormatter.js');
} else {
  console.log('⚠️ formatReturnMessage pattern not found');
}

// ============================================================
// 2. Add refId to factureChatId queue in NewOrderScreen.jsx
// ============================================================
let newOrder = fs.readFileSync('src/screens/NewOrderScreen.jsx', 'utf8');
const oldFactureQueue = `          await db.telegramQueue.add({
            priority: 3,
            type: 'text',
            status: 'pending',
            createdAt: Date.now(),
            attemptCount: 0,
            chatIdKey: 'factureChatId',
            text: formatOrderMessage(order),
          });`;
const newFactureQueue = `          await db.telegramQueue.add({
            priority: 3,
            type: 'text',
            status: 'pending',
            createdAt: Date.now(),
            attemptCount: 0,
            chatIdKey: 'factureChatId',
            refId: orderId,
            text: formatOrderMessage(order),
          });`;
if (newOrder.includes(oldFactureQueue)) {
  newOrder = newOrder.replace(oldFactureQueue, newFactureQueue);
  fs.writeFileSync('src/screens/NewOrderScreen.jsx', newOrder);
  console.log('✅ Added refId to factureChatId queue in NewOrderScreen.jsx');
} else {
  console.log('⚠️ factureChatId queue pattern not found in NewOrderScreen.jsx');
}

// ============================================================
// 3. In HistoryScreen.jsx — after return, edit the facture message
// ============================================================
let history = fs.readFileSync('src/screens/HistoryScreen.jsx', 'utf8');

// Add formatReturnMessage import
const oldImport = `import { formatCasaTransaction, formatPaymentMessage } from '../toolbox/telegramFormatter';`;
const newImport = `import { formatCasaTransaction, formatPaymentMessage, formatReturnMessage } from '../toolbox/telegramFormatter';`;
if (history.includes(oldImport)) {
  history = history.replace(oldImport, newImport);
  console.log('✅ Added formatReturnMessage import in HistoryScreen.jsx');
} else {
  console.log('⚠️ Import pattern not found in HistoryScreen.jsx');
}

// Add edit_text queue after the Casa return block
const oldCasaEnd = `      } catch(tgErr) {}
      load();
      if (isEdit) {
        navigate(\`/new-order?cloneId=\${order.id}\`);
      }`;

const newCasaEnd = `      } catch(tgErr) {}

      // ── Edit original facture message to show Return ──────────────────
      try {
        const tgMsg = await db.telegramMessages
          .where({ channel: 'factureChatId', refId: order.id })
          .first();
        if (tgMsg?.messageId) {
          await db.telegramQueue.add({
            priority: 4, type: 'edit_text', status: 'pending',
            createdAt: Date.now(), attemptCount: 0,
            chatIdKey: 'factureChatId',
            messageId: tgMsg.messageId,
            text: formatReturnMessage(order),
          });
        }
      } catch(tgReturnErr) {}

      load();
      if (isEdit) {
        navigate(\`/new-order?cloneId=\${order.id}\`);
      }`;

if (history.includes(oldCasaEnd)) {
  history = history.replace(oldCasaEnd, newCasaEnd);
  fs.writeFileSync('src/screens/HistoryScreen.jsx', history);
  console.log('✅ Added edit_text return message in HistoryScreen.jsx');
} else {
  console.log('⚠️ Casa end pattern not found in HistoryScreen.jsx');
}
