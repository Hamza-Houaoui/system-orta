const fs = require('fs');
let code = fs.readFileSync('src/components/InvoiceDetailModal.jsx', 'utf8');

const oldTry = `      // ── Send payment to Casa + Facture channels ────────────────────────
      try {
        const allTxForCasa = await db.transactions.orderBy('date').toArray();`;

const newTry = `      // ── Send payment to Casa + Facture channels ────────────────────────
      try {
        console.log('[Casa] handlePayBalance: starting telegram, amt=', amt, 'remaining=', remaining);
        const allTxForCasa = await db.transactions.orderBy('date').toArray();
        console.log('[Casa] allTxForCasa count=', allTxForCasa.length);`;

if (code.includes(oldTry)) {
  code = code.replace(oldTry, newTry);
  fs.writeFileSync('src/components/InvoiceDetailModal.jsx', code);
  console.log('✅ Added debug logs');
} else {
  console.log('⚠️ Pattern not found');
}
