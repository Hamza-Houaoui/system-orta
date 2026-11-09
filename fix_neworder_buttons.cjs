const fs = require('fs');
let code = fs.readFileSync('src/screens/NewOrderScreen.jsx', 'utf8');

const targetImports = `import { Share2, FileText, Upload, Printer, Download } from 'lucide-react';`;
const replacementImports = `import { Share2, FileText, Upload, Printer, Download } from 'lucide-react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';`;

if (!code.includes('@capacitor/share')) {
    code = code.replace(targetImports, replacementImports);
}

const targetLogic = `  const [saving, setSaving] = useState(false);`;
const replacementLogic = `  const [saving, setSaving] = useState(false);

  const generateInvoiceText = () => {
    let text = \`*فاتورة / INVOICE*\\n\`;
    text += \`--------------------------------\\n\`;
    text += \`*الزبون / Customer:* \${customer?.name}\\n\`;
    if (customer?.phone) text += \`*الهاتف / Phone:* \${customer.phone}\\n\`;
    text += \`*التاريخ / Date:* \${new Date().toLocaleString()}\\n\`;
    text += \`--------------------------------\\n\`;
    
    items.forEach((item, i) => {
      text += \`*\${i+1}. الموديل / Model:* \${item.catalogCode} (\${item.colorName || item.colorCode})\\n\`;
      text += \`   *الكمية / Qty:* \${item.totalQty} (\${item.sizes.map(s => \`\${s.size}:\${s.qty}\`).join(' ')})\\n\`;
      text += \`   *السعر / Price:* $\${item.price.toFixed(2)}\\n\`;
      text += \`   *الإجمالي / Total:* $\${(item.totalQty * item.price).toFixed(2)}\\n\`;
      text += \`-\\n\`;
    });
    
    text += \`--------------------------------\\n\`;
    const subtotal = items.reduce((s, i) => s + (i.totalQty * i.price), 0);
    text += \`*المجموع / Subtotal:* $\${subtotal.toFixed(2)}\\n\`;
    if (discountAmount > 0) {
      text += \`*الخصم / Discount:* $\${parseFloat(discountAmount).toFixed(2)}\\n\`;
    }
    const finalTotal = subtotal - (parseFloat(discountAmount) || 0);
    text += \`*الإجمالي النهائي / Final Total:* $\${finalTotal.toFixed(2)}\\n\`;
    
    if (orderType === 'deposit') {
       text += \`*المدفوع / Deposit:* $\${parseFloat(depositAmount).toFixed(2)}\\n\`;
       text += \`*المتبقي / Remaining:* $\${(finalTotal - (parseFloat(depositAmount)||0)).toFixed(2)}\\n\`;
    } else if (orderType === 'paid') {
       text += \`*الحالة / Status:* مدفوعة بالكامل (PAID)\\n\`;
    }
    
    if (note) {
      text += \`--------------------------------\\n\`;
      text += \`*ملاحظات / Notes:* \${note}\\n\`;
    }
    return text;
  };

  const handleWhatsApp = () => {
    const text = generateInvoiceText();
    const phone = (customer?.phone || '').replace(/\\D/g, '');
    let url = \`https://wa.me/\`;
    if (phone) url += \`\${phone}\`;
    url += \`?text=\${encodeURIComponent(text)}\`;
    window.open(url, '_blank');
  };

  const handlePDF = async () => {
    try {
      const doc = new jsPDF();
      doc.setFontSize(20);
      doc.text("INVOICE", 105, 20, { align: "center" });
      
      doc.setFontSize(12);
      doc.text(\`Customer: \${customer?.name || 'Walk-in'}\`, 14, 40);
      if (customer?.phone) doc.text(\`Phone: \${customer.phone}\`, 14, 47);
      doc.text(\`Date: \${new Date().toLocaleString()}\`, 14, 54);
      
      const tableData = items.map((item, i) => [
        i + 1,
        \`\${item.catalogCode} (\${item.colorName || item.colorCode})\`,
        item.totalQty,
        \`$\${item.price.toFixed(2)}\`,
        \`$\${(item.totalQty * item.price).toFixed(2)}\`
      ]);
      
      doc.autoTable({
        startY: 65,
        head: [['#', 'Model (Color)', 'Qty', 'Price', 'Total']],
        body: tableData,
        theme: 'striped',
        headStyles: { fillColor: [212, 175, 55] }
      });
      
      const finalY = doc.lastAutoTable.finalY || 65;
      const subtotal = items.reduce((s, i) => s + (i.totalQty * i.price), 0);
      const discount = parseFloat(discountAmount) || 0;
      const finalTotal = subtotal - discount;
      
      doc.setFontSize(11);
      doc.text(\`Subtotal: $\${subtotal.toFixed(2)}\`, 140, finalY + 10);
      if (discount > 0) doc.text(\`Discount: $\${discount.toFixed(2)}\`, 140, finalY + 17);
      
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text(\`Total: $\${finalTotal.toFixed(2)}\`, 140, finalY + 27);
      
      if (orderType === 'deposit') {
        doc.setFontSize(11);
        doc.setFont("helvetica", "normal");
        const deposit = parseFloat(depositAmount) || 0;
        doc.text(\`Deposit: $\${deposit.toFixed(2)}\`, 140, finalY + 37);
        doc.text(\`Remaining: $\${(finalTotal - deposit).toFixed(2)}\`, 140, finalY + 44);
      } else if (orderType === 'paid') {
        doc.setFontSize(12);
        doc.setTextColor(34, 197, 94);
        doc.text(\`PAID IN FULL\`, 140, finalY + 37);
      }
      
      if (note) {
        doc.setFont("helvetica", "normal");
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(10);
        doc.text(\`Notes: \${note}\`, 14, finalY + 20);
      }
      
      const pdfBase64 = doc.output('datauristring').split(',')[1];
      const fileName = \`Invoice_\${(customer?.name || 'Walk-in').replace(/\\s+/g, '_')}_\${Date.now()}.pdf\`;
      
      const savedFile = await Filesystem.writeFile({
        path: fileName,
        data: pdfBase64,
        directory: Directory.Cache
      });
      
      await Share.share({
        title: 'Invoice',
        url: savedFile.uri,
        dialogTitle: 'Share Invoice'
      });
    } catch (e) {
      toast.error('Failed to generate PDF: ' + e.message);
    }
  };`;

code = code.replace(targetLogic, replacementLogic);

const targetWhatsappBtn = `<MessageCircle size={18} /> WhatsApp
                        </button>`;
const replacementWhatsappBtn = `<MessageCircle size={18} /> WhatsApp
                        </button>`;

code = code.replace(/<button[^>]*>\s*<MessageCircle size=\{18\} \/> WhatsApp\s*<\/button>/, `<button
                          className="btn btn-success"
                          style={{ width: '100%', padding: '12px', fontSize: '1rem', fontWeight: 'bold' }}
                          disabled={!customer}
                          onClick={handleWhatsApp}
                        >
                          <MessageCircle size={18} /> WhatsApp
                        </button>`);

code = code.replace(/<button className="btn btn-secondary btn-sm" style={{ flex: 1 }} disabled={items\.length === 0}>\s*<FileText size=\{13\} \/> PDF\s*<\/button>/, `<button className="btn btn-secondary btn-sm" style={{ flex: 1 }} disabled={items.length === 0} onClick={handlePDF}>
                            <FileText size={13} /> PDF
                          </button>`);

fs.writeFileSync('src/screens/NewOrderScreen.jsx', code);
console.log('Fixed NewOrder WhatsApp and PDF');
