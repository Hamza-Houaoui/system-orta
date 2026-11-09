const fs = require('fs');
let code = fs.readFileSync('src/core/syncService.js', 'utf8');

if (!code.includes('isWatcherDevice')) {
  code = code.replace(
    /import \{ getDeviceId \} from '\.\/deviceSync';/,
    `import { getDeviceId, isWatcherDevice } from './deviceSync';`
  );
}

const target = `export const syncService = {
  async pushSync(onProgress, { incremental = false } = {}) {`;
const replacement = `export const syncService = {
  async pushSync(onProgress, { incremental = false } = {}) {
    if (isWatcherDevice()) {
      console.warn("Device 2 cannot push sync updates");
      return;
    }`;

code = code.replace(target, replacement);

fs.writeFileSync('src/core/syncService.js', code);
console.log('Blocked pushSync for device 2');
