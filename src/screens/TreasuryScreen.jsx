import { isWatcherDevice } from '../core/deviceSync';
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Wallet, Plus, Download, TrendingUp, TrendingDown, Check, Upload, X, FileText } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import db from '../core/db';
import { Logger } from '../core/logger';
import { toast } from '../components/Toaster';
import ErrorBoundary from '../components/ErrorBoundary';
import { exportRowsToExcel } from '../core/exportExcel';
import { getSettings } from '../core/store';
import { formatTreasuryReport, formatPaymentMessage , formatCasaTransaction, escapeHtml } from '../toolbox/telegramFormatter';
import { processTelegramQueue } from '../core/telegramPublisher';
import InvoiceDetailModal from '../components/InvoiceDetailModal';
import TransactionDetailModal from '../components/TransactionDetailModal';
import { EventBus, EVENTS } from '../toolbox/eventBus';

const INCOME_CATS = ['Sales Revenue', 'Deposit', 'Refund', 'Other Income'];
const PERIODS = ['Today', 'Week', 'Month', 'Year', 'All', 'Custom'];

// Transaction type → color for the Casa timeline
const TYPE_COLORS = {
  'Debt Payment': '#3b82f6',      // blue
  'Factory Payment': '#60a5fa',   // light blue
  'Sale': '#22c55e',              // green
  'Order': '#22c55e',             // green
  'Deposit': '#d4af37',           // gold
  'Commission Paid': '#f97316',   // orange
  'Commission Received': '#86efac', // light green
  'Customer Return': '#ef4444',   // red
};

function typeColor(cat) {
  if (!cat) return 'var(--text-muted)';
  const found = Object.keys(TYPE_COLORS).find(k => k.toLowerCase() === cat.toLowerCase());
  return found ? TYPE_COLORS[found] : 'var(--text-muted)';
}

// Parse a transaction description into colored segments for the timeline.
// Description format: "<TYPE> - <customer/factory> - <number/note>"
function parseTimelineDesc(t) {
  const cat = t.category || '';
  const desc = t.description || '';
  const parts = desc.split(/\s+[-—]\s+/).map(s => s.trim()).filter(Boolean);
  const first = typeColor(cat);

  const norm = cat.toLowerCase();
  if (norm === 'debt payment') {
    // "Debt payment" | customer(green) | note(gold)
    return parts.map((p, i) => ({ text: p, color: i === 0 ? first : i === 1 ? 'var(--green)' : 'var(--gold)' }));
  }
  if (norm === 'factory payment') {
    // "Factory Payment" | factory(blue) | #number(gold)
    return parts.map((p, i) => ({ text: p, color: i === 0 ? first : i === 1 ? 'var(--blue)' : 'var(--gold)' }));
  }
  if (['sale', 'deposit', 'commission paid', 'commission received', 'customer return', 'order', 'balance payment', 'return refund', 'balance confirm'].includes(norm)) {
    // "X" | customer(green) | number(gold)
    return parts.map((p, i) => ({ text: p, color: i === 0 ? first : i === 1 ? 'var(--green)' : 'var(--gold)' }));
  }
  return [{ text: desc || cat || 'Transaction', color: first }];
}

const FormatPrice = ({ amount, prefix = '$' }) => {
  const parts = Math.abs(amount).toFixed(2).split('.');
  const sign = amount < 0 ? '-' : prefix.includes('+') && amount > 0 ? '+' : '';
  const pfx = prefix.replace('+', '');
  return <>{sign}{pfx}{parts[0]}<span style={{ fontSize: '0.65em', opacity: 0.8 }}>.{parts[1]}</span></>;
};

const getPeriodRange = (period, customFrom, customTo) => {
  const now = Date.now();
  const d = new Date();
  switch (period) {
    case 'Custom': return { 
      from: customFrom ? new Date(customFrom).getTime() : 0, 
      to: customTo ? new Date(customTo).getTime() : now 
    };
    case 'Today': d.setHours(0,0,0,0); return { from: d.getTime(), to: now };
    case 'Week': d.setDate(d.getDate() - 7); return { from: d.getTime(), to: now };
    case 'Month': d.setMonth(d.getMonth() - 1); return { from: d.getTime(), to: now };
    case 'Year': d.setFullYear(d.getFullYear() - 1); return { from: d.getTime(), to: now };
    default: return { from: 0, to: now };
  }
};

