const fs = require('fs');
let code = fs.readFileSync('src/screens/TreasuryScreen.jsx', 'utf8');

code = code.replace(
  /<button className="btn btn-success" style=\{\{ flex: 1, padding: '8px 0', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6, fontSize: '0\.9rem' \}\} onClick=\{\(\) => \{ setForm\(\{amount:'',category:'',description:''\}\); setModal\('in'\); \}\}>\s*<TrendingUp size=\{16\}\/> \+ Income\s*<\/button>/,
  `{!isWatcherDevice() && <button className="btn btn-success" style={{ flex: 1, padding: '8px 0', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6, fontSize: '0.9rem' }} onClick={() => { setForm({amount:'',category:'',description:''}); setModal('in'); }}><TrendingUp size={16}/> + Income</button>}`
);
code = code.replace(
  /<button className="btn btn-danger" style=\{\{ flex: 1, padding: '8px 0', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6, fontSize: '0\.9rem' \}\} onClick=\{\(\) => \{ setForm\(\{amount:'',category:'',description:''\}\); setModal\('out'\); \}\}>\s*<TrendingDown size=\{16\}\/> \+ Expense\s*<\/button>/,
  `{!isWatcherDevice() && <button className="btn btn-danger" style={{ flex: 1, padding: '8px 0', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6, fontSize: '0.9rem' }} onClick={() => { setForm({amount:'',category:'',description:''}); setModal('out'); }}><TrendingDown size={16}/> + Expense</button>}`
);

fs.writeFileSync('src/screens/TreasuryScreen.jsx', code);
console.log('Fixed TreasuryScreen buttons 2');
