const fs = require('fs');
let code = fs.readFileSync('src/screens/NewOrderScreen.jsx', 'utf8');

const targetLogic = `      await Share.share({
        title: 'Invoice',
        url: savedFile.uri,
        dialogTitle: 'Share Invoice'
      });
      saveOrder();
    } catch (e) {
      toast.error('Failed to generate PDF: ' + e.message);
    }`;

const replacementLogic = `      try {
        await Share.share({
          title: 'Invoice',
          url: savedFile.uri,
          dialogTitle: 'Share Invoice'
        });
      } catch (shareErr) {
        // Fallback for Web/Desktop browsers where Share API is not available
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
    }`;

code = code.replace(targetLogic, replacementLogic);
fs.writeFileSync('src/screens/NewOrderScreen.jsx', code);
