import * as XLSX from 'xlsx';
import { Capacitor } from '@capacitor/core';

export async function exportRowsToExcel(fileName, rows) {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');

  // Native (Android tablet): save to cache and open the native Share sheet
  if (Capacitor.isNativePlatform()) {
    try {
      const { Filesystem, Directory } = await import('@capacitor/filesystem');
      const { Share } = await import('@capacitor/share');
      const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'base64' });
      const savedFile = await Filesystem.writeFile({
        path: fileName,
        data: wbout,
        directory: Directory.Cache
      });
      await Share.share({
        title: fileName,
        url: savedFile.uri,
        dialogTitle: 'Share Excel'
      });
      return;
    } catch (e) {
      // fall through to browser download
      console.warn('[exportExcel] native share failed, falling back: ', e);
    }
  }

  // Web / desktop fallback: blob + anchor download
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function isExcelFile(file) {
  const name = (file && file.name || '').toLowerCase();
  return name.endsWith('.xlsx') || name.endsWith('.xls') ||
    (file && (file.type === 'application/vnd.ms-excel' || file.type.includes('spreadsheetml')));
}

// Reads an imported file and returns a 2D array of rows (first row = header).
// Supports both CSV and Excel (.xlsx / .xls).
export async function readImportRows(file) {
  if (isExcelFile(file)) {
    const data = await file.arrayBuffer();
    const wb = XLSX.read(data, { type: 'array' });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
    return rows.map(r => (r || []).map(c => (c == null ? '' : String(c))));
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target.result;
        const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
        const rows = lines.map(line => {
          const match = line.match(/(?:\"([^\"]*)\"|([^,]+))/g);
          return match ? match.map(c => c.replace(/^"|"$/g, '').trim()) : [];
        });
        resolve(rows);
      } catch (e) { reject(e); }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file, 'utf-8');
  });
}

