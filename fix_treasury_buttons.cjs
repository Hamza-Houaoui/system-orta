const fs = require('fs');
let code = fs.readFileSync('src/screens/TreasuryScreen.jsx', 'utf8');

if (!code.includes('isWatcherDevice')) {
  code = `import { isWatcherDevice } from '../core/deviceSync';\n` + code;
}

code = code.replace(
  /<div style=\{\{ display: 'flex', gap: 10, flexWrap: 'wrap' \}\}>/g,
  `<div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>\n            {!isWatcherDevice() && (`
);

code = code.replace(
  /<button className="btn btn-info" style=\{\{ width: '50%', padding: '8px 0', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6, fontSize: '0.9rem' \}\} onClick=\{\(\) => setModal\('confirm'\)\}>\s*<CheckCircle size=\{15\}\/> Confirm Balance\s*<\/button>\s*<\/div>/g,
  `<button className="btn btn-info" style={{ width: '50%', padding: '8px 0', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6, fontSize: '0.9rem' }} onClick={() => setModal('confirm')}>\n                  <CheckCircle size={15}/> Confirm Balance\n                </button>\n            )}\n            </div>`
);

fs.writeFileSync('src/screens/TreasuryScreen.jsx', code);
console.log('Fixed TreasuryScreen buttons');
