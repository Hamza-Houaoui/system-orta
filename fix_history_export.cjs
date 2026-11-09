const fs = require('fs');
let code = fs.readFileSync('src/screens/HistoryScreen.jsx', 'utf8');

const targetLogic = `  const load = async () => {`;
const replacementLogic = `  const handleExport = () => {
    let csv = 'Order Number,Date,Type,Customer,Phone,Total Price,Deposit,Commission,Items Count,Notes\\n';
    orders.forEach(o => {
      const num = (o.number || '').replace(/"/g, '""');
      const date = new Date(o.date).toLocaleString().replace(/,/g, '');
      const type = (o.type || '').toUpperCase();
      const customer = (o.customerName || '').replace(/"/g, '""');
      const phone = (o.customerPhone || '').replace(/"/g, '""');
      const total = (o.totalPrice || 0).toFixed(2);
      const deposit = (o.depositAmount || 0).toFixed(2);
      const commission = (o.commission || 0).toFixed(2);
      const itemsCount = Array.isArray(o.items) ? o.items.length : 0;
      const notes = (o.notes || '').replace(/"/g, '""');
      csv += \`"\${num}","\${date}","\${type}","\${customer}","\${phone}","\${total}","\${deposit}","\${commission}","\${itemsCount}","\${notes}"\\n\`;
    });
    const blob = new Blob(['\\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = \`history_\${Date.now()}.csv\`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast.success('Exported history to CSV');
  };

  const load = async () => {`;

code = code.replace(targetLogic, replacementLogic);

const targetButton = `<button className="btn btn-secondary btn-sm"><Download size={13}/> Export Excel</button>`;
const replacementButton = `<button className="btn btn-secondary btn-sm" onClick={handleExport}><Download size={13}/> Export CSV</button>`;

code = code.replace(targetButton, replacementButton);

fs.writeFileSync('src/screens/HistoryScreen.jsx', code);
console.log('Fixed History export');
