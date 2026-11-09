const fs = require('fs');
let code = fs.readFileSync('src/core/telegramPublisher.js', 'utf8');

if (!code.includes('isWatcherDevice')) {
  code = `import { isWatcherDevice } from './deviceSync';\n` + code;
}

const target = `export async function processTelegramQueue() {`;
const replacement = `export async function processTelegramQueue() {\n  if (isWatcherDevice()) return; // Device 2 does not send to Telegram\n`;

code = code.replace(target, replacement);

fs.writeFileSync('src/core/telegramPublisher.js', code);
console.log('Blocked telegram processing for device 2');
