const fs = require('fs');
let code = fs.readFileSync('src/screens/ModelDetailScreen.jsx', 'utf8');

const target = `                        <input
                          type="number"
                          value={qty}
                          onChange={(e) => updateStock(activeColor.id, size, e.target.value)}
                          style={{ width: 80, textAlign: 'center', fontSize: '1.1rem', fontWeight: 700 }}
                        />`;

const replacement = `                        <input
                          key={\`\${activeColor.id}-\${size}\`}
                          type="number"
                          defaultValue={qty}
                          onBlur={(e) => updateStock(activeColor.id, size, e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); }}
                          style={{ width: 80, textAlign: 'center', fontSize: '1.1rem', fontWeight: 700 }}
                        />`;

code = code.replace(target, replacement);
fs.writeFileSync('src/screens/ModelDetailScreen.jsx', code);
console.log('Fixed stock input onBlur');
