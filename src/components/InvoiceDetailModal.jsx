import { isWatcherDevice, maskPhone } from '../core/deviceSync';
import { getSettings } from '../core/store';
import React, { useState, useEffect } from 'react';
import { FileText, RotateCcw, AlertTriangle, Check } from 'lucide-react';
import db from '../core/db';
import { toast } from '../components/Toaster';
import { Logger } from '../core/logger';
import { onStockChanged } from '../core/telegramPublisher';
import { formatOrderMessage, formatPaymentMessage , formatCasaTransaction } from '../toolbox/telegramFormatter';
import { EventBus, EVENTS } from '../toolbox/eventBus';

const STATUS_BADGE = {
  paid:     'badge-green',
  deposit:  'badge-orange',
  preforma: 'badge-gray',
  returned: 'badge-red',
};

const getGradientForType = (type) => {
  switch (type) {
    case 'paid': return 'linear-gradient(to right, rgba(34, 197, 94, 0.15), transparent)';
    case 'deposit': return 'linear-gradient(to right, rgba(245, 158, 11, 0.15), transparent)';
    case 'returned': return 'linear-gradient(to right, rgba(239, 68, 68, 0.15), transparent)';
    case 'preforma': return 'linear-gradient(to right, rgba(156, 163, 175, 0.15), transparent)';
    default: return 'transparent';
  }
};

const getColorClassForType = (type) => {
  switch (type) {
    case 'paid': return 'text-green';
    case 'deposit': return 'text-gold';
    case 'returned': return 'text-red';
    case 'preforma': return 'text-muted';
    default: return 'text-gold';
  }
};

const HistoryModelCell = ({ asset, code }) => {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    if (!asset?.blob) return;
    const objectUrl = URL.createObjectURL(asset.blob);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [asset]);

  return (
    <div style={{
      position: 'relative', display: 'flex', flexDirection: 'column',
      padding: '8px', overflow: 'hidden', height: '80px', width: '120px',
      justifyContent: 'center', borderRadius: 8,
      border: '1px solid var(--border)', boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
    }}>
      {url ? (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 0 }}>
          {asset.type === 'video' ? (
            <video src={url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} muted loop autoPlay />
          ) : (
            <img src={url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="bg" />
          )}
        </div>
      ) : (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 0, background: 'var(--surface3)' }} />
      )}
      {url && <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1 }} />}
      <div style={{ position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100%', gap: 6 }}>
        <span className="badge" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', color: 'var(--gold)', fontSize: '1.1rem', fontWeight: 'bold', border: '1px solid rgba(212,175,55,0.4)', textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}>
          {code}
        </span>
        {!url && <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 500 }}>No Image</span>}
      </div>
    </div>
  );
};

