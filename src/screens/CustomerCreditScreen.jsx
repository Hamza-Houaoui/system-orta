import { isWatcherDevice, maskPhone } from '../core/deviceSync';
import { getSettings } from '../core/store';
import { drawPdfHeader, fmtMoney } from '../core/invoicePdf';
import { formatCasaTransaction } from '../toolbox/telegramFormatter';
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, DollarSign, Plus, FileText, Download } from 'lucide-react';
import db from '../core/db';
import { Logger } from '../core/logger';
import { toast } from '../components/Toaster';
import ErrorBoundary from '../components/ErrorBoundary';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import COUNTRIES from '../core/countries.json';

const getFlag = (country) => {
  return COUNTRIES.find(c => c.name === country)?.flag || '🌍';
};

export default function CustomerCreditScreen() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [customer, setCustomer] = useState(null);
  const [logs, setLogs] = useState([]);
  const [modal, setModal] = useState(null);
  const [payAmount, setPayAmount] = useState('');
  const [debtAmount, setDebtAmount] = useState('');
  const [debtNote, setDebtNote] = useState('');
  const [payNote, setPayNote] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); }, [id]);

  const load = async () => {
    const c = await db.customers.get(id);
    if (!c) { navigate('/customers'); return; }
    setCustomer(c);
    
    // Load Manual Debt (orders of type 'manual_debt')
    const manualDebts = await db.orders
      .where('customerId').equals(id)
      .toArray()
      .then(arr => arr.filter(o => o.type === 'manual_debt'));
      
    // Load Payments (transactions of type 'in' with category 'Debt Payment')
    const payments = await db.transactions
      .where('customerId').equals(id)
      .toArray()
      .then(arr => arr.filter(t => t.type === 'in' && t.category === 'Debt Payment'));
      
    // Combine and sort
    const combined = [
      ...manualDebts.map(o => ({
        id: o.id,
        date: o.date,
        type: 'manual_debt',
        amount: o.totalPrice,
        number: o.number,
        note: o.note || 'Manual debt added'
      })),
      ...payments.map(t => ({
        id: t.id,
        date: t.date,
        type: 'payment',
        amount: t.amount,
        note: t.description || 'Debt Payment'
      }))
    ];
    
    combined.sort((a, b) => b.date - a.date);
    setLogs(combined);
  };

  const recordManualDebt = async () => {
    const amt = parseFloat(debtAmount);
    if (!amt || amt <= 0) { toast.error('Enter a valid amount'); return; }
    setSaving(true);
    try {
      const newCredit = (customer.credit || 0) + amt;
      await db.customers.update(id, { credit: newCredit });
      
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
        description: payNote ? `Debt payment — ${customer.name} — ${payNote}` : `Debt payment — ${customer.name}`,
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
      setModal(null); setPayAmount(''); setPayNote('');
      load();
    } catch (e) {
      toast.error(e.message);
      Logger.error('customers', 'recordPayment', e.message);
    }
    setSaving(false);
  };

  const generateDebtPDF = async () => {
    if (!customer) return;
    try {
      const settings = await getSettings();
      const doc = new jsPDF();
      const pageW = doc.internal.pageSize.getWidth();
      const margin = 14;

      // Shared shop header (logo, QR, shop name / phone / address, separator)
      const { y } = await drawPdfHeader(doc, { settings, when: Date.now() });

      // Gold centered title
      let ty = y + 14;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(18);
      doc.setTextColor(212, 175, 55);
      doc.text('CREDIT LEDGER', pageW / 2, ty, { align: 'center' });
      doc.setTextColor(0, 0, 0);

      // Customer info
      ty += 10;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.text(`Customer: ${customer.name || 'Walk-in'}`, margin, ty);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(80, 80, 80);
      let infoY = ty + 6;
      if (customer.phone) { doc.text(`Phone: ${customer.phone}`, margin, infoY); infoY += 6; }
      if (customer.country) { doc.text(`Country: ${customer.country}`, margin, infoY); infoY += 6; }
      doc.setTextColor(0, 0, 0);

      const tableData = [...logs].reverse().map(l => [
        new Date(l.date).toLocaleString(),
        l.type === 'manual_debt' ? 'DEBT ADDED' : 'PAYMENT',
        l.note || '-',
        l.type === 'manual_debt' ? `+$${fmtMoney(l.amount)}` : `-$${fmtMoney(l.amount)}`
      ]);

      doc.autoTable({
        startY: infoY + 4,
        margin: { left: margin, right: margin },
        head: [['Date', 'Type', 'Note', 'Amount']],
        body: tableData,
        theme: 'striped',
        styles: { fontSize: 8 },
        headStyles: { fillColor: [212, 175, 55], textColor: [0, 0, 0] },
        columnStyles: { 3: { halign: 'right' } },
        tableWidth: 'auto',
        didParseCell: (data) => {
          if (data.section === 'body' && data.column.index === 3) {
            if (data.cell.raw.startsWith('+')) data.cell.styles.textColor = [239, 68, 68]; // Red
            if (data.cell.raw.startsWith('-')) data.cell.styles.textColor = [34, 197, 94]; // Green
          }
        }
      });

      const finalY = doc.lastAutoTable.finalY || infoY + 4;
      const text1 = 'Current Outstanding Debt = ';
      const amountStr = `$${fmtMoney(customer.credit || 0)}`;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.setTextColor(0, 0, 0);
      doc.text(text1, margin, finalY + 14);
      const text1Width = doc.getTextWidth(text1);
      doc.setTextColor(239, 68, 68);
      doc.text(amountStr, margin + text1Width, finalY + 14);
      doc.setTextColor(0, 0, 0);

      // Footer
      const footerEn = 'No return or exchange is allowed after the date of the invoice. Thank you for your understanding.';
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text(footerEn, pageW / 2, doc.internal.pageSize.getHeight() - 10, { align: 'center' });
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(0, 0, 0);

      const fileName = `Credit_${customer.name.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`;
      doc.save(fileName);
      toast.success('PDF Generated successfully');
    } catch (e) {
      toast.error('Failed to generate PDF');
      Logger.error('customers', 'generateDebtPDF', e.message);
    }
  };

  if (!customer) return <div className="loading-screen"><div className="spin" style={{ width: 28, height: 28, border: '3px solid var(--gold)', borderTopColor: 'transparent', borderRadius: '50%' }} /></div>;

  return (
    <ErrorBoundary room="customer-credit">
      <div className="page-container fade-in">
        {/* Header */}
        <div className="page-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button className="btn btn-secondary btn-icon" onClick={() => navigate(`/customers/${id}`)}><ChevronLeft size={18}/></button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div className="avatar" style={{ width: 52, height: 52, overflow: 'hidden', background: 'var(--surface-light)', border: '2px solid rgba(212,175,55,0.2)' }}>
                {getFlag(customer.country) !== '🌍' ? (
                  <span style={{ fontSize: '5rem', lineHeight: 1, opacity: 0.5 }}>{getFlag(customer.country)}</span>
                ) : (
                  customer.name?.[0]?.toUpperCase()
                )}
              </div>
              <div>
                <div style={{ fontSize: '1.2rem', fontWeight: 700 }}>{customer.name} - Credit Ledger</div>
                <div className="text-muted text-sm"><span className="text-gold" style={{ fontWeight: 500 }}>{maskPhone(customer.phone)}</span></div>
              </div>
            </div>
          </div>
          <div className="page-actions">
            <button className="btn btn-secondary btn-sm" onClick={generateDebtPDF}>
              <Download size={14}/> Export PDF
            </button>
          </div>
        </div>

        {/* Big Dashboard */}
        <div style={{ background: 'var(--surface)', padding: 32, borderRadius: 12, border: '1px solid var(--border)', textAlign: 'center', marginBottom: 24, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
          <div style={{ color: 'var(--text-muted)', fontSize: '1.1rem', marginBottom: 8, letterSpacing: 2 }}>OUTSTANDING DEBT</div>
          <div style={{ fontSize: '3rem', fontWeight: 700, color: customer.credit > 0 ? 'var(--red)' : 'var(--green)', lineHeight: 1, textShadow: '0 2px 10px rgba(0,0,0,0.2)' }}>
            ${(customer.credit || 0).toFixed(2)}
          </div>
          
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 24 }}>
            <button className="btn btn-danger" style={{ padding: '12px 24px', fontSize: '1rem' }} onClick={() => setModal('manual_debt')}>
              <Plus size={18}/> Add Debt
            </button>
            <button className="btn btn-primary" style={{ padding: '12px 24px', fontSize: '1rem' }} onClick={() => setModal('payment')}>
              <DollarSign size={18}/> Pay Debt
            </button>
          </div>
        </div>

        {/* Ledger History */}
        <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', fontWeight: 600, color: 'var(--gold)', letterSpacing: 1 }}>
            TRANSACTION HISTORY
          </div>
          <div className="data-table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: 200 }}>DATE</th>
                  <th>TYPE</th>
                  <th>NOTE</th>
                  <th style={{ textAlign: 'right' }}>AMOUNT</th>
                </tr>
              </thead>
              <tbody>
                {logs.length === 0 ? (
                  <tr><td colSpan="4" style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-muted)' }}>No credit transactions found</td></tr>
                ) : (
                  logs.map(log => (
                    <tr key={log.id}>
                      <td style={{ color: 'var(--text-muted)' }}>{new Date(log.date).toLocaleString()}</td>
                      <td>
                        {log.type === 'manual_debt' ? (
                          <span className="badge badge-red" style={{ padding: '4px 8px' }}>DEBT ADDED</span>
                        ) : (
                          <span className="badge badge-green" style={{ padding: '4px 8px' }}>PAYMENT</span>
                        )}
                      </td>
                      <td style={{ color: 'var(--text-muted)' }}>{log.note}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700, fontSize: '1.1rem', color: log.type === 'manual_debt' ? 'var(--red)' : 'var(--green)' }}>
                        {log.type === 'manual_debt' ? '+' : '-'}${log.amount.toFixed(2)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* Payment Modal */}
      {modal === 'payment' && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <div className="modal-title"><DollarSign size={16}/> Record Payment</div>
            <div style={{ marginBottom: 16 }}>
              <label>Amount Paid ($)</label>
              <input 
                type="number" 
                value={payAmount}
                onChange={e => setPayAmount(e.target.value)}
                placeholder="0.00"
                className="w-full"
                autoFocus
              />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label>Note / Reason (Optional)</label>
              <input 
                type="text" 
                value={payNote}
                onChange={e => setPayNote(e.target.value)}
                placeholder="e.g. Cash payment received"
                className="w-full"
              />
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setModal(null)}>Cancel</button>
              <button 
                className="btn btn-primary" 
                onClick={recordPayment}
                disabled={saving || !payAmount}
              >
                {saving ? 'Saving...' : 'Record Payment'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manual Debt Modal */}
      {modal === 'manual_debt' && (
        <div className="modal-overlay fade-in" onClick={() => setModal(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <div className="modal-header">
              <h3>Add Manual Debt</h3>
              <button className="btn btn-secondary btn-icon" onClick={() => setModal(null)}>✕</button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label>Amount ($)</label>
                <input 
                  type="number" 
                  value={debtAmount}
                  onChange={e => setDebtAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full"
                  autoFocus
                />
              </div>
              <div>
                <label>Note / Reason (Optional)</label>
                <input 
                  type="text" 
                  value={debtNote}
                  onChange={e => setDebtNote(e.target.value)}
                  placeholder="e.g. Old debt from previous system"
                  className="w-full"
                />
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setModal(null)}>Cancel</button>
              <button 
                className="btn btn-danger" 
                onClick={recordManualDebt}
                disabled={saving || !debtAmount}
              >
                {saving ? 'Adding...' : 'Add Debt'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ErrorBoundary>
  );
}
