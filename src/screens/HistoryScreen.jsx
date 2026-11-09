import { isWatcherDevice, maskPhone } from '../core/deviceSync';
import { getSettings } from '../core/store';
import { buildInvoicePdf } from '../core/invoicePdf';
import { formatCasaTransaction, formatDepositPaidMessage, formatReturnMessage, escapeHtml } from '../toolbox/telegramFormatter';
import { EventBus, EVENTS } from '../toolbox/eventBus';
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  History, Search, FileText, MessageCircle, RotateCcw,
  ChevronDown, ChevronUp, Download, Filter, Camera, Edit, AlertTriangle, Check
} from 'lucide-react';
import { Virtuoso } from 'react-virtuoso';
import db from '../core/db';
import { onStockChanged, processTelegramQueue } from '../core/telegramPublisher';
import { Logger } from '../core/logger';
import { toast } from '../components/Toaster';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import ErrorBoundary from '../components/ErrorBoundary';
import { exportRowsToExcel } from '../core/exportExcel';
import BarcodeScanner from '../components/BarcodeScanner';
import InvoiceDetailModal from '../components/InvoiceDetailModal';

const STATUS_BADGE = {
  paid:     'badge-green',
  deposit:  'badge-orange',
  preforma: 'badge-gray',
  returned: 'badge-red',
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
      position: 'relative',
      display: 'flex',
      flexDirection: 'column',
      padding: '8px',
      overflow: 'hidden',
      height: '80px',
      width: '120px',
      justifyContent: 'center',
      borderRadius: 8,
      border: '1px solid var(--border)',
      boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
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

      {url && (
        <div style={{
          position: 'absolute',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.4)',
          zIndex: 1
        }} />
      )}
      
      <div style={{ position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100%', gap: 6 }}>
        <span className="badge" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', color: 'var(--gold)', fontSize: '1.1rem', fontWeight: 'bold', border: '1px solid rgba(212,175,55,0.4)', textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}>
          {code}
        </span>
        {!url && <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 500 }}>No Image</span>}
      </div>
    </div>
  );
};

