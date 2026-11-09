const fs = require('fs');
let code = fs.readFileSync('src/screens/HistoryScreen.jsx', 'utf8');

const targetImport = `import { toast } from '../components/Toaster';`;
const replacementImport = `import { toast } from '../components/Toaster';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';`;

if (!code.includes('import jsPDF')) {
    code = code.replace(targetImport, replacementImport);
    fs.writeFileSync('src/screens/HistoryScreen.jsx', code);
}
