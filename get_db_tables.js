import db from './src/core/db.js';
console.log(db.tables.map(t => t.name));
