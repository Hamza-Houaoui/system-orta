const fs = require('fs');
let code = fs.readFileSync('src/screens/SyncScreen.jsx', 'utf8');

// Find the Push Sync button and ensure it's wrapped properly
code = code.replace(
  /\{!isWatcherDevice\(\) && <button className="btn btn-primary" onClick=\{\(\) => runSync\('push'\)\} disabled=\{status === 'syncing'\}>\s*\{status === 'syncing' \? <><RefreshCw size=\{14\} className="spin"\/> Syncing\.\.\.<\/> : <><Upload size=\{14\}\/> Push Sync<\/>\}\s*<\/button>/g,
  `{!isWatcherDevice() && (\n              <button className="btn btn-primary" onClick={() => runSync('push')} disabled={status === 'syncing'}>\n                {status === 'syncing' ? <><RefreshCw size={14} className="spin"/> Syncing...</> : <><Upload size={14}/> Push Sync</>}\n              </button>\n            )}`
);

fs.writeFileSync('src/screens/SyncScreen.jsx', code);
console.log('Fixed SyncScreen closing tag');
