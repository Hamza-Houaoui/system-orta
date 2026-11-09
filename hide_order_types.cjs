const fs = require('fs');
let code = fs.readFileSync('src/screens/NewOrderScreen.jsx', 'utf8');
code = code.replace(
  `import { getDeviceId } from '../core/deviceSync';`,
  `import { getDeviceId, isWatcherDevice } from '../core/deviceSync';`
);

code = code.replace(
  `{ORDER_TYPES.map(t => {`,
  `{ORDER_TYPES.filter(t => isWatcherDevice() ? t === 'preforma' : true).map(t => {`
);

fs.writeFileSync('src/screens/NewOrderScreen.jsx', code);
console.log('Hid order types');
