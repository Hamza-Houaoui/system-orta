const fs = require('fs');

let code = fs.readFileSync('src/screens/NewOrderScreen.jsx', 'utf8');

const regex = /const generateInvoiceText = \(\) => \{[\s\S]*?return text;\n  \};/;

const newFunc = `const generateInvoiceText = () => {
    let text = \`*INVOICE*\\n\`;
    text += \`--------------------------------\\n\`;
    text += \`*Customer:* \${customer?.name}\\n\`;
    if (customer?.phone) text += \`*Phone:* \${customer.phone}\\n\`;
    text += \`*Date:* \${new Date().toLocaleString()}\\n\`;
    text += \`--------------------------------\\n\`;
    
    items.forEach((item, i) => {
      text += \`*\${i+1}. Model:* \${item.catalogCode} (\${item.colorName || item.colorCode})\\n\`;
      text += \`   *Qty:* \${item.totalQty} (\${item.sizes.map(s => \`\${s.size}:\${s.qty}\`).join(' ')})\\n\`;
      text += \`   *Price:* $\${(item.unitPrice || 0).toFixed(2)}\\n\`;
      text += \`   *Total:* $\${(item.totalQty * (item.unitPrice || 0)).toFixed(2)}\\n\`;
      text += \`-\\n\`;
    });
    
    text += \`--------------------------------\\n\`;
    const subtotal = items.reduce((s, i) => s + (i.totalQty * (i.unitPrice || 0)), 0);
    text += \`*Subtotal:* $\${subtotal.toFixed(2)}\\n\`;
    if (discount > 0) {
      text += \`*Discount:* $\${parseFloat(discount).toFixed(2)}\\n\`;
    }
    const finalTotal = subtotal - (parseFloat(discount) || 0);
    text += \`*Final Total:* $\${finalTotal.toFixed(2)}\\n\`;
    
    if (orderType === 'deposit') {
       text += \`*Deposit:* $\${parseFloat(depositAmount).toFixed(2)}\\n\`;
       text += \`*Remaining:* $\${(finalTotal - (parseFloat(depositAmount)||0)).toFixed(2)}\\n\`;
    } else if (orderType === 'paid') {
       text += \`*Status:* PAID\\n\`;
    }
    
    if (note) {
      text += \`--------------------------------\\n\`;
      text += \`*Notes:* \${note}\\n\`;
    }

    text += \`--------------------------------\\n\`;
    text += \`_Returns and exchanges are only accepted within 2 weeks from the purchase date._\\n\`;

    return text;
  };`;

if (code.match(regex)) {
  code = code.replace(regex, newFunc);
  fs.writeFileSync('src/screens/NewOrderScreen.jsx', code);
  console.log('✅ Updated WhatsApp template');
} else {
  console.log('⚠️ Pattern not found');
}
