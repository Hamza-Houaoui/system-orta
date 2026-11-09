const fs = require('fs');
let treasury = fs.readFileSync('src/screens/TreasuryScreen.jsx', 'utf8');
let modal = fs.readFileSync('src/components/InvoiceDetailModal.jsx', 'utf8');
let history = fs.readFileSync('src/screens/HistoryScreen.jsx', 'utf8');

// TreasuryScreen
treasury = treasury.replace(
  /formatPaymentMessage\(\`Manual \$\{type.toUpperCase\(\)\}: \$\{desc\}\`, amt\.toFixed\(2\), type\)/g,
  "formatPaymentMessage(`Manual ${type.toUpperCase()}: ${desc}`, null, amt.toFixed(2), type)"
);
fs.writeFileSync('src/screens/TreasuryScreen.jsx', treasury);

// InvoiceDetailModal
modal = modal.replace(
  /formatPaymentMessage\(\`Balance paid: \$\{order.customerName\} - \$\{order.number\}\`, amt\.toFixed\(2\), 'in'\)/g,
  "formatPaymentMessage(`Balance paid: ${order.customerName} - ${order.number}`, order.customerPhone, amt.toFixed(2), 'in')"
);
fs.writeFileSync('src/components/InvoiceDetailModal.jsx', modal);

// HistoryScreen
const historyOld = "\\`💰 <b>Balance paid</b>\\\\nAmount: \\${amt.toFixed(2)}\\\\nFrom: \\${payingOrder.customerName} - \\${payingOrder.number}\\`";
const historyNew = "formatPaymentMessage(`Balance paid: ${payingOrder.customerName} - ${payingOrder.number}`, payingOrder.customerPhone, amt.toFixed(2), 'in')";
history = history.replace(historyOld, historyNew);
if (!history.includes('formatPaymentMessage')) {
  history = history.replace("import { formatCasaTransaction } from '../toolbox/telegramFormatter';", "import { formatCasaTransaction, formatPaymentMessage } from '../toolbox/telegramFormatter';");
}
fs.writeFileSync('src/screens/HistoryScreen.jsx', history);

console.log('✅ Updated formatPaymentMessage callers');
