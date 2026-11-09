const fs = require('fs');

const deviceSyncPath = 'src/core/deviceSync.js';
let dsCode = fs.readFileSync(deviceSyncPath, 'utf8');
if (!dsCode.includes('export function isWatcherDevice')) {
  dsCode += `\nexport function isWatcherDevice() {\n  return Number(getDeviceId()) === 2;\n}\n`;
  fs.writeFileSync(deviceSyncPath, dsCode);
}
