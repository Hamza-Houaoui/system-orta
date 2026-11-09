import db from './src/core/db.js';
db.sizeSeries.toArray().then(sers => console.log(sers)).catch(console.error);
