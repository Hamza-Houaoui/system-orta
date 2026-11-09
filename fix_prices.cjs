const fs = require('fs');
let code = fs.readFileSync('src/screens/ModelDetailScreen.jsx', 'utf8');

const oldButton = '<button className="btn btn-primary btn-sm"><Edit2 size={14}/> Edit Prices</button>';
const newButton = `<button className="btn btn-primary btn-sm" onClick={() => {
              const f = prompt('Factory Price:', model.factoryPrice || 0);
              if (f === null) return;
              const w = prompt('Wholesale Price:', model.wholesalePrice || 0);
              if (w === null) return;
              const r = prompt('Retail Price:', model.retailPrice || 0);
              if (r === null) return;
              const d = prompt('Discount (0 for none):', model.discount || 0);
              if (d === null) return;
              
              db.catalog.update(model.id, {
                factoryPrice: parseFloat(f) || 0,
                wholesalePrice: parseFloat(w) || 0,
                retailPrice: parseFloat(r) || 0,
                discount: parseFloat(d) || 0,
                onSale: (parseFloat(d) || 0) > 0
              }).then(() => {
                toast.success('Prices updated');
                loadData();
                onStockChanged(model.id);
              });
            }}><Edit2 size={14}/> Edit Prices</button>`;

code = code.replace(oldButton, newButton);
fs.writeFileSync('src/screens/ModelDetailScreen.jsx', code);
console.log('Fixed Edit Prices');
