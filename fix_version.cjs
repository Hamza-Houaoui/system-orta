const fs = require('fs');
let code = fs.readFileSync('src/screens/SettingsScreen.jsx', 'utf8');

const target = `<div className="card">
        <h2 style={{ marginBottom: 15 }}><SettingsIcon size={18}/> Telegram Configuration</h2>`;

const replacement = `<div className="card">
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15}}>
          <h2 style={{ margin: 0 }}><SettingsIcon size={18}/> Telegram Configuration</h2>
          <span className="badge badge-primary">Version v37</span>
        </div>`;

code = code.replace(target, replacement);
fs.writeFileSync('src/screens/SettingsScreen.jsx', code);
console.log('Added version');
