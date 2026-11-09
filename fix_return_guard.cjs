const fs = require('fs');
let code = fs.readFileSync('src/screens/HistoryScreen.jsx', 'utf8');

code = code.replace(
  `  const handleReturn = async (order, isEdit = false) => {`,
  `  const handleReturn = async (order, isEdit = false) => {
    if (order.type === 'returned') { toast.error('Order already returned'); return; }`
);

fs.writeFileSync('src/screens/HistoryScreen.jsx', code);

let code2 = fs.readFileSync('src/components/InvoiceDetailModal.jsx', 'utf8');
code2 = code2.replace(
  `  const handleReturn = async () => {`,
  `  const handleReturn = async () => {
    if (order.type === 'returned') { toast.error('Order already returned'); return; }`
);
fs.writeFileSync('src/components/InvoiceDetailModal.jsx', code2);
console.log('Fixed return guards');
