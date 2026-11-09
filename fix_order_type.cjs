const fs = require('fs');
let code = fs.readFileSync('src/screens/NewOrderScreen.jsx', 'utf8');

code = code.replace(
  /setOrderType\(null\);/g,
  `setOrderType(isWatcherDevice() ? 'preforma' : null);`
);
code = code.replace(
  /const \[orderType, setOrderType\] = useState\(null\);/g,
  `const [orderType, setOrderType] = useState(isWatcherDevice() ? 'preforma' : null);`
);
// Make sure we always set to preforma if watcher
// Let's also hide the step 1 entirely for watcher, since they don't have a choice anyway?
// Wait, the user said "e5fi paid w deposit invoice summary w5ali ken preforma"
// By filtering `ORDER_TYPES`, they only see "preforma". But it's better to hide the Step 1 entirely if it's a watcher.
code = code.replace(
  /\{\/\* Step 1: Order Type \*\/\}/g,
  `{/* Step 1: Order Type */}\n                {!isWatcherDevice() && (`
);
code = code.replace(
  /\{\/\* Step 2: Items Summary \*\/\}/g,
  `)}\n                {/* Step 2: Items Summary */}`
);

fs.writeFileSync('src/screens/NewOrderScreen.jsx', code);
console.log('Fixed NewOrderScreen order type');
