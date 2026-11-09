const fs = require('fs');
let code = fs.readFileSync('src/screens/NewOrderScreen.jsx', 'utf8');

// I will just replace the specific lines
code = code.replace(/text \+= \`   \*السعر \/ Price:\* \$\{\(item.unitPrice \|\| 0\).toFixed\(2\)\}\\n\`;/g, 'text += \`   *السعر / Price:* $\${(item.unitPrice || 0).toFixed(2)}\\n\`;');
code = code.replace(/text \+= \`   \*الإجمالي \/ Total:\* \$\{\(item.totalQty \* \(item.unitPrice \|\| 0\)\).toFixed\(2\)\}\\n\`;/g, 'text += \`   *الإجمالي / Total:* $\${(item.totalQty * (item.unitPrice || 0)).toFixed(2)}\\n\`;');
code = code.replace(/text \+= \`\*المجموع \/ Subtotal:\* \$\{subtotal.toFixed\(2\)\}\\n\`;/g, 'text += \`*المجموع / Subtotal:* $\${subtotal.toFixed(2)}\\n\`;');
code = code.replace(/text \+= \`\*الخصم \/ Discount:\* \$\{parseFloat\(discountAmount\).toFixed\(2\)\}\\n\`;/g, 'text += \`*الخصم / Discount:* $\${parseFloat(discountAmount).toFixed(2)}\\n\`;');
code = code.replace(/text \+= \`\*الإجمالي النهائي \/ Final Total:\* \$\{finalTotal.toFixed\(2\)\}\\n\`;/g, 'text += \`*الإجمالي النهائي / Final Total:* $\${finalTotal.toFixed(2)}\\n\`;');
code = code.replace(/text \+= \`\*المدفوع \/ Deposit:\* \$\{parseFloat\(depositAmount\).toFixed\(2\)\}\\n\`;/g, 'text += \`*المدفوع / Deposit:* $\${parseFloat(depositAmount).toFixed(2)}\\n\`;');
code = code.replace(/text \+= \`\*المتبقي \/ Remaining:\* \$\{\(finalTotal - \(parseFloat\(depositAmount\)\|\|0\)\).toFixed\(2\)\}\\n\`;/g, 'text += \`*المتبقي / Remaining:* $\${(finalTotal - (parseFloat(depositAmount)||0)).toFixed(2)}\\n\`;');

fs.writeFileSync('src/screens/NewOrderScreen.jsx', code);
