import { isWatcherDevice, maskPhone } from '../core/deviceSync';
import { getSettings } from '../core/store';
import { formatCasaTransaction, escapeHtml } from '../toolbox/telegramFormatter';
import { processTelegramQueue } from '../core/telegramPublisher';
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { ChevronLeft, Users, ShoppingCart, DollarSign, History, Edit2, MessageCircle, Check, Plus, FileText , Download } from 'lucide-react';
import db from '../core/db';
import { Logger } from '../core/logger';
import { toast } from '../components/Toaster';
import ErrorBoundary from '../components/ErrorBoundary';
import InvoiceDetailModal from '../components/InvoiceDetailModal';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import COUNTRIES from '../core/countries.json';

const getFlag = (country) => {
  return COUNTRIES.find(c => c.name === country)?.flag || '🌍';
};

const STATUS_BADGE = { paid: 'badge-green', deposit: 'badge-orange', returned: 'badge-red', preforma: 'badge-gray', manual_debt: 'badge-sky', payment: 'badge-pistachio' };

const getGradientForType = (type) => {
  switch (type) {
    case 'paid': return 'linear-gradient(to right, rgba(34, 197, 94, 0.15), transparent)';
    case 'payment': return 'linear-gradient(to right, rgba(134, 239, 172, 0.15), transparent)';
    case 'deposit': return 'linear-gradient(to right, rgba(245, 158, 11, 0.15), transparent)';
    case 'returned': return 'linear-gradient(to right, rgba(239, 68, 68, 0.15), transparent)';
    case 'manual_debt': return 'linear-gradient(to right, rgba(56, 189, 248, 0.15), transparent)';
    case 'preforma': return 'linear-gradient(to right, rgba(156, 163, 175, 0.15), transparent)';
    default: return 'var(--surface)';
  }
};

const getColorClassForType = (type) => {
  switch (type) {
    case 'paid': return 'text-green';
    case 'payment': return 'text-pistachio';
    case 'deposit': return 'text-gold';
    case 'returned': return 'text-red';
    case 'manual_debt': return 'text-sky';
    case 'preforma': return 'text-muted';
    default: return 'text-gold';
  }
};

