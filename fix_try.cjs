const fs = require('fs');
let code = fs.readFileSync('src/core/telegramPublisher.js', 'utf8');

code = code.replace(
  `  setTimeout(() => processTelegramQueue().catch(() => {}), 100);
}`,
  `  setTimeout(() => processTelegramQueue().catch(() => {}), 100);
  } finally {
    if (releaseLock) releaseLock();
    delete stockChangeLocks[modelId];
  }
}`
);

fs.writeFileSync('src/core/telegramPublisher.js', code);
console.log('Fixed try catch');
