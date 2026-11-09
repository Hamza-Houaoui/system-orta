const fs = require('fs');
let code = fs.readFileSync('src/screens/SettingsScreen.jsx', 'utf8');

code = code.replace(
  /<div className="form-group"><label className="form-label">Starting Budget \(\$\)<\/label><input type="number" value=\{form\.startBudget\} onChange=\{e => set\('startBudget', parseFloat\(e\.target\.value\) \|\| 0\)\} style=\{\{ maxWidth: 200 \}\} \/><\/div>/g,
  `{Number(form.deviceId) !== 2 && <div className="form-group"><label className="form-label">Starting Budget ($)</label><input type="number" value={form.startBudget} onChange={e => set('startBudget', parseFloat(e.target.value) || 0)} style={{ maxWidth: 200 }} /></div>}`
);

fs.writeFileSync('src/screens/SettingsScreen.jsx', code);
console.log('Fixed SettingsScreen budget');
