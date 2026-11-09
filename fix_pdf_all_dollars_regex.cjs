const fs = require('fs');
let code = fs.readFileSync('src/screens/NewOrderScreen.jsx', 'utf8');

code = code.replace(/Subtotal: \$\{subtotal\.toFixed\(2\)\}/g, "Subtotal: $$${subtotal.toFixed(2)}");
code = code.replace(/Discount: \$\{discountVal\.toFixed\(2\)\}/g, "Discount: $$${discountVal.toFixed(2)}");
code = code.replace(/Total: \$\{finalTotal\.toFixed\(2\)\}/g, "Total: $$${finalTotal.toFixed(2)}");
code = code.replace(/Deposit: \$\{deposit\.toFixed\(2\)\}/g, "Deposit: $$${deposit.toFixed(2)}");
code = code.replace(/Remaining: \$\{\(finalTotal - deposit\)\.toFixed\(2\)\}/g, "Remaining: $$${(finalTotal - deposit).toFixed(2)}");

// Also the invoice text:
code = code.replace(/Subtotal:\* \$\{subtotal\.toFixed\(2\)\}/g, "Subtotal:* $$${subtotal.toFixed(2)}");
code = code.replace(/Discount:\* \$\{parseFloat\(discount\)\.toFixed\(2\)\}/g, "Discount:* $$${parseFloat(discount).toFixed(2)}");
code = code.replace(/Total:\* \$\{finalTotal\.toFixed\(2\)\}/g, "Total:* $$${finalTotal.toFixed(2)}");
code = code.replace(/Deposit:\* \$\{parseFloat\(depositAmount\)\.toFixed\(2\)\}/g, "Deposit:* $$${parseFloat(depositAmount).toFixed(2)}");
code = code.replace(/Remaining:\* \$\{\(finalTotal - \(parseFloat\(depositAmount\)\|\|0\)\)\.toFixed\(2\)\}/g, "Remaining:* $$${(finalTotal - (parseFloat(depositAmount)||0)).toFixed(2)}");

fs.writeFileSync('src/screens/NewOrderScreen.jsx', code);