export default function HistoryScreen() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [selectedOrderAssets, setSelectedOrderAssets] = useState({});
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({});
  const [showScanner, setShowScanner] = useState(false);
  const [showPayModal, setShowPayModal] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [payingOrder, setPayingOrder] = useState(null);
  const [returnConfirmModal, setReturnConfirmModal] = useState(null);

  useEffect(() => { load(); }, []);

  const handleExport = () => {
    const rows = [['Order Number', 'Date', 'Type', 'Customer', 'Phone', 'Total Price', 'Deposit', 'Commission', 'Items Count', 'Notes']];
    orders.forEach(o => {
      const num = o.number || '';
      const date = new Date(o.date).toLocaleString().replace(/,/g, '');
      const type = (o.type || '').toUpperCase();
      const customer = o.customerName || '';
      const phone = o.customerPhone || '';
      const total = (o.totalPrice || 0).toFixed(2);
      const deposit = (o.depositAmount || 0).toFixed(2);
      const commission = (o.commission || 0).toFixed(2);
      const itemsCount = Array.isArray(o.items) ? o.items.length : 0;
      const notes = o.notes || '';
      rows.push([num, date, type, customer, phone, total, deposit, commission, itemsCount, notes]);
    });
    exportRowsToExcel(`orders_history_${Date.now()}.xlsx`, rows);
    toast.success('Exported orders to Excel');
  };

  const handleFactureReport = async () => {
    if (orders.length === 0) {
      toast.error('No invoices to report');
      return;
    }
    const typeLabel = (t) => ({
      paid: '✅ PAID',
      deposit: '🔖 DEPOSIT',
      preforma: '📄 PROFORMA',
      returned: '↩️ RETURNED',
    }[t] || (t || '').toUpperCase());

    const paid = orders.filter(o => o.type === 'paid');
    const deposits = orders.filter(o => o.type === 'deposit');
    const preformas = orders.filter(o => o.type === 'preforma');
    const returned = orders.filter(o => o.type === 'returned');
    const totalRevenue = paid.reduce((s, o) => s + (o.totalPrice || 0), 0) + deposits.reduce((s, o) => s + (o.depositAmount || 0), 0);

    const now = new Date();
    const dateStr = now.toLocaleDateString('en-GB');
    const timeStr = now.toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });

    let header = `📋 <b>FACTURES REPORT</b>\n📅 ${dateStr} 🕓 ${timeStr}\n━━━━━━━━━━━━━━━━━━━━━\n`;
    header += `🧮 Total Invoices: <b>${orders.length}</b>\n`;
    header += `✅ Paid: ${paid.length}  |  🔖 Deposit: ${deposits.length}  |  📄 Proforma: ${preformas.length}  |  ↩️ Returned: ${returned.length}\n`;
    header += `💰 Total Revenue (paid+deposits): <b>$${totalRevenue.toFixed(2)}</b>\n`;
    header += `━━━━━━━━━━━━━━━━━━━━━\n🧾 Invoices:\n`;

    const lines = orders
      .slice()
      .sort((a,b) => b.date - a.date)
      .map(o => {
        const d = new Date(o.date);
        const ds = `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`;
        const cust = escapeHtml(o.customerName || 'Walk-in');
        const num = o.number || 'INV';
        const total = Number(o.totalPrice || 0).toFixed(2);
        const dep = o.depositAmount ? ` dep $${Number(o.depositAmount).toFixed(2)}` : '';
        const comm = o.commission ? ` comm $${Number(o.commission).toFixed(2)}` : '';
        return `${typeLabel(o.type)} ${ds} ${num} — ${cust} <b>$${total}</b>${dep}${comm}`;
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
        text = `📋 <b>FACTURES REPORT</b>  (${i+1}/${chunks.length})\n━━━━━━━━━━━━━━━━━━━━━\n` + text;
      }
      await db.telegramQueue.add({
        priority: 2,
        type: 'text',
        status: 'pending',
        createdAt: Date.now(),
        attemptCount: 0,
        chatIdKey: 'factureChatId',
        text,
        refId: `facture_report_${ts}_${i}`,
      });
    }
    setTimeout(() => processTelegramQueue().catch(() => {}), 100);
    toast.success(`FACTURES report sent (${chunks.length} message${chunks.length > 1 ? 's' : ''})`);
  };

  const handleWhatsApp = (order) => {
  const generateInvoiceText = (order) => {
    const EMOJI_CLIPBOARD = '\uD83D\uDCCB';
    const EMOJI_USER = '\uD83D\uDC64';
    const EMOJI_PHONE = '\uD83D\uDCDE';
    const EMOJI_RECEIPT = '\uD83E\uDDFE';
    const EMOJI_CALENDAR = '\uD83D\uDCC5';
    const EMOJI_DOT = '\u25AB\uFE0F';
    const EMOJI_MONEY = '\uD83D\uDCB0';
    
    // Use CRLF (\r\n) for WhatsApp newlines so encodeURIComponent converts it to %0D%0A
    const nl = '\r\n';
    
    
    let orderTypeStr = (order.type || '').toUpperCase();
    const customerName = order.customerName || 'Walk-in';
    const customerPhone = order.customerPhone || '';
    const invoiceNum = order.number || 'INVOICE';
    const invoiceDate = new Date(order.date).toLocaleString('en-GB');
    const items = order.items || [];
    const discount = order.discount || 0;
    const depositAmount = order.paidAmount || 0;
    const finalTotal = order.totalPrice || 0;
    const subtotal = items.reduce((s, i) => s + (i.totalQty * (i.unitPrice || 0)), 0);
    const note = order.note || '';
    

    let text = `${EMOJI_CLIPBOARD} ${orderTypeStr}${nl}`;
    text += `━━━━━━━━━━━━━━━━━━━━━${nl}`;
    text += `${EMOJI_USER} ${customerName}${nl}`;
    if (customerPhone) text += `${EMOJI_PHONE} ${customerPhone}${nl}`;
    text += `---------------------------------------${nl}`;
    text += `${EMOJI_RECEIPT} ${invoiceNum}${nl}`;
    text += `${EMOJI_CALENDAR} ${invoiceDate}${nl}`;
    text += `--------------------------------------${nl}`;
    
    items.forEach(item => {
      const price = parseFloat(item.unitPrice || 0).toFixed(2);
      const total = (item.totalQty * parseFloat(item.unitPrice || 0)).toFixed(2);
      text += `${EMOJI_DOT} ${item.catalogCode} | ${item.colorName || item.colorCode} | ${price} × ${item.totalQty} pcs = ${total}${nl}`;
    });
    
    text += `--------------------------------------${nl}`;
    
    
    if (parseFloat(discount) > 0) {
      text += `- Discount: ${parseFloat(discount).toFixed(2)}${nl}`;
    }
    
    text += `${nl}${EMOJI_MONEY} *${finalTotal.toFixed(2)}*${nl}${nl}`;
    
    if (orderTypeStr === 'DEPOSIT') {
       text += `Deposit: ${parseFloat(depositAmount).toFixed(2)}${nl}`;
    } else if (orderTypeStr === 'PAID') {
       text += `Paid: ${finalTotal.toFixed(2)}${nl}`;
    }
    
    if (note) {
      text += `Notes: ${note}${nl}`;
    }
    
    text += `____________________________${nl}`;
    text += `_Returns and exchanges are only accepted within 2 weeks from the purchase date_${nl}`;
    return text;
  };
    const text = generateInvoiceText(order);
    const phone = (order.customerPhone || '').replace(/\D/g, '');
    let url = `https://wa.me/`;
    if (phone) url += `${phone}`;
    url += `?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  const load = async () => {
    setLoading(true);
    try {
      const all = await db.orders.orderBy('date').reverse().toArray();
      setOrders(all);
      const paid = all.filter(o => o.type === 'paid');
      const deposits = all.filter(o => o.type === 'deposit');
      const returned = all.filter(o => o.type === 'returned');
      setStats({
        total: all.length,
        totalPaid: paid.reduce((s, o) => s + (o.totalPrice || 0), 0),
        totalDeposit: deposits.reduce((s, o) => s + (o.depositAmount || 0), 0),
        totalReturned: returned.length,
      });
      Logger.info('invoices', 'loadHistory', `Loaded ${all.length} orders`);
    } catch (e) {
      Logger.error('invoices', 'loadHistory', e.message);
    }
    setLoading(false);
  };

  const handleOrderClick = async (order) => {
    setSelectedOrder(order);
    const assets = {};
    for (const item of (order.items || [])) {
      const key = item.catalogId || item.catalogCode;
      const assetKey = item.colorId ? `${key}_${item.colorId}` : key;
      if (key && !assets[assetKey]) {
        try {
          let mcs = [];
          if (item.catalogId && typeof item.catalogId === 'string') {
            mcs = await db.modelColors.where('catalogId').equals(item.catalogId).toArray();
          } else if (item.catalogCode) {
            const cats = await db.catalog.where('code').equalsIgnoreCase(item.catalogCode).toArray();
            if (cats.length > 0) {
              mcs = await db.modelColors.where('catalogId').equals(cats[0].id).toArray();
            }
          }

          let foundAsset = null;
          if (item.colorId) {
            const exactColor = mcs.find(c => c.id === item.colorId);
            if (exactColor && exactColor.assets && exactColor.assets.length > 0) {
              foundAsset = exactColor.assets[0];
            }
          }
          if (!foundAsset) {
            for (const mc of mcs) {
              if (mc.assets && mc.assets.length > 0) {
                foundAsset = mc.assets[0];
                break;
              }
            }
          }
          if (foundAsset) assets[assetKey] = foundAsset;
        } catch (e) {
          Logger.error('invoices', 'fetchAsset', e.message);
        }
      }
    }
    setSelectedOrderAssets(assets);
  };

  const filtered = orders.filter(o => {
    if (filter !== 'all' && o.type !== filter) return false;
    if (dateFrom && o.date < new Date(dateFrom).getTime()) return false;
    if (dateTo && o.date > new Date(dateTo).getTime() + 86400000) return false;
    if (q) {
      const lower = q.toLowerCase();
      return (
        o.customerName?.toLowerCase().includes(lower) ||
        o.number?.toLowerCase().includes(lower) ||
        o.items?.some(i => i.catalogCode?.toLowerCase().includes(lower)) ||
        o.customerPhone?.includes(q)
      );
    }
    return true;
  });

  const formatDate = (ts) => new Date(ts).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric'
  });

  const getGradientForType = (type) => {
    switch (type) {
      case 'paid': return 'linear-gradient(to right, rgba(16,185,129,0.06), transparent 70%)';
      case 'deposit': return 'linear-gradient(to right, rgba(245,158,11,0.06), transparent 70%)';
      case 'returned': return 'linear-gradient(to right, rgba(239,68,68,0.06), transparent 70%)';
      case 'preforma': return 'linear-gradient(to right, rgba(156,163,175,0.06), transparent 70%)';
      case 'manual_debt': return 'linear-gradient(to right, rgba(59,130,246,0.15), transparent 70%)';
      case 'payment': return 'linear-gradient(to right, rgba(16,185,129,0.15), transparent 70%)';
      default: return 'var(--surface)';
    }
  };

  const getColorClassForType = (type) => {
    switch (type) {
      case 'paid': return 'text-green';
      case 'deposit': return 'text-gold';
      case 'returned': return 'text-red';
      case 'preforma': return 'text-muted';
      case 'manual_debt': return 'text-blue';
      case 'payment': return 'text-pistachio';
      default: return 'text-gold';
    }
  };

  const handleReturn = (order, isEdit = false) => {
    setReturnConfirmModal({ type: isEdit ? 'edit' : 'return', order });
  };

  const executeEdit = (order) => {
    setReturnConfirmModal(null);
    navigate(`/new-order?editCloneId=${order.id}`);
  };

  const executeReturn = async (order) => {
    setReturnConfirmModal(null);
    try {
      const now = Date.now();
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

          onStockChanged(item.catalogId);
        }
      }
      if (stockLogs.length > 0) await db.stockLog.bulkAdd(stockLogs);

      // Treasury: refund the amount actually received from the customer
      const refundAmount = Math.max(0, Math.min(order.paidAmount || 0, order.totalPrice || 0));
      if (refundAmount > 0) {
        await db.transactions.add({
          id: crypto.randomUUID(),
          date: now,
          type: 'out',
          amount: refundAmount,
          category: 'Customer Return',
          description: `Return - ${order.customerName} - ${order.number}`,
          orderId: order.id,
          customerId: order.customerId,
        });

        // ── Casa Telegram for Return ─────────────────────────
        try {
          const allTxRet = await db.transactions.orderBy('date').toArray();
          const _sbRet = parseFloat(getSettings().startBudget) || 0;
          const _aiRet = allTxRet.filter(t => t.type === 'in').reduce((s, t) => s + (t.amount || 0), 0);
          const _aoRet = allTxRet.filter(t => t.type === 'out').reduce((s, t) => s + (t.amount || 0), 0);
          const retBal = _sbRet + _aiRet - _aoRet;
          const todayStartRet = new Date(); todayStartRet.setHours(0, 0, 0, 0);
          const todayTxRet = allTxRet.filter(t => t.date >= todayStartRet.getTime());
          const cRetIn = todayTxRet.filter(t => t.type === 'in').reduce((s, t) => s + t.amount, 0);
          const cRetOut = todayTxRet.filter(t => t.type === 'out').reduce((s, t) => s + t.amount, 0);
          await db.telegramQueue.add({
            priority: 3, type: 'text', status: 'pending',
            createdAt: Date.now(), attemptCount: 0,
            chatIdKey: 'casaChatId',
            text: formatCasaTransaction({
              type: 'out',
              amount: refundAmount,
              category: 'Return Refund',
              customerName: order.customerName,
              balanceBefore: retBal + refundAmount,
              balance: retBal,
              todayIn: cRetIn,
              todayOut: cRetOut,
            }),
          });
        } catch (tgRetErr) { Logger.warn('invoices', 'handleReturn', `Casa telegram error: ${tgRetErr.message}`); }
      }

      // ── Telegram Return Message to Facture Channel ─────────
      try {
        await db.telegramQueue.add({
          priority: 3, type: 'text', status: 'pending',
          createdAt: Date.now(), attemptCount: 0,
          chatIdKey: 'factureChatId',
          refId: order.id,
          text: formatReturnMessage(order),
        });
      } catch (tgErr) { Logger.warn('invoices', 'handleReturn', `Telegram return error: ${tgErr.message}`); }

      // If customer had remaining debt from this order, clear it
      if (order.customerId && order.type === 'deposit') {
        const cust = await db.customers.get(order.customerId);
        if (cust) {
          const remaining = (order.totalPrice || 0) - (order.paidAmount || 0);
          if (remaining > 0) {
            await db.customers.update(order.customerId, {
              credit: Math.max(0, (cust.credit || 0) - remaining)
            });
          }
        }
      }

      toast.success(`Order ${order.number} returned — ${refundAmount} refunded`);
      Logger.info('invoices', 'returnOrder', `Order returned, refund: ${refundAmount}`, { id: order.id });
      EventBus.emit(EVENTS.TREASURY_CHANGED, { room: 'invoices', ref: order.number });
      load();
    } catch (e) {
      toast.error(e.message);
      Logger.error('invoices', 'returnOrder', e.message);
    }
  };

  const handlePayBalance = async () => {
    const amount = parseFloat(payAmount);
    if (isNaN(amount) || amount <= 0) return toast.error('Invalid amount');
    try {
      const newPaid = (payingOrder.paidAmount || 0) + amount;
      await db.orders.update(payingOrder.id, {
        type: 'paid',
        paidAmount: newPaid
      });
      await db.transactions.add({
        id: crypto.randomUUID(),
        type: 'in',
        amount: amount,
        description: 'Balance payment for order #' + payingOrder.number,
        date: Date.now(),
        category: 'order',
        orderId: payingOrder.id,
        customerId: payingOrder.customerId,
      });

      // ── Casa Telegram for Balance Payment ──────────────────
      try {
        const allTxPay = await db.transactions.orderBy('date').toArray();
        const _sbPay = parseFloat(getSettings().startBudget) || 0;
        const _aiPay = allTxPay.filter(t => t.type === 'in').reduce((s, t) => s + (t.amount || 0), 0);
        const _aoPay = allTxPay.filter(t => t.type === 'out').reduce((s, t) => s + (t.amount || 0), 0);
        const payBal = _sbPay + _aiPay - _aoPay;
        const todayStartPay = new Date(); todayStartPay.setHours(0, 0, 0, 0);
        const todayTxPay = allTxPay.filter(t => t.date >= todayStartPay.getTime());
        const cPayIn = todayTxPay.filter(t => t.type === 'in').reduce((s, t) => s + t.amount, 0);
        const cPayOut = todayTxPay.filter(t => t.type === 'out').reduce((s, t) => s + t.amount, 0);
        await db.telegramQueue.add({
          priority: 3, type: 'text', status: 'pending',
          createdAt: Date.now(), attemptCount: 0,
          chatIdKey: 'casaChatId',
          text: formatCasaTransaction({
            type: 'in',
            amount: amount,
            category: 'Balance Payment',
            customerName: payingOrder.customerName,
            balanceBefore: payBal - amount,
            balance: payBal,
            todayIn: cPayIn,
            todayOut: cPayOut,
          }),
        });
        await db.telegramQueue.add({
          priority: 3, type: 'text', status: 'pending',
          createdAt: Date.now() + 1, attemptCount: 0,
          chatIdKey: 'factureChatId',
          refId: payingOrder.id,
          text: formatDepositPaidMessage(payingOrder),
        });
      } catch (tgErr) { Logger.warn('invoices', 'handlePayBalance', `Telegram error: ${tgErr.message}`); }

      toast.success('Payment recorded');
      EventBus.emit(EVENTS.TREASURY_CHANGED, { room: 'invoices', ref: payingOrder.number });
      setShowPayModal(false);
      setSelectedOrder(null);
      load();
    } catch (e) {
      toast.error(e.message);
    }
  };
  const handlePDF = async (order) => {
    try {
      const settings = await getSettings();
      let customer = null;
      if (order.customerId) {
        customer = await db.customers.get(order.customerId);
      }
      if (!customer) customer = { name: order.customerName, phone: order.customerPhone };
      const doc = await buildInvoicePdf({
        settings,
        items: order.items || [],
        customer,
        orderType: order.type,
        discount: order.discount || 0,
        depositAmount: order.depositAmount || 0,
        note: order.note || order.notes || '',
        invoiceNo: order.number || '',
        when: order.date || Date.now(),
      });

      const pdfBase64 = doc.output('datauristring').split(',')[1];
      const fileName = `Invoice_${(order.customerName || 'Walk-in').replace(/\s+/g, '_')}_${Date.now()}.pdf`;

      const savedFile = await Filesystem.writeFile({
        path: fileName,
        data: pdfBase64,
        directory: Directory.Cache
      });

      try {
        await Share.share({
          title: 'Invoice',
          url: savedFile.uri,
          dialogTitle: 'Share Invoice'
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
      toast.error('Failed to generate PDF: ' + e.message);
    }
  };

  const OrderCard = ({ order }) => {

    return (
      <div style={{
        background: getGradientForType(order.type), 
        backgroundColor: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 10, overflow: 'hidden', marginBottom: 6,
        transition: 'border-color 0.2s',
      }}>
        <div
          style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', cursor: 'pointer' }}
          onClick={() => handleOrderClick(order)}
        >
          <div style={{ width: 85, flexShrink: 0, display: 'flex', justifyContent: 'center' }}>
            <span className={`badge ${STATUS_BADGE[order.type] || 'badge-gray'}`} style={{ width: '100%', justifyContent: 'center' }}>
              {order.type === 'preforma' ? 'NO PAID' : order.type === 'manual_debt' ? 'CREDIT' : (order.type || '').toUpperCase()}
            </span>
          </div>
          <div style={{ width: 90, flexShrink: 0 }}>
            <div className="text-muted" style={{ fontSize: '0.75rem' }}>{order.number}</div>
            <div className="text-xs text-muted">{formatDate(order.date)}</div>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className={`text-bold text-ellipsis ${getColorClassForType(order.type)}`}>{order.customerName}</div>
            <div className="text-xs text-muted text-ellipsis">
              {maskPhone(order.customerPhone) || '—'}
            </div>
          </div>
          
          {!isWatcherDevice() && order.type === 'deposit' && (
            <div style={{ padding: '0 10px' }} onClick={e => e.stopPropagation()}>
              <button 
                className="btn btn-success btn-sm" 
                style={{ fontSize: '0.75rem', padding: '4px 8px' }}
                onClick={() => {
                  setPayingOrder(order);
                  setPayAmount((order.totalPrice - (order.paidAmount || 0)).toFixed(2));
                  setShowPayModal(true);
                }}
              >
                Pay Now
              </button>
            </div>
          )}
          <div style={{ display: 'flex', gap: 6 }} onClick={e => e.stopPropagation()}>
            {/* HIDDEN Edit button (preforma) — re-enable by removing these comment markers
            {order.type === 'preforma' && (
              <button className="btn btn-orange btn-sm btn-icon" title="Edit Preforma" onClick={() => navigate(`/new-order?editId=${order.id}`)}>
                <Edit size={13}/>
              </button>
            )}
            */}
            {/* HIDDEN Edit button (paid/deposit) — re-enable by removing these comment markers
            {!isWatcherDevice() && (order.type === 'paid' || order.type === 'deposit') && (
              <button className="btn btn-orange btn-sm btn-icon" title="Edit Invoice (Returns and creates new)" onClick={() => handleReturn(order, true)}>
                <Edit size={13}/>
              </button>
            )}
            */}
            {order.customerPhone && (
              <button className="btn btn-success btn-sm btn-icon" title="WhatsApp" onClick={(e) => { e.stopPropagation(); handleWhatsApp(order); }}><MessageCircle size={13}/></button>
            )}
            <button className="btn btn-secondary btn-sm btn-icon" title="PDF" onClick={(e) => { e.stopPropagation(); handlePDF(order); }}><FileText size={13}/></button>
          </div>
          <div style={{ textAlign: 'right', minWidth: 80 }}>
            {order.type === 'deposit' ? (
              <>
                <div className={`text-bold ${getColorClassForType(order.type)}`}>${(order.paidAmount || 0).toFixed(2)}</div>
                <div className="text-xs text-muted">Total: ${(order.totalPrice || 0).toFixed(2)}</div>
              </>
            ) : (
              <>
                <div className={`text-bold ${getColorClassForType(order.type)}`}>${(order.totalPrice || 0).toFixed(2)}</div>
              </>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <ErrorBoundary room="history">
      <div className="page-container fade-in">
        <div className="page-header">
          <div className="page-title"><History size={22} /> HISTORY</div>
          <div className="page-actions">
            <button className="btn btn-secondary btn-sm" onClick={handleFactureReport}><FileText size={13}/> RAPORT</button>
            <button className="btn btn-secondary btn-sm" onClick={handleExport}><Download size={13}/> Export Excel</button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid-4" style={{ marginBottom: 16 }}>
          <div className="stat-card"><div className="stat-label">Total Orders</div><div className="stat-value">{stats.total || 0}</div></div>
          <div className="stat-card"><div className="stat-label">Total Revenue</div><div className="stat-value green">${(stats.totalPaid || 0).toFixed(2)}</div></div>
          <div className="stat-card"><div className="stat-label">Deposits Collected</div><div className="stat-value text-gold">${(stats.totalDeposit || 0).toFixed(2)}</div></div>
          <div className="stat-card"><div className="stat-label">Returned</div><div className="stat-value red">{stats.totalReturned || 0}</div></div>
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
            <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
            <input className="search-input" placeholder="Customer, model, invoice#..." value={q} onChange={e => setQ(e.target.value)} />
          </div>
          <button className="btn btn-secondary btn-icon" onClick={() => setShowScanner(true)} title="Scan Barcode">
            <Camera size={18} />
          </button>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ width: 150 }} />
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{ width: 150 }} />
        </div>

        <div className="filters-bar">
          {['all', 'paid', 'deposit', 'preforma', 'returned', 'manual_debt'].map(f => (
            <button key={f} className={`filter-btn ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
              {f === 'preforma' ? 'NO PAID' : f === 'manual_debt' ? 'CREDIT' : f.replace('_', ' ').toUpperCase()}
            </button>
          ))}
        </div>

        {/* Orders List */}
        {loading ? (
          <div className="empty-state"><div className="spin" style={{ width: 28, height: 28, border: '3px solid var(--gold)', borderTopColor: 'transparent', borderRadius: '50%' }} /></div>
        ) : filtered.length === 0 ? (
          <div className="empty-state"><History size={48}/><h3>No orders found</h3></div>
        ) : (
          <div>
            {filtered.map(order => <OrderCard key={order.id} order={order} />)}
          </div>
        )}
      </div>

      {/* Invoice Detail Modal */}
      {selectedOrder && (
        <InvoiceDetailModal 
          order={selectedOrder} 
          onClose={() => setSelectedOrder(null)} 
          onRefresh={load} 
        />
      )}

      {/* Barcode Scanner */}
      {showScanner && (
        <BarcodeScanner
          onScan={(code) => {
            setShowScanner(false);
            setQ(code);
          }}
          onClose={() => setShowScanner(false)}
        />
      )}

      {showPayModal && payingOrder && (
        <div className="modal-overlay" onClick={() => setShowPayModal(false)}>
          <div className="modal-box" style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
            <div className="modal-title">Pay Balance</div>
            <div style={{ marginBottom: 16 }}>
              <div>Order #{payingOrder.number}</div>
              <div className="text-muted text-sm">
                Remaining Balance: ${(payingOrder.totalPrice - (payingOrder.paidAmount || 0)).toFixed(2)}
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

      {/* Return / Edit Confirmation Modal */}
      {returnConfirmModal && (
        <div className="modal-overlay" onClick={() => setReturnConfirmModal(null)} style={{ zIndex: 1100 }}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{
            maxWidth: 440,
            border: returnConfirmModal.type === 'edit' ? '1px solid rgba(212, 175, 55, 0.5)' : '1px solid rgba(239, 68, 68, 0.5)',
            background: '#0d0d0d',
            boxShadow: '0 20px 60px rgba(0,0,0,0.85)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
              <div style={{
                width: 46, height: 46, borderRadius: 12,
                background: returnConfirmModal.type === 'edit' ? 'rgba(212, 175, 55, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                border: returnConfirmModal.type === 'edit' ? '1px solid rgba(212, 175, 55, 0.35)' : '1px solid rgba(239, 68, 68, 0.35)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: returnConfirmModal.type === 'edit' ? 'var(--gold)' : 'var(--red)',
                flexShrink: 0
              }}>
                {returnConfirmModal.type === 'edit' ? <Edit size={24} /> : <RotateCcw size={26} />}
              </div>
              <div>
                <div style={{ fontSize: '1.2rem', fontWeight: 700, color: returnConfirmModal.type === 'edit' ? 'var(--gold)' : 'var(--red)', letterSpacing: 0.5 }}>
                  {returnConfirmModal.type === 'edit' ? 'Edit Invoice' : 'Return Invoice'}
                </div>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                  Invoice #{returnConfirmModal.order.number}
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
                <span className="text-bold text-gold">{returnConfirmModal.order.customerName}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: '0.9rem' }}>
                <span className="text-muted">Invoice Total:</span>
                <span className="text-bold">${(returnConfirmModal.order.totalPrice || 0).toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <span className="text-muted" style={{ fontWeight: 600, fontSize: '0.95rem' }}>{returnConfirmModal.type === 'edit' ? 'Paid Amount:' : 'Return Cash:'}</span>
                <span className="text-bold" style={{ fontSize: returnConfirmModal.type === 'edit' ? '0.9rem' : '1.9rem', color: returnConfirmModal.type === 'edit' ? 'var(--green)' : 'var(--red)', letterSpacing: 0.5 }}>
                  ${(returnConfirmModal.order.paidAmount || 0).toFixed(2)}
                </span>
              </div>

              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10, fontSize: '0.82rem', color: 'var(--text-sec)', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {returnConfirmModal.type === 'edit' ? (
                  <>
                    <div>📝 A new draft will open with this invoice's items.</div>
                    <div>🔄 When you save the new draft, this invoice will be automatically returned (reversing stock & payments).</div>
                  </>
                ) : (
                  <>
                    <div>📦 <strong>Stock:</strong> All items in this invoice will be restored to inventory stock.</div>
                    <div>💵 <strong>Treasury:</strong> ${(returnConfirmModal.order.paidAmount || 0).toFixed(2)} will be refunded from Casa.</div>
                  </>
                )}
              </div>
            </div>

            <div style={{ fontSize: '0.86rem', color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: 20, textAlign: 'center' }}>
              {returnConfirmModal.type === 'edit' ? 'Do you want to proceed and edit this invoice?' : 'Are you sure you want to return this invoice?'}
            </div>

            <div className="modal-actions" style={{ marginTop: 0, paddingTop: 16, display: 'flex', gap: 12 }}>
              <button
                className="btn btn-secondary"
                style={{ flex: 1, padding: '12px', justifyContent: 'center', fontSize: '0.95rem' }}
                onClick={() => setReturnConfirmModal(null)}
              >
                Cancel
              </button>
              <button
                className={returnConfirmModal.type === 'edit' ? 'btn btn-primary' : 'btn btn-danger'}
                style={{
                  flex: 1.3,
                  padding: '12px',
                  justifyContent: 'center',
                  background: returnConfirmModal.type === 'edit' ? 'linear-gradient(135deg, #d4af37, #aa820a)' : 'linear-gradient(135deg, #ef4444, #dc2626)',
                  color: returnConfirmModal.type === 'edit' ? '#000' : '#fff',
                  fontWeight: 700,
                  fontSize: '0.95rem',
                  border: 'none'
                }}
                onClick={() => returnConfirmModal.type === 'edit' ? executeEdit(returnConfirmModal.order) : executeReturn(returnConfirmModal.order)}
              >
                <Check size={18} style={{ marginRight: 6 }} /> {returnConfirmModal.type === 'edit' ? 'Proceed to Edit' : 'Confirm Return'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ErrorBoundary>
  );
}
