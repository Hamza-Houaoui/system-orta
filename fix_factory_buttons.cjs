const fs = require('fs');
let code = fs.readFileSync('src/screens/FactoryDetailScreen.jsx', 'utf8');

const target = `<div style={{ display:'flex', gap:10, marginBottom:20, flexWrap:'wrap' }}>
          <button className="btn btn-danger" style={{flex:1}} onClick={() => setModal('invoice')}><Plus size={15}/> + Invoice</button>
          <button className="btn btn-secondary" style={{flex:1, color:'var(--orange)', borderColor:'rgba(245,158,11,0.4)'}} onClick={() => setModal('return')}><RotateCcw size={15}/> Return</button>
          <button className="btn btn-success" style={{flex:1}} onClick={() => setModal('payment')}><DollarSign size={15}/> + Payment</button>
        </div>`;

const replacement = `<div style={{ display:'flex', gap:10, marginBottom:20, flexWrap:'wrap' }}>
          {!isWatcherDevice() && (
            <>
              <button className="btn btn-danger" style={{flex:1}} onClick={() => setModal('invoice')}><Plus size={15}/> + Invoice</button>
              <button className="btn btn-secondary" style={{flex:1, color:'var(--orange)', borderColor:'rgba(245,158,11,0.4)'}} onClick={() => setModal('return')}><RotateCcw size={15}/> Return</button>
              <button className="btn btn-success" style={{flex:1}} onClick={() => setModal('payment')}><DollarSign size={15}/> + Payment</button>
            </>
          )}
        </div>`;

code = code.replace(target, replacement);

// And we can hide them in FactoriesScreen as well if there is "Add Factory"
code = code.replace(
  /<button className="btn btn-primary" onClick=\{\(\) => setFormModal\(true\)\}>\s*<Plus size=\{15\}\/> Add Factory\s*<\/button>/g,
  `{!isWatcherDevice() && <button className="btn btn-primary" onClick={() => setFormModal(true)}><Plus size={15}/> Add Factory</button>}`
);
fs.writeFileSync('src/screens/FactoryDetailScreen.jsx', code);
console.log('Fixed factory buttons');
