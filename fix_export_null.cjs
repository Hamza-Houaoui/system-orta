const fs = require('fs');
let code = fs.readFileSync('src/screens/ModelsScreen.jsx', 'utf8');

const target = `const msgId = assetsArr.map(a => a.messageId).filter(Boolean).join('|');`;
const replacement = `const msgId = assetsArr.map(a => a ? a.messageId : null).filter(Boolean).join('|');`;

code = code.replace(target, replacement);

fs.writeFileSync('src/screens/ModelsScreen.jsx', code);
console.log('Fixed export null asset crash');
