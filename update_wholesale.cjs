const fs = require('fs');
const file = 'src/toolbox/telegramFormatter.js';
let code = fs.readFileSync(file, 'utf8');

const oldWholesale = `export const buildWholesaleCaption = (model, color, series) => {
  let msg = \`👗 <b>\${escapeHtml(model.code || 'Model')}</b>\\n\`;
  msg += \`🎨 \${escapeHtml(color.colorName || color.colorCode || '')}\\n\`;
  if (series?.sizes?.length > 0) {
    msg += \`📏 <b>Sizes:</b> \${series.sizes.join(' - ')}\\n\`;
  }
  msg += \`💰 <b>$\${model.wholesalePrice || 0}</b>\\n\`;
  msg += \`🏷 <b>Code:</b> \${escapeHtml(model.code || '')}\`;
  return msg;
};`;

const newWholesale = `export const buildWholesaleCaption = (model, color, series) => {
  let msg = \`<blockquote>\${escapeHtml(model.code || 'Model')}</blockquote>\\n\`;
  if (series?.sizes?.length > 0) {
    msg += \`\${series.sizes.join(' - ')}\\n\`;
  }
  msg += \`<b>$\${model.wholesalePrice || 0}</b>\`;
  return msg;
};`;

if (code.includes(oldWholesale)) {
  code = code.replace(oldWholesale, newWholesale);
  fs.writeFileSync(file, code);
  console.log('✅ Updated wholesale caption format');
} else {
  console.log('⚠️ Pattern not found');
}
