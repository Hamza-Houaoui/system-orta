const fs = require('fs');
let pubCode = fs.readFileSync('src/core/telegramPublisher.js', 'utf8');
let fmtCode = fs.readFileSync('src/toolbox/telegramFormatter.js', 'utf8');

// 1. Add buildSalesCaption
if (!fmtCode.includes('buildSalesCaption')) {
    const salesFmt = `
export const buildSalesCaption = (model, color, series) => {
  let msg = \`👗 <b>\${model.code || 'Model'}</b>\\n\`;
  msg += \`🎨 \${color.colorName || color.colorCode || ''}\\n\`;
  if (series?.sizes?.length > 0) {
    msg += \`📏 <b>Sizes:</b> \${series.sizes.join(' - ')}\\n\`;
  }
  const original = model.retailPrice || model.wholesalePrice || 0;
  const discount = parseFloat(model.discount) || 0;
  const newPrice = Math.max(0, original - discount);
  if (discount > 0) {
     msg += \`💰 <s>$\${original}</s>  <b>$\${newPrice.toFixed(2)}</b> 🔥\\n\`;
  } else {
     msg += \`💰 <b>$\${original}</b> 🔥\\n\`;
  }
  msg += \`🏷 <b>Code:</b> \${model.code || ''}\`;
  return msg;
};
`;
    fmtCode = fmtCode.replace('export const buildWholesaleCaption', salesFmt + '\nexport const buildWholesaleCaption');
    fs.writeFileSync('src/toolbox/telegramFormatter.js', fmtCode);
}

// 2. Use it in telegramPublisher.js
pubCode = pubCode.replace(
    /import \{([^\}]+)\} from '\.\.\/toolbox\/telegramFormatter';/,
    (match, p1) => {
        if (!p1.includes('buildSalesCaption')) return `import { buildSalesCaption, ${p1} } from '../toolbox/telegramFormatter';`;
        return match;
    }
);

pubCode = pubCode.replace(
  `        } else if (channel === 'retailChatId') {
          caption = buildRetailCaption(model, color, brokenSizes);
        } else {
          caption = \`\${model.code || 'Model'} — \${color.colorName || color.colorCode || ''}\`;
        }`,
  `        } else if (channel === 'retailChatId') {
          caption = buildRetailCaption(model, color, brokenSizes);
        } else if (channel === 'salesChatId') {
          caption = buildSalesCaption(model, color, series);
        } else {
          caption = \`\${model.code || 'Model'} — \${color.colorName || color.colorCode || ''}\`;
        }`
);

// We have two places in telegramPublisher where this branch happens
pubCode = pubCode.replace(
  `    } else if (chatIdKey === 'retailChatId') {
      caption = buildRetailCaption(model, color, brokenSizes);
    } else {
      caption = \`\${model.code || 'Model'} — \${color.colorName || color.colorCode || ''}\`;
    }`,
  `    } else if (chatIdKey === 'retailChatId') {
      caption = buildRetailCaption(model, color, brokenSizes);
    } else if (chatIdKey === 'salesChatId') {
      caption = buildSalesCaption(model, color, series);
    } else {
      caption = \`\${model.code || 'Model'} — \${color.colorName || color.colorCode || ''}\`;
    }`
);

fs.writeFileSync('src/core/telegramPublisher.js', pubCode);
console.log('Fixed Sales caption');
