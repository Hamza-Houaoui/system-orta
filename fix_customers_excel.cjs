const fs = require('fs');
let code = fs.readFileSync('src/screens/CustomersScreen.jsx', 'utf8');

const targetLogic = `  const openAdd = () => { setForm({ name:'', phone:'', country:'Turkey', cargoName:'', code:'', note:'' }); setEditCustomer(null); setShowAdd(true); };`;
const replacementLogic = `  const fileInputRef = React.useRef(null);

  const handleExport = () => {
    let csv = 'Name,Phone,Country,Cargo,Code,Note,Debt\\n';
    customers.forEach(c => {
      const name = (c.name || '').replace(/"/g, '""');
      const phone = (c.phone || '').replace(/"/g, '""');
      const country = (c.country || '').replace(/"/g, '""');
      const cargo = (c.cargoName || '').replace(/"/g, '""');
      const codeStr = (c.code || '').replace(/"/g, '""');
      const note = (c.note || '').replace(/"/g, '""');
      const debt = c.credit || 0;
      csv += \`"\${name}","\${phone}","\${country}","\${cargo}","\${codeStr}","\${note}","\${debt}"\\n\`;
    });
    const blob = new Blob(['\\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = \`customers_\${Date.now()}.csv\`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast.success('Exported customers to CSV');
  };

  const handleImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target.result;
        const lines = text.split(/\\r?\\n/).filter(l => l.trim().length > 0);
        let updated = 0;
        let added = 0;

        await db.transaction('rw', db.customers, async () => {
          for (let i = 1; i < lines.length; i++) {
            const match = lines[i].match(/(?:\\"([^\\"]*)\\"|([^,]+))/g);
            const cols = match ? match.map(c => c.replace(/^"|"$/g, '').trim()) : [];
            if (cols.length < 1 || !cols[0]) continue;

            const name = cols[0];
            const phone = cols[1] || '';
            const country = cols[2] || '';
            const cargoName = cols[3] || '';
            const code = cols[4] || '';
            const note = cols[5] || '';
            const credit = parseFloat(cols[6]) || 0;

            let existing = await db.customers.where('name').equals(name).first();
            if (existing) {
              await db.customers.update(existing.id, {
                phone: phone || existing.phone,
                country: country || existing.country,
                cargoName: cargoName || existing.cargoName,
                code: code || existing.code,
                note: note || existing.note,
                credit: credit || existing.credit
              });
              updated++;
            } else {
              await db.customers.add({
                id: uuidv4(),
                name, phone, country, cargoName, code, note, credit,
                createdAt: Date.now()
              });
              added++;
            }
          }
        });
        toast.success(\`Imported: \${added} added, \${updated} updated\`);
        load();
      } catch (err) {
        toast.error('Failed to import CSV: ' + err.message);
      }
    };
    reader.readAsText(file);
    e.target.value = null;
  };

  const openAdd = () => { setForm({ name:'', phone:'', country:'Turkey', cargoName:'', code:'', note:'' }); setEditCustomer(null); setShowAdd(true); };`;

code = code.replace(targetLogic, replacementLogic);

const targetButtons = `<button className="btn btn-secondary btn-sm"><Upload size={13}/> Import</button>
            <button className="btn btn-secondary btn-sm"><Download size={13}/> Export</button>`;
const replacementButtons = `<input type="file" accept=".csv" style={{display: 'none'}} ref={fileInputRef} onChange={handleImport} />
            <button className="btn btn-secondary btn-sm" onClick={() => fileInputRef.current?.click()}><Upload size={13}/> Import CSV</button>
            <button className="btn btn-secondary btn-sm" onClick={handleExport}><Download size={13}/> Export CSV</button>`;

code = code.replace(targetButtons, replacementButtons);

fs.writeFileSync('src/screens/CustomersScreen.jsx', code);
console.log('Fixed Customers Excel buttons');
