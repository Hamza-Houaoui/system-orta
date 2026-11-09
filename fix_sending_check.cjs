const fs = require('fs');
let code = fs.readFileSync('src/core/telegramPublisher.js', 'utf8');

// We need to change:
// const allPending = await db.telegramQueue.where('status').equals('pending').toArray();
// to also include sending, or just check all queue items for that model
code = code.replace(
  `    const allPending = await db.telegramQueue.where('status').equals('pending').toArray();`,
  `    const allPending = await db.telegramQueue.where('status').anyOf('pending', 'sending').toArray();`
);

fs.writeFileSync('src/core/telegramPublisher.js', code);
console.log('Fixed pending/sending check');
