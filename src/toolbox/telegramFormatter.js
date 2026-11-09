
export const escapeHtml = (text) => String(text || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
export const formatOrderMessage = (order) => {
  let msg = `🧾 ${order.number}\n`;
  msg += `📋 <b>#${order.type}</b>\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `👤 ${order.customerName}\n`;
  if (order.customerPhone) msg += `📞 ${order.customerPhone}\n`;
  msg += `📅 ${new Date(order.date).toLocaleDateString('en-GB')} ${new Date(order.date).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}\n\n`;
  (order.items || []).forEach(item => {
    const totalQty = (item.sizes||[]).reduce((s,x) => s + x.qty, 0);
    msg += `▫️ ${item.catalogCode} | ${item.colorName} × ${totalQty} pcs = ${item.totalPrice}\n`;
  });
  if (order.discount > 0) msg += `\n🏷 Discount: ${order.discount}\n`;
  msg += `--------------------------------------\n`;
  msg += `💰 Total: <b>${order.totalPrice}</b>\n`;
  msg += `____________________________\n`;
  msg += `💵 Paid: <code>${order.paidAmount}</code>\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━━\n`;
  return msg;
};

export const formatFactoryInvoice = (type, factory, form, items, fin) => {
  const icons = { in: '📦', return: '↩️', payment: '💳', balance_confirm: '✅' };
  const labels = { in: 'FACTORY IMPORT', return: 'FACTORY RETURN', payment: 'FACTORY PAYMENT', balance_confirm: 'BALANCE CONFIRMED' };
  let msg = `${icons[type]} <b>${labels[type]}</b>\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `🏭 ${factory.name}\n`;
  msg += `📅 ${new Date().toLocaleDateString('en-GB')}\n`;
  if (form?.number) msg += `📄 Invoice #${form.number}\n`;
  if (type === 'payment') {
    if (form?.receiver) msg += `👤 Receiver: ${form.receiver}\n`;
    if (form?.note) msg += `📝 Note: ${form.note}\n`;
  }
  if (type !== 'payment' && type !== 'balance_confirm' && items?.length > 0) {
    items.forEach(item => {
      const sizeSum = Object.values(item.sizeQtys||{}).reduce((a,b)=>a+(parseInt(b)||0),0);
      const qty = sizeSum > 0 ? sizeSum : (item.qty || 0);
      const price = item.factoryPrice || 0;
      msg += `▫️ ${item.catalogCode} — ${item.colorName}\n   ${qty} pcs × $${price.toFixed(2)} = <b>$${(qty * price).toFixed(2)}</b>\n`;
    });
  }
  
  let amount = 0;
  if (type === 'balance_confirm') {
    amount = form?.amount || 0;
  } else if (form?.amount) {
    amount = form.amount;
  } else if (items) {
    amount = items.reduce((s,i) => {
      const sizeSum = Object.values(i.sizeQtys||{}).reduce((a,b)=>a+(parseInt(b)||0),0);
      const qty = sizeSum > 0 ? sizeSum : (i.qty || 0);
      return s + (qty * (i.factoryPrice || 0));
    }, 0);
  }
  
  if (type === 'balance_confirm') {
    msg += `✅ <b>$${amount}</b>\n`;
  } else {
    msg += `💰 Amount: <b>$${amount}</b>\n`;
  }
  msg += `━━━━━━━━━━━━━━━━━━━━━\n`;
  
  if (fin) {
    let newTotal = fin.totalCredit || 0;
    let newStock = fin.stockCredit || 0;
    
    if (type === 'in') {
      newTotal += amount;
      newStock += amount;
    } else if (type === 'return') {
      newTotal -= amount;
      newStock -= amount;
    } else if (type === 'payment') {
      newTotal -= amount;
    } else if (type === 'balance_confirm') {
      newTotal = amount; // Balance confirm sets the debt
    }
    
    msg += `📊 <b>FACTORY DASHBOARD</b>\n`;
    msg += `📦 Models: ${fin.modelCount || 0}\n`;
    msg += `💵 Stock Value: ${newStock.toFixed(2)}\n`;
    msg += `⚖️ Net Balance: ${(newTotal - newStock).toFixed(2)}\n`;
    msg += `🔴 Total Debt: ${newTotal.toFixed(2)}\n`;
  }
  
  return msg.trim();
};

export const formatReturnMessage = (order) => {
  let msg = `⭕️ ${order.number}\n`;
  msg += `⭕️ <b>#Return</b>\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `👤 ${order.customerName}\n`;
  if (order.customerPhone) msg += `📞 ${order.customerPhone}\n`;
  msg += `📅 ${new Date(order.date).toLocaleDateString('en-GB')} ${new Date(order.date).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}\n\n`;
  (order.items || []).forEach(item => {
    const totalQty = (item.sizes||[]).reduce((s,x) => s + x.qty, 0);
    msg += `▫️ ${item.catalogCode} | ${item.colorName} × ${totalQty} pcs = ${item.totalPrice}\n`;
  });
  msg += `--------------------------------------\n`;
  msg += `💰 Total: ${order.totalPrice} $\n`;
  msg += `____________________________\n`;
  msg += `💵 Return: ${order.paidAmount || 0} "$"\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━━\n`;
  return msg;
};

export const formatStockReport = (items) => {
  let msg = `📊 <b>STOCK REPORT</b>\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `📅 ${new Date().toLocaleDateString('en-GB')}\n\n`;
  items.forEach(item => {
    msg += `▫️ ${item.code} — ${item.total} pcs\n`;
  });
  msg += `\n━━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `🐝 System Orta`;
  return msg;
};

/**
 * Wholesale channel caption — full series info.
 * Shows: model code, color, series sizes, wholesale price.
 */

export const buildSalesCaption = (model, color, series) => {
  let msg = `👗 <blockquote>${escapeHtml(model.code || 'Model')}</blockquote>\n`;
  msg += `🎨 ${escapeHtml(color.colorName || color.colorCode || '')}\n`;
  if (series?.sizes?.length > 0) {
    msg += `📏 <b>Sizes:</b> ${series.sizes.join(' - ')}\n`;
  }
  const original = model.retailPrice || model.wholesalePrice || 0;
  const discount = parseFloat(model.discount) || 0;
  const newPrice = Math.max(0, original - discount);
  if (discount > 0) {
     msg += `💰 <s>${original}</s>  <b>${newPrice.toFixed(2)}</b> 🔥\n`;
  } else {
     msg += `💰 <b>${original}</b> 🔥\n`;
  }
  msg += `🏷 <b>Code:</b> ${escapeHtml(model.code || '')}`;
  return msg;
};

export const buildWholesaleCaption = (model, color, series) => {
  let msg = `<blockquote>${escapeHtml(model.code || 'Model')}</blockquote>\n`;
  if (series?.sizes?.length > 0) {
    msg += `${series.sizes.join(' - ')}\n`;
  }
  msg += `<b>$ ${model.wholesalePrice || 0}</b>`;
  return msg;
};

/**
 * Retail channel caption — broken series info.
 * Shows: model code, color, only remaining sizes, retail price.
 * @param {Array} brokenSizes - [{size, qty}] only the broken/remaining sizes
 */
export const buildRetailCaption = (model, color, brokenSizes) => {
  let msg = `<blockquote>${escapeHtml(model.code || 'Model')}</blockquote>\n`;
  if (brokenSizes && brokenSizes.length > 0) {
    const sizesStr = brokenSizes.map(s => `Size ${s.size}`).join(' - ');
    msg += `${sizesStr}\n`;
  }
  msg += `<b>$ ${model.retailPrice || 0}</b>`;
  return msg;
};

/**
 * Live Stock channel caption — detailed per-color per-size breakdown.
 * Shows: model code, each color with sizes and quantities, full/broken status.
 */
export const buildLiveStockCaption = (model, mColors, series) => {
  const sizes = series?.sizes || [];
  let msg = `📊 <b>LIVE STOCK</b> — ${escapeHtml(model.code || 'Model')}\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━━\n`;

  let totalPcs = 0;

  for (const mc of mColors) {
    const stock = mc.stock || [];
    const colorTotal = stock.reduce((s, x) => s + (Number(x.qty) || 0), 0);
    totalPcs += colorTotal;

    const colorName = mc.colorName || mc.colorCode || 'Unknown';

    if (colorTotal === 0) {
      msg += `🎨 ${colorName}: ❌ Out of stock\n`;
      continue;
    }

    // Calculate full series count
    let fullSeriesCount = 0;
    if (sizes.length > 0) {
      fullSeriesCount = Math.min(...sizes.map(size => {
        const sObj = stock.find(s => s.size === size);
        return sObj ? (Number(sObj.qty) || 0) : 0;
      }));
    }

    // Build size detail for sizes with stock > 0
    const sizeDetails = [];
    for (const s of stock) {
      const qty = Number(s.qty) || 0;
      if (qty > 0) sizeDetails.push(`${s.size}(×${qty})`);
    }

    // Determine status
    let statusIcon = '';
    if (fullSeriesCount > 0) {
      const hasLeftover = sizes.some(size => {
        const sObj = stock.find(s => s.size === size);
        const qty = sObj ? (Number(sObj.qty) || 0) : 0;
        return (qty - fullSeriesCount) > 0;
      });
      statusIcon = hasLeftover
        ? `✅ ${fullSeriesCount} serie + ⚠️ broken`
        : `✅ ${fullSeriesCount} serie`;
    } else {
      statusIcon = '⚠️ Broken';
    }

    msg += `🎨 ${colorName}: ${sizeDetails.join(' ')} ${statusIcon}\n`;
  }

  msg += `━━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `📦 Total: <b>${totalPcs} pcs</b>\n`;
  msg += `🐝 System Orta`;
  return msg;
};

export const formatTreasuryReport = (stats) => {
  let msg = `🏦 <b>TREASURY REPORT</b>\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `📅 ${new Date().toLocaleDateString('en-GB')}\n\n`;
  msg += `💰 Balance: <b>$${stats.balance}</b>\n`;
  msg += `📈 Total In: $${stats.totalIn}\n`;
  msg += `📉 Total Out: $${stats.totalOut}\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `🐝 System Orta`;
  return msg;
};

export const formatPaymentMessage = (customerName, phone, amount, type) => {
  let msg = `💳 <b>#PAYMENT ${type === 'in' ? 'RECEIVED' : 'SENT'}</b>\n`;
  msg += `📅 ${new Date().toLocaleDateString('en-GB')} ${new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `👤 ${customerName}\n`;
  if (phone) msg += `📞 ${phone}\n`;
  msg += `💰 Amount: <b>${amount}</b>\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━━\n`;
  return msg;
};

export const formatDepositPaidMessage = (order) => {
  const customerName = order.customerName || 'Walk-in';
  const customerPhone = order.customerPhone || '';
  const invoiceNum = order.number || 'INVOICE';
  const items = order.items || [];
  const finalTotal = order.totalPrice || 0;

  let msg = `↪️ ${invoiceNum}🕓\n`;
  msg += `🟩 #deposit-paid\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `👤 ${customerName}\n`;
  if (customerPhone) msg += `📞 ${customerPhone}\n`;
  msg += `📅 ${new Date().toLocaleDateString('en-GB')} ${new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}\n`;
  msg += `\n`;
  items.forEach(item => {
    const total = (item.totalQty * parseFloat(item.unitPrice || 0)).toFixed(2);
    msg += `▫️ ${item.catalogCode} | ${item.colorName || item.colorCode} × ${item.totalQty} pcs = ${total}\n`;
  });
  msg += `--------------------------------------\n`;
  msg += `💰 Total: <b>${finalTotal.toFixed(2)}</b>\n`;
  msg += `____________________________\n`;
  return msg;
};

export const formatCasaTransaction = ({
  type,        // 'in' | 'out'
  amount,      // this transaction amount
  category,    // 'Sale' | 'Deposit' | 'Return Refund' | 'Customer Payment' | 'Balance Payment' | 'Manual IN' | 'Manual OUT' ...
  customerName,// customer name if applicable
  balanceBefore,// casa balance BEFORE this transaction
  balance,     // casa balance AFTER this transaction
  todayIn,     // total IN today
  todayOut,    // total OUT today
}) => {
  const isIn = type === 'in';
  const sign = isIn ? '+' : '-';
  const icon = isIn ? '➕🟢' : '➖ 🔴';
  const amt = parseFloat(amount || 0);
  const balAfter = parseFloat(balance ?? 0);
  const balBefore = parseFloat(balanceBefore ?? (isIn ? balAfter - amt : balAfter + amt));
  const netToday = parseFloat(todayIn || 0) - parseFloat(todayOut || 0);

  // Category label map
  const categoryLabels = {
    'Sale': '🛍 Sale',
    'Deposit': '🔖 Deposit',
    'Return Refund': '↩️ Customer Return',
    'Customer Payment': '💳 Customer Payment',
    'Balance Payment': '💳 Balance Payment',
    'Manual IN': '📥 Manual IN',
    'Manual OUT': '📤 Manual OUT',
    'Commission Paid': '🤝 Commission',
    'Factory Payment': '🏭 Factory Payment',
    'Expense': '💸 Expense',
  };
  const categoryLabel = categoryLabels[category] || `📋 ${category || 'Transaction'}`;

  let msg = `${icon} <b>CASA ${sign}${amt.toFixed(2)}</b>\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `${categoryLabel}\n`;
  if (customerName) msg += `👤 ${customerName}\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `🔙 Casa was: $${balBefore.toFixed(2)}\n`;
  if (isIn) {
    msg += `➕🟢 Received: <b>+$${amt.toFixed(2)}</b>\n`;
  } else {
    msg += `➖ 🔴 Paid out: <b>-$${amt.toFixed(2)}</b>\n`;
  }
  msg += `✅ Casa now: <b>$${balAfter.toFixed(2)}</b>\n`;
  
  msg += `━━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `📈 Total IN Today:  <b>+$${parseFloat(todayIn || 0).toFixed(2)}</b>\n`;
  msg += `📉 Total OUT Today: <b>-$${parseFloat(todayOut || 0).toFixed(2)}</b>\n`;
  msg += `💰 Net Today: <b>${netToday >= 0 ? '+' : ''}${netToday.toFixed(2)}</b>\n\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `📅 ${new Date().toLocaleDateString('en-GB')} ${new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}`;
  
  return msg;
};
