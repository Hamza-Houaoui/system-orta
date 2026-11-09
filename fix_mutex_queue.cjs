const fs = require('fs');
let code = fs.readFileSync('src/core/telegramPublisher.js', 'utf8');

const oldMutex = `  // Prevent race conditions on the same model
  if (stockChangeLocks[modelId]) {
    await stockChangeLocks[modelId];
  }
  let releaseLock;
  stockChangeLocks[modelId] = new Promise(r => { releaseLock = r; });`;

const newMutex = `  // Proper mutex queue
  let releaseLock;
  const nextLock = new Promise(r => { releaseLock = r; });
  const currentLock = stockChangeLocks[modelId] || Promise.resolve();
  
  const finalLock = currentLock.then(() => nextLock);
  stockChangeLocks[modelId] = finalLock;

  await currentLock;`;

code = code.replace(oldMutex, newMutex);

const oldMutexEnd = `  } finally {
    if (releaseLock) releaseLock();
    delete stockChangeLocks[modelId];
  }`;

const newMutexEnd = `  } finally {
    if (releaseLock) releaseLock();
    if (stockChangeLocks[modelId] === finalLock) {
       delete stockChangeLocks[modelId];
    }
  }`;

code = code.replace(oldMutexEnd, newMutexEnd);
fs.writeFileSync('src/core/telegramPublisher.js', code);
console.log('Fixed mutex');
