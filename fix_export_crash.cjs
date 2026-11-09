const fs = require('fs');
let code = fs.readFileSync('src/screens/ModelsScreen.jsx', 'utf8');

const target = `const msgId = (mc.assets || []).map(a => a.messageId).filter(Boolean).join('|');`;
const replacement = `const assetsArr = Array.isArray(mc.assets) ? mc.assets : Object.values(mc.assets || {});
            const msgId = assetsArr.map(a => a.messageId).filter(Boolean).join('|');`;

code = code.replace(target, replacement);

fs.writeFileSync('src/screens/ModelsScreen.jsx', code);
console.log('Fixed export crash');
