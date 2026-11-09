const fs = require('fs');
let code = fs.readFileSync('src/screens/ModelsScreen.jsx', 'utf8');

code = code.replace(
  /<button className="btn btn-primary btn-sm" onClick=\{\(\) => setShowAdd\(true\)\}>\s*<Plus size=\{14\}\/> Add Model\s*<\/button>/,
  `{!isWatcherDevice() && <button className="btn btn-primary btn-sm" onClick={() => setShowAdd(true)}><Plus size={14}/> Add Model</button>}`
);
code = code.replace(
  /<button className="btn btn-primary" onClick=\{\(\) => setShowAdd\(true\)\}>\s*<Plus size=\{14\}\/> Add Model\s*<\/button>/,
  `{!isWatcherDevice() && <button className="btn btn-primary" onClick={() => setShowAdd(true)}><Plus size={14}/> Add Model</button>}`
);

fs.writeFileSync('src/screens/ModelsScreen.jsx', code);
console.log('Fixed ModelsScreen buttons');
