const fs = require('fs');
let code = fs.readFileSync('src/screens/NewOrderScreen.jsx', 'utf8');

code = code.replace(
  /commission: commission > 0 \? commission : 0,/g,
  `commission: (commission > 0 ? commission : 0) + (finalOrderType === 'paid' && actualAmountPaid < total ? total - actualAmountPaid : 0),`
);

// Wait, actualAmountPaid is defined AFTER the order object is created!
