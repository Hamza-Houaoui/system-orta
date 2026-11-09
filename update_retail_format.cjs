const fs = require('fs');
const file = 'src/toolbox/telegramFormatter.js';
let code = fs.readFileSync(file, 'utf8');

const oldRetail = `export const buildRetailCaption = (model, color, brokenSizes) => {
  let msg = \`👗 <b>\${escapeHtml(model.code || 'Model')}</b>\\n\`;
  msg += \`🎨 \${escapeHtml(color.colorName || color.colorCode || '')}\\n\`;
  if (brokenSizes && brokenSizes.length > 0) {
    const sizesStr = brokenSizes.map(s => s.size).join(' - ');
    msg += \`📏 <b>Sizes:</b> \${sizesStr}\\n\`;
  }
  msg += \`💰 <b>$\${model.retailPrice || 0}</b>\\n\`;
  msg += \`🏷 <b>Code:</b> \${escapeHtml(model.code || '')}\`;
  return msg;
};`;

const newRetail = `export const buildRetailCaption = (model, color, brokenSizes) => {
  let msg = \`<code>\${escapeHtml(model.code || 'Model')}</code>\\n\`;
  if (brokenSizes && brokenSizes.length > 0) {
    const sizesStr = brokenSizes.map(s => s.size).join(' - ');
    msg += \`\${sizesStr}\\n\`;
  }
  msg += \`<b>$ \${model.retailPrice || 0}</b>\`;
  return msg;
};`;

if (code.includes(oldRetail)) {
  code = code.replace(oldRetail, newRetail);
  fs.writeFileSync(file, code);
  console.log('✅ Updated retail formatting');
} else {
  console.log('⚠️ Pattern not found');
}
