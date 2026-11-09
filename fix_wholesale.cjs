const fs = require('fs');
const file = 'src/toolbox/telegramFormatter.js';
let code = fs.readFileSync(file, 'utf8');

const oldMsg = `export const buildWholesaleCaption = (model, color, series) => {
  let msg = \`<blockquote>\${escapeHtml(model.code || 'Model')}</blockquote>\\n\`;
  if (series?.sizes?.length > 0) {
    msg += \`\${series.sizes.join(' - ')}\\n\`;
  }
  msg += \`<b>\${model.wholesalePrice || 0}</b>\`;
  return msg;
};`;

const newMsg = `export const buildWholesaleCaption = (model, color, series) => {
  let msg = \`<blockquote>\${escapeHtml(model.code || 'Model')}</blockquote>\\n\`;
  if (series?.sizes?.length > 0) {
    msg += \`\${series.sizes.join(' - ')}\\n\`;
  }
  msg += \`<b>$\${model.wholesalePrice || 0}</b>\`;
  return msg;
};`;

if (code.includes(oldMsg)) {
  code = code.replace(oldMsg, newMsg);
  fs.writeFileSync(file, code);
  console.log('✅ Updated wholesale formatting with $');
} else {
  console.log('⚠️ Pattern not found');
}
