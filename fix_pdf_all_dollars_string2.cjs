const fs = require('fs');
let code = fs.readFileSync('src/screens/NewOrderScreen.jsx', 'utf8');

code = code.replace("`Subtotal: ${subtotal.toFixed(2)}`", "`Subtotal: $${subtotal.toFixed(2)}`");
code = code.replace("`Discount: ${discountVal.toFixed(2)}`", "`Discount: $${discountVal.toFixed(2)}`");
code = code.replace("`Total: ${finalTotal.toFixed(2)}`", "`Total: $${finalTotal.toFixed(2)}`");
code = code.replace("`Deposit: ${deposit.toFixed(2)}`", "`Deposit: $${deposit.toFixed(2)}`");
code = code.replace("`Remaining: ${(finalTotal - deposit).toFixed(2)}`", "`Remaining: $${(finalTotal - deposit).toFixed(2)}`");

fs.writeFileSync('src/screens/NewOrderScreen.jsx', code);
