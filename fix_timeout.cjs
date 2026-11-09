const fs = require('fs');
let code = fs.readFileSync('src/core/telegramPublisher.js', 'utf8');

code = code.replace(
  'const response = await fetchWithTimeout(resource, { ...options, signal: controller.signal });',
  'const response = await fetch(resource, { ...options, signal: controller.signal });'
);

fs.writeFileSync('src/core/telegramPublisher.js', code);
console.log('Fixed fetchWithTimeout recursion');
