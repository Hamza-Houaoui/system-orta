const fs = require('fs');
let code = fs.readFileSync('src/core/telegramPublisher.js', 'utf8');

const oldStrip = `                 if (item.type === 'edit_caption' || item.type === 'photo' || item.type === 'video') {
                     item.caption = stripHtml(item.caption || item.text || '');
                 } else {
                     item.text = stripHtml(item.text || item.caption || '');
                 }
                 item.status = 'pending';
                 item.attemptCount = 0;`;

const newStrip = `                 if (item.caption) item.caption = stripHtml(item.caption);
                 if (item.text) item.text = stripHtml(item.text);
                 item.status = 'pending';
                 item.attemptCount = (item.attemptCount || 0) + 1;`;

code = code.replace(oldStrip, newStrip);
fs.writeFileSync('src/core/telegramPublisher.js', code);
console.log('Fixed HTML strip');
