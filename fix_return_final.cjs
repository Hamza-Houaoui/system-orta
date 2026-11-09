const fs = require('fs');
let history = fs.readFileSync('src/screens/HistoryScreen.jsx', 'utf8');

// Replace the entire edit facture block with a simpler telegramQueue-based approach
const oldBlock = `      // ── Edit original facture message to show Return ──────────────────
      try {
        console.log('[Return] Looking for order.id=', order.id);
        const allTgMsgs = await db.telegramMessages
          .where('refId').equals(order.id)
          .toArray();
        console.log('[Return] allTgMsgs=', JSON.stringify(allTgMsgs));
        const tgMsg = allTgMsgs.find(m => m.channel === 'factureChatId');
        console.log('[Return] tgMsg=', tgMsg);
        if (tgMsg?.messageId) {
          await db.telegramQueue.add({
            priority: 4, type: 'edit_text', status: 'pending',
            createdAt: Date.now(), attemptCount: 0,
            chatIdKey: 'factureChatId',
            messageId: tgMsg.messageId,
            text: formatReturnMessage(order),
          });
        }
      } catch(tgReturnErr) { console.error('[Return] edit_text error:', tgReturnErr); }`;

const newBlock = `      // ── Edit original facture message to show Return ──────────────────
      try {
        // Search telegramQueue for the sent facture item (status=done, refId=order.id)
        const allQueueItems = await db.telegramQueue.toArray();
        const factureItem = allQueueItems.find(item =>
          item.refId === order.id &&
          item.chatIdKey === 'factureChatId' &&
          item.status === 'done' &&
          item.messageId
        );
        if (factureItem?.messageId) {
          await db.telegramQueue.add({
            priority: 4, type: 'edit_text', status: 'pending',
            createdAt: Date.now(), attemptCount: 0,
            chatIdKey: 'factureChatId',
            messageId: factureItem.messageId,
            text: formatReturnMessage(order),
          });
        }
      } catch(tgReturnErr) { console.error('[Return] edit_text error:', tgReturnErr); }`;

if (history.includes(oldBlock)) {
  history = history.replace(oldBlock, newBlock);
  fs.writeFileSync('src/screens/HistoryScreen.jsx', history);
  console.log('✅ Fixed return block to use telegramQueue instead of telegramMessages');
} else {
  console.log('⚠️ Pattern not found');
}
