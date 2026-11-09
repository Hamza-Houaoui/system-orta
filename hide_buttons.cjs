const fs = require('fs');

function addImport(file) {
  let code = fs.readFileSync(file, 'utf8');
  if (!code.includes('isWatcherDevice')) {
    code = code.replace(
      /import \{[^}]*\} from '..\/core\/deviceSync';/,
      match => match.replace('}', ', isWatcherDevice }')
    );
    if (!code.includes('isWatcherDevice')) {
      code = `import { isWatcherDevice } from '../core/deviceSync';\n` + code;
    }
    fs.writeFileSync(file, code);
  }
}

addImport('src/screens/HistoryScreen.jsx');
addImport('src/components/InvoiceDetailModal.jsx');
addImport('src/screens/ModelDetailScreen.jsx');
addImport('src/screens/FactoryDetailScreen.jsx');
addImport('src/screens/CustomerCreditScreen.jsx');
addImport('src/screens/FactoriesScreen.jsx');
addImport('src/screens/ModelsScreen.jsx');

console.log('Added imports');
