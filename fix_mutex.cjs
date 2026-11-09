const fs = require('fs');
let code = fs.readFileSync('src/core/telegramPublisher.js', 'utf8');

const mutexCode = `
const stockChangeLocks = {};

export async function onStockChanged(modelId) {
  // Prevent race conditions on the same model
  if (stockChangeLocks[modelId]) {
    await stockChangeLocks[modelId];
  }
  let releaseLock;
  stockChangeLocks[modelId] = new Promise(r => { releaseLock = r; });

  try {
`;

code = code.replace('export async function onStockChanged(modelId) {', mutexCode);

// Add finally block to release lock
const oldEnd = `  // ── Trigger queue processing ─────────────────────────────
  setTimeout(processTelegramQueue, 100);
}`;

const newEnd = `  // ── Trigger queue processing ─────────────────────────────
  setTimeout(processTelegramQueue, 100);
  } finally {
    releaseLock();
    delete stockChangeLocks[modelId];
  }
}`;

code = code.replace(oldEnd, newEnd);

fs.writeFileSync('src/core/telegramPublisher.js', code);
console.log('Added mutex to onStockChanged');
