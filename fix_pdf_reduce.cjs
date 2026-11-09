const fs = require('fs');
let code = fs.readFileSync('src/screens/NewOrderScreen.jsx', 'utf8');

code = code.replace(/i\.price/g, '(i.unitPrice || 0)');
// And wait, I lost the dollar signs in lines 149 and 150?
// Original: `   *السعر / Price:* $${item.price.toFixed(2)}\n`;
// After replace: `   *السعر / Price:* ${(item.unitPrice || 0).toFixed(2)}\n`;
// Yes, the dollar sign was lost because my original string was \`   *السعر / Price:* $\${item.price.toFixed(2)}\\n\`
// Wait, my replacement logic didn't remove the dollar sign!
// Actually, `$\${(item.unitPrice || 0).toFixed(2)}` in bash becomes `\${...}` if I used bash string interpolation incorrectly, or I forgot the $ in the first place?
// Let's re-add the $
code = code.replace(/\*السعر \/ Price:\* \$\{/g, '*السعر / Price:* $${');
code = code.replace(/\*الإجمالي \/ Total:\* \$\{/g, '*الإجمالي / Total:* $${');
code = code.replace(/Price\', \'Total\'\]\],\n        body: tableData,/g, 'Price\', \'Total\']],\n        body: tableData,');

// Also fix tableData mapping in PDF
code = code.replace(/\`\$\{(item\.unitPrice \|\| 0)\.toFixed\(2\)\}\`/g, '\`$${(item.unitPrice || 0).toFixed(2)}\`');
code = code.replace(/\`\$\{(item\.totalQty \* \(item\.unitPrice \|\| 0\))\.toFixed\(2\)\}\`/g, '\`$${(item.totalQty * (item.unitPrice || 0)).toFixed(2)}\`');

fs.writeFileSync('src/screens/NewOrderScreen.jsx', code);
