const fs = require('fs');
const file = 'src/toolbox/telegramFormatter.js';
let code = fs.readFileSync(file, 'utf8');

const oldOrder = `export const formatOrderMessage = (order) => {
  // Professional HTML format for Telegram
  let msg = \`🧾 <b>INVOICE \${order.number}</b>\\n\`;
  msg += \`━━━━━━━━━━━━━━━━━━━━━\\n\`;
  msg += \`👤 \${order.customerName}\\n\`;
  msg += \`📅 \${new Date(order.date).toLocaleDateString('en-GB')}\\n\`;
  msg += \`📋 Type: \${order.type}\\n\\n\`;
  (order.items || []).forEach(item => {
    const totalQty = (item.sizes||[]).reduce((s,x) => s + x.qty, 0);
    msg += \`▫️ \${item.catalogCode} — \${item.colorName} × \${totalQty} pcs\\n\`;
  });
  msg += \`\\n💰 Total: <b>$\${order.totalPrice}</b>\\n\`;
  msg += \`💵 Paid: <b>$\${order.paidAmount}</b>\\n\`;
  if (order.discount > 0) msg += \`🏷 Discount: $\${order.discount}\\n\`;
  msg += \`━━━━━━━━━━━━━━━━━━━━━\\n\`;
  msg += \`🐝 System Orta\`;
  return msg;
};`;

const newOrder = `export const formatOrderMessage = (order) => {
  let msg = \`🧾 \${order.number}\\n\`;
  msg += \`📋 <b>#\${order.type}</b>\\n\`;
  msg += \`━━━━━━━━━━━━━━━━━━━━━\\n\`;
  msg += \`👤 \${order.customerName}\\n\`;
  if (order.customerPhone) msg += \`📞 \${order.customerPhone}\\n\`;
  msg += \`📅 \${new Date(order.date).toLocaleDateString('en-GB')} \${new Date(order.date).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}\\n\\n\`;
  (order.items || []).forEach(item => {
    const totalQty = (item.sizes||[]).reduce((s,x) => s + x.qty, 0);
    msg += \`▫️ \${item.catalogCode} | \${item.colorName} × \${totalQty} pcs = $\${item.totalPrice}\\n\`;
  });
  if (order.discount > 0) msg += \`\\n🏷 Discount: $\${order.discount}\\n\`;
  msg += \`--------------------------------------\\n\`;
  msg += \`💰 Total: <b>$\${order.totalPrice}</b>\\n\`;
  msg += \`____________________________\\n\`;
  msg += \`💵 Paid: <code>$\${order.paidAmount}</code>\\n\`;
  msg += \`━━━━━━━━━━━━━━━━━━━━━\\n\`;
  return msg;
};`;

const oldPayment = `export const formatPaymentMessage = (customer, amount, type) => {
  let msg = \`💳 <b>\${type === 'in' ? 'PAYMENT RECEIVED' : 'PAYMENT SENT'}</b>\\n\`;
  msg += \`━━━━━━━━━━━━━━━━━━━━━\\n\`;
  msg += \`👤 \${customer}\\n\`;
  msg += \`💰 Amount: <b>$\${amount}</b>\\n\`;
  msg += \`📅 \${new Date().toLocaleDateString('en-GB')}\\n\`;
  msg += \`━━━━━━━━━━━━━━━━━━━━━\\n\`;
  msg += \`🐝 System Orta\`;
  return msg;
};`;

const newPayment = `export const formatPaymentMessage = (customerName, phone, amount, type) => {
  let msg = \`💳 <b>#PAYMENT \${type === 'in' ? 'RECEIVED' : 'SENT'}</b>\\n\`;
  msg += \`📅 \${new Date().toLocaleDateString('en-GB')} \${new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}\\n\`;
  msg += \`━━━━━━━━━━━━━━━━━━━━━\\n\`;
  msg += \`👤 \${customerName}\\n\`;
  if (phone) msg += \`📞 \${phone}\\n\`;
  msg += \`💰 Amount: <b>$\${amount}</b>\\n\`;
  msg += \`━━━━━━━━━━━━━━━━━━━━━\\n\`;
  return msg;
};`;

if (code.includes(oldOrder) && code.includes(oldPayment)) {
  code = code.replace(oldOrder, newOrder);
  code = code.replace(oldPayment, newPayment);
  fs.writeFileSync(file, code);
  console.log('✅ Updated formatOrderMessage and formatPaymentMessage in telegramFormatter.js');
} else {
  console.log('⚠️ Pattern not found in telegramFormatter.js');
}
