const fs = require('fs');
let code = fs.readFileSync('src/screens/ModelDetailScreen.jsx', 'utf8');

code = code.replace(
  /<button className="btn btn-primary btn-sm" onClick=\{\(\) => \{[\s\S]*?<Edit2 size=\{14\}\/> Edit Prices<\/button>/,
  match => `{!isWatcherDevice() && (\n            ${match}\n          )}`
);

fs.writeFileSync('src/screens/ModelDetailScreen.jsx', code);
console.log('Fixed Edit Prices');
