const fs = require('fs');
let code = fs.readFileSync('src/screens/StockScreen.jsx', 'utf8');

const targetImport = `import db from '../core/db';`;
const replacementImport = `import db from '../core/db';\nimport { toast } from '../components/Toaster';`;

code = code.replace(targetImport, replacementImport);
fs.writeFileSync('src/screens/StockScreen.jsx', code);
console.log('Fixed Stock toast import');
