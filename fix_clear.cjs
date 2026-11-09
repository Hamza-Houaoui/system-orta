const fs = require('fs');
let code = fs.readFileSync('src/screens/TelegramScreen.jsx', 'utf8');

code = code.replace(
  `    await db.telegramQueue.clear();`,
  `    const deletes = await db.telegramQueue.where('type').equals('delete').toArray();
    await db.telegramQueue.clear();
    if (deletes.length > 0) await db.telegramQueue.bulkAdd(deletes);`
);

fs.writeFileSync('src/screens/TelegramScreen.jsx', code);
console.log('Fixed clearAll');
