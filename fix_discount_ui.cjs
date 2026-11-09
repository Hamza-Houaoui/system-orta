const fs = require('fs');
let code = fs.readFileSync('src/screens/ModelDetailScreen.jsx', 'utf8');

const oldCards = `<div className="stat-card">
            <div className="stat-label">Retail Price</div>
            <div className="stat-value text-success">$\${model.retailPrice}</div>
          </div>
        </div>`;

const newCards = `<div className="stat-card">
            <div className="stat-label">Retail Price</div>
            <div className="stat-value text-success">$\${model.retailPrice}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Discount</div>
            <div className="stat-value text-danger">\${model.discount ? '$'+model.discount : '-'}</div>
          </div>
        </div>`;

code = code.replace(oldCards, newCards);
fs.writeFileSync('src/screens/ModelDetailScreen.jsx', code);
console.log('Fixed Discount UI');
