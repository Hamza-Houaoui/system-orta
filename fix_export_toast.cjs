const fs = require('fs');
let code = fs.readFileSync('src/screens/ModelsScreen.jsx', 'utf8');

code = code.replace(/toast\.error\('Failed to export'\);/g, `toast.error('Failed to export: ' + e.message);`);

fs.writeFileSync('src/screens/ModelsScreen.jsx', code);
