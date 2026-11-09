const fs = require('fs');
let code = fs.readFileSync('src/screens/FactoryDetailScreen.jsx', 'utf8');

const target = `<div style={{ display:'flex', gap:10, marginBottom:20, flexWrap:'wrap' }}>
          <button className="btn btn-danger" style={{flex:1}} onClick={() => setModal('invoice')}><Plus size={15}/> + Invoice</button>
          <button className="btn btn-secondary" style={{flex:1, color:'var(--orange)', borderColor:'rgba(245,158,11,0.4)'}} onClick={() => setModal('return')}><RotateCcw size={15}/> Return</button>
          <button className="btn btn-success" style={{flex:1}} onClick={() => setModal('payment')}><DollarSign size={15}/> + Payment</button>
          <button className="btn btn-info" style={{flex:1}} onClick={() => setModal('confirm')}><CheckCircle size={15}/> Confirm Balance</button>
        </div>`;

const replacement = `<div style={{ display:'flex', gap:10, marginBottom:20, flexWrap:'wrap' }}>
          {!isWatcherDevice() && (
            <>
              <button className="btn btn-danger" style={{flex:1}} onClick={() => setModal('invoice')}><Plus size={15}/> + Invoice</button>
              <button className="btn btn-secondary" style={{flex:1, color:'var(--orange)', borderColor:'rgba(245,158,11,0.4)'}} onClick={() => setModal('return')}><RotateCcw size={15}/> Return</button>
              <button className="btn btn-success" style={{flex:1}} onClick={() => setModal('payment')}><DollarSign size={15}/> + Payment</button>
              <button className="btn btn-info" style={{flex:1}} onClick={() => setModal('confirm')}><CheckCircle size={15}/> Confirm Balance</button>
            </>
          )}
        </div>`;

if (code.includes(target)) {
  code = code.replace(target, replacement);
  fs.writeFileSync('src/screens/FactoryDetailScreen.jsx', code);
  console.log('Fixed factory buttons successfully!');
} else {
  console.log('Target block not found in FactoryDetailScreen.jsx!');
}
