const fs = require('fs');
let code = fs.readFileSync('src/screens/FactoriesScreen.jsx', 'utf8');

const targetLogic = `  useEffect(() => { loadFactories(); }, []);`;
const replacementLogic = `  const fileInputRef = React.useRef(null);

  const handleExport = () => {
    let csv = 'Name,Phone,Address,Starting Debt\\n';
    factories.forEach(f => {
      csv += \`"\${(f.name || '').replace(/"/g, '""')}","\${(f.phone || '').replace(/"/g, '""')}","\${(f.address || '').replace(/"/g, '""')}","\${f.startCredit || 0}"\\n\`;
    });
    const blob = new Blob(['\\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = \`factories_\${Date.now()}.csv\`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast.success('Exported factories to CSV');
  };

  const handleImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target.result;
        const lines = text.split(/\\r?\\n/).filter(l => l.trim().length > 0);
        const newFactories = [];
        for (let i = 1; i < lines.length; i++) {
          const match = lines[i].match(/(?:\\"([^\\"]*)\\"|([^,]+))/g);
          const cols = match ? match.map(c => c.replace(/^"|"$/g, '').trim()) : [];
          if (cols.length >= 1 && cols[0]) {
             newFactories.push({
               id: uuidv4(),
               name: cols[0],
               phone: cols[1] || '',
               address: cols[2] || '',
               startCredit: parseFloat(cols[3]) || 0,
               createdAt: Date.now()
             });
          }
        }
        if (newFactories.length > 0) {
          await db.factories.bulkAdd(newFactories);
          toast.success(\`Imported \${newFactories.length} factories\`);
          loadFactories();
        } else {
          toast.error('No valid factories found in file');
        }
      } catch (err) {
        toast.error('Failed to import CSV');
      }
    };
    reader.readAsText(file);
    e.target.value = null;
  };

  useEffect(() => { loadFactories(); }, []);`;

code = code.replace(targetLogic, replacementLogic);
fs.writeFileSync('src/screens/FactoriesScreen.jsx', code);
console.log('Fixed Factories Excel functions');
