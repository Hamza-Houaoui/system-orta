const fs = require('fs');
let code = fs.readFileSync('src/screens/ModelDetailScreen.jsx', 'utf8');

// Hide Edit Prices
code = code.replace(
  /<button className="btn btn-secondary btn-sm" onClick=\{\(\) => \{[\s\S]*?<Edit2 size=\{14\}\/> Edit Prices<\/button>/,
  match => `{!isWatcherDevice() && (\n            ${match}\n          )}`
);

// Hide Add Color
code = code.replace(
  /<button className="btn btn-primary" onClick=\{\(\) => setShowAddColorModal\(true\)\}>\s*<Plus size=\{14\} \/> Add Color\s*<\/button>/,
  match => `{!isWatcherDevice() && (\n            ${match}\n          )}`
);

// Disable Stock Inputs in ModelDetailScreen
code = code.replace(
  /<input\s+key=\{`\$\{activeColor\.id\}-\$\{size\}`\}\s+type="number"\s+defaultValue=\{qty\}/g,
  `<input
                          key={\`\${activeColor.id}-\${size}\`}
                          type="number"
                          defaultValue={qty}
                          disabled={isWatcherDevice()}`
);

fs.writeFileSync('src/screens/ModelDetailScreen.jsx', code);
console.log('Fixed ModelDetailScreen buttons');
