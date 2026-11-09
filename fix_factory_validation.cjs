const fs = require('fs');
let code = fs.readFileSync('src/screens/FactoryDetailScreen.jsx', 'utf8');

const target = `      if (type === 'payment') {
        amount = parseFloat(form.amount) || 0;
        if (amount <= 0) { toast.error('Amount must be positive'); setSaving(false); return; }
      } else {
        items = invoiceItems.filter(i => i.catalogCode);
        // For return, use sizeQtys sum if broken series; for import, use qty
        amount = items.reduce((s, i) => {
          const sizeSum = Object.values(i.sizeQtys || {}).reduce((a, b) => a + (parseInt(b) || 0), 0);
          const totalQty = sizeSum > 0 ? sizeSum : (i.qty || 0);
          return s + (totalQty * (i.factoryPrice || 0));
        }, 0);
      }`;

const replacement = `      if (type === 'payment') {
        amount = parseFloat(form.amount) || 0;
        if (amount <= 0) { toast.error('Amount must be positive'); setSaving(false); return; }
        const f = await db.factories.get(id);
        if (amount > (f.runningDebt || 0)) { toast.error('Payment exceeds current debt'); setSaving(false); return; }
      } else {
        items = invoiceItems.filter(i => i.catalogCode);
        if (items.length === 0) { toast.error('Add at least one item'); setSaving(false); return; }
        
        // Pre-validate items
        for (const item of items) {
           const cat = await db.catalog.where('code').equals(item.catalogCode.toUpperCase()).first();
           if (!cat) { toast.error(\`Code \${item.catalogCode} not found\`); setSaving(false); return; }
           
           let mc = null;
           if (item.colorId) mc = await db.modelColors.get(item.colorId);
           if (!mc) {
              const mcs = await db.modelColors.where('catalogId').equals(cat.id).toArray();
              mc = mcs.find(m => m.colorName === item.colorName || m.colorCode === item.colorName);
           }
           if (!mc) { toast.error(\`Color \${item.colorName} not found for \${item.catalogCode}\`); setSaving(false); return; }
           
           const series = cat.sizeSeriesId ? await db.sizeSeries.get(cat.sizeSeriesId) : null;
           const sizes = series?.sizes || [];
           if (sizes.length === 0) { toast.error(\`Code \${item.catalogCode} has no size series defined\`); setSaving(false); return; }
           
           if (type === 'return') {
              const sizeSum = Object.values(item.sizeQtys || {}).reduce((a, b) => a + (parseInt(b) || 0), 0);
              const totalQtyToReturn = sizeSum > 0 ? sizeSum : (item.qty || 0);
              const stockMap = {};
              (mc.stock || []).forEach(s => stockMap[s.size] = s.qty);
              
              if (sizeSum > 0) {
                 for (const [sz, q] of Object.entries(item.sizeQtys)) {
                    if ((parseInt(q)||0) > (stockMap[sz] || 0)) {
                       toast.error(\`Cannot return \${q} of size \${sz} (only \${stockMap[sz] || 0} in stock)\`); setSaving(false); return;
                    }
                 }
              } else {
                 let available = mc.stock?.reduce((s, x)=>s+(parseInt(x.qty)||0), 0) || 0;
                 if (totalQtyToReturn > available) {
                    toast.error(\`Cannot return \${totalQtyToReturn} of \${item.catalogCode} (only \${available} in stock)\`); setSaving(false); return;
                 }
              }
           }
        }
        
        amount = items.reduce((s, i) => {
          const sizeSum = Object.values(i.sizeQtys || {}).reduce((a, b) => a + (parseInt(b) || 0), 0);
          const totalQty = sizeSum > 0 ? sizeSum : (i.qty || 0);
          return s + (totalQty * (i.factoryPrice || 0));
        }, 0);
      }`;

code = code.replace(target, replacement);
fs.writeFileSync('src/screens/FactoryDetailScreen.jsx', code);
console.log('Fixed factory validation');
