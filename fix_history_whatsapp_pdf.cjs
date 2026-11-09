const fs = require('fs');
let code = fs.readFileSync('src/screens/HistoryScreen.jsx', 'utf8');

const generateFunctions = `
  const handleWhatsApp = (order) => {
    let text = \`*فاتورة / INVOICE*\\n\`;
    text += \`--------------------------------\\n\`;
    text += \`*الزبون / Customer:* \${order.customerName || 'Walk-in'}\\n\`;
    if (order.customerPhone) text += \`*الهاتف / Phone:* \${order.customerPhone}\\n\`;
    text += \`*التاريخ / Date:* \${new Date(order.date).toLocaleString()}\\n\`;
    text += \`--------------------------------\\n\`;
    
    let subtotal = 0;
    (order.items || []).forEach((item, i) => {
      text += \`*\${i+1}. الموديل / Model:* \${item.catalogCode} (\${item.colorName || item.colorCode})\\n\`;
      text += \`   *الكمية / Qty:* \${item.totalQty} (\${item.sizes.map(s => \`\${s.size}:\${s.qty}\`).join(' ')})\\n\`;
      text += \`   *السعر / Price:* $\${(item.unitPrice || 0).toFixed(2)}\\n\`;
      text += \`   *الإجمالي / Total:* $\${(item.totalQty * (item.unitPrice || 0)).toFixed(2)}\\n\`;
      text += \`-\\n\`;
      subtotal += (item.totalQty * (item.unitPrice || 0));
    });
    
    text += \`--------------------------------\\n\`;
    text += \`*المجموع / Subtotal:* $\${subtotal.toFixed(2)}\\n\`;
    
    const discount = parseFloat(order.discount) || 0;
    if (discount > 0) {
      text += \`*الخصم / Discount:* $\${discount.toFixed(2)}\\n\`;
    }
    
    const finalTotal = subtotal - discount;
    text += \`*الإجمالي النهائي / Final Total:* $\${finalTotal.toFixed(2)}\\n\`;
    
    if (order.type === 'deposit') {
       const depositAmount = parseFloat(order.depositAmount) || 0;
       text += \`*المدفوع / Deposit:* $\${depositAmount.toFixed(2)}\\n\`;
       text += \`*المتبقي / Remaining:* $\${(finalTotal - depositAmount).toFixed(2)}\\n\`;
    } else if (order.type === 'paid') {
       text += \`*الحالة / Status:* مدفوعة بالكامل (PAID)\\n\`;
    }
    
    if (order.notes) {
      text += \`--------------------------------\\n\`;
      text += \`*ملاحظات / Notes:* \${order.notes}\\n\`;
    }

    const phone = (order.customerPhone || '').replace(/\\D/g, '');
    let url = \`https://wa.me/\`;
    if (phone) url += \`\${phone}\`;
    url += \`?text=\${encodeURIComponent(text)}\`;
    window.open(url, '_blank');
  };

  const handlePDF = async (order) => {
    try {
      const doc = new jsPDF();
      doc.setFontSize(20);
      doc.text("INVOICE", 105, 20, { align: "center" });
      
      doc.setFontSize(12);
      doc.text(\`Customer: \${order.customerName || 'Walk-in'}\`, 14, 40);
      if (order.customerPhone) doc.text(\`Phone: \${order.customerPhone}\`, 14, 47);
      doc.text(\`Date: \${new Date(order.date).toLocaleString()}\`, 14, 54);
      doc.text(\`Invoice #: \${order.number || ''}\`, 14, 61);
      
      const tableData = (order.items || []).map((item, i) => [
        i + 1,
        \`\${item.catalogCode} (\${item.colorName || item.colorCode})\`,
        item.totalQty,
        \`$\${(item.unitPrice || 0).toFixed(2)}\`,
        \`$\${(item.totalQty * (item.unitPrice || 0)).toFixed(2)}\`
      ]);
      
      doc.autoTable({
        startY: 70,
        head: [['#', 'Model (Color)', 'Qty', 'Price', 'Total']],
        body: tableData,
        theme: 'striped',
        headStyles: { fillColor: [212, 175, 55] }
      });
      
      const finalY = doc.lastAutoTable.finalY || 70;
      let subtotal = 0;
      (order.items || []).forEach(i => subtotal += (i.totalQty * (i.unitPrice || 0)));
      
      const discount = parseFloat(order.discount) || 0;
      const finalTotal = subtotal - discount;
      
      doc.setFontSize(11);
      doc.text(\`Subtotal: $\${subtotal.toFixed(2)}\`, 140, finalY + 10);
      if (discount > 0) doc.text(\`Discount: $\${discount.toFixed(2)}\`, 140, finalY + 17);
      
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text(\`Total: $\${finalTotal.toFixed(2)}\`, 140, finalY + 27);
      
      if (order.type === 'deposit') {
        doc.setFontSize(11);
        doc.setFont("helvetica", "normal");
        const depositAmount = parseFloat(order.depositAmount) || 0;
        doc.text(\`Deposit: $\${depositAmount.toFixed(2)}\`, 140, finalY + 37);
        doc.text(\`Remaining: $\${(finalTotal - depositAmount).toFixed(2)}\`, 140, finalY + 44);
      } else if (order.type === 'paid') {
        doc.setFontSize(12);
        doc.setTextColor(34, 197, 94);
        doc.text(\`PAID IN FULL\`, 140, finalY + 37);
      }
      
      if (order.notes) {
        doc.setFont("helvetica", "normal");
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(10);
        doc.text(\`Notes: \${order.notes}\`, 14, finalY + 20);
      }
      
      const pdfBase64 = doc.output('datauristring').split(',')[1];
      const fileName = \`Invoice_\${(order.customerName || 'Walk-in').replace(/\\s+/g, '_')}_\${Date.now()}.pdf\`;
      
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
`;

code = code.replace("  const OrderCard = ({ order }) => {", generateFunctions);

const oldButtons = `{order.customerPhone && (
              <a href={\`https://wa.me/\${order.customerPhone.replace(/\\D/g,'')}\`} target="_blank" rel="noreferrer">
                <button className="btn btn-success btn-sm btn-icon" title="WhatsApp"><MessageCircle size={13}/></button>
              </a>
            )}
            <button className="btn btn-secondary btn-sm btn-icon" title="PDF"><FileText size={13}/></button>`;

const newButtons = `{order.customerPhone && (
              <button className="btn btn-success btn-sm btn-icon" title="WhatsApp" onClick={(e) => { e.stopPropagation(); handleWhatsApp(order); }}><MessageCircle size={13}/></button>
            )}
            <button className="btn btn-secondary btn-sm btn-icon" title="PDF" onClick={(e) => { e.stopPropagation(); handlePDF(order); }}><FileText size={13}/></button>`;

code = code.replace(oldButtons, newButtons);

fs.writeFileSync('src/screens/HistoryScreen.jsx', code);
