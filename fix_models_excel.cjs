const fs = require('fs');
let code = fs.readFileSync('src/screens/ModelsScreen.jsx', 'utf8');

const targetLogic = `  useEffect(() => { load(); }, []);`;
const replacementLogic = `  const fileInputRef = React.useRef(null);

  const handleExport = async () => {
    try {
      const allModels = await db.catalog.toArray();
      const allColors = await db.modelColors.toArray();
      const allFactories = await db.factories.toArray();
      const allSeries = await db.sizeSeries.toArray();

      const factoryMap = {}; allFactories.forEach(f => factoryMap[f.id] = f.name);
      const seriesMap = {}; allSeries.forEach(s => seriesMap[s.id] = s.name);

      let csv = 'Model Code,Factory,Size Series,Factory Price,Wholesale Price,Retail Price,Color,Message ID,Stock\\n';
      
      for (const m of allModels) {
        const mColors = allColors.filter(c => c.catalogId === m.id);
        const fname = (factoryMap[m.factoryId] || '').replace(/"/g, '""');
        const sname = (seriesMap[m.sizeSeriesId] || '').replace(/"/g, '""');
        
        if (mColors.length === 0) {
          csv += \`"\${m.code}","\${fname}","\${sname}","\${m.factoryPrice||0}","\${m.wholesalePrice||0}","\${m.retailPrice||0}","","",""\\n\`;
        } else {
          for (const mc of mColors) {
            const colorName = (mc.colorName || mc.colorCode || '').replace(/"/g, '""');
            const msgId = mc.messageId || '';
            const stockStr = (mc.stock || []).map(s => \`\${s.size}:\${s.qty}\`).join('|');
            csv += \`"\${m.code}","\${fname}","\${sname}","\${m.factoryPrice||0}","\${m.wholesalePrice||0}","\${m.retailPrice||0}","\${colorName}","\${msgId}","\${stockStr}"\\n\`;
          }
        }
      }

      const blob = new Blob(['\\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = \`models_\${Date.now()}.csv\`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      toast.success('Exported models to CSV');
    } catch(e) {
      toast.error('Failed to export');
    }
  };

  const handleImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target.result;
        const lines = text.split(/\\r?\\n/).filter(l => l.trim().length > 0);
        
        const allFactories = await db.factories.toArray();
        const allSeries = await db.sizeSeries.toArray();
        const fMap = {}; allFactories.forEach(f => fMap[f.name.toLowerCase()] = f.id);
        const sMap = {}; allSeries.forEach(s => sMap[s.name.toLowerCase()] = s.id);

        let modelsUpdated = 0;
        let colorsUpdated = 0;

        await db.transaction('rw', [db.catalog, db.modelColors, db.factories, db.sizeSeries], async () => {
          for (let i = 1; i < lines.length; i++) {
            const match = lines[i].match(/(?:\\"([^\\"]*)\\"|([^,]+))/g);
            const cols = match ? match.map(c => c.replace(/^"|"$/g, '').trim()) : [];
            if (cols.length < 1 || !cols[0]) continue;

            const code = cols[0];
            const fName = cols[1] || '';
            const sName = cols[2] || '';
            const fPrice = parseFloat(cols[3]) || 0;
            const wPrice = parseFloat(cols[4]) || 0;
            const rPrice = parseFloat(cols[5]) || 0;
            const cName = cols[6] || '';
            const msgId = cols[7] || '';
            const stockStr = cols[8] || '';

            // Resolve Factory
            let fId = fName ? fMap[fName.toLowerCase()] : '';
            if (fName && !fId) {
               fId = uuidv4();
               await db.factories.add({ id: fId, name: fName, createdAt: Date.now() });
               fMap[fName.toLowerCase()] = fId;
            }

            // Resolve Series
            let sId = sName ? sMap[sName.toLowerCase()] : '';
            if (sName && !sId) {
               sId = uuidv4();
               await db.sizeSeries.add({ id: sId, name: sName, sizes: [] });
               sMap[sName.toLowerCase()] = sId;
            }

            // Find or create Model
            let m = await db.catalog.where('code').equals(code).first();
            if (!m) {
              m = {
                id: uuidv4(), code, factoryId: fId, sizeSeriesId: sId,
                factoryPrice: fPrice, wholesalePrice: wPrice, retailPrice: rPrice,
                onSale: false, createdAt: Date.now()
              };
              await db.catalog.add(m);
              modelsUpdated++;
            } else {
              // Update prices if provided
              let changed = false;
              if (fPrice && m.factoryPrice !== fPrice) { m.factoryPrice = fPrice; changed = true; }
              if (wPrice && m.wholesalePrice !== wPrice) { m.wholesalePrice = wPrice; changed = true; }
              if (rPrice && m.retailPrice !== rPrice) { m.retailPrice = rPrice; changed = true; }
              if (fId && m.factoryId !== fId) { m.factoryId = fId; changed = true; }
              if (sId && m.sizeSeriesId !== sId) { m.sizeSeriesId = sId; changed = true; }
              if (changed) { await db.catalog.put(m); modelsUpdated++; }
            }

            // Find or create Color
            if (cName) {
              let mc = await db.modelColors.where('catalogId').equals(m.id).toArray();
              let existingColor = mc.find(c => (c.colorName || c.colorCode) === cName);
              
              // Parse stock
              let stock = [];
              if (stockStr) {
                stockStr.split('|').forEach(part => {
                  const [sz, qty] = part.split(':');
                  if (sz) stock.push({ size: sz, qty: parseInt(qty)||0 });
                });
              }

              if (!existingColor) {
                await db.modelColors.add({
                  id: uuidv4(), catalogId: m.id, colorName: cName, colorCode: cName,
                  messageId: msgId, stock, createdAt: Date.now()
                });
                colorsUpdated++;
              } else {
                let colorChanged = false;
                if (msgId && existingColor.messageId !== msgId) { existingColor.messageId = msgId; colorChanged = true; }
                if (stockStr) { existingColor.stock = stock; colorChanged = true; }
                if (colorChanged) { await db.modelColors.put(existingColor); colorsUpdated++; }
              }
            }
          }
        });

        toast.success(\`Imported/Updated \${modelsUpdated} models, \${colorsUpdated} colors\`);
        load();
      } catch (err) {
        toast.error('Failed to import CSV: ' + err.message);
      }
    };
    reader.readAsText(file);
    e.target.value = null;
  };

  useEffect(() => { load(); }, []);`;

code = code.replace(targetLogic, replacementLogic);

const targetButtons = `<button className="btn btn-secondary btn-sm"><Upload size={13}/> Import</button>
            <button className="btn btn-secondary btn-sm"><Download size={13}/> Export</button>`;
const replacementButtons = `<input type="file" accept=".csv" style={{display: 'none'}} ref={fileInputRef} onChange={handleImport} />
            <button className="btn btn-secondary btn-sm" onClick={() => fileInputRef.current?.click()}><Upload size={13}/> Import CSV</button>
            <button className="btn btn-secondary btn-sm" onClick={handleExport}><Download size={13}/> Export CSV</button>`;

code = code.replace(targetButtons, replacementButtons);

fs.writeFileSync('src/screens/ModelsScreen.jsx', code);
console.log('Fixed Models Excel functions');
