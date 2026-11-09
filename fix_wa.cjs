const fs = require('fs');

function buildCode(isHistory) {
  return `  const generateInvoiceText = (${isHistory ? 'order' : ''}) => {
    const EMOJI_CLIPBOARD = '\\uD83D\\uDCCB';
    const EMOJI_USER = '\\uD83D\\uDC64';
    const EMOJI_PHONE = '\\uD83D\\uDCDE';
    const EMOJI_RECEIPT = '\\uD83E\\uDDFE';
    const EMOJI_CALENDAR = '\\uD83D\\uDCC5';
    const EMOJI_DOT = '\\u25AB\\uFE0F';
    const EMOJI_MONEY = '\\uD83D\\uDCB0';
    
    // Use CRLF (\\r\\n) for WhatsApp new lines
    const nl = '\\r\\n';
    
    ${isHistory ? `
    let orderTypeStr = (order.type || '').toUpperCase();
    const customerName = order.customerName || 'Walk-in';
    const customerPhone = order.customerPhone || '';
    const invoiceNum = order.number || 'INVOICE';
    const invoiceDate = new Date(order.date).toLocaleString('en-GB');
    const items = order.items || [];
    const discount = order.discount || 0;
    const depositAmount = order.paidAmount || 0;
    const finalTotal = order.totalPrice || 0;
    const subtotal = items.reduce((s, i) => s + (i.totalQty * (i.unitPrice || 0)), 0);
    const note = order.note || '';
    ` : `
    let orderTypeStr = (orderType || 'NEW ORDER').toUpperCase();
    const customerName = customer?.name || 'Walk-in';
    const customerPhone = customer?.phone || '';
    const invoiceNum = 'INVOICE'; // Not saved yet
    const invoiceDate = new Date().toLocaleString('en-GB');
    `}

    let text = EMOJI_CLIPBOARD + ' ' + orderTypeStr + nl;
    text += '━━━━━━━━━━━━━━━━━━━━━' + nl;
    text += EMOJI_USER + ' ' + customerName + nl;
    if (customerPhone) text += EMOJI_PHONE + ' ' + customerPhone + nl;
    text += '---------------------------------------' + nl;
    text += EMOJI_RECEIPT + ' ' + invoiceNum + nl;
    text += EMOJI_CALENDAR + ' ' + invoiceDate + nl;
    text += '--------------------------------------' + nl;
    
    items.forEach(item => {
      const price = parseFloat(item.unitPrice || 0).toFixed(2);
      const total = (item.totalQty * parseFloat(item.unitPrice || 0)).toFixed(2);
      text += EMOJI_DOT + ' ' + item.catalogCode + ' | ' + (item.colorName || item.colorCode) + ' | $' + price + ' × ' + item.totalQty + ' pcs = $' + total + nl;
    });
    
    text += '--------------------------------------' + nl;
    ${isHistory ? '' : `const subtotal = items.reduce((s, i) => s + (i.totalQty * (i.unitPrice || 0)), 0);
    const finalTotal = subtotal - (parseFloat(discount) || 0);`}
    
    if (parseFloat(discount) > 0) {
      text += '- Discount: $' + parseFloat(discount).toFixed(2) + nl;
    }
    
    text += nl + EMOJI_MONEY + ' *' + finalTotal.toFixed(2) + '*' + nl + nl;
    
    if (orderTypeStr === 'DEPOSIT') {
       text += 'Deposit: $' + parseFloat(depositAmount).toFixed(2) + nl;
    } else if (orderTypeStr === 'PAID') {
       text += 'Paid: $' + finalTotal.toFixed(2) + nl;
    }
    
    if (note) {
      text += 'Notes: ' + note + nl;
    }
    
    text += '____________________________' + nl;
    text += '_Returns and exchanges are only accepted within 2 weeks from the purchase date_' + nl;
    return text;
  };`;
}

let newOrder = fs.readFileSync('src/screens/NewOrderScreen.jsx', 'utf8');
const lines1 = newOrder.split('\\n');
const start1 = lines1.findIndex(l => l.includes('const generateInvoiceText = () => {'));
const end1 = lines1.findIndex(l => l.includes('const handleWhatsApp = () => {'));

if (start1 !== -1 && end1 !== -1) {
  lines1.splice(start1, end1 - start1, buildCode(false));
  fs.writeFileSync('src/screens/NewOrderScreen.jsx', lines1.join('\\n'));
  console.log('✅ Updated NewOrderScreen');
} else {
  console.log('⚠️ Pattern not found in NewOrderScreen', start1, end1);
}

let history = fs.readFileSync('src/screens/HistoryScreen.jsx', 'utf8');
const lines2 = history.split('\\n');
const start2 = lines2.findIndex(l => l.includes('const handleWhatsApp = (order) => {'));
const end2 = lines2.findIndex(l => l.includes('const handlePDF = async (order) => {'));

if (start2 !== -1 && end2 !== -1) {
  const newHistoryBlock = `  const handleWhatsApp = (order) => {
${buildCode(true)}
    const text = generateInvoiceText(order);
    const phone = (order.customerPhone || '').replace(/\\D/g, '');
    let url = \`https://wa.me/\`;
    if (phone) url += \`\${phone}\`;
    url += \`?text=\${encodeURIComponent(text)}\`;
    window.open(url, '_blank');
  };
`;
  lines2.splice(start2, end2 - start2, newHistoryBlock);
  fs.writeFileSync('src/screens/HistoryScreen.jsx', lines2.join('\\n'));
  console.log('✅ Updated HistoryScreen');
} else {
  console.log('⚠️ Pattern not found in HistoryScreen', start2, end2);
}
