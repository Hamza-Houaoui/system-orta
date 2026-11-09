const fs = require('fs');

// Remove debug from NewOrderScreen
let newOrder = fs.readFileSync('src/screens/NewOrderScreen.jsx', 'utf8');
newOrder = newOrder.replace(
  `          console.log('[Invoice] Added to queue with refId=', orderId);\n          Logger.debug`,
  `          Logger.debug`
);
fs.writeFileSync('src/screens/NewOrderScreen.jsx', newOrder);

// Remove debug from telegramPublisher
let publisher = fs.readFileSync('src/core/telegramPublisher.js', 'utf8');
publisher = publisher.replace(
  `            console.log('[Publisher] Saving to telegramMessages: refId=', item.refId, 'channel=', item.chatIdKey, 'msgId=', item.messageId);\n            await db.telegramMessages.put({`,
  `            await db.telegramMessages.put({`
);
fs.writeFileSync('src/core/telegramPublisher.js', publisher);

console.log('✅ Removed debug logs');
