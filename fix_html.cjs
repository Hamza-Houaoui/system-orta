const fs = require('fs');
let code = fs.readFileSync('src/toolbox/telegramFormatter.js', 'utf8');

const escapeFn = `
export const escapeHtml = (text) => String(text || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
`;

if (!code.includes('escapeHtml')) {
    code = escapeFn + code;
}

// Replace occurrences of model.code or color.colorName with escaped versions in wholesale, retail, sales, live stock
code = code.replace(/\$\{model\.code \|\| 'Model'\}/g, "${escapeHtml(model.code || 'Model')}");
code = code.replace(/\$\{color\.colorName \|\| color\.colorCode \|\| ''\}/g, "${escapeHtml(color.colorName || color.colorCode || '')}");
code = code.replace(/\$\{model\.code \|\| ''\}/g, "${escapeHtml(model.code || '')}");
code = code.replace(/\$\{c\.colorName \|\| c\.colorCode\}/g, "${escapeHtml(c.colorName || c.colorCode)}");
code = code.replace(/\$\{cat\.code\}/g, "${escapeHtml(cat.code)}");
code = code.replace(/\$\{cName\}/g, "${escapeHtml(cName)}");
code = code.replace(/\$\{o\.customerName\}/g, "${escapeHtml(o.customerName)}");
code = code.replace(/\$\{o\.cargoName\}/g, "${escapeHtml(o.cargoName)}");

fs.writeFileSync('src/toolbox/telegramFormatter.js', code);
console.log('Fixed HTML escaping');