export default function InvoiceDetailModal({ order, onClose, onRefresh }) {
  const [selectedOrderAssets, setSelectedOrderAssets] = useState({});
  const [showPayModal, setShowPayModal] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [showReturnConfirm, setShowReturnConfirm] = useState(false);

  useEffect(() => {
    const loadAssets = async () => {
      const assets = {};
      for (const item of order.items || []) {
        try {
          let model = null;
          if (item.catalogId) {
            model = await db.catalog.get(item.catalogId);
          } else if (item.catalogCode) {
            model = await db.catalog.where('code').equals(item.catalogCode.toUpperCase()).first();
          }
          
          if (model) {
            let asset = null;
            if (model.assets && model.assets.length > 0) {
              asset = model.assets[0];
            } else {
              const mcs = await db.modelColors.where('catalogId').equals(model.id).toArray();
              for (const mc of mcs) {
                if (mc.assets && mc.assets.length > 0) {
                  asset = mc.assets[0];
                  break;
                }
              }
            }
            if (asset && asset.blob) {
              const key = item.colorId ? `${item.catalogId || item.catalogCode}_${item.colorId}` : (item.catalogId || item.catalogCode);
              assets[key] = { blob: asset.blob, type: asset.type };
            }
          }
        } catch (e) {
          Logger.error('invoices', 'fetchAsset', e.message);
        }
      }
      setSelectedOrderAssets(assets);
    };
    if (order) loadAssets();
  }, [order]);

  const confirmReturn = async () => {
    setShowReturnConfirm(false);
    if (order.type === 'returned') { toast.error('Order already returned'); return; }
    try {
      const now = Date.now();
      const catalogIdsToUpdate = new Set();
      let refundAmount = 0;
      
      await db.transaction('rw', [db.orders, db.modelColors, db.stockLog, db.transactions, db.customers, db.catalog, db.sizeSeries], async () => {
        const currentOrder = await db.orders.get(order.id);
        if (currentOrder.type === 'returned') {
          throw new Error('Order already returned');
        }
      
        await db.orders.update(order.id, { type: 'returned', status: 'returned' });

        const stockLogs = [];
        for (const item of order.items || []) {
          const mc = await db.modelColors
            .where('catalogId').equals(item.catalogId)
            .and(mc => mc.colorId === item.colorId).first();
          if (mc) {
            const stockMap = {};
            (mc.stock || []).forEach(s => stockMap[s.size] = s.qty);
            const sizesChanged = {};
            (item.sizes || []).forEach(({ size, qty }) => {
              stockMap[size] = (stockMap[size] || 0) + qty;
              sizesChanged[size] = qty;
            });
            const newStock = Object.entries(stockMap).map(([size, qty]) => ({ size, qty }));
            await db.modelColors.update(mc.id, { stock: newStock });
            
            const newBalance = newStock.reduce((s, c) => s + c.qty, 0);
            stockLogs.push({
              id: crypto.randomUUID(), date: now, type: 'customer_return', ref: order.number,
              catalogCode: item.catalogCode, colorName: item.colorName,
              change: (item.sizes || []).reduce((s, x) => s + x.qty, 0),
              sizesChanged, balance: newBalance
            });
            
            catalogIdsToUpdate.add(item.catalogId);
          }
        }
        if (stockLogs.length > 0) await db.stockLog.bulkAdd(stockLogs);

        refundAmount = Math.max(0, Math.min(order.paidAmount || 0, order.totalPrice || 0));
        if (refundAmount > 0) {
          await db.transactions.add({
            id: crypto.randomUUID(), date: now, type: 'out', amount: refundAmount, category: 'Customer Return',
            description: `Return - ${order.customerName} - ${order.number}`, orderId: order.id, customerId: order.customerId,
          });
        }

        if (order.customerId) {
          const cust = await db.customers.get(order.customerId);
          if (cust) {
            const remaining = (order.totalPrice || 0) - (order.paidAmount || 0);
            if (remaining > 0) {
              await db.customers.update(order.customerId, { credit: Math.max(0, (cust.credit || 0) - remaining) });
            }
          }
        }
      });
      
      for (const catId of catalogIdsToUpdate) {
        onStockChanged(catId).catch(()=>{});
      }

      if (refundAmount > 0) {
        try {
          const allTxForCasa = await db.transactions.orderBy('date').toArray();
          const _startBudget = parseFloat(getSettings().startBudget) || 0;
          const _allIn  = allTxForCasa.filter(t => t.type === 'in').reduce((s,t) => s + (t.amount||0), 0);
          const _allOut = allTxForCasa.filter(t => t.type === 'out').reduce((s,t) => s + (t.amount||0), 0);
          const currentBalance = _startBudget + _allIn - _allOut;
          const previousBalance = currentBalance + refundAmount;
          
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
              amount: refundAmount,
              category: 'Return Refund',
              customerName: order.customerName,
              balanceBefore: previousBalance,
              balance: currentBalance,
              todayIn: casaTodayIn,
              todayOut: casaTodayOut,
            }),
          });
        } catch(tgErr) { Logger.warn('invoices', 'returnOrder', tgErr.message); }
      }

      toast.success(`Order ${order.number} returned — ${refundAmount} refunded`);
      Logger.info('invoices', 'returnOrder', `Order returned, refund: ${refundAmount}`, { id: order.id });
      EventBus.emit(EVENTS.TREASURY_CHANGED, { room: 'invoices', ref: order.number });
      onClose();
      if (onRefresh) onRefresh();
    } catch (e) {
      toast.error(e.message);
      Logger.error('invoices', 'returnOrder', e.message);
    }
  };

  const handlePayBalance = async () => {
    const amt = parseFloat(payAmount);
    if (!amt || amt <= 0) return toast.error('Enter a valid amount');
    
    try {
      const total = order.totalPrice || 0;
      const remaining = total - (order.paidAmount || 0);
      if (amt > remaining) { toast.error('Payment exceeds remaining balance'); return; }
      
      const newPaid = (order.paidAmount || 0) + amt;
      const commissionVal = total - newPaid;

      await db.transaction('rw', [db.orders, db.transactions, db.customers], async () => {

        await db.orders.update(order.id, {
          paidAmount: total,
          type: 'paid',
          status: 'paid',
          commission: (order.commission || 0) + (commissionVal > 0 ? commissionVal : 0)
        });

        // The IN transaction gets the full remaining balance so math checks out
        await db.transactions.add({
          id: crypto.randomUUID(), date: Date.now(), type: 'in', amount: remaining, category: 'Sale',
          description: `Balance Payment (Full) - ${order.customerName} - ${order.number}`, orderId: order.id, customerId: order.customerId
        });
        
        // The OUT transaction subtracts the unpaid difference
        if (commissionVal > 0) {
           await db.transactions.add({
             id: crypto.randomUUID(), date: Date.now(), type: 'out', amount: commissionVal, category: 'Commission Paid',
             description: `Commission - ${order.customerName} - ${order.number}`, orderId: order.id, customerId: order.customerId
           });
        }

        if (order.customerId) {
          const cust = await db.customers.get(order.customerId);
          if (cust) {
            await db.customers.update(order.customerId, { credit: Math.max(0, (cust.credit || 0) - remaining) });
          }
        }
      });

      // ── Send Commission to Casa Channel (outside transaction) ──────────────
      if (commissionVal > 0) {
        try {
          const allTxComm = await db.transactions.orderBy('date').toArray();
          const _sbComm = parseFloat(getSettings().startBudget) || 0;
          const _aiComm = allTxComm.filter(t => t.type === 'in').reduce((s,t) => s + (t.amount||0), 0);
          const _aoComm = allTxComm.filter(t => t.type === 'out').reduce((s,t) => s + (t.amount||0), 0);
          const commBalance = _sbComm + _aiComm - _aoComm;
          const todayStartComm = new Date(); todayStartComm.setHours(0,0,0,0);
          const todayTxComm = allTxComm.filter(t => t.date >= todayStartComm.getTime());
          await db.telegramQueue.add({
            priority: 3, type: 'text', status: 'pending',
            createdAt: Date.now(), attemptCount: 0,
            chatIdKey: 'casaChatId',
            text: formatCasaTransaction({
              type: 'out',
              amount: commissionVal,
              category: 'Commission Paid',
              customerName: order.customerName,
              balanceBefore: commBalance + commissionVal,
              balance: commBalance,
              todayIn: todayTxComm.filter(t => t.type === 'in').reduce((s,t) => s + t.amount, 0),
              todayOut: todayTxComm.filter(t => t.type === 'out').reduce((s,t) => s + t.amount, 0),
            }),
          });
        } catch(tgErr) { Logger.warn('invoices', 'payBalance', `Telegram commission error: ${tgErr.message}`); }
      }

      // ── Send payment to Casa + Facture channels ────────────────────────
      try {
        console.log('[Casa] handlePayBalance: starting telegram, amt=', amt, 'remaining=', remaining);
        const allTxForCasa = await db.transactions.orderBy('date').toArray();
        console.log('[Casa] allTxForCasa count=', allTxForCasa.length);
        const _startBudget = parseFloat(getSettings().startBudget) || 0;
        const _allIn  = allTxForCasa.filter(t => t.type === 'in').reduce((s,t) => s + (t.amount||0), 0);
        const _allOut = allTxForCasa.filter(t => t.type === 'out').reduce((s,t) => s + (t.amount||0), 0);
        const casaBalance = _startBudget + _allIn - _allOut;
        const todayStart = new Date(); todayStart.setHours(0,0,0,0);
        const todayTx = allTxForCasa.filter(t => t.date >= todayStart.getTime());
        const casaTodayIn = todayTx.filter(t => t.type === 'in').reduce((s,t) => s + t.amount, 0);
        const casaTodayOut = todayTx.filter(t => t.type === 'out').reduce((s,t) => s + t.amount, 0);

        await db.telegramQueue.add({
          priority: 2, type: 'text', status: 'pending', createdAt: Date.now(), attemptCount: 0,
          chatIdKey: 'casaChatId',
          text: formatCasaTransaction({
            type: 'in',
            amount: amt,
            category: 'Balance Payment',
            customerName: order.customerName,
            balanceBefore: casaBalance - amt,
            balance: casaBalance,
            todayIn: casaTodayIn,
            todayOut: casaTodayOut,
          }),
        });
        await db.telegramQueue.add({
          priority: 2, type: 'text', status: 'pending', createdAt: Date.now() + 1, attemptCount: 0,
          chatIdKey: 'factureChatId',
          text: formatPaymentMessage(`Balance paid: ${order.customerName} - ${order.number}`, order.customerPhone, amt.toFixed(2), 'in'),
        });
      } catch(tgErr) { Logger.warn('invoices', 'payBalance', `Telegram queue error: ${tgErr.message}`); }

      toast.success(`Payment of $${amt.toFixed(2)} recorded on invoice ${order.number}`);
      Logger.info('invoices', 'payBalance', `Paid balance $${amt}`, { id: order.id });
      EventBus.emit(EVENTS.TREASURY_CHANGED, { room: 'invoices', ref: order.number });
      setShowPayModal(false);
      onClose();
      if (onRefresh) onRefresh();
    } catch (e) {
      toast.error(e.message);
    }
  };

  if (!order) return null;

  return (
    <>
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-box" style={{ 
          maxWidth: 700,
          background: getGradientForType(order.type),
          backgroundColor: '#0d0d0d', 
        }} onClick={e => e.stopPropagation()}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
            <div>
              <span className={`badge ${STATUS_BADGE[order.type] || 'badge-gray'}`} style={{ fontSize: '0.75rem', marginBottom: 6 }}>
                {order.type?.toUpperCase()}
              </span>
              <div className={`text-bold ${getColorClassForType(order.type)}`} style={{ fontSize: '1.4rem', textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>
                {order.customerName} {order.customerPhone && `(${maskPhone(order.customerPhone)})`}
              </div>
              <div className="text-sm text-muted" style={{ marginTop: 6, display: 'flex', gap: 8, alignItems: 'center' }}>
                <span>{new Date(order.date).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}</span>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="text-muted text-sm" style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end', marginBottom: 6 }}>
                <FileText size={14} /> Invoice {order.number}
              </div>
            </div>
          </div>

          <div className="table-wrap">
            <table>
              <tbody>
                {(order.items || []).map((item, i) => {
                  const totalQty = (item.sizes || []).reduce((sum, s) => sum + (s.qty || 0), 0);
                  return (
                    <tr key={i}>
                      <td style={{ padding: '8px' }}>
                        <HistoryModelCell asset={selectedOrderAssets[item.colorId ? `${item.catalogId || item.catalogCode}_${item.colorId}` : (item.catalogId || item.catalogCode)]} code={item.catalogCode} />
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          {item.hex && <div style={{ width: 10, height: 10, borderRadius: '50%', background: item.hex }} />}
                          {item.colorName}
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                          {(item.sizes || []).map(s => (
                            <span key={s.size} className="badge" style={{
                              background: item.hex ? `${item.hex}22` : 'rgba(255,255,255,0.06)',
                              border: `1px solid ${item.hex ? `${item.hex}55` : 'var(--border)'}`,
                              color: item.hex || 'var(--text-sec)'
                            }}>
                              {s.size}×{s.qty}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td>
                        <span style={{ color: 'var(--text-muted)' }}>{totalQty} &times;</span>&nbsp;&nbsp;&nbsp;${(item.unitPrice || 0).toFixed(2)}
                      </td>
                      <td className="text-bold" style={{ fontSize: '1.15rem', color: item.hex || 'var(--gold)' }}>${(item.totalPrice || 0).toFixed(2)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 16, alignItems: 'flex-end' }}>
            <div className="text-muted" style={{ fontSize: '1.1rem' }}>${((order.totalPrice || 0) + (order.discount || 0)).toFixed(2)}</div>
            {order.discount > 0 && <div className="text-sm"><span className="text-muted">Discount: </span><span className="text-red">-${order.discount?.toFixed(2)}</span></div>}
            {order.type === 'deposit' ? (
              <>
                <div className={`text-bold ${getColorClassForType(order.type)}`} style={{ fontSize: '1.6rem' }}>${(order.paidAmount || 0).toFixed(2)}</div>
                <div className="text-sm"><span className="text-muted">Total: </span><span className="text-gold">${(order.totalPrice || 0).toFixed(2)}</span></div>
              </>
            ) : (
              <>
                <div className={`text-bold ${getColorClassForType(order.type)}`} style={{ fontSize: '1.6rem' }}>${(order.totalPrice || 0).toFixed(2)}</div>
                <div className="text-sm"><span className="text-muted">Paid: </span><span className="text-green">${(order.paidAmount || 0).toFixed(2)}</span></div>
              </>
            )}
          </div>

          {order.note && (
            <div className="text-sm text-gold" style={{ marginTop: 12, padding: 12, background: 'var(--surface)', borderRadius: 6, border: '1px solid rgba(212,175,55,0.2)' }}>
              <strong>Note:</strong> {order.note}
            </div>
          )}

          <div className="modal-actions" style={{ marginTop: 20 }}>
            {!isWatcherDevice() && order.type !== 'returned' && order.type !== 'preforma' && (
              <button className="btn btn-danger" onClick={() => setShowReturnConfirm(true)}>
                <RotateCcw size={15}/> Return Order
              </button>
            )}
            {!isWatcherDevice() && order.type === 'deposit' && (
              <button className="btn btn-success" onClick={() => {
                setPayAmount((order.totalPrice - (order.paidAmount || 0)).toFixed(2));
                setShowPayModal(true);
              }}>
                Pay Now
              </button>
            )}
            <div style={{ flex: 1 }} />
            <button className="btn btn-secondary" onClick={onClose}>Close</button>
          </div>
        </div>
      </div>

      {/* Return Confirmation Modal */}
      {showReturnConfirm && (
        <div className="modal-overlay" onClick={() => setShowReturnConfirm(false)} style={{ zIndex: 1100 }}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 440, border: '1px solid rgba(239, 68, 68, 0.5)', background: '#0d0d0d', boxShadow: '0 20px 60px rgba(0,0,0,0.85)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
              <div style={{
                width: 46, height: 46, borderRadius: 12,
                background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.35)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--red)', flexShrink: 0
              }}>
                <RotateCcw size={26} />
              </div>
              <div>
                <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--red)', letterSpacing: 0.5 }}>
                  Return Invoice
                </div>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                  Invoice #{order.number}
                </div>
              </div>
            </div>

            <div style={{
              background: 'rgba(255,255,255,0.03)',
              borderRadius: 10,
              padding: '14px 16px',
              border: '1px solid var(--border)',
              marginBottom: 16
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: '0.9rem' }}>
                <span className="text-muted">Customer:</span>
                <span className="text-bold text-gold">{order.customerName}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: '0.9rem' }}>
                <span className="text-muted">Invoice Total:</span>
                <span className="text-bold">${(order.totalPrice || 0).toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <span className="text-muted" style={{ fontWeight: 600, fontSize: '0.95rem' }}>Return Cash:</span>
                <span className="text-bold" style={{ fontSize: '1.9rem', color: 'var(--red)', letterSpacing: 0.5 }}>${(order.paidAmount || 0).toFixed(2)}</span>
              </div>

              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10, fontSize: '0.82rem', color: 'var(--text-sec)', display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div>📦 <strong>Stock:</strong> All items in this invoice will be restored to stock inventory.</div>
                <div>💵 <strong>Treasury:</strong> ${(order.paidAmount || 0).toFixed(2)} will be refunded from Casa.</div>
              </div>
            </div>

            <div style={{ fontSize: '0.86rem', color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: 20, textAlign: 'center' }}>
              Are you sure you want to return this invoice?
            </div>

            <div className="modal-actions" style={{ marginTop: 0, paddingTop: 16, display: 'flex', gap: 12 }}>
              <button
                className="btn btn-secondary"
                style={{ flex: 1, padding: '12px', justifyContent: 'center', fontSize: '0.95rem' }}
                onClick={() => setShowReturnConfirm(false)}
              >
                Cancel
              </button>
              <button
                className="btn btn-danger"
                style={{
                  flex: 1.3,
                  padding: '12px',
                  justifyContent: 'center',
                  background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: '0.95rem',
                  border: 'none'
                }}
                onClick={confirmReturn}
              >
                <Check size={18} style={{ marginRight: 6 }} /> Confirm Return
              </button>
            </div>
          </div>
        </div>
      )}

      {showPayModal && (
        <div className="modal-overlay" onClick={() => setShowPayModal(false)}>
          <div className="modal-box" style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
            <div className="modal-title">Pay Balance</div>
            <div style={{ marginBottom: 16 }}>
              <div>Order #{order.number}</div>
              <div className="text-muted text-sm">
                Remaining Balance: ${(order.totalPrice - (order.paidAmount || 0)).toFixed(2)}
              </div>
            </div>
            <div className="form-group">
              <label>Amount</label>
              <input
                type="number"
                step="0.01"
                className="input"
                value={payAmount}
                onChange={e => setPayAmount(e.target.value)}
              />
            </div>
            <div className="modal-actions" style={{ marginTop: 20 }}>
              <button className="btn btn-secondary" onClick={() => setShowPayModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handlePayBalance}>Confirm Payment</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
