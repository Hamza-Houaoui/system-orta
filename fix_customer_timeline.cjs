const fs = require('fs');
let code = fs.readFileSync('src/screens/CustomerDetailScreen.jsx', 'utf8');

const targetLogic = `  const load = async () => {`;
const replacementLogic = `  const handleExportTimeline = () => {
    let csv = 'Date,Reference,Type,Total Price,Deposit / Payment,Commission,Notes\\n';
    orders.forEach(o => {
      const date = new Date(o.date).toLocaleString().replace(/,/g, '');
      const ref = (o.number || 'PAYMENT').replace(/"/g, '""');
      const type = (o.type || '').toUpperCase();
      const total = (o.totalPrice || 0).toFixed(2);
      const deposit = (o.depositAmount || 0).toFixed(2);
      const commission = (o.commission || 0).toFixed(2);
      const notes = ((o.notes || '') + ' ' + (o.description || '')).trim().replace(/"/g, '""');
      csv += \`"\${date}","\${ref}","\${type}","\${total}","\${deposit}","\${commission}","\${notes}"\\n\`;
    });
    const blob = new Blob(['\\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = \`timeline_\${(customer.name||'').replace(/\\s+/g, '_')}_\${Date.now()}.csv\`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast.success('Exported timeline to CSV');
  };

  const load = async () => {`;

code = code.replace(targetLogic, replacementLogic);

const targetButton = `<DollarSign size={16} style={{ marginRight: 4 }}/> Credit Ledger
            </button>`;
const replacementButton = `<DollarSign size={16} style={{ marginRight: 4 }}/> Credit Ledger
            </button>
            <button className="btn btn-secondary" style={{ padding: '8px 16px', fontSize: '0.9rem', fontWeight: 600 }} onClick={handleExportTimeline}>
              <Download size={16} style={{ marginRight: 4 }} /> Export CSV
            </button>`;

code = code.replace(targetButton, replacementButton);

// Also need to import Download if not there
if (!code.includes('Download,')) {
    code = code.replace('from \'lucide-react\';', ', Download } from \'lucide-react\';');
}

fs.writeFileSync('src/screens/CustomerDetailScreen.jsx', code);
console.log('Fixed Customer Timeline export');
