const fs = require('fs');
let history = fs.readFileSync('src/screens/HistoryScreen.jsx', 'utf8');

const oldQuery = `      // ── Edit original facture message to show Return ──────────────────
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
      } catch(tgReturnErr) {}`;

const newQuery = `      // ── Edit original facture message to show Return ──────────────────
      try {
        const allTgMsgs = await db.telegramMessages
          .where('refId').equals(order.id)
          .toArray();
        const tgMsg = allTgMsgs.find(m => m.channel === 'factureChatId');
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

if (history.includes(oldQuery)) {
  history = history.replace(oldQuery, newQuery);
  fs.writeFileSync('src/screens/HistoryScreen.jsx', history);
  console.log('✅ Fixed telegramMessages query in HistoryScreen');
} else {
  console.log('⚠️ Pattern not found');
}
