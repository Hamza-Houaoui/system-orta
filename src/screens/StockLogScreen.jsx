import React, { useState, useEffect } from 'react';
import { ClipboardList, RefreshCw, Trash2, Info, Camera, FileText } from 'lucide-react';
import db from '../core/db';
import { toast } from '../components/Toaster';
import { processTelegramQueue } from '../core/telegramPublisher';
import { escapeHtml } from '../toolbox/telegramFormatter';
import InvoiceDetailModal from '../components/InvoiceDetailModal';
import FactoryInvoiceDetailModal from '../components/FactoryInvoiceDetailModal';
import BarcodeScanner from '../components/BarcodeScanner';

const TYPE_COLORS = {
  factory_in: 'badge-green', 
  factory_return: 'badge-red',
  sale: 'badge-red', 
  customer_return: 'badge-green',
  manual: 'badge-orange', 
  deposit: 'badge-red', 
  deposit_cancel: 'badge-gray',
};

export default function StockLogScreen() {
  const [logs, setLogs] = useState([]);
  const [filter, setFilter] = useState('all');
  const [modelQ, setModelQ] = useState('');
  const [selectedColor, setSelectedColor] = useState('');
  const [dbColors, setDbColors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showScanner, setShowScanner] = useState(false);
  
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [selectedFactoryInvoice, setSelectedFactoryInvoice] = useState(null);
  const [selectedManualLog, setSelectedManualLog] = useState(null);

  const FILTERS = [
    { label: 'All', value: 'all' },
    { label: 'Factory In', value: 'factory_in' },
    { label: 'Factory Return', value: 'factory_return' },
    { label: 'Sale', value: 'sale' },
    { label: 'Deposit', value: 'deposit' },
    { label: 'Customer Return', value: 'customer_return' },
    { label: 'Manual', value: 'manual' },
    { label: 'Deposit Cancelled', value: 'deposit_cancel' }
  ];

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    const all = await db.stockLog.orderBy('date').reverse().limit(500).toArray();
    setLogs(all);
    const clrs = await db.colors.toArray();
    setDbColors(clrs);
    setLoading(false);
  };

  const clearLog = async () => {
    if (!confirm('Clear all stock log entries?')) return;
    await db.stockLog.clear();
    setLogs([]);
  };

  const handleLogReport = async () => {
    if (logs.length === 0) {
      toast.error('No stock log entries to report');
      return;
    }
    const typeLabel = (t) => ({
      factory_in: '🟢 Factory In',
      factory_return: '🔴 Factory Return',
      sale: '🔴 Sale',
      customer_return: '🟢 Customer Return',
      manual: '🟠 Manual',
      deposit: '🔴 Deposit',
      deposit_cancel: '⚪ Deposit Cancel',
    }[t] || (t || '').toUpperCase());

    const inTypes = ['factory_in', 'customer_return', 'deposit_cancel'];
    const outTypes = ['sale', 'factory_return', 'deposit'];
    const totalIn = logs.filter(l => inTypes.includes(l.type)).reduce((s, l) => s + (l.change||0), 0);
    const totalOut = logs.filter(l => outTypes.includes(l.type)).reduce((s, l) => s + Math.abs(l.change||0), 0);

    const now = new Date();
    const dateStr = now.toLocaleDateString('en-GB');
    const timeStr = now.toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });

    let header = `📦 <b>STOCK LOG REPORT</b>\n📅 ${dateStr} 🕓 ${timeStr}\n━━━━━━━━━━━━━━━━━━━━━\n`;
    header += `🧮 Movements: <b>${logs.length}</b>\n`;
    header += `➕ Stock In: <b>+${totalIn}</b>  |  ➖ Stock Out: <b>-${totalOut}</b>\n`;
    header += `━━━━━━━━━━━━━━━━━━━━━\n🕓 Log:\n`;

    const lines = logs
      .slice()
      .sort((a,b) => b.date - a.date)
      .map(l => {
        const d = new Date(l.date);
        const ds = `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`;
        const tm = `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
        const code = escapeHtml(l.catalogCode || '');
        const color = l.colorName ? `/${escapeHtml(l.colorName)}` : '';
        const ref = l.ref ? ` (${escapeHtml(l.ref)})` : '';
        const chg = (l.change||0) > 0 ? `+${l.change}` : l.change;
        return `${typeLabel(l.type)} ${ds} ${tm} ${code}${color}${ref} <b>${chg}</b> (bal ${l.balance || 0})`;
      });

    const maxChunkLen = 3700;
    const rawLines = (header + lines.join('\n') + '\n━━━━━━━━━━━━━━━━━━━━━\n🐝 System Orta').split('\n');
    const chunks = [];
    let cur = '';
    for (const line of rawLines) {
      const candidate = cur ? cur + '\n' + line : line;
      if (candidate.length > maxChunkLen && cur) {
        chunks.push(cur);
        cur = line;
      } else {
        cur = candidate;
      }
    }
    if (cur) chunks.push(cur);

    const ts = Date.now();
    for (let i = 0; i < chunks.length; i++) {
      let text = chunks[i];
      if (chunks.length > 1 && i > 0) {
        text = `📦 <b>STOCK LOG REPORT</b>  (${i+1}/${chunks.length})\n━━━━━━━━━━━━━━━━━━━━━\n` + text;
      }
      await db.telegramQueue.add({
        priority: 2,
        type: 'text',
        status: 'pending',
        createdAt: Date.now(),
        attemptCount: 0,
        chatIdKey: 'liveStockChatId',
        text,
        refId: `stocklog_report_${ts}_${i}`,
      });
    }
    setTimeout(() => processTelegramQueue().catch(() => {}), 100);
    toast.success(`STOCK LOG report sent (${chunks.length} message${chunks.length > 1 ? 's' : ''})`);
  };

  const handleLogClick = async (log) => {
    if (['sale', 'customer_return', 'deposit', 'deposit_cancel'].includes(log.type)) {
      const order = await db.orders.where('number').equals(log.ref).first();
      if (order) {
        setSelectedOrder(order);
      } else {
        toast.error('Invoice not found');
      }
    } else if (['factory_in', 'factory_return'].includes(log.type)) {
      const invoice = await db.factoryInvoices.where('number').equals(log.ref).first();
      if (invoice) {
        const factory = await db.factories.get(invoice.factoryId);
        setSelectedFactoryInvoice({ invoice, factory });
      } else {
        toast.error('Factory invoice not found');
      }
    } else if (log.type === 'manual') {
      setSelectedManualLog(log);
    }
  };

  const availableColors = [...new Set(
    logs.filter(l => modelQ && l.catalogCode?.toLowerCase().includes(modelQ.toLowerCase()))
        .map(l => l.colorName)
        .filter(Boolean)
  )];

  const filtered = logs.filter(l => {
    if (filter !== 'all' && l.type !== filter) return false;
    if (modelQ && !l.catalogCode?.toLowerCase().includes(modelQ.toLowerCase())) return false;
    if (selectedColor && l.colorName !== selectedColor) return false;
    return true;
  });

  const totalIn  = filtered.filter(l => ['factory_in','customer_return','deposit_cancel'].includes(l.type)).reduce((s,l) => s + (l.change||0), 0);
  const totalOut = filtered.filter(l => ['sale','factory_return','deposit'].includes(l.type)).reduce((s,l) => s + Math.abs(l.change||0), 0);

  return (
    <>
    <div className="page-container fade-in">
      <div className="page-header">
        <div className="page-title"><ClipboardList size={22}/> STOCK MOVEMENT LOG</div>
        <div className="page-actions">
          <button className="btn btn-secondary btn-sm" onClick={handleLogReport}><FileText size={13}/> RAPORT</button>
          <button className="btn btn-secondary btn-sm" onClick={load}><RefreshCw size={13}/> Refresh</button>
          <button className="btn btn-danger btn-sm" onClick={clearLog}><Trash2 size={13}/> Clear Log</button>
        </div>
      </div>

      <div className="grid-3" style={{ marginBottom:16 }}>
        <div className="stat-card"><div className="stat-label">Total Movements</div><div className="stat-value">{filtered.length}</div></div>
        <div className="stat-card"><div className="stat-label">+ Stock In</div><div className="stat-value green">+{totalIn}</div></div>
        <div className="stat-card"><div className="stat-label">- Stock Out</div><div className="stat-value red">-{totalOut}</div></div>
      </div>

      <div className="filters-bar">
        {FILTERS.map(f => (
          <button key={f.value} className={`filter-btn ${filter === f.value ? 'active':''}`}
            onClick={() => setFilter(f.value)}>{f.label}</button>
        ))}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input placeholder="Model Code..." value={modelQ} onChange={e=>{setModelQ(e.target.value); setSelectedColor('');}}
            style={{ width:140, padding:'5px 10px', fontSize:'0.8rem', background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)' }} />
          <button className="btn btn-secondary btn-icon" onClick={() => setShowScanner(true)} title="Scan Barcode">
            <Camera size={18} />
          </button>
        </div>
        {modelQ && availableColors.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <button className={`btn ${selectedColor === '' ? 'btn-primary' : 'btn-secondary'} btn-sm`} onClick={() => setSelectedColor('')}>
              All Colors
            </button>
            {availableColors.map(c => (
              <button key={c} className={`btn ${selectedColor === c ? 'btn-primary' : 'btn-secondary'} btn-sm`} 
                onClick={() => setSelectedColor(c)} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: dbColors.find(col => col.name === c)?.hex || '#ccc' }} />
                {c}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Date</th><th>Type</th><th>Reference</th><th>Model / Color</th><th>Change</th><th>Total</th><th>Balance</th></tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} style={{ textAlign:'center',padding:40,color:'var(--text-muted)' }}>Loading...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} style={{ textAlign:'center',padding:40,color:'var(--text-muted)' }}>No log entries</td></tr>
            ) : filtered.map(l => {
              const hex = dbColors.find(col => 
                col.name?.toLowerCase() === l.colorName?.toLowerCase() || 
                col.code?.toLowerCase() === l.colorName?.toLowerCase()
              )?.hex;
              const bg = hex ? `linear-gradient(to right, ${hex}25, transparent 60%)` : 'transparent';
              return (
              <tr key={l.id} style={{ background: bg, cursor: 'pointer' }} onClick={() => handleLogClick(l)}>
                <td className="text-muted text-xs">{new Date(l.date).toLocaleDateString()}<br/>{new Date(l.date).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</td>
                <td><span className={`badge ${TYPE_COLORS[l.type]||'badge-gray'}`} style={{ display: 'inline-block', width: 130, textAlign: 'center' }}>{l.type?.replace(/_/g,' ').toUpperCase()}</span></td>
                <td className="text-gold text-sm">{l.ref}</td>
                <td>
                  <div className="text-bold">{l.catalogCode}</div>
                  <div className="text-muted text-xs" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {hex && <div style={{ width: 8, height: 8, borderRadius: '50%', background: hex }} />}
                    {l.colorName}
                  </div>
                </td>
                <td>
                  {l.sizesChanged && Object.entries(l.sizesChanged).map(([s,q]) => (
                    <div key={s} className="text-xs" style={{ color: q>0?'var(--green)':'var(--red)' }}>
                      Sz {s}: {q>0?'+'+q:q}
                    </div>
                  ))}
                </td>
                <td className={l.change > 0 ? 'green':'red'}>{l.change > 0 ? '+'+l.change : l.change}</td>
                <td className="text-bold">{l.balance}</td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>

    {selectedOrder && (
      <InvoiceDetailModal order={selectedOrder} onClose={() => setSelectedOrder(null)} />
    )}

    {selectedFactoryInvoice && (
      <FactoryInvoiceDetailModal 
        invoice={selectedFactoryInvoice.invoice} 
        factory={selectedFactoryInvoice.factory} 
        onClose={() => setSelectedFactoryInvoice(null)} 
      />
    )}

    {selectedManualLog && (
      <div className="modal-overlay" onClick={() => setSelectedManualLog(null)}>
        <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
          <div className="modal-title"><Info size={16}/> Manual Adjustment Details</div>
          <div style={{ marginBottom: 16 }}>
            <p className="text-sm text-muted">A manual stock adjustment was made on:</p>
            <div style={{ fontSize: '1.1rem', margin: '10px 0' }}>
              {new Date(selectedManualLog.date).toLocaleDateString()} at {new Date(selectedManualLog.date).toLocaleTimeString()}
            </div>
            <div style={{ padding: 12, background: 'var(--surface)', borderRadius: 8, border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span className="text-muted">Model:</span>
                <span className="text-bold text-gold">{selectedManualLog.catalogCode}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span className="text-muted">Color:</span>
                <span className="text-bold">{selectedManualLog.colorName}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span className="text-muted">Net Change:</span>
                <span className={selectedManualLog.change > 0 ? 'green' : 'red'}>
                  {selectedManualLog.change > 0 ? '+' : ''}{selectedManualLog.change}
                </span>
              </div>
            </div>
          </div>
          <div className="modal-actions">
            <button className="btn btn-secondary" onClick={() => setSelectedManualLog(null)}>Close</button>
          </div>
        </div>
      </div>
    )}

    {/* Barcode Scanner */}
    {showScanner && (
      <BarcodeScanner
        onScan={(code) => {
          setShowScanner(false);
          setModelQ(code);
          setSelectedColor('');
        }}
        onClose={() => setShowScanner(false)}
      />
    )}
    </>
  );
}
