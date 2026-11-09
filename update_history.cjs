const fs = require('fs');
let history = fs.readFileSync('src/screens/HistoryScreen.jsx', 'utf8');

const historyOld = `          text: \`💰 <b>Balance paid</b>\\nAmount: \${amt.toFixed(2)}\\nFrom: \${payingOrder.customerName} - \${payingOrder.number}\`,`;
const historyNew = `          text: formatPaymentMessage(\`Balance paid: \${payingOrder.customerName} - \${payingOrder.number}\`, payingOrder.customerPhone, amt.toFixed(2), 'in'),`;

if (history.includes(historyOld)) {
  history = history.replace(historyOld, historyNew);
  history = history.replace("import { formatCasaTransaction } from '../toolbox/telegramFormatter';", "import { formatCasaTransaction, formatPaymentMessage } from '../toolbox/telegramFormatter';");
  fs.writeFileSync('src/screens/HistoryScreen.jsx', history);
  console.log('✅ Updated HistoryScreen');
} else {
  console.log('⚠️ Pattern not found in HistoryScreen');
}
