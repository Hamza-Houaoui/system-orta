const fs = require('fs');
let code = fs.readFileSync('src/core/telegramMedia.js', 'utf8');

code = code.replace(
  /await db\.modelColors\.put\(mc\);/g,
  'await db.modelColors.update(mc.id, { assets: mc.assets });'
);

fs.writeFileSync('src/core/telegramMedia.js', code);
console.log('Fixed put in telegramMedia');
