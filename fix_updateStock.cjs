const fs = require('fs');
let code = fs.readFileSync('src/screens/ModelDetailScreen.jsx', 'utf8');

const target = `  const updateStock = async (colorId, size, newQty) => {
    try {
      const qty = parseInt(newQty) || 0;
      const mc = await db.modelColors.get(colorId);
      const stock = [...(mc.stock || [])];
      const oldQty = stock.find(s => s.size === size)?.qty || 0;
      
      const sIdx = stock.findIndex(s => s.size === size);
      if (sIdx >= 0) stock[sIdx].qty = qty;
      else stock.push({ size, qty });

      await db.modelColors.update(colorId, { stock });

      // Log manual adjustment
        if (qty !== oldQty) {
          const colorDef = colors.find(c => c.id === colorId);
          const changeQty = qty - oldQty;
          const newBalance = stock.reduce((s, x) => s + (parseInt(x.qty) || 0), 0);
          
          await db.stockLog.add({
            id: crypto.randomUUID(),
            date: Date.now(),
            type: 'manual',
            ref: \`Manual: \${model.code}\`,
            catalogCode: model.code,
            colorName: colorDef?.name || mc.colorCode || '',
            change: changeQty,
            sizesChanged: { [size]: changeQty },
            balance: newBalance
          });
      }
      await onStockChanged(model.id);
      load();
    } catch (e) {
      toast.error('Failed to update stock');
    }
  };`;

const replacement = `  const updateStock = async (colorId, size, newQty) => {
    try {
      const qty = parseInt(newQty) || 0;
      let changed = false;
      
      await db.transaction('rw', [db.modelColors, db.stockLog], async () => {
        const mc = await db.modelColors.get(colorId);
        const stock = [...(mc.stock || [])];
        const oldQty = stock.find(s => s.size === size)?.qty || 0;
        
        if (qty === oldQty) return;
        changed = true;
        
        const sIdx = stock.findIndex(s => s.size === size);
        if (sIdx >= 0) stock[sIdx].qty = qty;
        else stock.push({ size, qty });

        await db.modelColors.update(colorId, { stock });

        const colorDef = colors.find(c => c.id === colorId);
        const changeQty = qty - oldQty;
        const newBalance = stock.reduce((s, x) => s + (parseInt(x.qty) || 0), 0);
        
        await db.stockLog.add({
          id: crypto.randomUUID(),
          date: Date.now(),
          type: 'manual',
          ref: \`Manual: \${model.code}\`,
          catalogCode: model.code,
          colorName: colorDef?.name || mc.colorCode || '',
          change: changeQty,
          sizesChanged: { [size]: changeQty },
          balance: newBalance
        });
      });
      
      if (changed) {
        onStockChanged(model.id).catch(()=>{});
        load();
      }
    } catch (e) {
      toast.error('Failed to update stock');
    }
  };`;

code = code.replace(target, replacement);
fs.writeFileSync('src/screens/ModelDetailScreen.jsx', code);
console.log('Fixed updateStock logic');
