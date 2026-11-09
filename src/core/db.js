import Dexie from 'dexie';

// ============================================================
// System Orta — Room-Based Database Schema
// Each room has its own tables, isolated from other rooms
// ============================================================

export const db = new Dexie('SystemOrtaDB');

db.version(1).stores({
  // ── Settings (key-value singleton) ──────────────────────
  settings: 'key',

  // ── ROOM: Factories (غرفة المصانع) ──────────────────────
  factories: 'id, name, phone',
  factoryInvoices: 'id, factoryId, type, number, date',
  // factoryInvoice.items = [{ catalogCode, colorId, colorName, qty, sizes, factoryPrice, totalPrice }]

  // ── ROOM: Colors & Sizes ─────────────────────────────────
  colors: 'id, name, code',
  sizeSeries: 'id, name',
  // sizeSeries.sizes = ['44','46','48','50'], piecesPerSerie = 4

  // ── ROOM: Models (غرفة الموديلات) ────────────────────────
  catalog: 'id, code, factoryId, sizeSeriesId, onSale, publishedWholesale, publishedRetail, publishedSales',
  modelColors: 'id, catalogId, colorId, colorCode',
  // modelColors.stock = [{ size, qty }], brokenSizes = [{ size, qty }]
  // modelColors.messageId = Telegram Archive message ID
  // modelColors.link = Telegram link

  // ── ROOM: Customers (غرفة الزبائن) ──────────────────────
  customers: 'id, name, phone, country, credit, cargoName',

  // ── ROOM: Invoices (غرفة الفواتير) ──────────────────────
  orders: 'id, date, number, type, customerId, customerName, status, telegramMsgId',
  // orders.type = 'paid' | 'deposit' | 'preforma' | 'returned'
  // orders.items = [{ catalogCode, colorName, sizes:[{size,qty}], unitPrice, totalPrice, seriesType:'complete'|'broken' }]

  // ── ROOM: Treasury (غرفة الخزينة) ───────────────────────
  transactions: 'id, date, type, amount, category, orderId, customerId, factoryId',
  // transactions.type = 'in' | 'out' | 'balance_confirm'
  balanceConfirms: 'id, date, amount',

  // ── ROOM: Stock (غرفة المخزون) ──────────────────────────
  stockLog: 'id, date, type, ref, catalogCode, colorName',
  // stockLog.type = 'factory_in' | 'factory_return' | 'sale' | 'customer_return' | 'manual' | 'deposit' | 'deposit_cancel'

  // ── ROOM: Telegram (غرفة التليغرام) ─────────────────────
  telegramQueue: '++id, priority, type, status, createdAt, attemptCount',
  telegramMessages: 'id, channel, type, refId, messageId',
  // channel = 'wholesale'|'retail'|'sales'|'facture'|'livestock'|'sync'|'factory'|'casa'|'backup'|'archive'

  // ── ROOM: Backup (غرفة النسخ الاحتياطية) ────────────────
  backupLog: 'id, timestamp, type, status, size',

  // ── System: Logs & Sync ──────────────────────────────────
  logs: '++id, timestamp, level, room, tool',
  syncLog: 'id, timestamp, deviceId, action',
});

db.version(2).stores({
  syncLog: 'id, timestamp, deviceId, action',
  telegramMessages: 'id, channel, type, refId, messageId',
});

export default db;

// ── Auto-Push (debounce + forced interval + incremental) ────
// Debounce: triggers 60s after the LAST change (good for bursts).
// Force: triggers every 3 min regardless → full sync (safety net).
// Incremental: debounce pushes only send changed rows; force pushes send all.

let pushTimer = null;
let lastPushAt = 0;
const DEBOUNCE_MS = 10_000;  // 10 seconds — quick enough for real-time feel
const FORCE_MS    = 180_000; // 3 minutes

// Dirty-row tracker: Set of "table:id" strings for rows modified since last push.
// localStorage is used so it survives page reloads.
const DIRTY_KEY = 'orta_dirty_rows';
const _dirtySet = new Set(JSON.parse(localStorage.getItem(DIRTY_KEY) || '[]'));

export const markDirty = (table, key) => {
    if (window.isPulling) return; // Do not mark pulled rows as dirty locally
    _dirtySet.add(`${table}:${key}`);
    localStorage.setItem(DIRTY_KEY, JSON.stringify([..._dirtySet]));
};

export const getDirtySet = () => _dirtySet;

export const clearDirtySet = () => {
    _dirtySet.clear();
    localStorage.removeItem(DIRTY_KEY);
};

const doPush = (force = false) => {
    if (window.isPulling) return;
    lastPushAt = Date.now();
    import('./syncService').then(({ syncService }) => {
        // pushSync(onProgress, { incremental }) — must pass null first, options second
        syncService.pushSync(null, { incremental: !force }).catch(() => {});
    });
};

const triggerAutoPush = () => {
    if (window.isPulling) return;
    // Debounce: reset on every change
    if (pushTimer) clearTimeout(pushTimer);
    pushTimer = setTimeout(() => doPush(false), DEBOUNCE_MS);
};

// Force push: fires every 3 min — full sync as safety net
setInterval(() => {
    if (window.isPulling) return;
    if (Date.now() - lastPushAt >= FORCE_MS) {
        doPush(true);
    }
}, FORCE_MS);

const tablesToSync = ['factories','factoryInvoices','colors','sizeSeries','catalog','modelColors','customers','orders','transactions','stockLog'];
tablesToSync.forEach(tableName => {
    if (db[tableName]) {
        db[tableName].hook('creating', (key) => { markDirty(tableName, key); triggerAutoPush(); });
        db[tableName].hook('updating', (mods, primKey) => { markDirty(tableName, primKey); triggerAutoPush(); });
        db[tableName].hook('deleting', (key) => { markDirty(tableName, key); triggerAutoPush(); });
    }
});
