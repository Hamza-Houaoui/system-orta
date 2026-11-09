import { isWatcherDevice } from '../core/deviceSync';
import { getSettings } from '../core/store';
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, Building2, Plus, RefreshCw, DollarSign, RotateCcw, CheckCircle, Download, Upload, Camera, X, Barcode, FileText } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import db from '../core/db';
import { onStockChanged } from '../core/telegramPublisher';
import { toast } from '../components/Toaster';
import { Logger } from '../core/logger';
import ErrorBoundary from '../components/ErrorBoundary';
import { drawPdfHeader, fmtMoney } from '../core/invoicePdf';
import { exportRowsToExcel } from '../core/exportExcel';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { formatFactoryInvoice , formatCasaTransaction } from '../toolbox/telegramFormatter';
import FactoryInvoiceDetailModal from '../components/FactoryInvoiceDetailModal';
import BarcodeScanner from '../components/BarcodeScanner';

export default function FactoryDetailScreen() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [factory, setFactory] = useState(null);
  const [fin, setFin] = useState({});
  const [timeline, setTimeline] = useState([]);
  const [filter, setFilter] = useState('all');
  const [modal, setModal] = useState(null); // 'invoice'|'return'|'payment'|'confirm'
  const [showScanner, setShowScanner] = useState(false);
  const [scannerTargetRow, setScannerTargetRow] = useState(null);
  const [form, setForm] = useState({ number: '', amount: '', receiver: '', note: '' });
  const [invoiceItems, setInvoiceItems] = useState([{ catalogCode: '', colorName: '', qty: 1, factoryPrice: 0, catalogId: null, availableColors: [], sizes: [], sizeQtys: {} }]);
  const [invoicePhoto, setInvoicePhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [activeRow, setActiveRow] = useState(null);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [allModels, setAllModels] = useState([]);
  const [allModelColors, setAllModelColors] = useState([]);
  const [allColors, setAllColors] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); }, [id]);

  const load = async () => {
    const f = await db.factories.get(id);
    if (!f) { navigate('/factories'); return; }
    setFactory(f);
    const invoices = await db.factoryInvoices.where('factoryId').equals(id).toArray();
    
    invoices.sort((a, b) => a.date - b.date);
    let currentDebt = f.startCredit || 0;
    for (let inv of invoices) {
      if (inv.type === 'in') currentDebt += (inv.amount || 0);
      else if (inv.type === 'return') currentDebt -= (inv.amount || 0);
      else if (inv.type === 'payment') currentDebt -= (inv.amount || 0);
      inv.runningDebt = currentDebt;
    }
    
    invoices.sort((a, b) => b.date - a.date);
    setTimeline(invoices);
    computeFin(f, invoices);
    
    setAllModels(await db.catalog.toArray());
    setAllModelColors(await db.modelColors.toArray());
    setAllColors(await db.colors.toArray());
  };

  const computeFin = async (f, invoices) => {
    let totalIn = 0, totalOut = 0, totalPayments = 0;
    invoices.forEach(inv => {
      if (inv.type === 'in')      totalIn += inv.amount || 0;
      if (inv.type === 'return')  totalOut += inv.amount || 0;
      if (inv.type === 'payment') totalPayments += inv.amount || 0;
    });
    const totalCredit = (f.startCredit || 0) + totalIn - totalOut - totalPayments;
    const models = await db.catalog.where('factoryId').equals(id).toArray();
    let stockCredit = 0, totalSold = 0;
    for (const m of models) {
      const colors = await db.modelColors.where('catalogId').equals(m.id).toArray();
      for (const mc of colors) {
        const qty = (mc.stock || []).reduce((s, x) => s + (x.qty || 0), 0);
        stockCredit += qty * (m.factoryPrice || 0);
      }
    }
    setFin({ totalCredit, stockCredit, netCredit: totalCredit - stockCredit, totalIn, totalOut, modelCount: models.length });
  };

  const saveInvoice = async (modalType) => {
    setSaving(true);
    try {
      const type = modalType === 'invoice' ? 'in' : modalType;
      let amount = 0;
      let items = [];
      if (type === 'payment') {
        amount = parseFloat(form.amount) || 0;
        if (amount <= 0) { toast.error('Amount must be positive'); setSaving(false); return; }
        const f = await db.factories.get(id);
      } else {
        items = invoiceItems.filter(i => i.catalogCode);
        if (items.length === 0) { toast.error('Add at least one item'); setSaving(false); return; }
        
        // Pre-validate items
        for (const item of items) {
           const cat = await db.catalog.where('code').equals(item.catalogCode.toUpperCase()).first();
           if (!cat) { toast.error(`Code ${item.catalogCode} not found`); setSaving(false); return; }
           
           let mc = null;
           if (item.colorId) mc = await db.modelColors.get(item.colorId);
           if (!mc) {
              const mcs = await db.modelColors.where('catalogId').equals(cat.id).toArray();
              mc = mcs.find(m => m.colorName === item.colorName || m.colorCode === item.colorName);
           }
           if (!mc) { toast.error(`Color ${item.colorName} not found for ${item.catalogCode}`); setSaving(false); return; }
           
           const series = cat.sizeSeriesId ? await db.sizeSeries.get(cat.sizeSeriesId) : null;
           const sizes = series?.sizes || [];
           if (sizes.length === 0) { toast.error(`Code ${item.catalogCode} has no size series defined`); setSaving(false); return; }
           
           if (type === 'return') {
              const sizeSum = Object.values(item.sizeQtys || {}).reduce((a, b) => a + (parseInt(b) || 0), 0);
              const totalQtyToReturn = sizeSum > 0 ? sizeSum : (item.qty || 0);
              const stockMap = {};
              (mc.stock || []).forEach(s => stockMap[s.size] = s.qty);
              
              if (sizeSum > 0) {
                 for (const [sz, q] of Object.entries(item.sizeQtys)) {
                    if ((parseInt(q)||0) > (stockMap[sz] || 0)) {
                       toast.error(`Cannot return ${q} of size ${sz} (only ${stockMap[sz] || 0} in stock)`); setSaving(false); return;
                    }
                 }
              } else {
                 let available = mc.stock?.reduce((s, x)=>s+(parseInt(x.qty)||0), 0) || 0;
                 if (totalQtyToReturn > available) {
                    toast.error(`Cannot return ${totalQtyToReturn} of ${item.catalogCode} (only ${available} in stock)`); setSaving(false); return;
                 }
              }
           }
        }
        
        amount = items.reduce((s, i) => {
          const sizeSum = Object.values(i.sizeQtys || {}).reduce((a, b) => a + (parseInt(b) || 0), 0);
          const totalQty = sizeSum > 0 ? sizeSum : (i.qty || 0);
          return s + (totalQty * (i.factoryPrice || 0));
        }, 0);
      }
      const inv = {
        id: uuidv4(), factoryId: id, type,
        number: form.number || `INV-${Date.now()}`,
        date: Date.now(), amount, items,
        receiverName: form.receiver, note: form.note,
        photoBlob: invoicePhoto || null,
      };
      const catalogIdsToUpdate = new Set();
      
      await db.transaction('rw', [db.factoryInvoices, db.modelColors, db.stockLog, db.transactions, db.catalog, db.sizeSeries, db.telegramQueue], async () => {
        await db.factoryInvoices.add(inv);
        const stockLogs = [];
        if (type === 'in') {
        for (const item of items) {
          const cat = await db.catalog.where('code').equals(item.catalogCode.toUpperCase()).first();
          if (cat) {
            let mc = null;
            if (item.colorId) mc = await db.modelColors.get(item.colorId);
            if (!mc) {
              const mcs = await db.modelColors.where('catalogId').equals(cat.id).toArray();
              mc = mcs.find(m => m.colorName === item.colorName || m.colorCode === item.colorName) || mcs[0];
            }
            if (mc) {
              const series = cat.sizeSeriesId ? await db.sizeSeries.get(cat.sizeSeriesId) : null;
              const sizes = series?.sizes || [];
              const stockMap = {};
              (mc.stock || []).forEach(s => stockMap[s.size] = s.qty);
              const hasSizeBreakdown = item.sizeQtys && Object.keys(item.sizeQtys).length > 0;
              const sizesChanged = {};
              let itemTotalIn = 0;
              if (hasSizeBreakdown) {
                // User specified per-size quantities
                Object.entries(item.sizeQtys).forEach(([sz, q]) => {
                  const qty = parseInt(q) || 0;
                  stockMap[sz] = (stockMap[sz] || 0) + qty;
                  sizesChanged[sz] = qty;
                  itemTotalIn += qty;
                });
              } else {
                // Full series import — distribute evenly
                const basePerSize = Math.floor(item.qty / (sizes.length || 1));
                const remainder = item.qty % (sizes.length || 1);
                sizes.forEach((sz, idx) => {
                  const addQty = idx < remainder ? basePerSize + 1 : basePerSize;
                  stockMap[sz] = (stockMap[sz] || 0) + addQty;
                  sizesChanged[sz] = addQty;
                  itemTotalIn += addQty;
                });
              }
              const newStock = Object.entries(stockMap).map(([size, qty]) => ({ size, qty }));
              await db.modelColors.update(mc.id, { stock: newStock });
              
              const newBalance = newStock.reduce((s, c) => s + c.qty, 0);
              stockLogs.push({
                id: uuidv4(), date: Date.now(), type: 'factory_in', ref: inv.number,
                catalogCode: item.catalogCode, colorName: mc.colorName || mc.colorCode,
                change: itemTotalIn, sizesChanged, balance: newBalance
              });
              catalogIdsToUpdate.add(cat.id);
            }
          }
        }
        if (stockLogs.length > 0) await db.stockLog.bulkAdd(stockLogs);
      }
      if (type === 'return') {
        for (const item of items) {
          const cat = await db.catalog.where('code').equals(item.catalogCode.toUpperCase()).first();
          if (cat) {
            let mc = null;
            if (item.colorId) mc = await db.modelColors.get(item.colorId);
            if (!mc) {
              const mcs = await db.modelColors.where('catalogId').equals(cat.id).toArray();
              mc = mcs.find(m => m.colorName === item.colorName || m.colorCode === item.colorName) || mcs[0];
            }
            if (mc) {
              const series = cat.sizeSeriesId ? await db.sizeSeries.get(cat.sizeSeriesId) : null;
              const sizes = series?.sizes || [];
              const stockMap = {};
              (mc.stock || []).forEach(s => stockMap[s.size] = s.qty);
              
              const hasSizeBreakdown = item.sizeQtys && Object.keys(item.sizeQtys).length > 0;
              const sizesChanged = {};
              let itemTotalOut = 0;
              if (hasSizeBreakdown) {
                // User specified per-size quantities
                Object.entries(item.sizeQtys).forEach(([sz, q]) => {
                  const qty = parseInt(q) || 0;
                  stockMap[sz] = Math.max(0, (stockMap[sz] || 0) - qty);
                  sizesChanged[sz] = -qty;
                  itemTotalOut += qty;
                });
              } else {
                // Full series return — distribute evenly
                const basePerSize = Math.floor(item.qty / (sizes.length || 1));
                const remainder = item.qty % (sizes.length || 1);
                sizes.forEach((sz, idx) => {
                  const subQty = idx < remainder ? basePerSize + 1 : basePerSize;
                  stockMap[sz] = Math.max(0, (stockMap[sz] || 0) - subQty);
                  sizesChanged[sz] = -subQty;
                  itemTotalOut += subQty;
                });
              }
              const newStock = Object.entries(stockMap).map(([size, qty]) => ({ size, qty }));
              await db.modelColors.update(mc.id, { stock: newStock });
              
              const newBalance = newStock.reduce((s, c) => s + c.qty, 0);
              stockLogs.push({
                id: uuidv4(), date: Date.now(), type: 'factory_return', ref: inv.number,
                catalogCode: item.catalogCode, colorName: mc.colorName || mc.colorCode,
                change: -itemTotalOut, sizesChanged, balance: newBalance
              });
              catalogIdsToUpdate.add(cat.id);
            }
          }
        }
        if (stockLogs.length > 0) await db.stockLog.bulkAdd(stockLogs);
      }
      if (type === 'payment') {
        const amt = parseFloat(form.amount) || 0;
        await db.transactions.add({
          id: uuidv4(),
          date: Date.now(),
          type: 'out',
          amount: amt,
          category: 'Factory Payment',
          description: `Factory Payment - ${factory.name} - #${inv.number}`,
          factoryId: factory.id,
        });
      }
      }); // End transaction
      
      // ── Send FACTORY PAYMENT to Casa Channel (outside transaction for accurate balance) ──
      if (type === 'payment') {
        try {
          const amt = parseFloat(form.amount) || 0;
          const allTxForCasa = await db.transactions.orderBy('date').toArray();
          const _startBudget = parseFloat(getSettings().startBudget) || 0;
          const _allIn  = allTxForCasa.filter(t => t.type === 'in').reduce((s,t) => s + (t.amount||0), 0);
          const _allOut = allTxForCasa.filter(t => t.type === 'out').reduce((s,t) => s + (t.amount||0), 0);
          const casaBalance = _startBudget + _allIn - _allOut;
          const todayStart = new Date(); todayStart.setHours(0,0,0,0);
          const todayTx = allTxForCasa.filter(t => t.date >= todayStart.getTime());
          const casaTodayIn = todayTx.filter(t => t.type === 'in').reduce((s,t) => s + t.amount, 0);
          const casaTodayOut = todayTx.filter(t => t.type === 'out').reduce((s,t) => s + t.amount, 0);
          await db.telegramQueue.add({
            priority: 3, type: 'text', status: 'pending',
            createdAt: Date.now(), attemptCount: 0,
            chatIdKey: 'casaChatId',
            text: formatCasaTransaction({
              type: 'out',
              amount: amt,
              category: 'Factory Payment',
              customerName: factory.name,
              balanceBefore: casaBalance + amt,
              balance: casaBalance,
              todayIn: casaTodayIn,
              todayOut: casaTodayOut,
            }),
          });
        } catch(tgErr) {
          Logger.warn('factories', 'saveInvoice', `Failed to queue Telegram casa: ${tgErr.message}`);
        }
      }

      // Update Telegram for all modified catalogs outside the transaction
      for (const catId of catalogIdsToUpdate) {
        onStockChanged(catId).catch(() => {});
      }

      let tgmType = 'text';
      let blob = undefined;
      if (invoicePhoto) {
        tgmType = 'photo';
        blob = invoicePhoto;
      }

      await db.telegramQueue.add({
        priority: 2,
        type: tgmType,
        status: 'pending',
        createdAt: Date.now(),
        attemptCount: 0,
        chatIdKey: 'factoryInvoiceChatId',
        text: formatFactoryInvoice(type, factory, form, invoiceItems, fin),
        blob: blob,
        fileName: invoicePhoto ? invoicePhoto.name : undefined,
      });
      Logger.info('factories', 'saveInvoice', `Factory ${type} saved — queued to Telegram`, { id: inv.id, amount });
      toast.success(`${type.charAt(0).toUpperCase()+type.slice(1)} saved — $${amount.toFixed(2)}`);
      setModal(null); setForm({ number:'', amount:'', receiver:'', note:'' });
      setInvoiceItems([{ catalogCode:'', colorName:'', qty:1, factoryPrice:0, catalogId: null, availableColors: [] }]);
      setInvoicePhoto(null);
      setPhotoPreview(null);
      load();
    } catch (e) {
      Logger.error('factories', 'saveInvoice', e.message);
      toast.error('Error: ' + e.message);
    }
    setSaving(false);
  };

  const handlePhotoCapture = (e) => {
    const file = e.target.files[0];
    if (file) {
      setInvoicePhoto(file);
      setPhotoPreview(URL.createObjectURL(file));
    }
  };

  const getModelThumbnail = (modelId) => {
    const mcWithImage = allModelColors.find(mc => mc.catalogId === modelId && mc.assets?.length > 0);
    if (!mcWithImage) return null;
    const asset = mcWithImage.assets[0];
    if (!asset.blob) return null;
    try {
      return URL.createObjectURL(asset.blob);
    } catch(e) { return null; }
  };

  const selectModelForInvoice = (idx, model) => {
    const colorsForModel = allModelColors.filter(mc => mc.catalogId === model.id).map(mc => {
      const cDef = allColors.find(c => c.id === mc.colorId) || {};
      return { ...mc, name: cDef.name || mc.colorCode, hex: cDef.hex };
    });

    // Load the size series for this model
    const loadSizes = async () => {
      const sizeSeriesData = model.sizeSeriesId ? await db.sizeSeries.get(model.sizeSeriesId) : null;
      const sizeList = sizeSeriesData?.sizes || [];
      setInvoiceItems(p => {
        const n = [...p];
        n[idx] = {
          ...n[idx],
          catalogCode: model.code,
          catalogId: model.id,
          factoryPrice: model.factoryPrice || 0,
          availableColors: colorsForModel,
          colorName: colorsForModel.length > 0 ? colorsForModel[0].name : '',
          sizes: sizeList,
          sizeQtys: {},
        };
        return n;
      });
    };
    loadSizes();
    setActiveRow(null);
  };

  const filtered = filter === 'all' ? timeline : timeline.filter(t => t.type === filter);

  const handleFactoryPDF = async () => {
    try {
      const jsPDF = (await import('jspdf')).default;
      await import('jspdf-autotable');
      const settings = await getSettings();
      const doc = new jsPDF();
      const pageW = doc.internal.pageSize.getWidth();
      const margin = 14;

      const headerSettings = { ...settings, shopPhone: '', shopAddress: '' };
      const header = await drawPdfHeader(doc, { settings: headerSettings, invoiceNo: '' });
      let y = header.y;

      // Factory name
      y += 4;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(33, 33, 33);
      doc.text(String(factory.name || ''), pageW / 2, y, { align: 'center' });
      y += 10;

      // Dashboard stats
      doc.autoTable({
        startY: y,
        margin: { left: margin, right: margin },
        head: [['Toplam Model', 'Mevcut Stok Degeri', 'Net Bakiye', 'Toplam Bakiye']],
        body: [[
          String(fin.modelCount || 0),
          '$' + fmtMoney(fin.stockCredit || 0),
          '$' + fmtMoney(fin.netCredit || 0),
          '$' + fmtMoney(fin.totalCredit || 0)
        ]],
        styles: { fontSize: 9, cellPadding: 4, halign: 'center' },
        headStyles: { fillColor: [212, 175, 55], textColor: [0, 0, 0], fontStyle: 'bold' },
        tableWidth: 'auto'
      });
      y = doc.lastAutoTable.finalY + 8;

      // Chronological timeline (oldest first)
      const chrono = [...timeline].sort((a, b) => a.date - b.date);
      const typeLabels = { in: 'FATURA', return: 'IADE', payment: 'ODEME', balance_confirm: 'ONAYLANMIS BAKIYE' };
      const typeColors = { in: [239, 68, 68], return: [212, 175, 55], payment: [34, 197, 94], balance_confirm: [59, 130, 246] };
      const body = chrono.map(t => [
        new Date(t.date).toLocaleDateString() + ' ' + new Date(t.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        typeLabels[t.type] || t.type,
        t.type !== 'balance_confirm' ? (t.number || '') : '',
        (t.type === 'in' ? '+' : (t.type === 'return' || t.type === 'payment') ? '-' : '') + '$' + fmtMoney(t.amount || 0),
        '$' + fmtMoney(t.runningDebt || 0)
      ]);

      doc.autoTable({
        startY: y,
        margin: { left: margin, right: margin },
        head: [['Tarih', 'Tur', 'No', 'Tutar', 'Guncel Borc']],
        body,
        styles: { fontSize: 8, cellPadding: 3, textColor: [33, 33, 33] },
        headStyles: { fillColor: [212, 175, 55], textColor: [0, 0, 0], fontStyle: 'bold' },
        columnStyles: { 3: { halign: 'right' }, 4: { halign: 'right' } },
        tableWidth: 'auto',
        theme: 'striped',
        didParseCell: (data) => {
          if (data.section === 'body') {
            const t = chrono[data.row.index];
            const color = typeColors[t.type];
            if (color) data.cell.styles.textColor = color;
          }
        }
      });
      y = doc.lastAutoTable.finalY + 8;

      // Confirmed balance line (blue) if any balance confirm transaction
      const lastConfirm = [...chrono].reverse().find(t => t.type === 'balance_confirm');
      if (lastConfirm) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.setTextColor(59, 130, 246);
        doc.text(`Onaylanmis Bakiye: $${fmtMoney(lastConfirm.amount || 0)}`, pageW - margin, y, { align: 'right' });
        y += 8;
      }

      // Final total balance
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(239, 68, 68);
      doc.text(`Toplam Bakiye: $${fmtMoney(fin.totalCredit || 0)}`, pageW - margin, y, { align: 'right' });

      const pdfBase64 = doc.output('datauristring').split(',')[1];
      const fileName = `${(factory.name || 'factory').replace(/\s+/g, '_')}_Report_${Date.now()}.pdf`;

      try {
        const savedFile = await Filesystem.writeFile({
          path: fileName,
          data: pdfBase64,
          directory: Directory.Cache
        });
        await Share.share({
          title: 'Factory Report',
          url: savedFile.uri,
          dialogTitle: 'Share Factory Report'
        });
      } catch (shareErr) {
        const blobUrl = URL.createObjectURL(new Blob([doc.output('blob')], { type: 'application/pdf' }));
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
    } catch (e) {
      Logger.error('factory', 'exportPdf', e.message);
      toast.error('Failed to generate PDF: ' + e.message);
    }
  };

  const typeLabels = { in: 'INVOICE', return: 'RETURN', payment: 'PAYMENT', balance_confirm: 'CONFIRMED BALANCE' };
  const handleFactoryCSV = async () => {
    try {
      const chrono = [...timeline].sort((a, b) => a.date - b.date);
      const rows = [['Date', 'Type', 'Number', 'Amount', 'Running Debt']];
      chrono.forEach(t => {
        const dateStr = new Date(t.date).toLocaleString().replace(/,/g, '');
        const type = (typeLabels[t.type] || t.type || '').toUpperCase();
        const number = t.type !== 'balance_confirm' ? (t.number || '') : '';
        const sign = t.type === 'in' ? '+' : (t.type === 'return' || t.type === 'payment') ? '-' : '';
        const amt = sign + (t.amount || 0).toFixed(2);
        const rb = (t.runningDebt || 0).toFixed(2);
        rows.push([dateStr, type, number, amt, rb]);
      });
      exportRowsToExcel(`${(factory.name || 'factory').replace(/\s+/g, '_')}_timeline_${Date.now()}.xlsx`, rows);
      toast.success('Exported factory timeline to Excel');
    } catch (e) {
      Logger.error('factory', 'exportCsv', e.message);
      toast.error('Failed to export Excel: ' + e.message);
    }
  };

  if (!factory) return <div className="loading-screen"><div className="spin" style={{width:30,height:30,border:'3px solid var(--gold)',borderTopColor:'transparent',borderRadius:'50%'}} /></div>;

  return (
    <ErrorBoundary room="factory-detail">
      <div className="page-container fade-in">
        {/* Header */}
        <div className="page-header">
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <button className="btn btn-secondary btn-icon" onClick={() => navigate('/factories')}><ChevronLeft size={18}/></button>
            <div className="page-title">{factory.name}</div>
          </div>
          <div className="page-actions">
            <button className="btn btn-secondary btn-sm" onClick={handleFactoryPDF}><FileText size={13}/> PDF</button>
            <button className="btn btn-secondary btn-sm" onClick={handleFactoryCSV}><Download size={13}/> Export Excel</button>
            <button className="btn btn-secondary btn-sm"><Upload size={13}/> Import</button>
          </div>
        </div>

        {/* Dashboard cards */}
        <div className="grid-5" style={{ marginBottom:16 }}>
          <div className="stat-card"><div className="stat-label">Total Models</div><div className="stat-value">{fin.modelCount||0}</div></div>
          <div className="stat-card"><div className="stat-label">Current Stock Value</div><div className="stat-value text-gold">${(fin.stockCredit||0).toFixed(2)}</div></div>
          <div className="stat-card"><div className="stat-label">Total Debt (Credit)</div><div className="stat-value red">${(fin.totalCredit||0).toFixed(2)}</div></div>
          <div className="stat-card"><div className="stat-label">Net Balance (Owed)</div>
            <div className="stat-value red" style={{fontSize:'1.2rem'}}>${(fin.netCredit||0).toFixed(2)}<div className="text-xs text-muted" style={{fontWeight:400}}>Total Debt - Stock Value</div></div>
          </div>
          <div className="stat-card"><div className="stat-label">Total In / Out</div>
            <div style={{fontSize:'0.9rem'}}><span className="text-green text-bold">+${(fin.totalIn||0).toFixed(2)}</span> / <span className="text-red text-bold">-${(fin.totalOut||0).toFixed(2)}</span></div>
          </div>
        </div>

        {/* Action buttons */}
        <div style={{ display:'flex', gap:10, marginBottom:20, flexWrap:'wrap' }}>
          {!isWatcherDevice() && (
            <>
              <button className="btn btn-danger" style={{flex:1}} onClick={() => setModal('invoice')}><Plus size={15}/> + Invoice</button>
              <button className="btn btn-secondary" style={{flex:1, color:'var(--orange)', borderColor:'rgba(245,158,11,0.4)'}} onClick={() => setModal('return')}><RotateCcw size={15}/> Return</button>
              <button className="btn btn-success" style={{flex:1}} onClick={() => setModal('payment')}><DollarSign size={15}/> + Payment</button>
              <button className="btn btn-info" style={{flex:1}} onClick={() => setModal('confirm')}><CheckCircle size={15}/> Confirm Balance</button>
            </>
          )}
        </div>

        {/* Transaction History */}
        <div className="flex-between" style={{ marginBottom:12 }}>
          <div className="text-gold text-bold">Transaction History</div>
          <div className="filters-bar" style={{margin:0}}>
            {['all','in','return','payment'].map(f => (
              <button key={f} className={`filter-btn ${filter===f?'active':''}`} onClick={()=>setFilter(f)}>
                {f==='all'?'All':f==='in'?'Factory Invoice':f==='return'?'Factory Return':'Payment'}
              </button>
            ))}
          </div>
        </div>

        <div className="timeline">
          {filtered.length === 0 && (
            <div className="empty-state"><Building2 size={36}/><h3>No transactions yet</h3></div>
          )}
          {filtered.map(t => (
            <div key={t.id} className="tl-item" onClick={() => setSelectedInvoice(t)} style={{ 
              cursor: 'pointer',
              background: t.type==='in' ? 'linear-gradient(to right, rgba(239,68,68,0.12), transparent 70%)' :
                          t.type==='return' ? 'linear-gradient(to right, rgba(245,158,11,0.12), transparent 70%)' :
                          t.type==='payment' ? 'linear-gradient(to right, rgba(16,185,129,0.12), transparent 70%)' :
                          t.type==='balance_confirm' ? 'linear-gradient(to right, rgba(59,130,246,0.12), transparent 70%)' : ''
            }}>
              <div className="tl-icon" style={
                t.type==='in' ? { background: 'rgba(239,68,68,0.15)', color: 'var(--red)', borderColor: 'rgba(239,68,68,0.3)' } :
                t.type==='return' ? { background: 'rgba(245,158,11,0.15)', color: 'var(--gold)', borderColor: 'rgba(245,158,11,0.3)' } :
                t.type==='payment' ? { background: 'rgba(16,185,129,0.15)', color: 'var(--green)', borderColor: 'rgba(16,185,129,0.3)' } :
                t.type==='balance_confirm' ? { background: 'rgba(59,130,246,0.15)', color: 'var(--blue)', borderColor: 'rgba(59,130,246,0.3)' } : {}
              }>
                {t.type==='in'?<Plus size={14}/>:t.type==='return'?<RotateCcw size={14}/>:t.type==='balance_confirm'?<CheckCircle size={14}/>:<DollarSign size={14}/>}
              </div>
              <div className="tl-meta">
                <div className="tl-title" style={
                  t.type==='in' ? { color: 'var(--red)' } :
                  t.type==='return' ? { color: 'var(--gold)' } :
                  t.type==='payment' ? { color: 'var(--green)' } :
                  t.type==='balance_confirm' ? { color: 'var(--blue)' } : {}
                }>
                  {t.type==='in'?'INVOICE':t.type==='return'?'RETURN':t.type==='balance_confirm'?'BALANCE CONFIRMED':'PAYMENT'} {t.type!=='balance_confirm' && `#${t.number}`}
                </div>
                <div className="tl-date">{new Date(t.date).toLocaleDateString()} {new Date(t.date).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</div>
                {t.receiverName && <div className="text-xs text-muted">Receiver: {t.receiverName}</div>}
              </div>
              <div className="tl-amount" style={{ textAlign: 'right' }}>
                <span style={{ 
                  display: 'block', fontWeight: 'bold',
                  color: t.type==='in' ? 'var(--red)' : t.type==='return' ? 'var(--gold)' : t.type==='payment' ? 'var(--green)' : t.type==='balance_confirm' ? 'var(--blue)' : ''
                }}>
                  {t.type==='in'?'+':t.type==='return'||t.type==='payment'?'-':''}${(t.amount||0).toFixed(2)}
                </span>
                <span className="text-muted" style={{ display: 'block', fontSize: '0.75rem', marginTop: 4 }}>
                  Debt: ${(t.runningDebt||0).toFixed(2)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Invoice / Return Modal */}
      {(modal==='invoice'||modal==='return') && (
        <div className="modal-overlay" onClick={()=>setModal(null)}>
          <div className="modal-box modal-box-lg" onClick={e=>e.stopPropagation()} style={{ background: modal === 'invoice' ? 'linear-gradient(to right, rgba(239, 68, 68, 0.1) 0%, var(--surface) 60%)' : modal === 'return' ? 'linear-gradient(to right, rgba(245, 158, 11, 0.1) 0%, var(--surface) 60%)' : 'var(--surface)' }}>
            <div className="modal-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {modal==='invoice'?<><Plus size={16}/> Import Invoice</>:<><RotateCcw size={16}/> Return Invoice</>}
                </div>
                <label className="btn btn-secondary" style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8, margin: 0, fontWeight: 500, fontSize: '0.95rem', padding: '6px 14px' }}>
                  <Camera size={18}/> Invoice Photo
                  <input type="file" accept="image/*" capture="environment" hidden onChange={handlePhotoCapture} />
                </label>
              </div>
              {photoPreview && (
                <div style={{ position: 'relative', width: 80, height: 80, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border-gold)', boxShadow: '0 6px 16px rgba(0,0,0,0.4)' }}>
                  <img src={photoPreview} alt="Invoice preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); setInvoicePhoto(null); setPhotoPreview(null); }} style={{ position: 'absolute', top: 4, right: 4, background: 'var(--danger)', color: '#fff', border: 'none', borderRadius: '50%', width: 22, height: 22, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={14}/></button>
                </div>
              )}
            </div>
            <div className="form-row" style={{ width: '50%' }}>
              <div className="form-group"><label className="form-label">Invoice Number</label>
                <input placeholder="Auto-generated" value={form.number} onChange={e=>setForm(p=>({...p,number:e.target.value}))}/></div>
              <div className="form-group"><label className="form-label">Date</label>
                <input type="date" defaultValue={new Date().toISOString().slice(0,10)}/></div>
            </div>
            <div className="form-label" style={{marginBottom:8}}>Items</div>
            <div className="table-wrap" style={{marginBottom:12, overflow: 'visible'}}>
              <table>
                <thead><tr><th>Model Code</th><th>Color</th><th>Qty</th><th>Factory Price</th><th>Total</th><th></th></tr></thead>
                <tbody>
                  {invoiceItems.map((item,i) => {
                    const selColor = item.availableColors?.find(c => c.name === item.colorName);
                    return (
                    <tr key={i} style={{ background: selColor?.hex ? `linear-gradient(to right, ${selColor.hex}33 0%, transparent 70%)` : undefined }}>
                      <td style={{ position: 'relative' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                          <button className="btn btn-secondary btn-icon" style={{ width: '100%', padding: 6, display: 'flex', justifyContent: 'center', alignItems: 'center' }} onClick={() => { setShowScanner(true); setScannerTargetRow(i); }} title="Scan Barcode">
                            <Barcode size={16} />
                          </button>
                          {item.catalogId && getModelThumbnail(item.catalogId) && (
                            <div style={{ width: 50, height: 70, borderRadius: 6, overflow: 'hidden', flexShrink: 0, border: '1px solid var(--border)' }}>
                              <img src={getModelThumbnail(item.catalogId)} style={{width:'100%', height:'100%', objectFit:'cover'}} alt="" />
                            </div>
                          )}
                          <div style={{ width: '100%', position: 'relative' }}>
                            <input 
                              value={item.catalogCode} 
                              style={{padding:'6px 8px',fontSize:'0.82rem', width:'100%'}} 
                              placeholder="Code" 
                              onChange={e=>{
                                const n=[...invoiceItems];
                                n[i]={...n[i],catalogCode:e.target.value};
                                setInvoiceItems(n);
                                setActiveRow(i);
                              }}
                              onFocus={() => setActiveRow(i)}
                            />
                            {activeRow === i && item.catalogCode.length > 0 && (
                              <div style={{ position: 'absolute', top: '100%', left: 0, minWidth: 220, zIndex: 100, background: 'var(--surface2)', border: '1px solid var(--border-gold)', borderRadius: 8, overflow: 'hidden', boxShadow: '0 8px 24px rgba(0,0,0,0.4)', marginTop: 4 }}>
                                {allModels.filter(m => m.factoryId === id && m.code.toLowerCase().startsWith(item.catalogCode.toLowerCase())).slice(0,5).map(m => {
                                  const thumb = getModelThumbnail(m.id);
                                  return (
                                    <div key={m.id} onClick={() => selectModelForInvoice(i, m)}
                                      style={{ padding: '8px 10px', cursor: 'pointer', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}
                                      onMouseEnter={e => e.currentTarget.style.background = 'var(--surface3)'}
                                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                    >
                                      <div style={{ width: 36, height: 36, borderRadius: 6, background: 'var(--surface)', border: '1px solid var(--border)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        {thumb ? <img src={thumb} style={{width:'100%',height:'100%',objectFit:'cover'}} alt="" /> : <span style={{fontSize:'0.6rem',color:'var(--text-muted)'}}>No img</span>}
                                      </div>
                                      <div style={{ fontWeight: 500, flex: 1 }}>{m.code}</div>
                                      <div style={{ fontSize: '0.75rem', color: 'var(--gold)' }}>${m.factoryPrice || 0}</div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td>
                        {item.availableColors?.length > 0 ? (
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            {item.availableColors.map((c, cIdx) => (
                              <button
                                key={cIdx}
                                className="btn btn-secondary btn-sm"
                                style={{ padding: '4px 10px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: 8, width: 100, justifyContent: 'flex-start', overflow: 'hidden', backgroundImage: c.hex ? (item.colorName === c.name ? `linear-gradient(to right, ${c.hex}AA 0%, transparent 80%)` : `linear-gradient(to right, ${c.hex}44 0%, transparent 80%)`) : 'none', border: item.colorName === c.name ? '1px solid var(--gold)' : '1px solid var(--border)', boxShadow: item.colorName === c.name ? '0 0 12px rgba(212,175,55,0.4)' : 'none', transition: 'all 0.2s', color: item.colorName === c.name ? 'var(--gold)' : 'var(--text)' }}
                                onClick={(e) => {
                                  e.preventDefault();
                                  const n=[...invoiceItems];
                                  n[i]={...n[i],colorName:c.name, colorId:c.id};
                                  setInvoiceItems(n);
                                }}
                              >
                                <div style={{ width: 10, height: 10, borderRadius: '50%', background: c.hex || '#ccc' }} />
                                {c.name}
                              </button>
                            ))}
                          </div>
                        ) : (
                          <input value={item.colorName} style={{padding:'6px 8px',fontSize:'0.82rem', width:'100%'}} placeholder="Color" onChange={e=>{const n=[...invoiceItems];n[i]={...n[i],colorName:e.target.value};setInvoiceItems(n);}}/>
                        )}
                      </td>
                      <td>
                        {(modal === 'return' || modal === 'invoice') && item.sizes?.length > 0 ? (
                          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 280 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'center' }}>
                              <button className="btn btn-secondary btn-sm" style={{ padding: '6px 12px', fontSize: '1.2rem', fontWeight: 600, height: 'max-content', background: selColor?.hex ? `${selColor.hex}44` : undefined, color: selColor?.hex || 'var(--text)', border: selColor?.hex ? `1px solid ${selColor.hex}` : undefined }} onClick={() => {
                                const n = [...invoiceItems];
                                const newQtys = { ...(n[i].sizeQtys || {}) };
                                n[i].sizes.forEach(sz => newQtys[sz] = Math.max(0, (parseInt(newQtys[sz]) || 0) - 1));
                                n[i] = { ...n[i], sizeQtys: newQtys };
                                setInvoiceItems(n);
                              }}>-</button>
                              
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center' }}>
                                {item.sizes.map(sz => (
                                  <div key={sz} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', width: 28, textAlign: 'center' }}>{sz}</span>
                                    <input
                                      type="number"
                                      min="0"
                                      placeholder="0"
                                      value={item.sizeQtys?.[sz] || ''}
                                      style={{ padding: '3px 6px', fontSize: '0.8rem', width: 55, textAlign: 'center' }}
                                      onChange={e => {
                                        const n = [...invoiceItems];
                                        n[i] = { ...n[i], sizeQtys: { ...(n[i].sizeQtys || {}), [sz]: e.target.value } };
                                        setInvoiceItems(n);
                                      }}
                                    />
                                  </div>
                                ))}
                              </div>

                              <button className="btn btn-secondary btn-sm" style={{ padding: '6px 12px', fontSize: '1.2rem', fontWeight: 600, height: 'max-content', background: selColor?.hex ? `${selColor.hex}44` : undefined, color: selColor?.hex || 'var(--text)', border: selColor?.hex ? `1px solid ${selColor.hex}` : undefined }} onClick={() => {
                                const n = [...invoiceItems];
                                const newQtys = { ...(n[i].sizeQtys || {}) };
                                n[i].sizes.forEach(sz => newQtys[sz] = (parseInt(newQtys[sz]) || 0) + 1);
                                n[i] = { ...n[i], sizeQtys: newQtys };
                                setInvoiceItems(n);
                              }}>+</button>
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--gold)', marginTop: 10, textAlign: 'center', fontWeight: 600 }}>
                              Total: {Object.values(item.sizeQtys || {}).reduce((a, b) => a + (parseInt(b) || 0), 0)} pcs
                            </div>
                          </div>
                        ) : (
                          <input type="number" value={item.qty} style={{padding:'6px 8px',fontSize:'0.82rem',width:70}} onChange={e=>{const n=[...invoiceItems];n[i]={...n[i],qty:parseInt(e.target.value)||0};setInvoiceItems(n);}}/>
                        )}
                      </td>
                      <td><input type="number" value={item.factoryPrice} style={{padding:'6px 8px',fontSize:'0.82rem',width:90}} onChange={e=>{const n=[...invoiceItems];n[i]={...n[i],factoryPrice:parseFloat(e.target.value)||0};setInvoiceItems(n);}}/></td>
                      <td className="text-gold text-bold">${(() => { const sizeSum = Object.values(item.sizeQtys||{}).reduce((a,b)=>a+(parseInt(b)||0),0); return ((sizeSum>0?sizeSum:item.qty)*item.factoryPrice).toFixed(2); })()}</td>
                      <td><button className="btn btn-danger btn-sm btn-icon" onClick={()=>setInvoiceItems(p=>p.filter((_,j)=>j!==i))}>×</button></td>
                    </tr>
                  ); })}
                </tbody>
              </table>
            </div>
            <button className="btn btn-secondary btn-sm" onClick={()=>setInvoiceItems(p=>[...p,{catalogCode:'',colorName:'',qty:1,factoryPrice:0, catalogId: null, availableColors: []}])}><Plus size={13}/> Add Model</button>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: 12 }}>
              <div style={{flex: 1}}></div>
              <div style={{textAlign:'right'}} className="text-gold text-bold">
                Total: ${invoiceItems.reduce((s, i) => {
                  const sizeSum = Object.values(i.sizeQtys || {}).reduce((a, b) => a + (parseInt(b) || 0), 0);
                  return s + ((sizeSum > 0 ? sizeSum : i.qty) * i.factoryPrice);
                }, 0).toFixed(2)}
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={()=>setModal(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={()=>saveInvoice(modal)} disabled={saving}>{saving?'Saving...':'Save'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {modal==='payment' && (
        <div className="modal-overlay" onClick={()=>setModal(null)}>
          <div className="modal-box" onClick={e=>e.stopPropagation()} style={{ background: 'linear-gradient(to right, rgba(16, 185, 129, 0.1) 0%, var(--surface) 60%)' }}>
            <div className="modal-title"><DollarSign size={16}/> Record Payment</div>
            <div className="form-group"><label className="form-label">Amount ($)</label>
              <input type="number" placeholder="0.00" value={form.amount} onChange={e=>setForm(p=>({...p,amount:e.target.value}))} autoFocus/></div>
            <div className="form-group"><label className="form-label">Receiver Name</label>
              <input placeholder="Name of person who received" value={form.receiver} onChange={e=>setForm(p=>({...p,receiver:e.target.value}))}/></div>
            <div className="form-group"><label className="form-label">Note</label>
              <input placeholder="Optional note" value={form.note} onChange={e=>setForm(p=>({...p,note:e.target.value}))}/></div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={()=>setModal(null)}>Cancel</button>
              <button className="btn btn-success" onClick={()=>saveInvoice('payment')} disabled={saving}>{saving?'Saving...':'Save Payment'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Balance Modal */}
      {modal==='confirm' && (
        <div className="modal-overlay" onClick={()=>setModal(null)}>
          <div className="modal-box" onClick={e=>e.stopPropagation()}>
            <div className="modal-title"><CheckCircle size={16}/> Confirm Balance</div>
            <div style={{marginBottom:16, padding:'16px', background:'rgba(59,130,246,0.08)', borderRadius:8, border:'1px solid rgba(59,130,246,0.25)'}}>
              <div className="text-sec text-sm">Current Total Debt</div>
              <div style={{fontSize:'1.8rem', fontWeight:700, color:'var(--blue)'}}>${(fin.totalCredit||0).toFixed(2)}</div>
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={()=>setModal(null)}>Cancel</button>
              <button className="btn btn-info" onClick={async()=>{
                const bcNumber = `BC-${Date.now()}`;
                const amount = fin.totalCredit || 0;
                await db.factoryInvoices.add({ id:uuidv4(), factoryId:id, type:'balance_confirm', number:bcNumber, date:Date.now(), amount, items:[] });
                
                await db.telegramQueue.add({
                  priority: 2,
                  type: 'text',
                  status: 'pending',
                  createdAt: Date.now(),
                  attemptCount: 0,
                  chatIdKey: 'factoryInvoiceChatId',
                  text: formatFactoryInvoice('balance_confirm', factory, { amount }, [], fin),
                });
                
                toast.success('Balance confirmed'); setModal(null); load();
              }}>Confirm Balance</button>
            </div>
          </div>
        </div>
      )}

      {selectedInvoice && (
        <FactoryInvoiceDetailModal invoice={selectedInvoice} factory={factory} onClose={() => setSelectedInvoice(null)} />
      )}

      {/* Barcode Scanner */}
      {showScanner && (
        <BarcodeScanner
          onScan={(code) => {
            const m = allModels.find(x => x.factoryId === id && x.code.toLowerCase() === code.toLowerCase());
            if (m && scannerTargetRow !== null) {
              selectModelForInvoice(scannerTargetRow, m);
            } else if (scannerTargetRow !== null) {
              const n = [...invoiceItems];
              n[scannerTargetRow] = { ...n[scannerTargetRow], catalogCode: code };
              setInvoiceItems(n);
              setActiveRow(scannerTargetRow);
            }
            setShowScanner(false);
            setScannerTargetRow(null);
          }}
          onClose={() => {
            setShowScanner(false);
            setScannerTargetRow(null);
          }}
        />
      )}
    </ErrorBoundary>
  );
}
