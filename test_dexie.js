import { Dexie } from 'dexie';
import indexedDB from 'fake-indexeddb';
import FDBKeyRange from 'fake-indexeddb/lib/FDBKeyRange.js';

Dexie.dependencies.indexedDB = indexedDB;
Dexie.dependencies.IDBKeyRange = FDBKeyRange;

const db = new Dexie('TestDB');
db.version(1).stores({ queue: '++id, status' });

async function run() {
  await db.queue.add({ id: "some-uuid", status: "pending" });
  const items = await db.queue.toArray();
  console.log("Items:", items);
  
  const updated = await db.queue.update(items[0].id, { status: 'failed' });
  console.log("Updated count:", updated);
}
run();
