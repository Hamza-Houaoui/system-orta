const fs = require('fs');
let code = fs.readFileSync('src/core/db.js', 'utf8');

code = code.replace(
  /db\[tableName\]\.hook\('updating', \(key\) => \{ markDirty\(tableName, key\); triggerAutoPush\(\); \}\);/g,
  "db[tableName].hook('updating', (mods, primKey) => { markDirty(tableName, primKey); triggerAutoPush(); });"
);

fs.writeFileSync('src/core/db.js', code);
console.log('Fixed updating hook');
