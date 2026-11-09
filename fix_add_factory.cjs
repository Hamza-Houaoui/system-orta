const fs = require('fs');
let code = fs.readFileSync('src/screens/FactoriesScreen.jsx', 'utf8');

code = code.replace(
  /<button className="btn btn-primary btn-sm" onClick=\{\(\) => setShowAdd\(true\)\}>\s*<Plus size=\{14\} \/> Add Factory\s*<\/button>/,
  `{!isWatcherDevice() && <button className="btn btn-primary btn-sm" onClick={() => setShowAdd(true)}><Plus size={14} /> Add Factory</button>}`
);
code = code.replace(
  /<button className="btn btn-primary" onClick=\{\(\) => setShowAdd\(true\)\}><Plus size=\{14\} \/> Add Factory<\/button>/,
  `{!isWatcherDevice() && <button className="btn btn-primary" onClick={() => setShowAdd(true)}><Plus size={14} /> Add Factory</button>}`
);

fs.writeFileSync('src/screens/FactoriesScreen.jsx', code);
console.log('Fixed Add Factory');
