const fs = require('fs');

// Add debug in return function
let history = fs.readFileSync('src/screens/HistoryScreen.jsx', 'utf8');
const oldQuery = `      // ── Edit original facture message to show Return ──────────────────
      try {
        const allTgMsgs = await db.telegramMessages
          .where('refId').equals(order.id)
          .toArray();
        const tgMsg = allTgMsgs.find(m => m.channel === 'factureChatId');
        if (tgMsg?.messageId) {`;
const newQuery = `      // ── Edit original facture message to show Return ──────────────────
      try {
        console.log('[Return] Looking for order.id=', order.id);
        const allTgMsgs = await db.telegramMessages
          .where('refId').equals(order.id)
          .toArray();
        console.log('[Return] allTgMsgs=', JSON.stringify(allTgMsgs));
        const tgMsg = allTgMsgs.find(m => m.channel === 'factureChatId');
        console.log('[Return] tgMsg=', tgMsg);
        if (tgMsg?.messageId) {`;
history = history.replace(oldQuery, newQuery);
fs.writeFileSync('src/screens/HistoryScreen.jsx', history);

// Add debug in NewOrderScreen when adding to queue
let newOrder = fs.readFileSync('src/screens/NewOrderScreen.jsx', 'utf8');
const oldQueue = `            refId: orderId,
            text: formatOrderMessage(order),`;
const newQueue = `            refId: orderId,
            text: formatOrderMessage(order),`;
// Also add log right after the add
const oldAfterAdd = `          Logger.debug('invoices', 'saveOrder', \`Queued invoice \${number} to factureChatId\`);`;
const newAfterAdd = `          console.log('[Invoice] Added to queue with refId=', orderId);
          Logger.debug('invoices', 'saveOrder', \`Queued invoice \${number} to factureChatId\`);`;
newOrder = newOrder.replace(oldAfterAdd, newAfterAdd);
fs.writeFileSync('src/screens/NewOrderScreen.jsx', newOrder);

// Add debug in telegramPublisher when saving to telegramMessages
let publisher = fs.readFileSync('src/core/telegramPublisher.js', 'utf8');
const oldSave = `          if (item.type !== 'delete' && item.type !== 'edit_caption' && item.type !== 'edit_text' && item.refId) {
            await db.telegramMessages.put({
               id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString() + Math.random().toString(36),
               channel: item.chatIdKey,
               type: item.type,
               refId: item.refId,
               messageId: item.messageId
            });`;
const newSave = `          if (item.type !== 'delete' && item.type !== 'edit_caption' && item.type !== 'edit_text' && item.refId) {
            console.log('[Publisher] Saving to telegramMessages: refId=', item.refId, 'channel=', item.chatIdKey, 'msgId=', item.messageId);
            await db.telegramMessages.put({
               id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString() + Math.random().toString(36),
               channel: item.chatIdKey,
               type: item.type,
               refId: item.refId,
               messageId: item.messageId
            });`;
if (publisher.includes(oldSave)) {
  publisher = publisher.replace(oldSave, newSave);
  fs.writeFileSync('src/core/telegramPublisher.js', publisher);
  console.log('✅ Added debug logs');
} else {
  console.log('⚠️ Publisher pattern not found');
}
