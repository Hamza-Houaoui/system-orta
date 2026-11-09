const fs = require('fs');
let code = fs.readFileSync('src/screens/FactoryDetailScreen.jsx', 'utf8');

code = code.replace(
  /onStockChanged\(cat\.id\);/g,
  'catalogIdsToUpdate.add(cat.id);'
);

fs.writeFileSync('src/screens/FactoryDetailScreen.jsx', code);
console.log('Fixed factory return onStockChanged');
