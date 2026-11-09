const fs = require('fs');
let code = fs.readFileSync('src/core/telegramPublisher.js', 'utf8');

code = code.replace(
  `    const allPending = await db.telegramQueue.where('status').equals('pending').toArray();`,
  `    let allPending = await db.telegramQueue.where('status').equals('pending').toArray();
    allPending.sort((a, b) => (a.priority || 99) - (b.priority || 99));`
);

fs.writeFileSync('src/core/telegramPublisher.js', code);
console.log('Added priority sorting');
