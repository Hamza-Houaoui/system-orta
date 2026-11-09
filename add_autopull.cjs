const fs = require('fs');
let code = fs.readFileSync('src/App.jsx', 'utf8');

if (!code.includes('isWatcherDevice')) {
  code = code.replace(
    /import \{ getDeviceId \} from '\.\/core\/deviceSync';/,
    `import { getDeviceId, isWatcherDevice } from './core/deviceSync';`
  );
  if (!code.includes('isWatcherDevice')) {
    code = `import { isWatcherDevice } from './core/deviceSync';\n` + code;
  }
}

const target = `    // Auto queue timer (every 15 seconds)
    const queueTimer = setInterval(() => {`;

const replacement = `    // Auto pull sync timer for Device 2 (every 30 seconds)
    const pullTimer = setInterval(() => {
      if (isWatcherDevice() && !isSyncing) {
         syncService.pullSync(() => {}).catch(() => {}); // silently pull updates
      }
    }, 30000);

    // Auto queue timer (every 15 seconds)
    const queueTimer = setInterval(() => {`;

code = code.replace(target, replacement);

const targetCleanup = `clearInterval(queueTimer);`;
const replacementCleanup = `clearInterval(queueTimer); clearInterval(pullTimer);`;
code = code.replace(targetCleanup, replacementCleanup);

fs.writeFileSync('src/App.jsx', code);
console.log('Added auto pull');
