import db from './src/core/db.js';
async function run() {
  const logs = await db.stockLog.where('type').equals('manual').toArray();
  for (let log of logs) {
    if (log.totalQty !== undefined) {
      log.change = log.totalQty;
      delete log.totalQty;
      
      let sizesChanged = {};
      if (log.sizes && Array.isArray(log.sizes)) {
        log.sizes.forEach(s => { sizesChanged[s.size] = s.qty; });
      }
      log.sizesChanged = sizesChanged;
      delete log.sizes;
      
      log.balance = 0; // cannot compute easily for old data without going back in time, but 0 is better than undefined
      
      await db.stockLog.put(log);
    }
  }
}
run();
