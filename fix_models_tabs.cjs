const fs = require('fs');
let code = fs.readFileSync('src/screens/ModelsScreen.jsx', 'utf8');

// Hide Add Category card
code = code.replace(
  /<div className="card" style=\{\{ marginBottom: 16 \}\}>\s*<div className="form-label" style=\{\{ marginBottom: 12 \}\}>ADD CATEGORY<\/div>/g,
  `{!isWatcherDevice() && <div className="card" style={{ marginBottom: 16 }}>
              <div className="form-label" style={{ marginBottom: 12 }}>ADD CATEGORY</div>`
);
code = code.replace(
  /<button className="btn btn-primary" onClick=\{addCategory\} disabled=\{saving\}>Add<\/button>\s*<\/div>\s*<\/div>\s*<\/div>/g,
  `<button className="btn btn-primary" onClick={addCategory} disabled={saving}>Add</button>
                </div>
              </div>
            </div>}`
);

// Hide Add Color card
code = code.replace(
  /<div className="card" style=\{\{ marginBottom: 16 \}\}>\s*<div className="form-label" style=\{\{ marginBottom: 12 \}\}>ADD COLOR<\/div>/g,
  `{!isWatcherDevice() && <div className="card" style={{ marginBottom: 16 }}>
              <div className="form-label" style={{ marginBottom: 12 }}>ADD COLOR</div>`
);
code = code.replace(
  /<button className="btn btn-primary" onClick=\{addColor\} disabled=\{saving\}>Add<\/button>\s*<\/div>\s*<\/div>\s*<\/div>/g,
  `<button className="btn btn-primary" onClick={addColor} disabled={saving}>Add</button>
                </div>
              </div>
            </div>}`
);

// Hide Add Size Series card
code = code.replace(
  /<div className="card" style=\{\{ marginBottom: 16 \}\}>\s*<div className="form-label" style=\{\{ marginBottom: 12 \}\}>ADD SIZE SERIES<\/div>/g,
  `{!isWatcherDevice() && <div className="card" style={{ marginBottom: 16 }}>
              <div className="form-label" style={{ marginBottom: 12 }}>ADD SIZE SERIES</div>`
);
code = code.replace(
  /<button className="btn btn-primary" onClick=\{addSeries\} disabled=\{saving\}>Add<\/button>\s*<\/div>\s*<\/div>\s*<\/div>/g,
  `<button className="btn btn-primary" onClick={addSeries} disabled={saving}>Add</button>
                </div>
              </div>
            </div>}`
);

fs.writeFileSync('src/screens/ModelsScreen.jsx', code);
console.log('Fixed ModelsScreen tabs');
