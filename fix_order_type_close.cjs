const fs = require('fs');
let code = fs.readFileSync('src/screens/NewOrderScreen.jsx', 'utf8');

code = code.replace(
  /\{\/\* Step 2: Fields based on type \*\/\}/g,
  `)}\n                {/* Step 2: Fields based on type */}`
);
// Remove the broken one I added
code = code.replace(
  /\)\}\n                \{\/\* Step 2: Items Summary \*\/\}/g,
  ``
);

fs.writeFileSync('src/screens/NewOrderScreen.jsx', code);
console.log('Fixed NewOrderScreen close tag');
