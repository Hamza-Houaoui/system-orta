const fs = require('fs');
const file = 'src/toolbox/telegramFormatter.js';
let code = fs.readFileSync(file, 'utf8');

const oldWholesale = `export const buildWholesaleCaption = (model, color, series) => {
  let msg = \`<blockquote>\${escapeHtml(model.code || 'Model')}</blockquote>\\n\`;
  if (series?.sizes?.length > 0) {
    msg += \`\${series.sizes.join(' - ')}\\n\`;
  }
  msg += \`<b>\${model.wholesalePrice || 0}</b>\`;
  return msg;
};`;

const newWholesale = `export const buildWholesaleCaption = (model, color, series) => {
  let msg = \`<code>\${escapeHtml(model.code || 'Model')}</code>\\n\`;
  if (series?.sizes?.length > 0) {
    msg += \`\${series.sizes.join(' - ')}\\n\`;
  }
  msg += \`<b>$ \${model.wholesalePrice || 0}</b>\`;
  return msg;
};`;

if (code.includes(oldWholesale)) {
  code = code.replace(oldWholesale, newWholesale);
  fs.writeFileSync(file, code);
  console.log('✅ Updated wholesale formatting');
} else {
  console.log('⚠️ Pattern not found');
}
