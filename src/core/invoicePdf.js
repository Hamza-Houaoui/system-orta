export const fmtMoney = (n) => {
  const v = Math.round((Number(n) || 0) * 100) / 100;
  return Number.isInteger(v) ? String(v) : v.toFixed(2);
};

export const PDF_TITLE_MAP = { paid: 'PAID', deposit: 'DEPOSIT', preforma: 'NO PAID', returned: 'RETURNED', manual_debt: 'CREDIT' };

// Draws the shared shop header: logo (top-left), QR (top-right), invoice # above
// the QR, date+time under the logo, gold shop name, phone/address, separator.
// Returns the y position just below the separator.
// `subUnderQr`: optional array of short lines drawn under the QR (e.g. customer code/cargo).
export async function drawPdfHeader(doc, { settings, invoiceNo = '', when = Date.now(), subUnderQr = [] } = {}) {
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 14;
  let logoData = settings?.shopLogo || '';
  let qrData = null;
  if (settings?.website) {
    try {
      const qrcode = await import('qrcode');
      qrData = await qrcode.toDataURL(settings.website, { margin: 1, width: 220 });
    } catch (e) { qrData = null; }
  }

  const boxSize = 30;
  if (logoData) {
    try { doc.addImage(logoData, 'PNG', margin, 14, 46, 30); } catch (e) { /* ignore bad logo */ }
  }
  let qrX = pageW - margin - boxSize;
  if (qrData) {
    try { doc.addImage(qrData, 'PNG', qrX, 14, boxSize, boxSize); } catch (e) { /* ignore */ }
  }
  if (subUnderQr.length) {
    doc.setFontSize(8);
    doc.setTextColor(60, 60, 60);
    doc.text(subUnderQr.join('\n'), qrX, 14 + boxSize + 6, { align: 'right' });
    doc.setTextColor(0, 0, 0);
  }

  if (invoiceNo) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(60, 60, 60);
    doc.text(`Invoice #: ${invoiceNo}`, pageW - margin, 10, { align: 'right' });
    doc.setTextColor(0, 0, 0);
  }

  const dte = new Date(when);
  const dateLine = `${dte.toLocaleDateString()}  ${dte.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(90, 90, 90);
  doc.text(`Date: ${dateLine}`, margin, 14 + boxSize + 5);
  doc.setTextColor(0, 0, 0);

  const shopName = settings?.shopName || 'System Orta';
  const leftBottom = logoData ? 14 + boxSize : 0;
  const rightBottom = qrData ? (14 + boxSize + (subUnderQr.length ? 9 : 0)) : 0;
  const headStartY = Math.max(20, leftBottom, rightBottom) + 3;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(212, 175, 55);
  doc.text(String(shopName), pageW / 2, headStartY, { align: 'center' });
  doc.setTextColor(0, 0, 0);

  const subLines = [];
  if (settings?.shopPhone) subLines.push(String(settings.shopPhone));
  if (settings?.shopAddress) subLines.push(String(settings.shopAddress));
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(80, 80, 80);
  subLines.forEach((l, i) => doc.text(l, pageW / 2, headStartY + 6 + i * 5, { align: 'center' }));
  doc.setTextColor(0, 0, 0);

  let y = headStartY + 6 + subLines.length * 5 + 6;

  doc.setDrawColor(212, 175, 55);
  doc.setLineWidth(1);
  doc.line(margin, y, pageW - margin, y);

  return { y };
}

// Shared enhanced invoice renderer used by both NewOrder and History.
// `params`: {
//   settings,            // { shopLogo, website, shopName, shopPhone, shopAddress }
//   items,               // raw items: each { catalogCode, colorName, colorCode, unitPrice, totalPrice?, sizes?, firstAsset? }
//   customer,            // { name, phone, code?, cargoName? }
//   orderType,           // 'paid' | 'deposit' | 'preforma'
//   discount,            // number
//   depositAmount,       // number (string ok)
//   note,                // string
//   invoiceNo,           // string shown above the QR
//   when,                // ms timestamp for the date line (default now)
// }
export async function buildInvoicePdf(params) {
  const {
    settings,
    items,
    customer,
    orderType,
    discount = 0,
    depositAmount = 0,
    note = '',
    invoiceNo = '',
    when = Date.now(),
  } = params;

  const jsPDF = (await import('jspdf')).default;
  await import('jspdf-autotable');
  const doc = new jsPDF();

  const pageW = doc.internal.pageSize.getWidth();
  const margin = 14;
  const invoiceTitle = PDF_TITLE_MAP[orderType] || 'INVOICE';
  const shopName = settings?.shopName || 'System Orta';

  // ── Header images (logo left, QR right) ─────────────
  let logoData = settings?.shopLogo || '';
  let qrData = null;
  if (settings?.website) {
    try {
      const qrcode = await import('qrcode');
      qrData = await qrcode.toDataURL(settings.website, { margin: 1, width: 220 });
    } catch (e) { qrData = null; }
  }

  const boxSize = 30;
  if (logoData) {
    const logoW = 46;
    const logoH = 30;
    try { doc.addImage(logoData, 'PNG', margin, 14, logoW, logoH); } catch (e) { /* ignore bad logo */ }
  }
  let qrX = pageW - margin - boxSize;
  if (qrData) {
    try { doc.addImage(qrData, 'PNG', qrX, 14, boxSize, boxSize); } catch (e) { /* ignore */ }
  }
  const customerCode = customer?.code || '';
  const cargoName = customer?.cargoName || '';
  if (customerCode || cargoName) {
    let extra = `code: ${customerCode}`;
    if (cargoName) extra += `\ncargo: ${cargoName}`;
    doc.setFontSize(8);
    doc.setTextColor(60, 60, 60);
    doc.text(extra, qrX, 14 + boxSize + 6, { align: 'right' });
    doc.setTextColor(0, 0, 0);
  }

  // Invoice number above the QR (top-right)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(60, 60, 60);
  doc.text(`Invoice #: ${invoiceNo}`, pageW - margin, 10, { align: 'right' });
  doc.setTextColor(0, 0, 0);

  // Date + time under the shop logo (top-left)
  const dte = new Date(when);
  const dateLine = `${dte.toLocaleDateString()}  ${dte.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(90, 90, 90);
  doc.text(`Date: ${dateLine}`, margin, 14 + boxSize + 5);
  doc.setTextColor(0, 0, 0);

  // ── Shop header (name / phone / address) ────────────
  const leftBottom = logoData ? 14 + boxSize : 0;
  const rightBottom = qrData ? (14 + boxSize + (customerCode || cargoName ? 9 : 0)) : 0;
  const headStartY = Math.max(20, leftBottom, rightBottom) + 3;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(212, 175, 55);
  doc.text(String(shopName), pageW / 2, headStartY, { align: 'center' });
  doc.setTextColor(0, 0, 0);

  const subLines = [];
  if (settings?.shopPhone) subLines.push(String(settings.shopPhone));
  if (settings?.shopAddress) subLines.push(String(settings.shopAddress));
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(80, 80, 80);
  subLines.forEach((l, i) => doc.text(l, pageW / 2, headStartY + 6 + i * 5, { align: 'center' }));
  doc.setTextColor(0, 0, 0);

  let y = headStartY + 6 + subLines.length * 5 + 6;

  // Separator
  doc.setDrawColor(212, 175, 55);
  doc.setLineWidth(1);
  doc.line(margin, y, pageW - margin, y);

  // ── Title (order type) + date ───────────────────────
  y += 12;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  const titleColor = { paid: [34, 197, 94], deposit: [212, 175, 55], returned: [239, 68, 68], preforma: [130, 130, 130], manual_debt: [59, 130, 246] }[orderType] || [212, 175, 55];
  doc.setTextColor(titleColor[0], titleColor[1], titleColor[2]);
  doc.text(invoiceTitle, pageW / 2, y, { align: 'center' });
  doc.setTextColor(0, 0, 0);

  y += 8;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(`Customer: ${customer?.name || 'Walk-in'}`, margin, y);
  if (customer?.phone) {
    doc.setFont('helvetica', 'normal');
    doc.text(`Phone: ${customer.phone}`, margin, y + 6);
  }
  y += (customer?.phone ? 12 : 6);

  // ── Items table (with per-model barcode) ────────────
  const itemsForTable = await Promise.all((items || []).map(async (item) => {
    let barcodeData = null;
    try {
      const JsBarcode = (await import('jsbarcode')).default;
      const canvas = document.createElement('canvas');
      await JsBarcode(canvas, String(item.catalogCode), {
        format: 'CODE128', displayValue: false, height: 14, width: 1, margin: 0
      });
      barcodeData = canvas.toDataURL('image/png');
    } catch (e) { barcodeData = null; }
    let thumb = null;
    const asset = item.firstAsset;
    if (asset && asset.blob) {
      try {
        thumb = await new Promise((resolve) => {
          const r = new FileReader();
          r.onload = () => resolve(r.result);
          r.onerror = () => resolve(null);
          r.readAsDataURL(asset.blob);
        });
      } catch (e) { thumb = null; }
    }
    const sizesStr = (item.sizes || []).map(s => `${s.size}×${s.qty}`).join(', ');
    const qty = (item.sizes || []).reduce((s, x) => s + (x.qty || 0), 0) || item.totalQty || 1;
    const lineTotal = item.totalPrice != null ? item.totalPrice : (qty * (item.unitPrice || 0));
    return {
      code: item.catalogCode,
      barcode: barcodeData,
      color: item.colorName || item.colorCode || '',
      thumb,
      sizes: sizesStr,
      price: fmtMoney(item.unitPrice || 0),
      total: fmtMoney(lineTotal),
      lineTotal,
    };
  }));

  doc.autoTable({
    startY: y,
    margin: { left: margin, right: margin },
    head: [['#', 'Model', 'Color', 'Sizes', 'Price', 'Total']],
    body: itemsForTable.map((r, i) => [i + 1, r.code, r.color, r.sizes, r.price, r.total]),
    styles: { cellPadding: { top: 4, right: 3, bottom: 4, left: 3 }, fontSize: 8 },
    didParseCell: (data) => {
      if (data.section === 'head') {
        data.cell.styles.fillColor = [212, 175, 55];
        data.cell.styles.textColor = [0, 0, 0];
        data.cell.styles.fontStyle = 'bold';
      }
      if (data.section === 'body') {
        const row = itemsForTable[data.row.index];
        data.cell.styles.minCellHeight = (row && row.thumb) ? 22 : 16;
        if (data.column.index === 1) {
          data.cell.styles.cellPadding = { top: 4, right: 8, bottom: 4, left: 3 };
          if (data.cell.text && data.cell.text.length > 0) {
            data.cell.text[0] = ' ' + data.cell.text[0];
          }
        } else if (data.column.index === 2) {
          data.cell.styles.cellPadding = { top: 4, right: 8, bottom: 4, left: 3 };
        }
      }
    },
    didDrawCell: (data) => {
      if (data.section === 'body' && data.column.index === 1) {
        const row = itemsForTable[data.row.index];
        if (row && row.barcode) {
          const bw = 20;
          const bh = 8;
          try {
            doc.addImage(
              row.barcode, 'PNG',
              data.cell.x + data.cell.width - bw - 4,
              data.cell.y + 3,
              bw, bh
            );
          } catch (e) { /* ignore */ }
        }
      } else if (data.section === 'body' && data.column.index === 2) {
        const row = itemsForTable[data.row.index];
        if (row && row.thumb) {
          const tw = 8;
          const th = 11;
          try {
            doc.addImage(
              row.thumb, 'JPEG',
              data.cell.x + data.cell.width - tw - 7,
              data.cell.y + (data.cell.height - th) / 2 - 1.5,
              tw, th
            );
          } catch (e) { /* ignore */ }
        }
      }
    },
    columnStyles: {
      0: { cellWidth: 10 },
      1: { cellWidth: 55 },
      2: { cellWidth: 36 },
      3: { cellWidth: 34 },
      4: { cellWidth: 22, halign: 'right' },
      5: { cellWidth: 25, halign: 'right' },
    },
    tableWidth: 'auto',
    theme: 'striped',
  });

  const finalY = doc.lastAutoTable.finalY || y + 30;

  // ── Totals ───────────────────────────────────────────
  const subtotal = itemsForTable.reduce((s, r) => s + (r.lineTotal || 0), 0);
  const discountVal = parseFloat(discount) || 0;
  const finalTotal = subtotal - discountVal;
  let ty = finalY + 8;
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text(`Subtotal: $${fmtMoney(subtotal)}`, pageW - margin, ty, { align: 'right' });
  ty += 6;
  if (discountVal > 0) {
    doc.setTextColor(220, 38, 38);
    doc.text(`Discount: -$${fmtMoney(discountVal)}`, pageW - margin, ty, { align: 'right' });
    doc.setTextColor(0, 0, 0);
    ty += 6;
  }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(`TOTAL: $${fmtMoney(finalTotal)}`, pageW - margin, ty, { align: 'right' });
  ty += 8;

  if (orderType === 'deposit') {
    const deposit = parseFloat(depositAmount) || 0;
    const remaining = finalTotal - deposit;
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(34, 197, 94);
    doc.setFontSize(13);
    doc.text(`Deposit: $${fmtMoney(deposit)}`, pageW - margin, ty, { align: 'right' });
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(11);
    doc.text(`Remaining: $${fmtMoney(remaining)}`, pageW - margin, ty + 7, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    ty += 16;
  } else if (orderType === 'paid') {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(34, 197, 94);
    doc.setFontSize(12);
    doc.text('PAID IN FULL', pageW - margin, ty, { align: 'right' });
    doc.setTextColor(0, 0, 0);
    ty += 8;
  }

  // ── Note (plain black text, no frame) ───────────────
  if (note && String(note).trim()) {
    ty += 6;
    const noteText = String(note).trim();
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);
    const wrapped = doc.splitTextToSize(noteText, pageW - margin * 2);
    doc.text(wrapped, margin, ty + 3);
    ty += wrapped.length * 4 + 4;
  }

  // ── Footer (professional English) ────────────────────
  const footerEn = 'No return or exchange is allowed after the date of the invoice. Thank you for your understanding.';
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text(footerEn, pageW / 2, doc.internal.pageSize.getHeight() - 10, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0, 0, 0);

  return doc;
}
