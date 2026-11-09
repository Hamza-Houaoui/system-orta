import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ShoppingBag, Search, Plus, Trash2, ChevronDown,
  FileText, MessageCircle, Send, Check, User, X, Camera, Barcode, AlertTriangle
} from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import db from '../core/db';
import { Logger } from '../core/logger';
import { toast } from '../components/Toaster';
import { EventBus, EVENTS } from '../toolbox/eventBus';
import { onStockChanged } from '../core/telegramPublisher';
import { formatOrderMessage, formatCasaTransaction } from '../toolbox/telegramFormatter';
import ErrorBoundary from '../components/ErrorBoundary';
import BarcodeScanner from '../components/BarcodeScanner';
import COUNTRIES from '../core/countries.json';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { loadTelegramMedia } from '../core/telegramMedia';
import { getSettings } from '../core/store';
import { getDeviceId, isWatcherDevice, maskPhone } from '../core/deviceSync';
import { buildInvoicePdf } from '../core/invoicePdf';

const Thumbnail = ({ asset, width = 40, height = 40 }) => {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    if (!asset?.blob) return;
    const objectUrl = URL.createObjectURL(asset.blob);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [asset]);

  if (!url) return <div style={{ width, height, borderRadius: 6, background: 'var(--surface-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: width < 50 ? '0.6rem' : '0.8rem', color: 'var(--text-muted)' }}>No Img</div>;

  return (
    <div style={{ width, height, borderRadius: 8, overflow: 'hidden', flexShrink: 0, border: '1px solid var(--border)' }}>
      {asset.type === 'video' ? (
        <video src={url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} muted loop autoPlay />
      ) : (
        <img src={url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="thumb" />
      )}
    </div>
  );
};

const TableCellImage = ({ asset, code }) => {
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
      padding: '4px', overflow: 'hidden', height: '60px', width: '90px',
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
      <div style={{ position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100%', gap: 4 }}>
        <span className="badge" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', color: 'var(--gold)', fontSize: '0.9rem', fontWeight: 'bold', border: '1px solid rgba(212,175,55,0.4)', textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}>
          {code}
        </span>
        {!url && <span style={{ color: 'var(--text-muted)', fontSize: '0.65rem', fontWeight: 500 }}>No Image</span>}
      </div>
    </div>
  );
};

const getFlag = (country) => COUNTRIES.find(c => c.name === country)?.flag || '🌍';

const ORDER_TYPES = ['paid', 'deposit', 'preforma'];

const formatInvoiceDate = (ts) => {
  const d = new Date(ts);
  const yy = String(d.getFullYear()).slice(-2);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yy}${mm}${dd}`;
};

export default function NewOrderScreen() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preCustomerId = searchParams.get('customer');
  const editId = searchParams.get('editId');
  const cloneId = searchParams.get('cloneId');
  const editCloneId = searchParams.get('editCloneId');

  // Customer state
  const [customerQ, setCustomerQ] = useState('');
  const [customerResults, setCustomerResults] = useState([]);
  const [customer, setCustomer] = useState(null);
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [newCust, setNewCust] = useState({ name: '', phone: '', country: 'Tanzania' });

  // Model search
  const [modelQ, setModelQ] = useState('');
  const [modelResult, setModelResult] = useState(null);
  const [availableColors, setAvailableColors] = useState([]);
  const [selectedColor, setSelectedColor] = useState(null);
  const [sizeQtys, setSizeQtys] = useState({});
  const [seriesInfo, setSeriesInfo] = useState(null);

  // Invoice items
  const [items, setItems] = useState([]);

  // Invoice settings
  const [orderType, setOrderType] = useState(null);
  const [discount, setDiscount] = useState('');
  const [depositAmount, setDepositAmount] = useState('');
  const [paidExact, setPaidExact] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [stockWarningModal, setStockWarningModal] = useState(null);
  const generateInvoiceText = (invoiceNo) => {
    const EMOJI_CLIPBOARD = '\uD83D\uDCCB';
    const EMOJI_USER = '\uD83D\uDC64';
    const EMOJI_PHONE = '\uD83D\uDCDE';
    const EMOJI_RECEIPT = '\uD83E\uDDFE';
    const EMOJI_CALENDAR = '\uD83D\uDCC5';
    const EMOJI_DOT = '\u25AB\uFE0F';
    const EMOJI_MONEY = '\uD83D\uDCB0';
    
    // Use CRLF (\r\n) for WhatsApp newlines so encodeURIComponent converts it to %0D%0A
    const nl = '\r\n';
    
    
    let orderTypeStr = (orderType || 'NEW ORDER').toUpperCase();
    const customerName = customer?.name || 'Walk-in';
    const customerPhone = customer?.phone || '';
    const invoiceNum = invoiceNo || 'INVOICE';
    const invoiceDate = new Date().toLocaleString('en-GB');
    

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
    const subtotal = items.reduce((s, i) => s + (i.totalQty * (i.unitPrice || 0)), 0);
    const finalTotal = subtotal - (parseFloat(discount) || 0);
    
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

  const handleWhatsApp = async () => {
    const now = Date.now();
    const invDateStr = formatInvoiceDate(now);
    const invPrefix = `INV-D${getDeviceId()}-${invDateStr}-`;
    const invTodayOrders = await db.orders.where('number').startsWith(invPrefix).toArray();
    let invSeq = 0;
    invTodayOrders.forEach(o => {
      const parts = (o.number || '').split('-');
      const seq = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(seq) && seq > invSeq) invSeq = seq;
    });
    const invoiceNo = `${invPrefix}${String(invSeq + 1).padStart(4, '0')}`;

    const text = generateInvoiceText(invoiceNo);
    const phone = (customer?.phone || '').replace(/\D/g, '');
    let url = `https://wa.me/`;
    if (phone) url += `${phone}`;
    url += `?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
    saveOrder();
  };

  const handlePDF = async () => {
    try {
      const settings = await getSettings();

      // Compute the next invoice number (same logic as saveOrder) so it shows on
      // the PDF and matches the order that gets saved after generating.
      const now = Date.now();
      const invDateStr = formatInvoiceDate(now);
      const invPrefix = `INV-D${getDeviceId()}-${invDateStr}-`;
      const invTodayOrders = await db.orders.where('number').startsWith(invPrefix).toArray();
      let invSeq = 0;
      invTodayOrders.forEach(o => {
        const parts = (o.number || '').split('-');
        const seq = parseInt(parts[parts.length - 1], 10);
        if (!isNaN(seq) && seq > invSeq) invSeq = seq;
      });
      const invoiceNo = `${invPrefix}${String(invSeq + 1).padStart(4, '0')}`;

      const doc = await buildInvoicePdf({
        settings,
        items,
        customer,
        orderType,
        discount,
        depositAmount,
        note,
        invoiceNo,
        when: now,
      });

      const pdfBase64 = doc.output('datauristring').split(',')[1];
      const fileName = `Invoice_${(customer?.name || 'Walk-in').replace(/\s+/g, '_')}_${Date.now()}.pdf`;

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
      saveOrder();
    } catch (e) {
      toast.error('Failed to generate PDF: ' + e.message);
    }
  };
  const [step3Visible, setStep3Visible] = useState(false);
  const [step4Visible, setStep4Visible] = useState(false);

  // Colors & size series
  const [allColors, setAllColors] = useState([]);
  const [allSeries, setAllSeries] = useState([]);

  // Reset invoice state when items are empty
  useEffect(() => {
    if (items.length === 0 && !editId && !cloneId && !editCloneId) {
      setOrderType(isWatcherDevice() ? 'preforma' : null);
      setStep3Visible(false);
      setStep4Visible(false);
      setDiscount('');
      setDepositAmount('');
      setPaidExact('');
      setNote('');
    }
  }, [items.length, editId, cloneId, editCloneId]);

  const customerInputRef = useRef();
  const modelInputRef = useRef();

  useEffect(() => {
    loadColors();
    if (preCustomerId) loadPreCustomer(preCustomerId);
    if (editId) loadOrderForEdit(editId);
    if (cloneId) loadOrderForEdit(cloneId);
    if (editCloneId) loadOrderForEdit(editCloneId);
  }, []);

  const loadOrderForEdit = async (id) => {
    const order = await db.orders.get(id);
    if (!order) return;
    
    if (order.customerId) {
      const c = await db.customers.get(order.customerId);
      if (c) setCustomer(c);
    }
    
    const loadedItems = order.items || [];
    
    // Lazy load any missing images for loaded items
    for (let i = 0; i < loadedItems.length; i++) {
        const item = loadedItems[i];
        if (item.firstAsset && item.firstAsset.fileId && !item.firstAsset.blob) {
            // We need colorId to save back to DB, we can query it using catalogId and colorId
            db.modelColors.where({ catalogId: item.catalogId }).toArray().then(mcs => {
                const mc = mcs.find(m => m.colorId === item.colorId);
                if (mc) {
                    loadTelegramMedia(item.firstAsset, mc.id).then(blob => {
                        if (blob) {
                            setItems(prev => {
                                const next = [...prev];
                                const idx = next.findIndex(x => x.id === item.id);
                                if (idx >= 0) {
                                    next[idx].firstAsset = { ...next[idx].firstAsset, blob };
                                }
                                return next;
                            });
                        }
                    });
                }
            });
        }
    }
    
    setItems(loadedItems);
    setOrderType(order.type);
    setDiscount(order.discount ? order.discount.toString() : '');
    if (order.type === 'deposit') setDepositAmount(order.depositAmount ? order.depositAmount.toString() : '');
    if (order.type === 'paid') setPaidExact(order.paidAmount ? order.paidAmount.toString() : '');
    setNote(order.note || '');
    
    setStep3Visible(true);
    setStep4Visible(true);
  };

  const loadColors = async () => {
    const colors = await db.colors.toArray();
    const series = await db.sizeSeries.toArray();
    setAllColors(colors);
    setAllSeries(series);
  };

  const loadPreCustomer = async (id) => {
    const c = await db.customers.get(id);
    if (c) setCustomer(c);
  };

  // ── Customer search ──────────────────────────────────────
  const searchCustomer = async (q) => {
    setCustomerQ(q);
    if (!q.trim()) { setCustomerResults([]); return; }
    const all = await db.customers.toArray();
    const res = all.filter(c =>
      c.name?.toLowerCase().includes(q.toLowerCase()) ||
      c.phone?.includes(q)
    ).slice(0, 6);
    setCustomerResults(res);
  };

  const selectCustomer = (c) => {
    setCustomer(c);
    setCustomerQ('');
    setCustomerResults([]);
  };

  const addNewCustomer = async () => {
    if (!newCust.name.trim()) { toast.error('Name required'); return; }
    const id = uuidv4();
    await db.customers.add({ id, ...newCust, credit: 0, createdAt: Date.now() });
    const c = { id, ...newCust, credit: 0 };
    setCustomer(c);
    setShowAddCustomer(false);
    setNewCust({ name: '', phone: '', country: 'Tanzania' });
    toast.success('Customer added');
  };

  const [modelSuggestions, setModelSuggestions] = useState([]);
  const [showScanner, setShowScanner] = useState(false);

  // ── Model search ─────────────────────────────────────────
  const searchModel = async (q, isBarcode = false) => {
    setModelQ(q);
    
    if (!q.trim()) {
      setModelSuggestions([]);
      return;
    }

    const qTrim = q.trim();
    
    if (qTrim.toUpperCase().includes('T.ME/')) {
      const allMc = await db.modelColors.toArray();
      const match = allMc.find(mc => mc.link && mc.link.includes(qTrim));
      if (match) {
        const cat = await db.catalog.get(match.catalogId);
        if (cat) {
          selectModelFromSuggestion(cat, match.id);
        }
      }
      setModelSuggestions([]);
      return;
    }

    const all = await db.catalog.toArray();
    
    if (isBarcode) {
      // 1. Try exact Model Code
      const exactMatch = all.find(c => c.code.toLowerCase() === qTrim.toLowerCase());
      if (exactMatch) {
        selectModelFromSuggestion(exactMatch);
        return true;
      }
      
      // 2. Try Combined Barcode (ModelCode + ColorCode)
      const allMc = await db.modelColors.toArray();
      const allColors = await db.colors.toArray();
      let matchedModelId = null;
      let matchedColorId = null;
      
      for (const mc of allMc) {
          const m = all.find(cat => cat.id === mc.catalogId);
          const c = allColors.find(col => col.id === mc.colorId);
          if (m && c) {
              const combinedCode = `${m.code}${c.code || ''}`.toLowerCase();
              if (combinedCode === qTrim.toLowerCase()) {
                  matchedModelId = m.id;
                  matchedColorId = mc.id;
                  break;
              }
          }
      }
      
      if (matchedModelId) {
          const modelMatch = all.find(m => m.id === matchedModelId);
          if (modelMatch) {
             selectModelFromSuggestion(modelMatch, matchedColorId);
             return true;
          }
      }

      toast.error(`Model with code or barcode "${qTrim}" not found`);
      setModelSuggestions([]);
      return false;
    }

    const matches = all.filter(c => c.code.toLowerCase().startsWith(qTrim.toLowerCase())).slice(0, 8);
    
    // Attach firstAsset for the dropdown thumbnail and fetch sizes
    for (const m of matches) {
      if (m.sizeSeriesId) {
        const series = await db.sizeSeries.get(m.sizeSeriesId);
        if (series) m.sizesString = series.sizes?.join('-');
      }

      let assetColorId = null;
      if (m.assets?.[0]) {
        m.firstAsset = m.assets[0];
      } else {
        const mColors = await db.modelColors.where('catalogId').equals(m.id).toArray();
        for (const mc of mColors) {
          if (mc.assets?.[0]) {
            m.firstAsset = mc.assets[0];
            assetColorId = mc.id;
            break;
          }
        }
      }

      if (m.firstAsset && m.firstAsset.fileId && !m.firstAsset.blob && assetColorId) {
         loadTelegramMedia(m.firstAsset, assetColorId).then(blob => {
            if (blob) {
                m.firstAsset.blob = blob;
                setModelSuggestions(prev => [...prev]);
                setModelResult(prev => prev && prev.id === m.id ? { ...prev, firstAsset: m.firstAsset } : prev);
            }
         });
      }
    }
    
    setModelSuggestions(matches);
  };

  const selectModelFromSuggestion = async (cat, autoSelectColorId = null) => {
    setModelSuggestions([]);
    setModelQ('');
    setModelResult(null);
    setAvailableColors([]);
    setSelectedColor(null);
    setSizeQtys({});

    if (!cat) return;

    const mColors = await db.modelColors.where('catalogId').equals(cat.id).toArray();
    const series = cat.sizeSeriesId ? await db.sizeSeries.get(cat.sizeSeriesId) : null;

    const colors = mColors.map(mc => {
      const colorDef = allColors.find(c => c.id === mc.colorId) || {};
      const stock = mc.stock || [];
      const total = stock.reduce((s, x) => s + (x.qty || 0), 0);
      return { ...mc, colorName: colorDef.name || mc.colorCode, hex: colorDef.hex, stock, total };
    });

    let firstAsset = cat.assets?.[0];
    if (!firstAsset) {
      for (const mc of colors) {
        if (mc.assets && mc.assets.length > 0) {
          firstAsset = mc.assets[0];
          break;
        }
      }
    }

    const factory = cat.factoryId ? await db.factories.get(cat.factoryId) : null;
    const factoryName = (factory && factory.name) ? factory.name : 'Unknown Factory';

    setModelResult({ ...cat, series, firstAsset, factoryName });
    setAvailableColors(colors);
    setSeriesInfo(series);

    if (autoSelectColorId) {
      const colorToSelect = colors.find(c => c.id === autoSelectColorId);
      if (colorToSelect) selectColor(colorToSelect);
    }

    // Lazy load any missing images for available colors
    for (const col of colors) {
       if (col.assets) {
          for (const asset of col.assets) {
             if (asset.fileId && !asset.blob) {
                 loadTelegramMedia(asset, col.id).then(blob => {
                    if (blob) {
                        asset.blob = blob;
                        setAvailableColors(prev => prev.map(c => c.id === col.id ? { ...c, assets: [...col.assets] } : c));
                        // If this is the selected model's firstAsset, update it too
                        setModelResult(prev => prev && prev.firstAsset?.id === asset.id ? { ...prev, firstAsset: { ...prev.firstAsset, blob } } : prev);
                        // If this color is selected, update it too
                        setSelectedColor(prev => prev && prev.id === col.id ? { ...prev, assets: [...col.assets] } : prev);
                    }
                 });
             }
          }
       }
    }
  };

  const selectColor = (mc) => {
    setSelectedColor(mc);
    const qtys = {};
    (mc.stock || []).forEach(s => { qtys[s.size] = 1; });
    setSizeQtys(qtys);
  };

  const changeAllSizes = (delta) => {
    setSizeQtys(prev => {
      const next = { ...prev };
      Object.keys(next).forEach(sz => {
        let current = parseInt(next[sz]) || 0;
        let newQty = current + delta;
        if (newQty < 0) newQty = 0;
        next[sz] = newQty === 0 ? '' : newQty.toString();
      });
      return next;
    });
  };

  const changeSingleSize = (size, delta) => {
    setSizeQtys(prev => {
      const next = { ...prev };
      let current = parseInt(next[size]) || 0;
      let newQty = current + delta;
      if (newQty < 0) newQty = 0;
      next[size] = newQty === 0 ? '' : newQty.toString();
      return next;
    });
  };

  // Compute if order is complete series or broken
  const computeSeriesType = (qtys, series) => {
    if (!series) return 'broken';
    const sizes = series.sizes || [];
    const pcs = series.piecesPerSerie || sizes.length;
    const counts = sizes.map(sz => parseInt(qtys[sz]) || 0);
    const minQty = Math.min(...counts);
    if (minQty > 0 && counts.every(q => q === minQty)) return 'complete';
    return 'broken';
  };

  const getUnitPrice = (model, seriesType) => {
    if (seriesType === 'complete') return model.wholesalePrice || 0;
    return model.retailPrice || model.wholesalePrice || 0;
  };

  const commitAddItem = (item) => {
    setItems(prev => [...prev, item]);
    setModelQ('');
    setModelResult(null);
    setAvailableColors([]);
    setSelectedColor(null);
    setSizeQtys({});
    setStockWarningModal(null);
    modelInputRef.current?.focus();
  };

  const addToInvoice = () => {
    if (!modelResult || !selectedColor) { toast.error('Select model and color'); return; }
    const totalQty = Object.values(sizeQtys).reduce((s, v) => s + (parseInt(v) || 0), 0);
    if (totalQty === 0) { toast.error('Enter at least 1 piece'); return; }

    // Check stock — gather any exceeded sizes
    const overDetails = [];
    (seriesInfo?.sizes || Object.keys(sizeQtys)).forEach(sz => {
      const ordered = parseInt(sizeQtys[sz]) || 0;
      const avail = (selectedColor.stock || []).find(s => s.size === sz)?.qty || 0;
      if (ordered > avail) {
        overDetails.push({ size: sz, ordered, avail });
      }
    });

    const seriesType = computeSeriesType(sizeQtys, seriesInfo);
    const unitPrice = getUnitPrice(modelResult, seriesType);
    const sizes = Object.entries(sizeQtys)
      .filter(([, q]) => parseInt(q) > 0)
      .map(([size, qty]) => ({ size, qty: parseInt(qty) }));

    const item = {
      id: uuidv4(),
      catalogId: modelResult.id,
      catalogCode: modelResult.code,
      colorId: selectedColor.colorId,
      colorName: selectedColor.colorName,
      hex: selectedColor.hex,
      firstAsset: selectedColor.assets?.[0] || modelResult.firstAsset,
      sizes,
      totalQty,
      unitPrice,
      totalPrice: totalQty * unitPrice,
      seriesType,
    };

    if (overDetails.length > 0) {
      setStockWarningModal({
        modelCode: modelResult.code,
        colorName: selectedColor.colorName || selectedColor.colorCode || '',
        totalQty,
        overDetails,
        item,
      });
      return;
    }

    commitAddItem(item);
  };

  const removeItem = (id) => setItems(prev => prev.filter(i => i.id !== id));

  // ── Totals ───────────────────────────────────────────────
  const subtotal = items.reduce((s, i) => s + i.totalPrice, 0);
  const discountVal = parseFloat(discount) || 0;
  const total = subtotal - discountVal;
  const depositVal = parseFloat(depositAmount) || 0;
  let paidVal = parseFloat(paidExact) || total;
  if (orderType === 'paid' && paidVal < total) paidVal = total;
  const finalOrderType = orderType;
  
  const commission = finalOrderType === 'paid' ? paidVal - total : 0;
  const remaining = finalOrderType === 'deposit' ? total - depositVal : 0;

  // Actual cash physically received from the customer (Casa Cash)
  const receivedAmount = orderType === 'paid' ? (parseFloat(paidExact) || total) : depositVal;
  // Agent commission = the difference between invoice total and what was actually received
  const storedCommission = orderType === 'paid' && receivedAmount > 0 ? Math.max(0, total - receivedAmount) : 0;

  // ── Save Order ───────────────────────────────────────────
  const saveOrder = async () => {
    if (!customer) { toast.error('Select a customer'); return; }
    if (items.length === 0) { toast.error('Add at least one item'); return; }
    if (!orderType) { toast.error('Please select an order type (Step 1)'); return; }
    setSaving(true);

    try {


      let orderId = uuidv4();
      let number;
      const now = Date.now();
      let createdAt = now;

      if (editId) {
        const existing = await db.orders.get(editId);
        if (existing) {
          if (existing.type !== 'preforma') {
            toast.error('Cannot edit a finalized order directly. Please return it first.');
            setSaving(false);
            return;
          }
          orderId = existing.id;
          number = existing.number;
          createdAt = existing.createdAt || now;
        }
      }

      // editCloneId: auto-return the original order silently, then create new
      if (editCloneId) {
        const original = await db.orders.get(editCloneId);
        if (original && original.type !== 'returned') {
          // Restore stock
          for (const item of original.items || []) {
            const mc = await db.modelColors.where('catalogId').equals(item.catalogId).and(m => m.colorId === item.colorId).first();
            if (mc) {
              const stockMap = {};
              (mc.stock || []).forEach(s => stockMap[s.size] = s.qty);
              (item.sizes || []).forEach(({ size, qty }) => { stockMap[size] = (stockMap[size] || 0) + qty; });
              await db.modelColors.update(mc.id, { stock: Object.entries(stockMap).map(([size, qty]) => ({ size, qty })) });
            }
          }
          // Refund treasury
          const refundAmt = Math.max(0, Math.min(original.paidAmount || 0, original.totalPrice || 0));
          if (refundAmt > 0) {
            await db.transactions.add({
              id: uuidv4(), date: now, type: 'out', amount: refundAmt,
              category: 'Customer Return',
              description: `Return (Edit) - ${original.customerName} - ${original.number}`,
              orderId: original.id, customerId: original.customerId,
            });
            // ── Casa Telegram for Return (Edit) ─────────────────────
            try {
              const allTxRetCasa = await db.transactions.orderBy('date').toArray();
              const _sbRet = parseFloat(getSettings().startBudget) || 0;
              const _aiRet = allTxRetCasa.filter(t => t.type === 'in').reduce((s,t) => s + (t.amount||0), 0);
              const _aoRet = allTxRetCasa.filter(t => t.type === 'out').reduce((s,t) => s + (t.amount||0), 0);
              const retBal = _sbRet + _aiRet - _aoRet;
              const todayStartRet = new Date(); todayStartRet.setHours(0,0,0,0);
              const todayTxRet = allTxRetCasa.filter(t => t.date >= todayStartRet.getTime());
              const cTodayInRet = todayTxRet.filter(t => t.type === 'in').reduce((s,t) => s + t.amount, 0);
              const cTodayOutRet = todayTxRet.filter(t => t.type === 'out').reduce((s,t) => s + t.amount, 0);
              await db.telegramQueue.add({
                priority: 3, type: 'text', status: 'pending',
                createdAt: Date.now(), attemptCount: 0,
                chatIdKey: 'casaChatId',
                text: formatCasaTransaction({
                  type: 'out',
                  amount: refundAmt,
                  category: 'Return Refund',
                  customerName: original.customerName,
                  balanceBefore: retBal + refundAmt,
                  balance: retBal,
                  todayIn: cTodayInRet,
                  todayOut: cTodayOutRet,
                }),
              });
            } catch(tgRetErr) { Logger.warn('invoices', 'saveOrder', `Casa telegram error: ${tgRetErr.message}`); }
          }
          // Mark original as returned
          await db.orders.update(editCloneId, { type: 'returned', status: 'returned' });
        }
      }

      // Number generation moved inside transaction

      const order = {
        id: orderId,
        number,
        date: now,
        type: finalOrderType,
        status: finalOrderType,
        customerId: customer.id,
        customerName: customer.name,
        customerPhone: customer.phone,
        items,
        subtotal,
        discount: discountVal,
        totalPrice: total,
        paidAmount: finalOrderType === 'paid' ? receivedAmount : depositVal,
        depositAmount: finalOrderType === 'deposit' ? depositVal : 0,
        commission: Math.max(storedCommission, commission > 0 ? commission : 0),
        note,
        createdAt: createdAt,
      };

      const catalogIdsToUpdate = new Set();
      const actualAmountPaid = finalOrderType === 'paid' ? (parseFloat(paidExact) || total) : (parseFloat(depositAmount) || 0);
      
      await db.transaction('rw', [db.orders, db.modelColors, db.stockLog, db.transactions, db.telegramQueue, db.telegramMessages, db.catalog, db.customers], async () => {
        if (!number) {
          const dateStr = formatInvoiceDate(now);
          const prefix = `INV-D${getDeviceId()}-${dateStr}-`;
          const todayOrders = await db.orders.where('number').startsWith(prefix).toArray();
          let maxSeq = 0;
          todayOrders.forEach(o => {
            const parts = o.number.split('-');
            const seqStr = parts[parts.length - 1];
            const seq = parseInt(seqStr, 10);
            if (!isNaN(seq) && seq > maxSeq) maxSeq = seq;
          });
          number = `${prefix}${String(maxSeq + 1).padStart(4, '0')}`;
          order.number = number;
        }
        
        await db.orders.put(order);

        if (finalOrderType !== 'preforma') {
          const stockLogs = [];
          for (const item of items) {
            const mc = await db.modelColors.where('catalogId').equals(item.catalogId)
              .and(mc => mc.colorId === item.colorId).first();
            if (mc) {
              const stockMap = {};
              (mc.stock || []).forEach(s => stockMap[s.size] = s.qty);
              const sizesChanged = {};
              item.sizes.forEach(({ size, qty }) => {
                stockMap[size] = (stockMap[size] || 0) - qty;
                sizesChanged[size] = (sizesChanged[size] || 0) - qty;
              });
              const newStock = Object.entries(stockMap).map(([size, qty]) => ({ size, qty }));
              await db.modelColors.update(mc.id, { stock: newStock });
              
              const newBalance = newStock.reduce((s, c) => s + c.qty, 0);
              stockLogs.push({
                id: uuidv4(), date: now, type: 'sale', ref: number,
                catalogCode: item.catalogCode, colorName: item.colorName,
                change: -item.totalQty, sizesChanged, balance: newBalance
              });

              catalogIdsToUpdate.add(item.catalogId);
            }
          }
          if (stockLogs.length > 0) await db.stockLog.bulkAdd(stockLogs);

          if (finalOrderType === 'paid') {
            // IN: Total Amount
            const inAmount = actualAmountPaid < total ? total : actualAmountPaid;
            await db.transactions.add({
              id: uuidv4(), date: now, type: 'in', amount: parseFloat(inAmount.toFixed(2)),
              category: 'Sale',
              description: `Sale - ${customer.name} - ${number}`,
              orderId, customerId: customer.id,
            });
            // OUT: Commission (if they paid less)
            if (actualAmountPaid < total) {
              const commissionVal = total - actualAmountPaid;
              await db.transactions.add({
                id: uuidv4(), date: now, type: 'out', amount: parseFloat(commissionVal.toFixed(2)),
                category: 'Commission Paid',
                description: `Commission - ${customer.name} - ${number}`,
                orderId, customerId: customer.id,
              });
            }
          } else if (finalOrderType === 'deposit') {
            await db.transactions.add({
              id: uuidv4(), date: now, type: 'in', amount: parseFloat(actualAmountPaid.toFixed(2)),
              category: 'Deposit',
              description: `Deposit - ${customer.name} - ${number}`,
              orderId, customerId: customer.id,
            });

          }

          if (commission > 0) {
            await db.transactions.add({
              id: uuidv4(), date: now, type: 'out', amount: commission, category: 'Commission Paid',
              description: `Commission for ${number}`, orderId, customerId: customer.id,
            });
          }
        }
      });
      
      // ── Send Commission Paid to Casa Channel ─────────────────────────
      const commOutAmount = finalOrderType === 'paid' && actualAmountPaid !== total
        ? Math.abs(total - actualAmountPaid)
        : 0;
      if (commOutAmount > 0) {
        try {
          const allTxForCasa2 = await db.transactions.orderBy('date').toArray();
          const _startBudget2 = parseFloat(getSettings().startBudget) || 0;
          const _allIn2  = allTxForCasa2.filter(t => t.type === 'in').reduce((s,t) => s + (t.amount||0), 0);
          const _allOut2 = allTxForCasa2.filter(t => t.type === 'out').reduce((s,t) => s + (t.amount||0), 0);
          const commBalance = _startBudget2 + _allIn2 - _allOut2;
          const todayStart2 = new Date(); todayStart2.setHours(0,0,0,0);
          const todayTx2 = allTxForCasa2.filter(t => t.date >= todayStart2.getTime());
          const cTodayIn2 = todayTx2.filter(t => t.type === 'in').reduce((s,t) => s + t.amount, 0);
          const cTodayOut2 = todayTx2.filter(t => t.type === 'out').reduce((s,t) => s + t.amount, 0);
          
          await db.telegramQueue.add({
            priority: 3, type: 'text', status: 'pending',
            createdAt: Date.now() + 2, attemptCount: 0,
            chatIdKey: 'casaChatId',
            text: formatCasaTransaction({
              type: 'out',
              amount: commOutAmount,
              category: 'Commission Paid',
              customerName: customer.name,
              balanceBefore: commBalance + commOutAmount,
              balance: commBalance,
              todayIn: cTodayIn2,
              todayOut: cTodayOut2,
            }),
          });
        } catch(tgErr) {
          Logger.warn('invoices', 'saveOrder', `Failed to queue Telegram commission: ${tgErr.message}`);
        }
      }

      // Run outside transaction to avoid blocking UI during Telegram queue logic
      for (const catId of catalogIdsToUpdate) {
        onStockChanged(catId).catch(() => {});
      }

      // Net result in casa = always exactly what was physically collected



      EventBus.emit(EVENTS.ORDER_CREATED, { orderId, number, total, customerId: customer.id });
      EventBus.emit(EVENTS.TREASURY_CHANGED, { room: 'invoices', ref: number });
      Logger.info('invoices', 'saveOrder', 'Order saved', { orderId, number, total });

      // ── Send to Facture Channel on Telegram ──────────────────────────
      if (finalOrderType !== 'preforma') {
        try {
          await db.telegramQueue.add({
            priority: 3,
            type: 'text',
            status: 'pending',
            createdAt: Date.now(),
            attemptCount: 0,
            chatIdKey: 'factureChatId',
            refId: orderId,
            text: formatOrderMessage(order),
          });
          Logger.debug('invoices', 'saveOrder', `Queued invoice ${number} to factureChatId`);
        } catch(tgErr) {
          Logger.warn('invoices', 'saveOrder', `Failed to queue Telegram facture: ${tgErr.message}`);
        }
        // ── Send to Casa Channel ─────────────────────────────────────────
        try {
          const allTxForCasa = await db.transactions.orderBy('date').toArray();
          const _startBudget = parseFloat(getSettings().startBudget) || 0;
          const _allIn  = allTxForCasa.filter(t => t.type === 'in').reduce((s,t) => s + (t.amount||0), 0);
          const _allOut = allTxForCasa.filter(t => t.type === 'out').reduce((s,t) => s + (t.amount||0), 0);
          const currentBalance = _startBudget + _allIn - _allOut;
          const commVar = finalOrderType === 'paid' ? (actualAmountPaid !== total ? Math.abs(total - actualAmountPaid) : 0) : 0;
          const tgInAmount = finalOrderType === 'deposit' ? actualAmountPaid : (actualAmountPaid < total ? total : actualAmountPaid);
          const balanceAfterIn = currentBalance + commVar;
          const previousBalance = balanceAfterIn - tgInAmount;
          const todayStart = new Date(); todayStart.setHours(0,0,0,0);
          const todayTx = allTxForCasa.filter(t => t.date >= todayStart.getTime());
          const casaTodayIn = todayTx.filter(t => t.type === 'in').reduce((s,t) => s + t.amount, 0);
          const casaTodayOut = todayTx.filter(t => t.type === 'out').reduce((s,t) => s + t.amount, 0);
          
          await db.telegramQueue.add({
            priority: 3, type: 'text', status: 'pending',
            createdAt: Date.now(), attemptCount: 0,
            chatIdKey: 'casaChatId',
            text: formatCasaTransaction({
              type: 'in',
              amount: tgInAmount,
              category: finalOrderType === 'deposit' ? 'Deposit' : 'Sale',
              customerName: customer.name,
              balanceBefore: previousBalance,
              balance: balanceAfterIn,
              todayIn: casaTodayIn,
              todayOut: casaTodayOut,
            }),
          });
        } catch(tgErr) {
          Logger.warn('invoices', 'saveOrder', `Failed to queue Telegram casa: ${tgErr.message}`);
        }
      }

      toast.success(`Order ${number} saved! $${total.toFixed(2)}`);
      navigate('/history');
    } catch (e) {
      Logger.error('invoices', 'saveOrder', e.message);
      toast.error('Error: ' + e.message);
    }
    setSaving(false);
  };

  return (
    <ErrorBoundary room="new-order">
      <div className="page-container fade-in">
        <div className="page-header" style={{ marginBottom: 16 }}>
          <img
            src="/beeaueen_logo.png"
            alt="System Orta"
            style={{ maxHeight: 54, maxWidth: 200, objectFit: 'contain' }}
            className="logo-glow"
            onError={e => {
              e.target.style.display = 'none';
              const fb = document.getElementById('new-order-fallback-title');
              if (fb) fb.style.display = 'flex';
            }}
          />
          <div id="new-order-fallback-title" className="page-title" style={{ display: 'none' }}>
            <ShoppingBag size={22} /> NEW ORDER
          </div>
        </div>

        <div className="new-order-grid">
          {/* ── Left Column ─────────────────────────────── */}
          <div>
            {/* Customer Selector */}
            <div className="card" style={{ marginBottom: 16 }}>
              <div className="form-label" style={{ fontSize: '0.9rem', marginBottom: 12 }}>
                <User size={14} style={{ marginRight: 6 }} />CUSTOMER
              </div>

              {customer ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: 'rgba(212,175,55,0.08)', borderRadius: 8, border: '1px solid var(--border-gold)' }}>
                  <div className="avatar" style={{ width: 38, height: 38, overflow: 'hidden', background: 'var(--surface-light)', border: '1px solid rgba(212,175,55,0.2)' }}>
                    {getFlag(customer.country) !== '🌍' ? (
                      <span style={{ fontSize: '3.5rem', lineHeight: 1, opacity: 0.5 }}>{getFlag(customer.country)}</span>
                    ) : (
                      customer.name?.[0]?.toUpperCase()
                    )}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div className="text-bold">{customer.name}</div>
                    <div className="text-muted text-xs"><span className="text-gold" style={{ fontWeight: 600 }}>{maskPhone(customer.phone)}</span> {customer.cargoName ? `· ${customer.cargoName}` : ''}</div>
                  </div>
                  {customer.credit > 0 && <span className="badge badge-red">${customer.credit.toFixed(2)} owed</span>}
                  <button className="btn btn-secondary btn-sm btn-icon" onClick={() => setCustomer(null)}><X size={14}/></button>
                </div>
              ) : (
                <div style={{ position: 'relative' }}>
                  <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                  <input
                    ref={customerInputRef}
                    className="search-input"
                    placeholder="Search customer by name or phone..."
                    value={customerQ}
                    onChange={e => searchCustomer(e.target.value)}
                    style={{ color: customerQ && /^[\d\s\+\-]+$/.test(customerQ) ? 'var(--gold)' : undefined, fontWeight: customerQ && /^[\d\s\+\-]+$/.test(customerQ) ? 'bold' : 'normal', letterSpacing: customerQ && /^[\d\s\+\-]+$/.test(customerQ) ? '1px' : 'normal' }}
                    autoFocus
                  />
                  {customerResults.length > 0 && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100, background: 'var(--surface2)', border: '1px solid var(--border-gold)', borderRadius: 8, overflow: 'hidden', boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>
                      {customerResults.map(c => (
                        <div key={c.id} onClick={() => selectCustomer(c)}
                          style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}
                          onMouseEnter={e => e.currentTarget.style.background = 'var(--surface3)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                          <div className="avatar" style={{ width: 30, height: 30, overflow: 'hidden', background: 'var(--surface-light)' }}>
                            {getFlag(c.country) !== '🌍' ? (
                              <span style={{ fontSize: '3rem', lineHeight: 1, opacity: 0.5 }}>{getFlag(c.country)}</span>
                            ) : (
                              c.name?.[0]?.toUpperCase()
                            )}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: '0.86rem' }}>{c.name}</div>
                            <div className="text-xs text-muted"><span className="text-gold" style={{ fontWeight: 600 }}>{maskPhone(c.phone)}</span></div>
                          </div>
                          {c.credit > 0 && <span className="text-red text-xs text-bold" style={{ marginLeft: 'auto' }}>${c.credit?.toFixed(2)}</span>}
                        </div>
                      ))}
                      <div onClick={() => setShowAddCustomer(true)}
                        style={{ padding: '10px 14px', cursor: 'pointer', color: 'var(--gold)', fontWeight: 600, fontSize: '0.84rem', borderTop: '1px solid var(--border-gold)' }}
                      >
                        <Plus size={13} style={{ marginRight: 6 }} />Add New Customer
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Model Search */}
            <div className="card" style={{ marginBottom: 16 }}>
              <div className="form-label" style={{ fontSize: '0.9rem', marginBottom: 12 }}>
                ADD ITEMS
              </div>
              <div style={{ position: 'relative', marginBottom: 12 }}>
                {showScanner ? (
                  <BarcodeScanner
                    inline={true}
                    onScan={async (code) => {
                      setShowScanner(false);
                      const found = await searchModel(code, true);
                      if (found === false) {
                        setTimeout(() => setShowScanner(true), 500);
                      }
                    }}
                    onClose={() => setShowScanner(false)}
                  />
                ) : (
                  <div style={{ display: 'flex', gap: 10 }}>
                    <input
                      ref={modelInputRef}
                      placeholder="Model code (e.g. 12345)..."
                      value={modelQ}
                      onChange={e => searchModel(e.target.value)}
                      style={{ flex: 1 }}
                      onKeyDown={e => e.key === 'Enter' && modelSuggestions.length > 0 && selectModelFromSuggestion(modelSuggestions[0])}
                    />
                    <button className="btn btn-secondary" style={{ width: 100, display: 'flex', justifyContent: 'center', alignItems: 'center' }} onClick={() => setShowScanner(true)} title="Scan Barcode">
                      <Barcode size={22} />
                    </button>
                  </div>
                )}
                {!showScanner && modelSuggestions.length > 0 && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100, background: 'var(--surface2)', border: '1px solid var(--border-gold)', borderRadius: 8, overflow: 'hidden', boxShadow: '0 8px 24px rgba(0,0,0,0.4)', marginTop: 4 }}>
                    {modelSuggestions.map(m => (
                      <div key={m.id} onClick={() => selectModelFromSuggestion(m)}
                        style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12 }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--surface3)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        <Thumbnail asset={m.firstAsset} />
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--gold)' }}>{m.code}</div>
                          {m.sizesString && <div className="text-xs text-muted" style={{ marginTop: 2 }}>{m.sizesString}</div>}
                        </div>
                        <div className="text-sm text-bold" style={{ marginLeft: 'auto', color: 'var(--gold)' }}>${m.wholesalePrice}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Model Found */}
              {modelResult && (
                <div style={{ 
                  background: selectedColor?.hex ? `linear-gradient(to right, ${selectedColor.hex}1A 0%, transparent 70%), rgba(212,175,55,0.06)` : 'rgba(212,175,55,0.06)', 
                  borderRadius: 10, padding: 14, border: '1px solid var(--border-gold)',
                  transition: 'background 0.3s ease'
                }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <div className="model-code" style={{ fontSize: '1.8rem', lineHeight: 1 }}>{modelResult.code}</div>
                      <div className="text-muted" style={{ fontSize: '1rem' }}>
                        Factory: <span className="text-gold">{modelResult.factoryName || modelResult.factoryId}</span>
                      </div>
                      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                        <span className="price-tag price-wholesale" style={{ fontSize: '0.85rem', padding: '2px 8px', width: 'fit-content' }}>W: ${modelResult.wholesalePrice}</span>
                        <span className="price-tag price-retail" style={{ fontSize: '0.85rem', padding: '2px 8px', width: 'fit-content' }}>R: ${modelResult.retailPrice}</span>
                      </div>

                      {/* Colors */}
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                        {availableColors.map(mc => (
                          <div
                            key={mc.id}
                            onClick={() => selectColor(mc)}
                            style={{
                              width: 145, height: 40,
                              padding: '0 12px', borderRadius: 20, cursor: 'pointer',
                              border: selectedColor?.id === mc.id ? '2px solid var(--gold)' : '1px solid var(--border)',
                              background: mc.hex ? `linear-gradient(to right, ${mc.hex}55 0%, transparent 100%)` : (selectedColor?.id === mc.id ? 'rgba(212,175,55,0.15)' : 'transparent'),
                              display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: 8, fontSize: '0.85rem', fontWeight: 600,
                              opacity: mc.total === 0 ? 0.4 : 1,
                              textShadow: '0 1px 2px rgba(0,0,0,0.8)'
                            }}
                          >
                            {mc.hex && <div style={{ width: 12, height: 12, flexShrink: 0, borderRadius: '50%', background: mc.hex, border: '1px solid rgba(255,255,255,0.2)' }} />}
                            <div style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {mc.colorName}
                            </div>
                            <span className={mc.total > 0 ? 'text-green' : 'text-red'} style={{ fontSize: '0.72rem', flexShrink: 0 }}>({mc.total})</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div style={{ flexShrink: 0, marginLeft: 16 }}>
                      <Thumbnail asset={selectedColor?.assets?.[0] || modelResult.firstAsset} width={110} height={150} />
                    </div>
                  </div>

                  {/* Sizes */}
                  {selectedColor && (
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20, marginBottom: 16 }}>
                        <button className="btn" style={{ flexShrink: 0, height: 64, width: 64, fontSize: '2rem', borderRadius: 16, background: 'rgba(239, 68, 68, 0.15)', color: 'var(--red)', border: '1px solid var(--red)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => changeAllSizes(-1)}>-</button>

                        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
                          {(selectedColor.stock || []).map(({ size, qty }) => (
                            <div key={size} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                              <button 
                                className="btn btn-secondary" 
                                style={{ 
                                  padding: '6px 0', width: 50, fontSize: '1.2rem', borderRadius: 8, lineHeight: 1,
                                  background: selectedColor?.hex ? `${selectedColor.hex}33` : undefined,
                                  borderColor: selectedColor?.hex ? `${selectedColor.hex}80` : undefined,
                                  textShadow: selectedColor?.hex ? '0 1px 2px rgba(0,0,0,0.5)' : undefined
                                }} 
                                onClick={() => changeSingleSize(size, 1)}
                              >
                                +
                              </button>
                              <div style={{ color: qty > 0 ? 'var(--green)' : 'var(--red)', fontWeight: 700, fontSize: '0.9rem', letterSpacing: 0.5 }}>{size}</div>
                              <input
                                type="number" min={0} max={qty}
                                value={sizeQtys[size] || ''}
                                onChange={e => setSizeQtys(prev => ({ ...prev, [size]: e.target.value }))}
                                style={{ 
                                  width: 60, textAlign: 'center', padding: '8px 4px', fontSize: '1.1rem', fontWeight: 700,
                                  color: (parseInt(sizeQtys[size]) || 0) > 0 
                                    ? ((parseInt(sizeQtys[size]) || 0) > qty ? 'var(--red)' : 'var(--green)') 
                                    : 'var(--text-muted)'
                                }}
                                placeholder={`/${qty}`}
                              />
                              <button 
                                className="btn btn-secondary" 
                                style={{ 
                                  padding: '6px 0', width: 50, fontSize: '1.2rem', borderRadius: 8, lineHeight: 1,
                                  background: selectedColor?.hex ? `${selectedColor.hex}33` : undefined,
                                  borderColor: selectedColor?.hex ? `${selectedColor.hex}80` : undefined,
                                  textShadow: selectedColor?.hex ? '0 1px 2px rgba(0,0,0,0.5)' : undefined
                                }} 
                                onClick={() => changeSingleSize(size, -1)}
                              >
                                -
                              </button>
                              <div style={{ fontSize: '0.7rem', color: qty === 0 ? 'var(--red)' : 'var(--text-muted)', textAlign: 'center', marginTop: 4 }}>
                                avail: {qty}
                              </div>
                            </div>
                          ))}
                        </div>

                        <button className="btn" style={{ flexShrink: 0, height: 64, width: 64, fontSize: '2rem', borderRadius: 16, background: 'rgba(34, 197, 94, 0.15)', color: 'var(--green)', border: '1px solid var(--green)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => changeAllSizes(1)}>+</button>
                      </div>

                      {/* Series info */}
                      {(() => {
                        const sType = computeSeriesType(sizeQtys, seriesInfo);
                        const price = getUnitPrice(modelResult, sType);
                        const totalQty = Object.values(sizeQtys).reduce((s, v) => s + (parseInt(v) || 0), 0);
                        return (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px', background: 'rgba(0,0,0,0.3)', borderRadius: 12 }}>
                            <span className={`badge ${sType === 'complete' ? 'badge-green' : 'badge-orange'}`} style={{ fontSize: '0.8rem', padding: '4px 8px' }}>
                              {sType === 'complete' ? '✓ Complete Series' : '~ Broken'}
                            </span>
                            <span className="text-muted" style={{ fontSize: '0.95rem' }}>Price: <strong className="text-gold">${price}</strong></span>
                            <span className="text-muted" style={{ fontSize: '0.95rem' }}>Qty: <strong>{totalQty}</strong></span>
                            <span className="text-muted" style={{ fontSize: '0.95rem' }}>Total: <strong className="text-gold">${(totalQty * price).toFixed(2)}</strong></span>
                            <button className="btn btn-primary" style={{ marginLeft: 'auto', padding: '10px 32px', fontSize: '1.1rem', fontWeight: 700, borderRadius: 10 }} onClick={addToInvoice}>
                              <Plus size={18} /> Add
                            </button>
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Items Table */}
            {items.length > 0 && (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr><th>Model</th><th>Color</th><th>Sizes</th><th>Type</th><th>Price</th><th>Total</th><th></th></tr>
                  </thead>
                  <tbody>
                    {items.map(item => (
                      <tr key={item.id}>
                        <td style={{ padding: '8px' }}>
                          <TableCellImage asset={item.firstAsset} code={item.catalogCode} />
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            {item.hex && <div style={{ width: 12, height: 12, borderRadius: '50%', background: item.hex }} />}
                            {item.colorName}
                          </div>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                            {item.sizes.map(s => (
                              <span key={s.size} className="badge badge-gray">{s.size}×{s.qty}</span>
                            ))}
                          </div>
                        </td>
                        <td>
                          <span className={`badge ${item.seriesType === 'complete' ? 'badge-green' : 'badge-orange'}`}>
                            {item.seriesType}
                          </span>
                        </td>
                        <td>
                          <span className="text-gold text-bold" style={{ fontSize: '1.1rem' }}>{item.totalQty}</span>
                          <span style={{ margin: '0 8px', color: 'var(--text-muted)' }}>×</span>
                          <span className="text-green text-bold" style={{ fontSize: '1.1rem' }}>${item.unitPrice.toFixed(2)}</span>
                        </td>
                        <td className="text-gold text-bold" style={{ fontSize: '1.1rem' }}>${item.totalPrice.toFixed(2)}</td>
                        <td>
                          <button className="btn btn-danger btn-sm btn-icon" onClick={() => removeItem(item.id)}>
                            <Trash2 size={13} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ── Right Column — Invoice Panel ─────────────── */}
          <div className="invoice-panel">
            {items.length === 0 ? (
              <div className="card-gold" style={{ textAlign: 'center', padding: '40px 20px', opacity: 0.5 }}>
                <ShoppingBag size={32} style={{ color: 'var(--gold)', marginBottom: 8 }} />
                <div className="text-sec text-sm">Add items to see invoice summary</div>
              </div>
            ) : (
              <div className="card-gold" style={{ 
                background: finalOrderType === 'paid' ? 'linear-gradient(to bottom, rgba(34, 197, 94, 0.3) 0%, transparent 100%), var(--glass-gold)' :
                            finalOrderType === 'deposit' ? 'linear-gradient(to bottom, rgba(212, 175, 55, 0.3) 0%, transparent 100%), var(--glass-gold)' :
                            finalOrderType === 'preforma' ? 'linear-gradient(to bottom, rgba(156, 163, 175, 0.3) 0%, transparent 100%), var(--glass-gold)' :
                            'var(--glass-gold)',
                transition: 'background 0.3s ease'
              }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--gold)', marginBottom: 16, letterSpacing: 1 }}>
                  INVOICE SUMMARY
                </div>

                {/* Step 1: Order Type */}
                {!isWatcherDevice() && (
                <div className="form-group">
                  <div style={{ display: 'flex', gap: 6 }}>
                    {ORDER_TYPES.filter(t => isWatcherDevice() ? t === 'preforma' : true).map(t => {
                      let activeColor = '#000';
                      let activeBg = 'var(--gold)';
                      let inactiveColor = 'var(--gold)';
                      let inactiveBg = 'rgba(212,175,55,0.05)';
                      
                      if (t === 'paid') { 
                        activeColor = '#fff'; 
                        activeBg = 'var(--green)'; 
                        inactiveColor = 'var(--green)';
                        inactiveBg = 'rgba(34, 197, 94, 0.05)';
                      }
                      if (t === 'preforma') { 
                        activeColor = '#fff'; 
                        activeBg = 'var(--text-muted)'; 
                        inactiveColor = 'var(--text-muted)';
                        inactiveBg = 'rgba(156, 163, 175, 0.05)';
                      }
                      
                      const isSelected = orderType === t;
                      
                      return (
                        <button key={t} onClick={() => { setOrderType(t); setStep3Visible(false); setStep4Visible(false); }}
                          style={{
                            flex: 1, padding: '10px 4px', borderRadius: 8, cursor: 'pointer',
                            border: `1px solid ${isSelected ? activeBg : inactiveColor}`,
                            background: isSelected ? activeBg : inactiveBg,
                            color: isSelected ? activeColor : inactiveColor,
                            fontWeight: 600, fontSize: '0.8rem', fontFamily: 'inherit',
                            textTransform: 'uppercase',
                            transition: 'all 0.2s',
                          }}
                        >{t === 'preforma' ? 'NO PAID' : t}</button>
                      );
                    })}
                  </div>
                </div>

                )}
                {/* Step 2: Fields based on type */}
                {orderType && (
                  <div style={{ 
                    marginTop: 16, 
                    animation: 'fadeIn 0.3s ease',
                  }}>

                  {/* Subtotal */}
                  <div className="flex-between" style={{ marginBottom: 8 }}>
                    <span style={{ fontSize: '0.85rem', color: finalOrderType === 'paid' ? 'var(--green)' : finalOrderType === 'preforma' ? 'var(--text-muted)' : 'var(--gold)' }}>Subtotal</span>
                    <span style={{ fontWeight: 700, color: finalOrderType === 'paid' ? 'var(--green)' : finalOrderType === 'preforma' ? 'var(--text-muted)' : 'var(--gold)' }}>${subtotal.toFixed(2)}</span>
                  </div>

                  {/* Discount */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <span className="text-red text-bold text-sm" style={{ whiteSpace: 'nowrap' }}>Discount</span>
                    <input
                      type="number" placeholder="0" value={discount}
                      onChange={e => { setDiscount(e.target.value); setStep3Visible(false); }}
                      style={{ textAlign: 'right', padding: '6px 10px', fontSize: '0.95rem', flex: 1, color: 'var(--red)', fontWeight: 'bold' }}
                    />
                    <button className="btn btn-primary" style={{ padding: '6px 16px', fontWeight: 'bold' }} onClick={() => setStep3Visible(true)}>OK</button>
                  </div>

                  {/* Total */}
                  <div className="flex-between" style={{ 
                    marginBottom: 12, padding: '10px 0', 
                    borderTop: `1px solid ${finalOrderType === 'paid' ? 'var(--green)' : finalOrderType === 'preforma' ? 'var(--text-muted)' : 'var(--border-gold)'}`, 
                    borderBottom: `1px solid ${finalOrderType === 'paid' ? 'var(--green)' : finalOrderType === 'preforma' ? 'var(--text-muted)' : 'var(--border-gold)'}`
                  }}>
                    <span style={{ fontWeight: 700, color: finalOrderType === 'paid' ? 'var(--green)' : finalOrderType === 'preforma' ? 'var(--text-muted)' : 'var(--gold)' }}>TOTAL</span>
                    <span style={{ fontSize: '1.4rem', fontWeight: 700, color: finalOrderType === 'paid' ? 'var(--green)' : finalOrderType === 'preforma' ? 'var(--text-muted)' : 'var(--gold)' }}>${total.toFixed(2)}</span>
                  </div>

                  {step3Visible && (
                    <div style={{ animation: 'fadeIn 0.3s ease' }}>
                      {/* Deposit amount — only for deposit */}
                  {finalOrderType === 'deposit' && (
                    <div className="form-group" style={{ animation: 'fadeIn 0.3s ease' }}>
                      <label className="form-label text-green" style={{ fontSize: '0.85rem' }}>Deposit Amount ($)</label>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <input type="number" placeholder="0.00" value={depositAmount}
                          onChange={e => { setDepositAmount(e.target.value); setStep4Visible(false); }}
                          style={{ flex: 1, color: 'var(--green)', fontWeight: 'bold', fontSize: '1rem' }} />
                        <button className="btn btn-primary" style={{ padding: '0 16px', fontWeight: 'bold' }} onClick={() => setStep4Visible(true)}>OK</button>
                      </div>
                      {remaining > 0 && (
                        <div className="text-sec text-xs" style={{ marginTop: 4 }}>
                          Remaining: ${remaining.toFixed(2)}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Amount Received — only for paid */}
                  {finalOrderType === 'paid' && (
                    <div className="form-group" style={{ animation: 'fadeIn 0.3s ease' }}>
                      <label className="form-label text-green" style={{ fontSize: '0.85rem' }}>Casa Cash ($)</label>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <input type="number" placeholder={total.toFixed(2)} value={paidExact}
                          onChange={e => { setPaidExact(e.target.value); setStep4Visible(false); }}
                          style={{ flex: 1, color: 'var(--green)', fontWeight: 'bold', fontSize: '1rem' }} />
                        <button className="btn btn-primary" style={{ padding: '0 16px', fontWeight: 'bold' }} onClick={() => setStep4Visible(true)}>OK</button>
                      </div>
                      {commission > 0 && (
                        <div className="text-orange text-xs" style={{ marginTop: 4 }}>
                          Commission: ${commission.toFixed(2)}
                        </div>
                      )}
                    </div>
                  )}

                  {(step4Visible || finalOrderType === 'preforma') && (
                    <div style={{ animation: 'fadeIn 0.3s ease', marginTop: 16 }}>
                      {/* Note */}
                      <div className="form-group">
                        <label className="form-label">Note</label>
                        <textarea placeholder="Optional note..." value={note}
                          onChange={e => setNote(e.target.value)}
                          style={{ resize: 'none', height: 60 }} />
                      </div>

                      {/* Action Buttons */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
                        <div style={{ display: 'flex', gap: 12, marginTop: 10 }}>
                          <button
                            className="btn btn-success"
                            style={{ flex: 1, padding: '16px', fontSize: '1.1rem', fontWeight: 'bold', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8 }}
                            disabled={!customer || saving || items.length === 0}
                            onClick={handleWhatsApp}
                          >
                            <MessageCircle size={22} /> WhatsApp
                          </button>
                          <button 
                            className="btn btn-secondary" 
                            style={{ flex: 1, padding: '16px', fontSize: '1.1rem', fontWeight: 'bold', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8 }} 
                            disabled={!customer || saving || items.length === 0} 
                            onClick={handlePDF}
                          >
                            <FileText size={22} /> PDF
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                    </div>
                  )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add Customer Modal */}
      {showAddCustomer && (
        <div className="modal-overlay" onClick={() => setShowAddCustomer(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="modal-title"><User size={16} /> Add New Customer</div>
            <div className="form-group">
              <label className="form-label">Name *</label>
              <input placeholder="Full name" value={newCust.name} onChange={e => setNewCust(p => ({ ...p, name: e.target.value }))} autoFocus />
            </div>
            <div className="form-group">
              <label className="form-label">Phone</label>
              <input placeholder="+255..." value={newCust.phone} onChange={e => setNewCust(p => ({ ...p, phone: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Country</label>
              <select value={newCust.country} onChange={e => setNewCust(p => ({ ...p, country: e.target.value }))}>
                {['Tanzania','DR Congo','Congo','Cameroon','Uganda','Kenya','Ghana','Nigeria','Turkey','Other'].map(c => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setShowAddCustomer(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={addNewCustomer}>Add & Select</button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Stock Warning Modal */}
      {stockWarningModal && (
        <div className="modal-overlay" onClick={() => setStockWarningModal(null)} style={{ zIndex: 1100 }}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 440, border: '1px solid rgba(245,158,11,0.5)', background: '#0d0d0d', boxShadow: '0 20px 60px rgba(0,0,0,0.8)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
              <div style={{
                width: 46, height: 46, borderRadius: 12,
                background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.35)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--orange)', flexShrink: 0
              }}>
                <AlertTriangle size={26} />
              </div>
              <div>
                <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--gold)', letterSpacing: 0.5 }}>
                  Stock Warning
                </div>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                  Quantity exceeds available inventory
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
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: '0.92rem' }}>
                <span className="text-muted">Model / Color:</span>
                <span className="text-bold text-gold">{stockWarningModal.modelCode} — {stockWarningModal.colorName}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10, fontSize: '0.92rem' }}>
                <span className="text-muted">Total Requested:</span>
                <span className="text-bold" style={{ color: 'var(--orange)' }}>{stockWarningModal.totalQty} pcs</span>
              </div>

              {stockWarningModal.overDetails?.length > 0 && (
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10 }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 8, fontWeight: 600, letterSpacing: 0.5 }}>
                    EXCEEDED SIZES:
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {stockWarningModal.overDetails.map((od, i) => (
                      <span key={i} className="badge badge-orange" style={{ fontSize: '0.82rem', padding: '5px 10px', borderRadius: 6 }}>
                        Size <strong>{od.size}</strong>: {od.ordered} pcs <span style={{ opacity: 0.7 }}>(Stock: {od.avail})</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div style={{ fontSize: '0.88rem', color: 'var(--text-sec)', lineHeight: 1.5, marginBottom: 22, textAlign: 'center' }}>
              Do you want to proceed and add this item anyway as a <strong>Preorder / Factory Promise</strong>?
            </div>

            <div className="modal-actions" style={{ marginTop: 0, paddingTop: 16, display: 'flex', gap: 12 }}>
              <button
                className="btn btn-secondary"
                style={{ flex: 1, padding: '12px', justifyContent: 'center', fontSize: '0.95rem' }}
                onClick={() => setStockWarningModal(null)}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                style={{
                  flex: 1.3,
                  padding: '12px',
                  justifyContent: 'center',
                  background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                  color: '#000',
                  fontWeight: 700,
                  fontSize: '0.95rem',
                  border: 'none'
                }}
                onClick={() => commitAddItem(stockWarningModal.item)}
              >
                <Check size={18} style={{ marginRight: 6 }} /> Add Anyway
              </button>
            </div>
          </div>
        </div>
      )}

    </ErrorBoundary>
  );
}