export default function TreasuryScreen() {
  const [transactions, setTransactions] = useState([]);
  const [period, setPeriod] = useState('Today');
  const [stats, setStats] = useState({ totalIn: 0, totalOut: 0, balance: 0, startBudget: 0 });
  const [q, setQ] = useState('');
  const [modal, setModal] = useState(null); // 'in' | 'out' | 'confirm'
  const [form, setForm] = useState({ amount: '', category: '', description: '', photoBlob: null });
  const [photoPreview, setPhotoPreview] = useState(null);
  const [saving, setSaving] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [loading, setLoading] = useState(true);

  const INCOME_CATS = ['Sale', 'Deposit', 'Manual', 'Commission Received', 'Refund Received'];
  const EXPENSE_CATS = ['Commission Paid', 'Factory Payment', 'Manual', 'Refund Issued', 'Expense'];

  const handleExport = () => {
    const rows = [['Date', 'Type', 'Category', 'Description', 'Amount', 'Running Balance']];
    transactions.forEach(t => {
      const dateStr = new Date(t.date).toLocaleString().replace(/,/g, '');
      const type = (t.type || '').toUpperCase();
      const cat = t.category || '';
      const desc = t.description || '';
      const amt = (t.amount || 0).toFixed(2);
      const rb = (t.runningBalance || 0).toFixed(2);
      rows.push([dateStr, type, cat, desc, amt, rb]);
    });
    exportRowsToExcel(`casa_timeline_${Date.now()}.xlsx`, rows);
    toast.success('Exported Casa timeline to Excel');
  };

  const handleCasaReport = async () => {
    if (transactions.length === 0) {
      toast.error('No Casa transactions to report');
      return;
    }
    const allTx = transactions;
    const startBudget = Number(stats.startBudget) || 0;
    const balance = Number(stats.balance) || 0;

    const periodStats = {};
    for (const [label, rng] of [
      ['Today', getPeriodRange('Today')],
      ['Week', getPeriodRange('Week')],
      ['Month', getPeriodRange('Month')],
      ['Year', getPeriodRange('Year')],
    ]) {
      const tx = allTx.filter(t => t.date >= rng.from && t.date <= rng.to && t.type !== 'balance_confirm');
      const tin = tx.filter(t => t.type === 'in').reduce((s,t) => s + (t.amount||0), 0);
      const tout = tx.filter(t => t.type === 'out').reduce((s,t) => s + (t.amount||0), 0);
      periodStats[label] = { in: tin, out: tout, net: tin - tout };
    }

    const now = new Date();
    const dateStr = now.toLocaleDateString('en-GB');
    const timeStr = now.toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });

    let header = `🏦 <b>CASA REPORT</b>\n📅 ${dateStr} 🕓 ${timeStr}\n━━━━━━━━━━━━━━━━━━━━━\n`;
    header += `💵 Start Budget: $${startBudget.toFixed(2)}\n`;
    header += `💰 <b>Balance: $${balance.toFixed(2)}</b>\n`;
    header += `━━━━━━━━━━━━━━━━━━━━━\n`;
    for (const [label, s] of Object.entries(periodStats)) {
      header += `📊 ${label}:  IN <b>+$${s.in.toFixed(2)}</b>  OUT <b>-$${s.out.toFixed(2)}</b>  Net <b>${s.net>=0?'+':''}$${s.net.toFixed(2)}</b>\n`;
    }
    header += `━━━━━━━━━━━━━━━━━━━━━\n🕓 Recent:\n`;

    const recents = allTx
      .filter(t => t.type !== 'balance_confirm')
      .slice()
      .sort((a,b) => b.date - a.date)
      .map(t => {
        const d = new Date(t.date);
        const ds = `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`;
        const sign = t.type === 'in' ? '+' : '-';
        const cat = escapeHtml(t.category || '');
        const desc = t.description ? ` — ${escapeHtml(t.description)}` : '';
        return `${t.type==='in'?'🟢':'🔴'} ${ds} ${cat}${desc} <b>${sign}$${Number(t.amount||0).toFixed(2)}</b> (CASA $${Number(t.runningBalance||0).toFixed(2)})`;
      }).join('\n');

    const footer = `\n━━━━━━━━━━━━━━━━━━━━━\n🐝 System Orta`;

    const rawLines = (header + recents + footer).split('\n');
    const chunks = [];
    let cur = '';
    for (const line of rawLines) {
      const candidate = cur ? cur + '\n' + line : line;
      if (candidate.length > 3700 && cur) {
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
        text = `📊 <b>CASA REPORT</b>  (${i+1}/${chunks.length})\n━━━━━━━━━━━━━━━━━━━━━\n` + text;
      }
      await db.telegramQueue.add({
        priority: 2,
        type: 'text',
        status: 'pending',
        createdAt: Date.now(),
        attemptCount: 0,
        chatIdKey: 'casaChatId',
        text,
        refId: `casa_report_${ts}_${i}`,
      });
    }
    setTimeout(() => processTelegramQueue().catch(() => {}), 100);
    toast.success(`CASA report sent (${chunks.length} message${chunks.length > 1 ? 's' : ''})`);
  };

  useEffect(() => { load(); }, [period, dateFrom, dateTo]);

  useEffect(() => {
    const off = EventBus.on(EVENTS.TREASURY_CHANGED, () => load());
    return off;
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const { from, to } = getPeriodRange(period, dateFrom, dateTo);
      const all = await db.transactions.orderBy('date').reverse().toArray();
      const periodTx = all.filter(t => t.date >= from && t.date <= to && t.type !== 'balance_confirm');
      const totalIn  = periodTx.filter(t => t.type === 'in').reduce((s, t) => s + (t.amount || 0), 0);
      const totalOut = periodTx.filter(t => t.type === 'out').reduce((s, t) => s + (t.amount || 0), 0);
      const settings = getSettings();
      const startBudget = parseFloat(settings.startBudget) || 0;
      const allIn  = all.filter(t => t.type === 'in').reduce((s, t) => s + (t.amount || 0), 0);
      const allOut = all.filter(t => t.type === 'out').reduce((s, t) => s + (t.amount || 0), 0);
      const balance = startBudget + allIn - allOut;
      setStats({ totalIn, totalOut, balance, startBudget });
      
      let currentBalance = balance;
      const allWithRunningBalance = all.map(t => {
        const balanceAtTime = currentBalance;
        if (t.type === 'in') currentBalance -= (t.amount || 0);
        else if (t.type === 'out') currentBalance += (t.amount || 0);
        return { ...t, runningBalance: balanceAtTime };
      });
      
      // Show all for list, filtered by q
      setTransactions(allWithRunningBalance);
      Logger.info('treasury', 'loadTransactions', `Loaded ${allWithRunningBalance.length} transactions`);
    } catch (e) {
      Logger.error('treasury', 'loadTransactions', e.message);
    }
    setLoading(false);
  };

  const addTransaction = async (type) => {
    if (!form.amount || parseFloat(form.amount) <= 0) { toast.error('Enter a valid amount'); return; }
    setSaving(true);
    try {
      const tx = {
        id: uuidv4(),
        date: Date.now(),
        type: type === 'in' ? 'in' : 'out',
        amount: parseFloat(form.amount),
        category: form.category || (type === 'in' ? 'Manual' : 'Manual'),
        description: form.description || (type === 'in' ? 'Manual Income' : 'Manual Expense'),
        photoBlob: form.photoBlob || null
      };
      await db.transactions.add(tx);
      Logger.info('treasury', 'addTransaction', `${type} transaction added`, { amount: form.amount });

      // ── Send to Casa Channel on Telegram ───────────────────────────
      try {
        const allTxForCasa = await db.transactions.orderBy('date').toArray();
        const _startBudget = parseFloat(getSettings().startBudget) || 0;
          const _allIn  = allTxForCasa.filter(t => t.type === 'in').reduce((s,t) => s + (t.amount||0), 0);
          const _allOut = allTxForCasa.filter(t => t.type === 'out').reduce((s,t) => s + (t.amount||0), 0);
          const casaBalanceBefore = _startBudget + _allIn - _allOut;
        const todayStart = new Date(); todayStart.setHours(0,0,0,0);
        const todayTx = allTxForCasa.filter(t => t.date >= todayStart.getTime());
        const casaTodayIn = todayTx.filter(t => t.type === 'in').reduce((s,t) => s + t.amount, 0);
        const casaTodayOut = todayTx.filter(t => t.type === 'out').reduce((s,t) => s + t.amount, 0);
        const amt = parseFloat(form.amount) || 0;
        // allTxForCasa already includes the new transaction, so casaBalanceBefore is actually the NEW balance
        const currentBalance = casaBalanceBefore;
        const previousBalance = type === 'in' ? currentBalance - amt : currentBalance + amt;
        
        await db.telegramQueue.add({
          priority: 2,
          type: 'text',
          status: 'pending',
          createdAt: Date.now(),
          attemptCount: 0,
          chatIdKey: 'casaChatId',
          text: formatCasaTransaction({
            type,
            amount: amt,
            category: type === 'in' ? 'Manual IN' : 'Manual OUT',
            customerName: form.description || null,
            balanceBefore: previousBalance,
            balance: currentBalance,
            todayIn: casaTodayIn,
            todayOut: casaTodayOut,
          }),
        });
        Logger.debug('treasury', 'addTransaction', `Queued ${type} ${form.amount} to casaChatId`);
      } catch(tgErr) {
        Logger.warn('treasury', 'addTransaction', `Failed to queue Telegram casa: ${tgErr.message}`);
      }

      toast.success(`${type === 'in' ? 'Income' : 'Expense'} of $${parseFloat(form.amount).toFixed(2)} added`);
      setModal(null);
      setForm({ amount: '', category: '', description: '', photoBlob: null });
      setPhotoPreview(null);
      load();
    } catch (e) {
      Logger.error('treasury', 'addTransaction', e.message);
      toast.error(e.message);
    }
    setSaving(false);
  };

  const confirmBalance = async () => {
    try {
      await db.transactions.add({
        id: uuidv4(), date: Date.now(), type: 'balance_confirm',
        amount: stats.balance, category: 'Balance Confirm',
        description: `Balance confirmed: $${stats.balance.toFixed(2)}`,
      });

      // ── Send to Casa Channel on Telegram ───────────────────────────
      try {
        const tgText = formatTreasuryReport(stats);
        await db.telegramQueue.add({
          priority: 2,
          type: 'text',
          status: 'pending',
          createdAt: Date.now(),
          attemptCount: 0,
          chatIdKey: 'casaChatId',
          text: tgText,
        });
        Logger.debug('treasury', 'confirmBalance', 'Queued balance confirmation to casaChatId');
      } catch(tgErr) {
        Logger.warn('treasury', 'confirmBalance', `Failed to queue Telegram casa: ${tgErr.message}`);
      }

      toast.success(`Balance confirmed: $${stats.balance.toFixed(2)}`);
      setModal(null);
      load();
    } catch (e) { toast.error(e.message); }
  };

  const handleTransactionClick = async (t) => {
    if (t.type === 'balance_confirm') return;
    if (t.orderId) {
      try {
        const order = await db.orders.get(t.orderId);
        if (order) {
          setSelectedOrder(order);
          return;
        }
      } catch (e) { console.error(e); }
    }
    setSelectedTransaction(t);
  };

  const handlePhotoCapture = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setForm(p => ({ ...p, photoBlob: file }));
      setPhotoPreview(URL.createObjectURL(file));
    }
  };

  const filtered = transactions.filter(t => {
    if (!q) return true;
    const lower = q.toLowerCase();
    return t.description?.toLowerCase().includes(lower) || t.category?.toLowerCase().includes(lower);
  });

  const formatDate = (ts) => new Date(ts).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

  return (
    <ErrorBoundary room="treasury">
      <div className="page-container fade-in">
        <div className="page-header">
          <div className="page-title"><Wallet size={22} /> CASA</div>
          <div className="page-actions">
            <button className="btn btn-secondary btn-sm" onClick={handleCasaReport}><FileText size={13}/> RAPORT</button>
            <button className="btn btn-secondary btn-sm" onClick={handleExport}><Download size={13}/> Export Excel</button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid-2" style={{ marginBottom: 16 }}>
          <div className="stat-card" style={{ border: '3px solid var(--gold)', background: 'linear-gradient(to right, rgba(16, 185, 129, 0.15), transparent 80%)', display: 'flex', flexDirection: 'column' }}>
            <div className="stat-label">CASA</div>
            <div className="stat-value" style={{ fontSize: '2rem', flex: 1 }}>
              <FormatPrice amount={stats.balance} />
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              {!isWatcherDevice() && <button className="btn btn-success" style={{ flex: 1, padding: '8px 0', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6, fontSize: '0.9rem' }} onClick={() => { setForm({amount:'',category:'',description:''}); setModal('in'); }}><TrendingUp size={16}/> + IN CASA</button>}
              {!isWatcherDevice() && <button className="btn btn-danger" style={{ flex: 1, padding: '8px 0', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6, fontSize: '0.9rem' }} onClick={() => { setForm({amount:'',category:'',description:''}); setModal('out'); }}><TrendingDown size={16}/> - OUT CASA</button>}
            </div>
          </div>
          <div className="stat-card" style={{ display: 'flex', flexDirection: 'column' }}>
            <div className="stat-label">Net ({period})</div>
            <div className="stat-value text-blue" style={{ flex: 1 }}>
              <FormatPrice amount={stats.totalIn - stats.totalOut} />
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button className="btn btn-info" style={{ width: '50%', padding: '8px 0', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6, fontSize: '0.9rem' }} onClick={() => setModal('confirm')}>
                <Check size={16}/> Confirm Casa
              </button>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Total In ({period})</div>
            <div className="stat-value green">
              <FormatPrice amount={stats.totalIn} prefix="+$" />
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Total Out ({period})</div>
            <div className="stat-value red">
              <FormatPrice amount={-stats.totalOut} />
            </div>
          </div>
        </div>

        {/* Period selector + Search */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 14, alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="filters-bar" style={{ margin: 0 }}>
            {PERIODS.map(p => (
              <button key={p} className={`filter-btn ${period === p ? 'active' : ''}`} onClick={() => setPeriod(p)}>{p}</button>
            ))}
          </div>
          {period === 'Custom' && (
            <>
              <input type="datetime-local" className="search-input" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPeriod('Custom'); }} />
              <input type="datetime-local" className="search-input" value={dateTo} onChange={e => { setDateTo(e.target.value); setPeriod('Custom'); }} />
            </>
          )}
          <input
            placeholder="Search transactions..."
            value={q} onChange={e => setQ(e.target.value)}
            style={{ flex: 1, minWidth: 200, padding: '7px 14px' }}
          />
        </div>

        {/* Timeline */}
        <div className="timeline">
          {loading ? (
            <div className="empty-state"><div className="spin" style={{ width: 28, height: 28, border: '3px solid var(--gold)', borderTopColor: 'transparent', borderRadius: '50%' }} /></div>
          ) : filtered.length === 0 ? (
            <div className="empty-state"><Wallet size={48}/><h3>No transactions yet</h3></div>
          ) : filtered.map(t => (
            t.type === 'balance_confirm' ? (
              <div key={t.id} className="tl-confirm-row">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Check size={15} color="var(--blue)" />
                  <span className="text-bold" style={{ color: 'var(--blue)' }}>BALANCE CONFIRMED</span>
                  <span className="text-muted text-xs">{formatDate(t.date)}</span>
                </div>
                <span style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--blue)' }}>
                  <FormatPrice amount={t.amount || 0} />
                </span>
              </div>
            ) : (
              <div key={t.id} className="tl-item" onClick={() => handleTransactionClick(t)} style={{ cursor: 'pointer' }}>
                <div className={`tl-icon ${t.type === 'in' ? 'tl-in' : 'tl-out'}`}>
                  {t.type === 'in' ? <TrendingUp size={14}/> : <TrendingDown size={14}/>}
                </div>
                <div className="tl-meta">
                  <div className="tl-title" style={{ display: 'flex', flexWrap: 'wrap', gap: '0 6px', alignItems: 'center' }}>
                    {parseTimelineDesc(t).map((s, i) => (
                      <span key={i} style={{ color: s.color }}>{s.text}</span>
                    ))}
                  </div>
                  <div className="tl-date">
                    {t.category && <span className="badge" style={{ marginRight: 6, background: 'rgba(0,0,0,0.08)', color: typeColor(t.category) }}>{t.category}</span>}
                    {formatDate(t.date)}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className={`tl-amount ${t.type === 'in' ? 'text-green' : 'text-red'}`}>
                    <FormatPrice amount={t.amount || 0} prefix={t.type === 'in' ? '+$' : '-$'} />
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>
                    CASA: <FormatPrice amount={t.runningBalance} />
                  </div>
                </div>
              </div>
            )
          ))}
        </div>
      </div>

      {/* Income Modal */}
      {(modal === 'in' || modal === 'out') && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="modal-title">
              {modal === 'in' ? <><TrendingUp size={16} color="var(--green)"/> Manual Income</> : <><TrendingDown size={16} color="var(--red)"/> Manual Expense</>}
            </div>
            <div className="form-group">
              <label className="form-label">Amount ($) *</label>
              <input type="number" placeholder="0.00" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} autoFocus />
            </div>
            <div className="form-group">
              <label className="form-label">Category</label>
              <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))}>
                <option value="">Select category...</option>
                {(modal === 'in' ? INCOME_CATS : EXPENSE_CATS).map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Description</label>
              <input placeholder="What is this for?" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
            </div>
            <div className="form-group" style={{ marginTop: 12 }}>
              <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <TrendingUp size={14}/> Attach Receipt Photo
                <input type="file" accept="image/*" capture="environment" hidden onChange={handlePhotoCapture} />
              </label>
              {photoPreview && (
                <div style={{ position: 'relative', marginTop: 8, width: 80, height: 80, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border-gold)' }}>
                  <img src={photoPreview} alt="Receipt preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  <button onClick={() => { setForm(p => ({...p, photoBlob: null})); setPhotoPreview(null); }} style={{ position: 'absolute', top: 2, right: 2, background: 'var(--danger)', color: '#fff', border: 'none', borderRadius: '50%', width: 20, height: 20, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={12}/></button>
                </div>
              )}
            </div>
            <div className="modal-actions" style={{ marginTop: 24 }}>
              <button className="btn btn-secondary" onClick={() => { setModal(null); setForm({ amount: '', category: '', description: '', photoBlob: null }); setPhotoPreview(null); }}>Cancel</button>
              <button className={`btn ${modal === 'in' ? 'btn-success' : 'btn-danger'}`} onClick={() => addTransaction(modal)} disabled={saving}>
                {saving ? 'Saving...' : modal === 'in' ? 'Add Income' : 'Add Expense'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Balance Modal */}
      {modal === 'confirm' && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="modal-title"><Check size={16}/> Confirm Current Balance</div>
            <div style={{ padding: '20px', textAlign: 'center', background: 'rgba(59,130,246,0.08)', borderRadius: 10, border: '1px solid rgba(59,130,246,0.25)', marginBottom: 16 }}>
              <div className="text-muted text-sm">Current Balance</div>
              <div style={{ fontSize: '2.2rem', fontWeight: 700, color: 'var(--blue)' }}>${stats.balance.toFixed(2)}</div>
            </div>
            <p className="text-muted text-sm" style={{ marginBottom: 16 }}>
              This will record a balance confirmation checkpoint in the transaction log.
            </p>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setModal(null)}>Cancel</button>
              <button className="btn btn-info" onClick={confirmBalance}>Confirm Balance</button>
            </div>
          </div>
        </div>
      )}

      {selectedOrder && (
        <InvoiceDetailModal order={selectedOrder} onClose={() => setSelectedOrder(null)} />
      )}

      {selectedTransaction && (
        <TransactionDetailModal transaction={selectedTransaction} onClose={() => setSelectedTransaction(null)} />
      )}
    </ErrorBoundary>
  );
}
