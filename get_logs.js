import { Dexie } from 'dexie';
import indexedDB from 'fake-indexeddb';
import FDBKeyRange from 'fake-indexeddb/lib/FDBKeyRange.js';

Dexie.dependencies.indexedDB = indexedDB;
Dexie.dependencies.IDBKeyRange = FDBKeyRange;

const db = new Dexie('SystemOrtaDB');
// Actually, I can't read the browser's IndexedDB from Node.js!
// The user's browser DB is in their browser.
