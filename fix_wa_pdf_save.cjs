const fs = require('fs');
let code = fs.readFileSync('src/screens/NewOrderScreen.jsx', 'utf8');

code = code.replace(/window.open\(url, '_blank'\);\n  \};/g, "window.open(url, '_blank');\n    saveOrder();\n  };");
code = code.replace(/await Share.share\(\{\n        title: 'Invoice',\n        url: savedFile.uri,\n        dialogTitle: 'Share Invoice'\n      \}\);\n    \} catch \(e\) \{/g, "await Share.share({\n        title: 'Invoice',\n        url: savedFile.uri,\n        dialogTitle: 'Share Invoice'\n      });\n      saveOrder();\n    } catch (e) {");

fs.writeFileSync('src/screens/NewOrderScreen.jsx', code);
