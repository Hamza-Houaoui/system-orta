const fs = require('fs');
let code = fs.readFileSync('src/screens/NewOrderScreen.jsx', 'utf8');

const targetImport = `import 'jspdf-autotable';`;
const replacementImport = `import 'jspdf-autotable';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';`;

if (!code.includes('@capacitor/filesystem')) {
    code = code.replace(targetImport, replacementImport);
    fs.writeFileSync('src/screens/NewOrderScreen.jsx', code);
}
