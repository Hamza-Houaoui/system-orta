const fs = require('fs');
let code = fs.readFileSync('src/screens/FactoriesScreen.jsx', 'utf8');

code = code.replace(
  /<button className="btn btn-primary" onClick=\{\(\) => setFormModal\(true\)\}>\s*<Plus size=\{15\}\/> Add Factory\s*<\/button>/,
  `{!isWatcherDevice() && <button className="btn btn-primary" onClick={() => setFormModal(true)}><Plus size={15}/> Add Factory</button>}`
);
fs.writeFileSync('src/screens/FactoriesScreen.jsx', code);
console.log('Fixed FactoriesScreen buttons');
