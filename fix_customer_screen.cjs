const fs = require('fs');

function fixCustomer(file) {
  if (!fs.existsSync(file)) return;
  let code = fs.readFileSync(file, 'utf8');
  if (!code.includes('isWatcherDevice')) {
    code = code.replace(
      /import \{[^}]*\} from '..\/core\/deviceSync';/,
      match => match.replace('}', ', isWatcherDevice }')
    );
    if (!code.includes('isWatcherDevice')) {
      code = `import { isWatcherDevice } from '../core/deviceSync';\n` + code;
    }
  }
  
  code = code.replace(
    /<button className="btn btn-danger" style={{ flex: 1 }} onClick=\{\(\) => setModal\('add'\)\}>/g,
    `{!isWatcherDevice() && <button className="btn btn-danger" style={{ flex: 1 }} onClick={() => setModal('add')}>`
  );
  code = code.replace(
    /<Plus size=\{18\}\/> Add Debt\s*<\/button>/g,
    `<Plus size={18}/> Add Debt</button>}`
  );
  
  code = code.replace(
    /<button className="btn btn-success" style={{ flex: 1 }} onClick=\{\(\) => setModal\('pay'\)\}>/g,
    `{!isWatcherDevice() && <button className="btn btn-success" style={{ flex: 1 }} onClick={() => setModal('pay')}>`
  );
  code = code.replace(
    /<DollarSign size=\{18\}\/> Pay Debt\s*<\/button>/g,
    `<DollarSign size={18}/> Pay Debt</button>}`
  );
  
  fs.writeFileSync(file, code);
}

fixCustomer('src/screens/CustomerCreditScreen.jsx');
fixCustomer('src/screens/CustomerDetailScreen.jsx');
console.log('Fixed Customer screens');