export default function CustomerDetailScreen() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [customer, setCustomer] = useState(null);
  const [orders, setOrders] = useState([]);
  const [stats, setStats] = useState({});
  const [modal, setModal] = useState(null);
  const [payAmount, setPayAmount] = useState('');
  const [debtAmount, setDebtAmount] = useState('');
  const [debtNote, setDebtNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState(location.state?.filter || 'all');
  const [selectedOrder, setSelectedOrder] = useState(null);

  useEffect(() => { load(); }, [id]);

  const handleExportTimeline = () => {
    let csv = 'Date,Reference,Type,Total Price,Deposit / Payment,Commission,Notes\n';
    orders.forEach(o => {
      const date = new Date(o.date).toLocaleString().replace(/,/g, '');
      const ref = (o.number || 'PAYMENT').replace(/"/g, '""');
      const type = (o.type || '').toUpperCase();
      const total = (o.totalPrice || 0).toFixed(2);
      const deposit = (o.depositAmount || 0).toFixed(2);
      const commission = (o.commission || 0).toFixed(2);
      const notes = ((o.notes || '') + ' ' + (o.description || '')).trim().replace(/"/g, '""');
      csv += `"${date}","${ref}","${type}","${total}","${deposit}","${commission}","${notes}"\n`;
    });
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `timeline_${(customer.name||'').replace(/\s+/g, '_')}_${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast.success('Exported timeline to CSV');
  };

  const handleCustomerReport = async () => {
    if (!customer) return;
    if (orders.length === 0) {
      toast.error('No timeline entries to report');
      return;
    }
    const typeLabel = (t) => ({
      paid: '✅ PAID',
      deposit: '🔖 DEPOSIT',
      preforma: '📄 PROFORMA',
      returned: '↩️ RETURNED',
      manual_debt: '💰 DEBT',
      payment: '💳 PAYMENT',
    }[t] || (t || '').toUpperCase());

    const now = new Date();
    const dateStr = now.toLocaleDateString('en-GB');
    const timeStr = now.toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });

    let header = `👤 <b>CUSTOMER REPORT</b>\n📅 ${dateStr} 🕓 ${timeStr}\n━━━━━━━━━━━━━━━━━━━━━\n`;
    header += `🧑 ${escapeHtml(customer.name || '')}\n`;
    if (customer.phone) header += `📞 ${escapeHtml(customer.phone)}\n`;
    if (customer.country) header += `🌍 ${escapeHtml(customer.country)}\n`;
    if (customer.cargoName) header += `🚚 ${escapeHtml(customer.cargoName)}\n`;
    header += `💰 Outstanding Debt: <b>$${Number(customer.credit || 0).toFixed(2)}</b>\n`;
    header += `━━━━━━━━━━━━━━━━━━━━━\n🕓 Timeline:\n`;

    const lines = orders
      .slice()
      .sort((a,b) => b.date - a.date)
      .map(o => {
        const d = new Date(o.date);
        const ds = `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`;
        const num = o.number || 'PAY';
        const items = o.items?.map(i => i.catalogCode).filter(Boolean).join(', ') || '';
        const total = Number(o.totalPrice || 0).toFixed(2);
        const amountLine = o.type === 'deposit'
          ? `${total} (paid $${Number(o.paidAmount || 0).toFixed(2)})`
          : o.type === 'payment'
            ? `+$${total}`
            : `${total}`;
        const note = (o.note || o.description || '').trim();
        const noteTxt = note ? ` — ${escapeHtml(note)}` : '';
        const itemsTxt = items ? ` ${escapeHtml(items)} |` : '';
        return `${typeLabel(o.type)} ${ds} ${escapeHtml(num)} |${itemsTxt} <b>$${amountLine}</b>${noteTxt}`;
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
        text = `👤 <b>CUSTOMER REPORT</b>  (${i+1}/${chunks.length})\n━━━━━━━━━━━━━━━━━━━━━\n` + text;
      }
      await db.telegramQueue.add({
        priority: 2,
        type: 'text',
        status: 'pending',
        createdAt: Date.now(),
        attemptCount: 0,
        chatIdKey: 'factureChatId',
        text,
        refId: `customer_report_${ts}_${i}`,
      });
    }
    setTimeout(() => processTelegramQueue().catch(() => {}), 100);
    toast.success(`${customer.name}'s timeline sent (${chunks.length} message${chunks.length > 1 ? 's' : ''})`);
  };

  const load = async () => {
    const c = await db.customers.get(id);
    if (!c) { navigate('/customers'); return; }
    setCustomer(c);
    const ords = await db.orders.where('customerId').equals(id).toArray();
    
    // Fetch payments to show in the timeline
    const payments = await db.transactions
      .where('customerId').equals(id)
      .toArray()
      .then(arr => arr.filter(t => t.type === 'in' && t.category === 'Debt Payment'));
      
    const mappedPayments = payments.map(t => ({
      id: t.id,
      date: t.date,
      type: 'payment',
      number: `PAY-${t.date.toString().slice(-6)}`,
      totalPrice: t.amount,
      paidAmount: t.amount,
      items: [{ catalogCode: 'Payment Received' }],
      note: t.description
    }));

    const allHistory = [...ords, ...mappedPayments];
    allHistory.sort((a, b) => b.date - a.date);
    
    let currentBal = c.credit || 0;
    for (let i = 0; i < allHistory.length; i++) {
      const o = allHistory[i];
      o.runningBalance = currentBal;
      
      if (o.type === 'payment') {
        currentBal += (o.paidAmount || 0);
      } else if (o.type === 'manual_debt') {
        currentBal -= (o.totalPrice || 0);
      } else if (o.type === 'paid' || o.type === 'deposit') {
        const debtAdded = Math.max(0, (o.totalPrice || 0) - (o.paidAmount || 0));
        currentBal -= debtAdded;
      } else if (o.type === 'returned') {
        const debtReduced = Math.max(0, (o.totalPrice || 0) - (o.paidAmount || 0));
        currentBal += debtReduced;
      }
      // Don't floor at 0 here because of floating point inaccuracies or historical discrepancies, just let it compute backwards.
    }
    
    setOrders(allHistory);
    const totalSpent = ords.filter(o => o.type === 'paid').reduce((s, o) => s + (o.totalPrice || 0), 0);
    const totalDeposits = ords.filter(o => o.type === 'deposit').reduce((s, o) => s + (o.depositAmount || 0), 0);
    setStats({ orderCount: ords.length, totalSpent, totalDeposits });
  };

  const recordPayment = async () => {
    const amt = parseFloat(payAmount);
    if (!amt || amt <= 0) { toast.error('Enter a valid amount'); return; }
    setSaving(true);
    try {
      const newCredit = Math.max(0, (customer.credit || 0) - amt);
      await db.customers.update(id, { credit: newCredit });
      await db.transactions.add({
        id: crypto.randomUUID(), date: Date.now(), type: 'in',
        amount: amt, category: 'Debt Payment',
        description: `Debt payment — ${customer.name}`,
        customerId: id,
      });

      // ── Send Debt Payment to Casa Channel ──
      try {
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
          priority: 3, type: 'text', status: 'pending', createdAt: Date.now(), attemptCount: 0,
          chatIdKey: 'casaChatId',
          text: formatCasaTransaction({
            type: 'in',
            amount: amt,
            category: 'Customer Payment',
            customerName: customer.name,
            balanceBefore: casaBalance - amt,
            balance: casaBalance,
            todayIn: casaTodayIn,
            todayOut: casaTodayOut,
          }),
        });
      } catch(tgErr) {
        Logger.warn('customers', 'recordPayment', `Telegram queue error: ${tgErr.message}`);
      }
      Logger.info('customers', 'recordPayment', `Payment recorded: $${amt}`, { id, newCredit });
      toast.success(`Payment of $${amt.toFixed(2)} recorded. Remaining: $${newCredit.toFixed(2)}`);
      setModal(null); setPayAmount('');
      load();
    } catch (e) {
      toast.error(e.message);
      Logger.error('customers', 'recordPayment', e.message);
    }
    setSaving(false);
  };

  const recordManualDebt = async () => {
    const amt = parseFloat(debtAmount);
    if (!amt || amt <= 0) { toast.error('Enter a valid amount'); return; }
    setSaving(true);
    try {
      const newCredit = (customer.credit || 0) + amt;
      await db.customers.update(id, { credit: newCredit });
      
      // We log this as an order of type 'manual_debt' so it shows up in the timeline
      await db.orders.add({
        id: crypto.randomUUID(),
        number: `MD-${Date.now().toString().slice(-6)}`,
        date: Date.now(),
        customerId: id,
        customerName: customer.name,
        type: 'manual_debt',
        totalPrice: amt,
        paidAmount: 0,
        items: [],
        note: debtNote || 'Manual debt added',
      });
      
      Logger.info('customers', 'recordManualDebt', `Manual debt added: $${amt}`, { id, newCredit });
      toast.success(`Manual debt of $${amt.toFixed(2)} added. Total: $${newCredit.toFixed(2)}`);
      setModal(null); setDebtAmount(''); setDebtNote('');
      load();
    } catch (e) {
      toast.error(e.message);
      Logger.error('customers', 'recordManualDebt', e.message);
    }
    setSaving(false);
  };

  const generateDebtPDF = () => {
    if (!customer) return;
    try {
      const doc = new jsPDF();
      const dateStr = new Date().toLocaleDateString();
      
      // Header
      doc.setFontSize(18);
      doc.text(`Debt Statement - ${customer.name}`, 14, 22);
      
      doc.setFontSize(11);
      doc.setTextColor(100);
      doc.text(`Date: ${dateStr}`, 14, 30);
      doc.text(`Phone: ${customer.phone || 'N/A'}`, 14, 36);
      doc.text(`Country: ${customer.country || 'N/A'}`, 14, 42);

      // Table data
      const tableData = [...orders].reverse().map(o => [
        new Date(o.date).toLocaleDateString(),
        o.number || '-',
        (o.type || '').toUpperCase(),
        `$${(o.totalPrice || 0).toFixed(2)}`,
        `$${(o.paidAmount || 0).toFixed(2)}`,
        `$${Math.max(0, (o.totalPrice || 0) - (o.paidAmount || 0)).toFixed(2)}`
      ]);

      // Add table
      doc.autoTable({
        startY: 50,
        head: [['Date', 'Invoice#', 'Type', 'Total', 'Paid', 'Remaining']],
        body: tableData,
        theme: 'striped',
        headStyles: { fillColor: [212, 175, 55] },
      });

      // Footer
      const finalY = doc.lastAutoTable.finalY || 50;
      doc.setFontSize(18);
      
      const text1 = "Total Debt = ";
      const amountStr = `$${(customer.credit || 0).toFixed(2)}`;
      
      doc.setTextColor(0, 0, 0); // Black
      doc.text(text1, 14, finalY + 15);
      
      const text1Width = doc.getTextWidth(text1);
      doc.setTextColor(239, 68, 68); // Red
      doc.text(amountStr, 14 + text1Width, finalY + 15);

      const fileName = `Debt_${customer.name.replace(/\s+/g, '_')}_${dateStr.replace(/\//g, '-')}.pdf`;
      doc.save(fileName);
      toast.success('PDF Generated successfully');
    } catch (e) {
      toast.error('Failed to generate PDF');
      Logger.error('customers', 'generateDebtPDF', e.message);
    }
  };

  if (!customer) return <div className="loading-screen"><div className="spin" style={{ width: 28, height: 28, border: '3px solid var(--gold)', borderTopColor: 'transparent', borderRadius: '50%' }} /></div>;

  return (
    <ErrorBoundary room="customer-detail">
      <div className="page-container fade-in">
        {/* Header */}
        <div className="page-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button className="btn btn-secondary btn-icon" onClick={() => navigate('/customers')}><ChevronLeft size={18}/></button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div className="avatar" style={{ width: 52, height: 52, overflow: 'hidden', background: 'var(--surface-light)', border: '2px solid rgba(212,175,55,0.2)' }}>
                {getFlag(customer.country) !== '🌍' ? (
                  <span style={{ fontSize: '5rem', lineHeight: 1, opacity: 0.5 }}>{getFlag(customer.country)}</span>
                ) : (
                  customer.name?.[0]?.toUpperCase()
                )}
              </div>
              <div>
                <div style={{ fontSize: '1.2rem', fontWeight: 700 }}>{customer.name}</div>
                <div className="text-muted text-sm"><span className="text-gold" style={{ fontWeight: 500 }}>{maskPhone(customer.phone)}</span> {customer.cargoName ? `· ${customer.cargoName}` : ''}</div>
              </div>
            </div>
          </div>
          <div className="page-actions">
            {customer.phone && (
              <a href={`https://wa.me/${customer.phone.replace(/\D/g,'')}`} target="_blank" rel="noreferrer">
                <button className="btn btn-success btn-sm"><MessageCircle size={13}/> WhatsApp</button>
              </a>
            )}
            <button className="btn btn-primary btn-sm" onClick={() => navigate(`/new-order?customer=${id}`)}>
              <ShoppingCart size={13}/> New Order
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid-4" style={{ marginBottom: 20 }}>
          <div className="stat-card"><div className="stat-label">Total Orders</div><div className="stat-value">{stats.orderCount || 0}</div></div>
          <div className="stat-card"><div className="stat-label">Total Spent</div><div className="stat-value green">${(stats.totalSpent || 0).toFixed(2)}</div></div>
          <div className="stat-card"><div className="stat-label">Deposits</div><div className="stat-value text-gold">${(stats.totalDeposits || 0).toFixed(2)}</div></div>
          <div className="stat-card" style={{ border: customer.credit > 0 ? '1px solid rgba(239,68,68,0.4)' : undefined, position: 'relative' }}>
            <div className="stat-label">OUTSTANDING DEBT</div>
            <div className={`stat-value ${customer.credit > 0 ? 'red' : 'green'}`}>
              ${(customer.credit || 0).toFixed(2)}
            </div>
            <div style={{ position: 'absolute', right: 20, top: '50%', transform: 'translateY(-50%)' }}>
              <button className="btn btn-secondary btn-icon" onClick={generateDebtPDF} title="Export PDF">
                <FileText size={16}/>
              </button>
            </div>
          </div>
        </div>

        {/* Orders History */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <button className="btn btn-sky" style={{ padding: '8px 16px', fontSize: '0.9rem', fontWeight: 600 }} onClick={() => navigate(`/customers/${id}/credit`)}>
              <DollarSign size={16} style={{ marginRight: 4 }}/> Credit Ledger
            </button>
            <button className="btn btn-secondary" style={{ padding: '8px 16px', fontSize: '0.9rem', fontWeight: 600 }} onClick={handleCustomerReport}>
              <FileText size={16} style={{ marginRight: 4 }} /> RAPORT
            </button>
            <button className="btn btn-secondary" style={{ padding: '8px 16px', fontSize: '0.9rem', fontWeight: 600 }} onClick={handleExportTimeline}>
              <Download size={16} style={{ marginRight: 4 }} /> Export CSV
            </button>
          </div>
          <div className="filters-bar" style={{ marginBottom: 0 }}>
            {['all', 'paid', 'deposit', 'preforma', 'returned', 'manual_debt', 'payment'].map(f => (
              <button key={f} className={`filter-btn ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
                {f.replace('_', ' ').toUpperCase()}
              </button>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {orders.length === 0 ? (
            <div className="empty-state"><ShoppingCart size={40}/><h3>No orders yet</h3>
              <button className="btn btn-primary" onClick={() => navigate(`/new-order?customer=${id}`)}><Plus size={13}/> Create First Order</button>
            </div>
          ) : orders.filter(o => filter === 'all' || o.type === filter).length === 0 ? (
            <div className="empty-state"><History size={40}/><h3>No {filter} orders found</h3></div>
          ) : orders.filter(o => filter === 'all' || o.type === filter).map(o => (
            <div key={o.id} onClick={() => { if (o.type !== 'payment') setSelectedOrder(o); }} style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
              background: getGradientForType(o.type), border: '1px solid var(--border)', borderRadius: 10, cursor: o.type === 'payment' ? 'default' : 'pointer'
            }}>
              <div style={{ width: 110, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span className={`badge ${STATUS_BADGE[o.type] || 'badge-gray'}`} style={{ fontSize: '0.7rem', alignSelf: 'stretch', textAlign: 'center' }}>
                  {o.type?.toUpperCase()}
                </span>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="text-ellipsis text-sm">{o.items?.map(i => i.catalogCode).join(', ')}</div>
                <div className="text-xs text-muted" style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 4 }}>
                  <FileText size={12}/> {o.number} • {new Date(o.date).toLocaleDateString()}
                </div>
              </div>
              <div style={{ textAlign: 'right', minWidth: 90 }}>
                {o.type === 'deposit' ? (
                  <>
                    <div className={`text-bold ${getColorClassForType(o.type)}`}>${(o.paidAmount || 0).toFixed(2)}</div>
                    <div className="text-xs text-muted">Total: ${(o.totalPrice || 0).toFixed(2)}</div>
                  </>
                ) : (
                  <>
                    <div className={`text-bold ${getColorClassForType(o.type)}`}>${(o.totalPrice || 0).toFixed(2)}</div>
                  </>
                )}
                {o.runningBalance !== undefined && (
                  <div className="text-xs" style={{ color: 'var(--text-muted)', marginTop: 6, fontWeight: 500 }}>
                    Debt: <span style={{ color: o.runningBalance > 0 ? 'var(--red)' : 'var(--green)' }}>${o.runningBalance.toFixed(2)}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {selectedOrder && (
        <InvoiceDetailModal 
          order={selectedOrder} 
          onClose={() => setSelectedOrder(null)} 
          onRefresh={load} 
        />
      )}
    </ErrorBoundary>
  );
}
