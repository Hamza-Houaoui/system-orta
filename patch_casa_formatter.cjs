const fs = require('fs');

let formatter = fs.readFileSync('src/toolbox/telegramFormatter.js', 'utf8');

const oldFnStart = `export const formatCasaTransaction = ({`;
const oldFnEnd = `  return msg;
};`;

const startIndex = formatter.indexOf(oldFnStart);
const endIndex = formatter.indexOf(oldFnEnd, startIndex) + oldFnEnd.length;

if (startIndex === -1 || endIndex === -1) {
  console.error('Could not find formatCasaTransaction');
  process.exit(1);
}

const newFn = `export const formatCasaTransaction = ({
  type,        // 'in' | 'out'
  amount,      // this transaction amount
  category,    // 'Sale' | 'Deposit' | 'Return Refund' | 'Customer Payment' | 'Balance Payment' | 'Manual IN' | 'Manual OUT' ...
  customerName,// customer name if applicable
  balanceBefore,// casa balance BEFORE this transaction
  balance,     // casa balance AFTER this transaction
  todayIn,     // total IN today
  todayOut,    // total OUT today
}) => {
  const isIn = type === 'in';
  const sign = isIn ? '+' : '-';
  const icon = isIn ? '➕🟢' : '➖ 🔴';
  const amt = parseFloat(amount || 0);
  const balAfter = parseFloat(balance ?? 0);
  const balBefore = parseFloat(balanceBefore ?? (isIn ? balAfter - amt : balAfter + amt));
  const netToday = parseFloat(todayIn || 0) - parseFloat(todayOut || 0);

  // Category label map
  const categoryLabels = {
    'Sale': '🛍 Sale',
    'Deposit': '🔖 Deposit',
    'Return Refund': '↩️ Customer Return',
    'Customer Payment': '💳 Customer Payment',
    'Balance Payment': '💳 Balance Payment',
    'Manual IN': '📥 Manual IN',
    'Manual OUT': '📤 Manual OUT',
    'Commission Paid': '🤝 Commission',
    'Factory Payment': '🏭 Factory Payment',
    'Expense': '💸 Expense',
  };
  const categoryLabel = categoryLabels[category] || \`📋 \${category || 'Transaction'}\`;

  let msg = \`\${icon} <b>CASA \${sign}\${amt.toFixed(2)}</b>\\n\`;
  msg += \`━━━━━━━━━━━━━━━━━━━━━\\n\`;
  msg += \`\${categoryLabel}\\n\`;
  if (customerName) msg += \`👤 \${customerName}\\n\`;
  msg += \`━━━━━━━━━━━━━━━━━━━━━\\n\`;
  msg += \`🔙 Casa was: $\${balBefore.toFixed(2)}\\n\`;
  if (isIn) {
    msg += \`➕🟢 Received: <b>+$\${amt.toFixed(2)}</b>\\n\`;
  } else {
    msg += \`➖ 🔴 Paid out: <b>-$\${amt.toFixed(2)}</b>\\n\`;
  }
  msg += \`✅ Casa now: <b>$\${balAfter.toFixed(2)}</b>\\n\`;
  
  msg += \`━━━━━━━━━━━━━━━━━━━━━\\n\`;
  msg += \`📈 Total IN Today:  <b>+$\${parseFloat(todayIn || 0).toFixed(2)}</b>\\n\`;
  msg += \`📉 Total OUT Today: <b>-$\${parseFloat(todayOut || 0).toFixed(2)}</b>\\n\`;
  msg += \`💰 Net Today: <b>\${netToday >= 0 ? '+' : ''}\${netToday.toFixed(2)}</b>\\n\\n\`;
  msg += \`━━━━━━━━━━━━━━━━━━━━━\\n\`;
  msg += \`📅 \${new Date().toLocaleDateString('en-GB')} \${new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}\`;
  
  return msg;
};`;

formatter = formatter.substring(0, startIndex) + newFn + formatter.substring(endIndex);
fs.writeFileSync('src/toolbox/telegramFormatter.js', formatter);
console.log('✅ formatCasaTransaction replaced');
