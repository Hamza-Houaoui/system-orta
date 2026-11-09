const fs = require('fs');
let code = fs.readFileSync('src/screens/NewOrderScreen.jsx', 'utf8');
const regex = /const generateInvoiceText = \(\) => \{[\s\S]*?return text;\n  \};/;

const newFunc = `const generateInvoiceText = () => {
    let text = \`📋 \${(orderType || 'NEW ORDER').toUpperCase()}\\n\`;
    text += \`━━━━━━━━━━━━━━━━━━━━━\\n\`;
    text += \`👤 \${customer?.name || 'Walk-in'}\\n\`;
    if (customer?.phone) text += \`📞 \${customer.phone}\\n\`;
    text += \`---------------------------------------\\n\`;
    text += \`🧾 INVOICE\\n\`;
    text += \`📅 \${new Date().toLocaleString('en-GB')}\\n\`;
    text += \`--------------------------------------\\n\`;
    
    items.forEach(item => {
      text += \`▫️ \${item.catalogCode} | \${item.colorName || item.colorCode} | $\${(item.unitPrice || 0).toFixed(2)} × \${item.totalQty} pcs = $\${(item.totalQty * (item.unitPrice || 0)).toFixed(2)}\\n\`;
    });
    
    text += \`--------------------------------------\\n\`;
    const subtotal = items.reduce((s, i) => s + (i.totalQty * (i.unitPrice || 0)), 0);
    
    if (discount > 0) {
      text += \`- Discount: $\${parseFloat(discount).toFixed(2)}\\n\`;
    }
    
    const finalTotal = subtotal - (parseFloat(discount) || 0);
    text += \`\\n💰 *\${finalTotal.toFixed(2)}*\\n\\n\`;
    
    if (orderType === 'deposit') {
       text += \`Deposit: $\${parseFloat(depositAmount).toFixed(2)}\\n\`;
    } else if (orderType === 'paid') {
       text += \`Paid: $\${finalTotal.toFixed(2)}\\n\`;
    }
    
    if (note) {
      text += \`Notes: \${note}\\n\`;
    }
    
    text += \`____________________________\\n\`;
    text += \`_Returns and exchanges are only accepted within 2 weeks from the purchase date_\\n\`;
    return text;
  };`;

if (code.match(regex)) {
  code = code.replace(regex, newFunc);
  fs.writeFileSync('src/screens/NewOrderScreen.jsx', code);
  console.log('✅ Updated WhatsApp template to EXACT request');
} else {
  console.log('⚠️ Pattern not found');
}
