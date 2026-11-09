const fs = require('fs');
let code = fs.readFileSync('src/core/telegramPublisher.js', 'utf8');

const targetLogic = `      const sObj = stock.find(s => s.size === size);
      const qty = sObj ? (Number(sObj.qty) || 0) : 0;
      const brokenQty = qty - fullSeriesCount;
      if (brokenQty > 0) {
        brokenSizes.push({ size, qty: brokenQty });
      }`;

const newLogic = `      const sObj = stock.find(s => s.size === size);
      const qty = sObj ? (Number(sObj.qty) || 0) : 0;
      const effectiveFullSeries = Math.max(0, fullSeriesCount);
      const brokenQty = qty - effectiveFullSeries;
      if (brokenQty > 0) {
        brokenSizes.push({ size, qty: brokenQty });
      }`;

code = code.replace(targetLogic, newLogic);
fs.writeFileSync('src/core/telegramPublisher.js', code);
