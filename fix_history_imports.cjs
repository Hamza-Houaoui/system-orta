const fs = require('fs');
let code = fs.readFileSync('src/screens/HistoryScreen.jsx', 'utf8');

const targetImport = `import { formatInvoiceDate } from '../toolbox/dateUtils';`;
const replacementImport = `import { formatInvoiceDate } from '../toolbox/dateUtils';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';`;

if (!code.includes('import jsPDF')) {
    code = code.replace(targetImport, replacementImport);
    fs.writeFileSync('src/screens/HistoryScreen.jsx', code);
}
