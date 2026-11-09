const fs = require('fs');
let code = fs.readFileSync('src/screens/ModelDetailScreen.jsx', 'utf8');

// Hide Edit Prices
code = code.replace(
  /<button className="btn btn-secondary btn-sm" onClick=\{\(\) => \{/g,
  `{!isWatcherDevice() && <button className="btn btn-secondary btn-sm" onClick={() => {`
);
code = code.replace(
  /Edit Prices<\/button>/g,
  `Edit Prices</button>}`
);

// Hide Add Color
code = code.replace(
  /<button className="btn btn-primary" onClick=\{\(\) => setShowAddColorModal\(true\)\}>/g,
  `{!isWatcherDevice() && <button className="btn btn-primary" onClick={() => setShowAddColorModal(true)}>`
);
code = code.replace(
  /Add Color<\/button>/g,
  `Add Color</button>}`
);
// Wait, the "Add Color" in modal footer also matches... I'll just change the first one manually using sed to avoid breaking modal.
