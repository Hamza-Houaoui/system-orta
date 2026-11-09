const fs = require('fs');
let code = fs.readFileSync('src/screens/ModelDetailScreen.jsx', 'utf8');

const target = `<button
            onClick={() => setShowAddColor(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 20, cursor: 'pointer',
              border: '1px dashed var(--border-gold)', background: 'transparent', color: 'var(--gold)',
              fontWeight: 600, fontSize: '0.85rem'
            }}
          >
            <Plus size={14} /> Add Color
          </button>`;

const replacement = `{!isWatcherDevice() && (
            <button
              onClick={() => setShowAddColor(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 20, cursor: 'pointer',
                border: '1px dashed var(--border-gold)', background: 'transparent', color: 'var(--gold)',
                fontWeight: 600, fontSize: '0.85rem'
              }}
            >
              <Plus size={14} /> Add Color
            </button>
          )}`;

code = code.replace(target, replacement);
fs.writeFileSync('src/screens/ModelDetailScreen.jsx', code);
console.log('Fixed Add Color');
