const fs = require('fs');
let code = fs.readFileSync('src/screens/TreasuryScreen.jsx', 'utf8');

const targetLogic = `  useEffect(() => { load(); }, [period, dateFrom, dateTo]);`;
const replacementLogic = `  const handleExport = () => {
    let csv = 'Date,Type,Category,Description,Amount,Running Balance\\n';
    transactions.forEach(t => {
      const dateStr = new Date(t.date).toLocaleString().replace(/,/g, '');
      const type = (t.type || '').toUpperCase();
      const cat = (t.category || '').replace(/"/g, '""');
      const desc = (t.description || '').replace(/"/g, '""');
      const amt = (t.amount || 0).toFixed(2);
      const rb = (t.runningBalance || 0).toFixed(2);
      csv += \`"\${dateStr}","\${type}","\${cat}","\${desc}","\${amt}","\${rb}"\\n\`;
    });
    const blob = new Blob(['\\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = \`casa_timeline_\${Date.now()}.csv\`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast.success('Exported Casa timeline to CSV');
  };

  useEffect(() => { load(); }, [period, dateFrom, dateTo]);`;

code = code.replace(targetLogic, replacementLogic);

const targetButton = `<button className="btn btn-secondary btn-sm"><Download size={13}/> Export</button>`;
const replacementButton = `<button className="btn btn-secondary btn-sm" onClick={handleExport}><Download size={13}/> Export CSV</button>`;

code = code.replace(targetButton, replacementButton);

fs.writeFileSync('src/screens/TreasuryScreen.jsx', code);
console.log('Fixed Casa export');
