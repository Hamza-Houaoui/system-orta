const fs = require('fs');
let code = fs.readFileSync('src/screens/SyncScreen.jsx', 'utf8');

if (!code.includes('isWatcherDevice')) {
  code = `import { isWatcherDevice } from '../core/deviceSync';\n` + code;
}

code = code.replace(
  /<button className="btn btn-primary" onClick=\{\(\) => runSync\('push'\)\} disabled=\{status === 'syncing'\}>/g,
  `{!isWatcherDevice() && <button className="btn btn-primary" onClick={() => runSync('push')} disabled={status === 'syncing'}>`
);
code = code.replace(
  /<UploadCloud size=\{18\}\/> Push to Telegram\s*<\/button>/g,
  `<UploadCloud size={18}/> Push to Telegram</button>}`
);

fs.writeFileSync('src/screens/SyncScreen.jsx', code);
console.log('Fixed SyncScreen buttons');
