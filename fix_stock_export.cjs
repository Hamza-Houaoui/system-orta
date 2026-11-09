const fs = require('fs');
let code = fs.readFileSync('src/screens/StockScreen.jsx', 'utf8');

const targetLogic = `  const loadStock = async () => {`;
const replacementLogic = `  const handleExport = () => {
    let csv = 'Model Code,Factory,Color,Total Stock,Sizes Detail,Factory Price,Wholesale Price,Retail Price\\n';
    models.forEach(m => {
      if (!m.colors || m.colors.length === 0) {
         const mCode = (m.code || '').replace(/"/g, '""');
         const factory = (m.factoryName || '').replace(/"/g, '""');
         csv += \`"\${mCode}","\${factory}","","0","","\${m.factoryPrice}","\${m.wholesalePrice}","\${m.retailPrice}"\\n\`;
      } else {
        m.colors.forEach(c => {
          const sizesDetail = (c.stock || []).map(s => \`\${s.size}:\${s.qty}\`).join(' | ');
          const mCode = (m.code || '').replace(/"/g, '""');
          const factory = (m.factoryName || '').replace(/"/g, '""');
          const colorName = (c.name || '').replace(/"/g, '""');
          csv += \`"\${mCode}","\${factory}","\${colorName}","\${c.total}","\${sizesDetail}","\${m.factoryPrice}","\${m.wholesalePrice}","\${m.retailPrice}"\\n\`;
        });
      }
    });
    const blob = new Blob(['\\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = \`stock_report_\${Date.now()}.csv\`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast.success('Exported stock to CSV');
  };

  const loadStock = async () => {`;

code = code.replace(targetLogic, replacementLogic);

const targetButton = `<button className="btn btn-secondary btn-sm"><Download size={14} /> Export</button>`;
const replacementButton = `<button className="btn btn-secondary btn-sm" onClick={handleExport}><Download size={14} /> Export CSV</button>`;

code = code.replace(targetButton, replacementButton);

fs.writeFileSync('src/screens/StockScreen.jsx', code);
console.log('Fixed Stock export');
