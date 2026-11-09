const fs = require('fs');
let code = fs.readFileSync('src/core/telegramPublisher.js', 'utf8');

code = code.replace(
  /await db\.modelColors\.put\(color\);/g,
  'await db.modelColors.update(color.id, { assets: color.assets });'
);

fs.writeFileSync('src/core/telegramPublisher.js', code);
console.log('Fixed modelColors.put in telegramPublisher');
