# System Orta — Complete AI Developer & System Architecture Guide

> [!IMPORTANT]
> **Purpose of this Document**: This guide is the single source of truth for any AI agent or developer working on **System Orta** (`v2.6.0`). It documents every file, database table, theme token, mathematical formula (`Casa`, `Stock`, `Factory`, `Factures`, `Models`), subsystem (`Telegram`, `Pictures`, `Sync`, `Backup`, `PDF/Excel`), and every screen, tab, button, and popup window in the application.

---

## 1. Repository Verification & Project Overview

- **Local Workspace Path**: `/run/media/hamza/storage2tb/Project/systemorta`
- **Git Remote Origin**: `https://github.com/Hamza-Houaoui/system-orta.git` (Verified exact match via `git remote -v`).
- **Tech Stack**:
  - **Frontend**: React 18 (`^18.2.0`), React Router DOM (`HashRouter` `^6.22.3`), Vite (`^5.1.6`), Lucide React Icons (`^0.358.0`).
  - **Database**: IndexedDB powered by **Dexie.js** (`^3.2.7`) — Database name: `SystemOrtaDB` (Version 5).
  - **Mobile Runtime**: **Capacitor 8** (`@capacitor/core`, `@capacitor/android`, `@capacitor/filesystem`, `@capacitor/share`) — Package ID: `com.orta.system`.
  - **Utilities**: `jszip` (Sync/Backup compression), `jspdf` + `jspdf-autotable` + `qrcode` + `jsbarcode` (Invoice PDFs & Barcodes), `xlsx` (Excel import/export), `html5-qrcode` (Camera Barcode Scanner), `uuid` (`v4`).

### Directory Map
- [`src/App.jsx`](file:///run/media/hamza/storage2tb/Project/systemorta/src/App.jsx): Main shell, Topbar, Sidebar navigation, startup migrations, global loops.
- [`src/index.css`](file:///run/media/hamza/storage2tb/Project/systemorta/src/index.css): Complete Luxury Gold & Obsidian Dark design system and CSS classes.
- **Core Services (`src/core/`)**:
  - [`db.js`](file:///run/media/hamza/storage2tb/Project/systemorta/src/core/db.js): Dexie schema (15 tables), `settingsDB` wrapper, seed data, dirty-row tracking hooks.
  - [`store.js`](file:///run/media/hamza/storage2tb/Project/systemorta/src/core/store.js): Business logic rooms (`TreasuryRoom`, `CustomersRoom`, `FactoriesRoom`, `ModelsRoom`).
  - [`telegramPublisher.js`](file:///run/media/hamza/storage2tb/Project/systemorta/src/core/telegramPublisher.js): Background Telegram queue processor, album grouping, live stock message editing, series vs. broken channel evaluator.
  - [`telegramMedia.js`](file:///run/media/hamza/storage2tb/Project/systemorta/src/core/telegramMedia.js): Lazy-loader for Telegram `file_id` images (`resolveTelegramUrl`, `<TgImg>`).
  - [`photoRecoveryService.js`](file:///run/media/hamza/storage2tb/Project/systemorta/src/core/photoRecoveryService.js): Recovers missing `fileId`s from Telegram backup/archive messages.
  - [`syncService.js`](file:///run/media/hamza/storage2tb/Project/systemorta/src/core/syncService.js): Multi-device Telegram ZIP sync engine (`pushSync`, `pullSync`, `mergeIncomingData`).
  - [`deviceSync.js`](file:///run/media/hamza/storage2tb/Project/systemorta/src/core/deviceSync.js): Device roles (Device 1 Main, Device 2 Watcher, Device 3 Monitor), PIN verification (`141425`), phone number masking.
  - [`SyncManager.jsx`](file:///run/media/hamza/storage2tb/Project/systemorta/src/core/SyncManager.jsx): Headless background listener for auto-push (10s debounce / 3m forced) and Watcher auto-pull (30s interval).
  - [`invoicePdf.js`](file:///run/media/hamza/storage2tb/Project/systemorta/src/core/invoicePdf.js): Generates branded customer invoice PDFs with thumbnails, barcodes, QR codes, and WhatsApp sharing.
  - [`exportExcel.js`](file:///run/media/hamza/storage2tb/Project/systemorta/src/core/exportExcel.js): Universal multi-sheet `.xlsx` exporter for Web and Android.
  - [`phoneParser.js`](file:///run/media/hamza/storage2tb/Project/systemorta/src/core/phoneParser.js): Country code detector and flag resolver (`getPhoneInfo`).
  - [`logger.js`](file:///run/media/hamza/storage2tb/Project/systemorta/src/core/logger.js): Intercepts `console.log/warn/error` and persists to `db.logs`.
- **Toolbox (`src/toolbox/`)**:
  - [`telegramFormatter.js`](file:///run/media/hamza/storage2tb/Project/systemorta/src/toolbox/telegramFormatter.js): HTML message templates for every Telegram channel.
  - [`eventBus.js`](file:///run/media/hamza/storage2tb/Project/systemorta/src/toolbox/eventBus.js): Pub/Sub event bus (`emit`, `on`, `EVENTS`).

---

## 2. Themes, CSS Design System & Layout (`src/index.css`)

System Orta uses a single **Dark Luxury Gold ("Obsidian & Gold")** theme defined in [`src/index.css`](file:///run/media/hamza/storage2tb/Project/systemorta/src/index.css#L1-L55).

### 2.1 CSS Custom Properties (`:root`)
| Variable | Value | Usage |
| :--- | :--- | :--- |
| `--bg` | `#050505` | Deepest background (app shell background) |
| `--surface` | `#0f0f0f` | Primary card, modal, sidebar, and topbar background |
| `--surface2` | `#161616` | Inputs, secondary cards, table row hover, inner boxes |
| `--surface3` | `#222222` | Elevated surfaces, tags, subtle dividers |
| `--border` | `#262626` | Standard card, table, and input border |
| `--border-hover` | `#3a3a3a` | Hovered borders |
| `--gold` | `#D4AF37` | Primary brand color (active tabs, prices, primary buttons) |
| `--gold-light` | `#F3E5AB` | Gradient highlights, hover glows |
| `--gold-dark` | `#AA7C11` | Button gradients |
| `--gold-dim` | `rgba(212, 175, 55, 0.12)` | Active nav background, gold badges, subtle highlights |
| `--text` | `#F9FAFB` | Primary text |
| `--text-sec` | `#9CA3AF` | Secondary labels, subtitles, table headers |
| `--text-muted` | `#6B7280` | Placeholders, disabled text, timestamps |
| `--green` / `--green-dim` | `#10B981` / `rgba(16,185,129,0.12)` | Paid invoices, Casa Cash In, In-Stock, Online status |
| `--red` / `--red-dim` | `#EF4444` / `rgba(239,68,68,0.12)` | Debt, Casa Cash Out, Returns, Out-of-Stock, Danger buttons |
| `--amber` / `--amber-dim` | `#F59E0B` / `rgba(245,158,11,0.12)` | Deposits, Low Stock (`< 5`), On Sale, Warnings |
| `--blue` / `--blue-dim` | `#3B82F6` / `rgba(59,130,246,0.12)` | Balance Confirmations, Info badges, Factory Stock Value |
| `--purple` / `--purple-dim`| `#8B5CF6` / `rgba(139,92,246,0.12)` | Preforma / No-Paid orders, Broken Sizes badge |
| `--sidebar-w` / `--topbar-h`| `240px` / `64px` | Layout dimensions |
| `--font` | `'Outfit', -apple-system, ...` | Global typography |

### 2.2 Visual Color Coding for Financial Rows & Modals
Throughout [`HistoryScreen.jsx`](file:///run/media/hamza/storage2tb/Project/systemorta/src/screens/HistoryScreen.jsx), [`TreasuryScreen.jsx`](file:///run/media/hamza/storage2tb/Project/systemorta/src/screens/TreasuryScreen.jsx), [`CustomerDetailScreen.jsx`](file:///run/media/hamza/storage2tb/Project/systemorta/src/screens/CustomerDetailScreen.jsx), and [`FactoryDetailScreen.jsx`](file:///run/media/hamza/storage2tb/Project/systemorta/src/screens/FactoryDetailScreen.jsx), rows and modals use directional `linear-gradient(to right, ...)` backgrounds to immediately signify transaction types:
- **Green Gradient (`rgba(16, 185, 129, 0.08–0.15)`)**: Paid Orders (`paid`), Casa Cash In (`in`), Factory Payments (`payment`), Debt Payments (`debt_payment`).
- **Amber/Gold Gradient (`rgba(245, 158, 11, 0.08–0.15)`)**: Deposit Orders (`deposit`), Factory Imports (`in` in factory context).
- **Red Gradient (`rgba(239, 68, 68, 0.08–0.15)`)**: Returned Orders (`returned`), Manual Debt (`manual_debt`), Casa Cash Out (`out`), Factory Returns (`return`).
- **Purple Gradient (`rgba(139, 92, 246, 0.08–0.15)`)**: Preforma / No-Paid Orders (`nopaid`).
- **Blue Gradient (`rgba(59, 130, 246, 0.08–0.15)`)**: Balance Confirmations (`balance_confirm`).

### 2.3 Responsive Breakpoints
- `max-width: 1024px`: `.grid-4` collapses to 2 columns; `.grid-3` collapses to 2 columns.
- `max-width: 768px`:
  - `.sidebar` hides off-screen (`transform: translateX(-100%)`) and opens as a slide-over drawer when `.sidebar.open` is toggled via the mobile hamburger button (`☰`).
  - `.grid-2`, `.grid-3`, `.grid-4` collapse to 1 column (`1fr`).
  - `.modal-box` becomes full-width (`max-width: 100%`).

---

## 3. Database Architecture (`src/core/db.js`)

[`SystemOrtaDB`](file:///run/media/hamza/storage2tb/Project/systemorta/src/core/db.js#L6-L59) has **15 tables** in Dexie (Version 5):

| Table Name | Primary Key & Indexes | Key Fields & Description |
| :--- | :--- | :--- |
| `settings` | `key` | Key-value config store (`startBudget`, `nextOrderNum`, `telegramBotToken`, 10 chat IDs, `silent_mode_*`, `auto_publish_*`, `liveStockMsgMap`, `syncHistory`, `backupLog`). Accessed via [`settingsDB`](file:///run/media/hamza/storage2tb/Project/systemorta/src/core/db.js#L131-L150). |
| `transactions` | `id, date, type, category, orderId, customerId, factoryId` | **Casa (Treasury)** ledger. `type`: `'in' \| 'out' \| 'balance_confirm'`. Fields: `amount`, `category`, `description`, `person`, `orderId`, `customerId`, `factoryId`, `date`. |
| `customers` | `id, name, phone, brand, country` | Customer profiles. Fields: `name`, `phone`, `brand`, `country`, `credit` (Manual Debt balance), `notes`, `createdAt`. |
| `factories` | `id, name, code, phone` | Supplier/Factory profiles. Fields: `name`, `code`, `phone`, `location`, `notes`, `startCredit` (initial debt), `createdAt`. |
| `sizeSeries` | `id, name` | Size templates (e.g., `{ id: 'ss-1', name: '44-50 (4 pcs)', sizes: ['44','46','48','50'], piecesPerSerie: 4 }`). |
| `colorTemplates` | `id, name` | Master color swatches (`{ id, name, hex }`). Seeded with 15 defaults (`Black`, `White`, `Gold`, etc.). |
| `models` | `id, code, name, factoryId, type, sizeSeriesId, onSale, createdAt` | Product catalog models. Fields: `code` (Barcode/Catalog #), `name`, `type` (`'Long Dress'`, `'Short Dress'`, `'Ensemble'`, etc.), `factoryId`, `sizeSeriesId`, `factoryPrice`, `wholesalePrice`, `retailPrice`, `discount`, `onSale` (`0` or `1`), `notes`, `telegramMsgIds` (`{ wholesale, retail, sales, liveStock }`). |
| `modelColors` | `id, modelId, colorId, barcode` | Color variants of a model. Fields: `modelId`, `colorId`, `colorName`, `hex`, `barcode`, `stock` (`[{ size: '44', qty: 5 }, ...]`), `assets` (`[{ id, type: 'image'\|'video', blob, fileId, isPrimary }]`), `telegramMsgIds` (per-color channel message IDs). |
| `orders` | `id, number, date, customerId, type, status` | Customer invoices (Factures). `type`: `'paid' \| 'deposit' \| 'nopaid' \| 'returned' \| 'manual_debt'`. Fields: `number` (`INV-0001`), `date`, `customerId`, `customerName`, `customerBrand`, `customerCountry`, `customerPhone`, `subtotal`, `discount`, `totalPrice`, `paidAmount`, `depositAmount`, `commission`, `notes`, `debtNote`. |
| `orderItems` | `id, orderId, modelId, colorId` | Line items per order. Fields: `orderId`, `modelId`, `modelCode`, `modelName`, `colorId`, `colorName`, `seriesType` (`'complete' \| 'broken'`), `sizes` (`[{ size, qty }]`), `totalQty`, `unitPrice`, `totalPrice`. |
| `stockLog` | `id, date, modelId, colorId, type, orderId, factoryInvoiceId` | Audit log of every stock change. `type`: `'in' \| 'out' \| 'return' \| 'customer_return' \| 'adjust'`. Fields: `modelCode`, `modelName`, `colorName`, `size`, `qty` (signed `+/-`), `reason`, `balance` (total model+color stock after change). |
| `factoryInvoices` | `id, factoryId, type, date, number` | Factory ledger records. `type`: `'in' \| 'return' \| 'payment' \| 'balance_confirm'`. Fields: `number`, `date`, `amount`, `receiver`, `note`, `items` (`[{ catalogCode, catalogId, colorName, qty, sizeQtys, factoryPrice, sizes }]`). |
| `telegramQueue` | `++id, priority, status, type, createdAt` | Outbound Telegram message queue. `status`: `'pending' \| 'sent' \| 'failed'`. |
| `logs` | `++id, timestamp, level` | System console logs captured by `logger.js`. |
| `deletedRecords`| `id, table, deletedAt` | Tombstone tracker so deletions propagate across devices during Sync. |

### Dirty-Row Tracking Hook (`src/core/db.js`)
[`db.js`](file:///run/media/hamza/storage2tb/Project/systemorta/src/core/db.js#L61-L129) attaches Dexie hooks (`creating`, `updating`, `deleting`) to all 12 synced tables:
- Every create/update adds `"tableName:primaryKey"` to `localStorage['orta_dirty_rows']` and triggers [`syncService.triggerAutoPush()`](file:///run/media/hamza/storage2tb/Project/systemorta/src/core/syncService.js#L65-L85).
- Every delete records a tombstone `{ id: "tableName:pk", table: tableName, recordId: pk, deletedAt: Date.now() }` in `db.deletedRecords` and marks `"deletedRecords:tableName:pk"` dirty.
- During a sync pull (`window.__ortaPullingSync = true`), these hooks are paused so incoming data does not re-trigger an outgoing push.

---

## 4. Complete Mathematical & Financial Engine ("Calcule" & "Money")

> [!NOTE]
> Every formula below is extracted directly from [`src/core/store.js`](file:///run/media/hamza/storage2tb/Project/systemorta/src/core/store.js), [`src/screens/NewOrderScreen.jsx`](file:///run/media/hamza/storage2tb/Project/systemorta/src/screens/NewOrderScreen.jsx), [`src/screens/TreasuryScreen.jsx`](file:///run/media/hamza/storage2tb/Project/systemorta/src/screens/TreasuryScreen.jsx), [`src/screens/FactoryDetailScreen.jsx`](file:///run/media/hamza/storage2tb/Project/systemorta/src/screens/FactoryDetailScreen.jsx), [`src/screens/CustomerDetailScreen.jsx`](file:///run/media/hamza/storage2tb/Project/systemorta/src/screens/CustomerDetailScreen.jsx), and [`src/components/InvoiceDetailModal.jsx`](file:///run/media/hamza/storage2tb/Project/systemorta/src/components/InvoiceDetailModal.jsx).

---

### 4.1 Casa (Treasury) Calculations (`TreasuryRoom` & `TreasuryScreen`)

#### A. Global Casa Balance ([`TreasuryRoom.getBalance()`](file:///run/media/hamza/storage2tb/Project/systemorta/src/core/store.js#L13-L22))
$$\text{Total In} = \sum_{t \in \text{transactions}, \, t.\text{type} = \text{'in'}} t.\text{amount}$$
$$\text{Total Out} = \sum_{t \in \text{transactions}, \, t.\text{type} = \text{'out'}} t.\text{amount}$$
$$\text{Current Casa Balance} = \text{startBudget} + \text{Total In} - \text{Total Out}$$
- `startBudget` is stored in `settings` (`key = 'startBudget'`, default `0`).
- Transactions with `type === 'balance_confirm'` have **zero mathematical effect** on the balance; they act purely as visual/audit checkpoints in the timeline and Telegram channel.

#### B. Period-Filtered Stats (`Today`, `Week`, `Month`, `Year`, `All`, `Custom`)
In [`TreasuryScreen.jsx`](file:///run/media/hamza/storage2tb/Project/systemorta/src/screens/TreasuryScreen.jsx#L101-L108):
- `periodStats.totalIn`: Sum of `'in'` transactions within the selected date window.
- `periodStats.totalOut`: Sum of `'out'` transactions within the selected date window.
- `periodStats.net` (**Net Period** card):
  $$\text{Net Period} = \text{periodStats.totalIn} - \text{periodStats.totalOut}$$
- Meanwhile, the **Total Balance** card at the top right always displays the global all-time `balance.balance`.

#### C. Running Balance Calculation (Reverse-Chronological Walk)
In [`TreasuryScreen.jsx`](file:///run/media/hamza/storage2tb/Project/systemorta/src/screens/TreasuryScreen.jsx#L110-L120), to display the `Balance` column after each transaction in the table:
1. All transactions are sorted **newest first** (`b.date - a.date`).
2. Starting with `currentBalance = globalBalance`:
   - Assign `tx.runningBalance = currentBalance`.
   - Step backward in time:
     - If `tx.type === 'in'`, `currentBalance -= tx.amount`.
     - If `tx.type === 'out'`, `currentBalance += tx.amount`.
     - If `tx.type === 'balance_confirm'`, `currentBalance` is unchanged.

#### D. How Every Action Affects Casa (`db.transactions`)
1. **Paid Customer Order (`type === 'paid'`)** ([`NewOrderScreen.jsx`](file:///run/media/hamza/storage2tb/Project/systemorta/src/screens/NewOrderScreen.jsx#L316-L361)):
   - Let $\text{Total} = \text{subtotal} - \text{discount}$, and let $\text{ActualPaid}$ be the value entered in the `Casa Cash ($)` (`paidExact`) input (defaults to $\text{Total}$ if left blank).
   - **Case 1: Standard or Broker Deduction ($\text{ActualPaid} \le \text{Total}$)**:
     - E.g., Invoice Total is `\$1000`, broker takes `\$50` commission, so `\$950` enters Casa.
     - System records **two** Casa transactions so the full invoice value and the commission expense are both audited:
       1. `type: 'in'`, `amount: Total` (`\$1000`), `category: 'Sale'`.
       2. If $\text{Total} - \text{ActualPaid} > 0$: `type: 'out'`, `amount: Total - ActualPaid` (`\$50`), `category: 'Commission Paid'`.
     - **Net Casa Change**: $+\text{Total} - (\text{Total} - \text{ActualPaid}) = +\text{ActualPaid}$ (`+\$950`).
   - **Case 2: Overpayment / Included Commission ($\text{ActualPaid} > \text{Total}$)**:
     - E.g., Invoice Total is `\$1000`, customer pays `\$1050` where `\$50` is commission to be paid out (`commission = ActualPaid - Total`).
     - System records:
       1. `type: 'in'`, `amount: ActualPaid` (`\$1050`), `category: 'Sale'`.
       2. `type: 'out'`, `amount: commission` (`\$50`), `category: 'Commission Paid'`.
     - **Net Casa Change**: $+\text{ActualPaid} - \text{commission} = +\text{Total}$ (`+\$1000`).

2. **Deposit Customer Order (`type === 'deposit'`)** ([`NewOrderScreen.jsx`](file:///run/media/hamza/storage2tb/Project/systemorta/src/screens/NewOrderScreen.jsx#L362-L379)):
   - If `depositAmount > 0`, records **one** transaction:
     - `type: 'in'`, `amount: depositAmount`, `category: 'Deposit'`.
   - Remaining unpaid balance ($\text{Total} - \text{depositAmount}$) stays on the invoice as a Deposit Debt.

3. **Settling a Deposit Order Later ("Pay Deposit Balance")**:
   - **Via `InvoiceDetailModal.jsx`** ([lines 51-125](file:///run/media/hamza/storage2tb/Project/systemorta/src/components/InvoiceDetailModal.jsx#L51-L125)):
     - Let $\text{Remaining} = \text{order.totalPrice} - (\text{order.paidAmount} \text{ or } \text{order.depositAmount})$.
     - User enters `payAmount` ($\text{amt}$).
     - Commission is calculated as:
       $$\text{commissionVal} = \max(0, \, \text{Remaining} - \text{amt})$$
     - Order is marked `type: 'paid'`, `paidAmount: order.totalPrice`, `commission: (order.commission || 0) + commissionVal`.
     - Casa records:
       1. `type: 'in'`, `amount: Remaining`, `category: 'Sale'`, `description: "Deposit Balance Paid - Order #..."`.
       2. If $\text{commissionVal} > 0$: `type: 'out'`, `amount: commissionVal`, `category: 'Commission Paid'`.
     - **Net Casa Change**: $+\text{Remaining} - (\text{Remaining} - \text{amt}) = +\text{amt}$.
   - **Via `HistoryScreen.jsx` Inline `Pay Now` Modal** ([lines 96-143](file:///run/media/hamza/storage2tb/Project/systemorta/src/screens/HistoryScreen.jsx#L96-L143)):
     - Adds `type: 'in'`, `amount: payAmount`, `category: 'order'`, and sets `order.type = 'paid'`, `order.paidAmount = (order.paidAmount || 0) + payAmount`.

4. **Customer Return (`type === 'returned'`)** ([`InvoiceDetailModal.jsx`](file:///run/media/hamza/storage2tb/Project/systemorta/src/components/InvoiceDetailModal.jsx#L127-L185) & [`NewOrderScreen.jsx`](file:///run/media/hamza/storage2tb/Project/systemorta/src/screens/NewOrderScreen.jsx#L221-L263)):
   - Calculates refund amount capped at the invoice total (so broker commissions aren't over-refunded):
     $$\text{refundAmount} = \max\left(0, \, \min(\text{order.paidAmount}, \, \text{order.totalPrice})\right)$$
   - If $\text{refundAmount} > 0$, records in Casa:
     - `type: 'out'`, `amount: refundAmount`, `category: 'Customer Return'`.

5. **Customer Manual Debt Payment** ([`CustomerCreditScreen.jsx`](file:///run/media/hamza/storage2tb/Project/systemorta/src/screens/CustomerCreditScreen.jsx#L117-L173) & [`CustomerDetailScreen.jsx`](file:///run/media/hamza/storage2tb/Project/systemorta/src/screens/CustomerDetailScreen.jsx#L172-L220)):
   - Records `type: 'in'`, `amount: amt`, `category: 'Debt Payment'`.

6. **Factory Payment** ([`FactoryDetailScreen.jsx`](file:///run/media/hamza/storage2tb/Project/systemorta/src/screens/FactoryDetailScreen.jsx#L225-L246)):
   - Records `type: 'out'`, `amount: amt`, `category: 'Factory Payment'`.

7. **Manual Casa In / Out** ([`TreasuryScreen.jsx`](file:///run/media/hamza/storage2tb/Project/systemorta/src/screens/TreasuryScreen.jsx#L122-L163)):
   - Records `type: 'in'` or `'out'`, with user-selected `category` (`'Sale'`, `'Deposit'`, `'Manual In'`, `'Factory Payment'`, `'Commission'`, `'Rent'`, `'Salary'`, `'Transport'`, `'Packaging'`, `'Other'`).

---

### 4.2 Stock & Series Calculations (`ModelsRoom`, `StockScreen`, `telegramPublisher`)

#### A. Size Series & Color Stock Structure
- Each model links to a `sizeSeries` record containing `sizes` (e.g. `['44', '46', '48', '50']`) and `piecesPerSerie` (e.g. `4`).
- Each color variant (`modelColors`) stores an array `stock: [{ size: '44', qty: 3 }, { size: '46', qty: 3 }, { size: '48', qty: 2 }, { size: '50', qty: 3 }]`.

#### B. Complete Series vs. Broken Sizes Math ([`calcColorChannelInfo`](file:///run/media/hamza/storage2tb/Project/systemorta/src/core/telegramPublisher.js#L16-L46) & [`ModelDetailScreen.jsx`](file:///run/media/hamza/storage2tb/Project/systemorta/src/screens/ModelDetailScreen.jsx#L316-L328))
Given a model's `seriesSizes` $= [s_1, s_2, \dots, s_k]$ and a color's `stock` map $Q(s)$:
1. **Total Stock for Color**:
   $$\text{totalStock} = \sum_{s \in \text{stock}} Q(s)$$
2. **Full Series Count** (number of complete size runs available):
   $$\text{fullSeriesCount} = \min_{s \in \text{seriesSizes}} Q(s)$$
   *(If `seriesSizes` is empty, $\text{fullSeriesCount} = 0$).*
3. **Broken Sizes Breakdown** (leftover pieces above the complete series floor):
   For each size $s \in \text{seriesSizes}$:
   $$\text{brokenQty}(s) = Q(s) - \max(0, \, \text{fullSeriesCount})$$
   - Any size with $\text{brokenQty}(s) > 0$ is included in `brokenSizes: [{ size: s, brokenQty }]`.
   - **Example**: Sizes `36, 38, 40, 42` with quantities `3, 3, 5, 4`:
     - $\text{totalStock} = 15$ pcs.
     - $\text{fullSeriesCount} = \min(3, 3, 5, 4) = 3$ full series ($3 \times 4 = 12$ pcs).
     - $\text{brokenSizes} = [\text{40: } 2\text{ pcs}, \, \text{42: } 1\text{ pc}]$ ($3$ broken pcs).
4. **Is Broken Flag in `StockScreen.jsx`** ([lines 44-48](file:///run/media/hamza/storage2tb/Project/systemorta/src/screens/StockScreen.jsx#L44-L48)):
   - In the stock overview table, a color row is flagged `isBroken = true` if $\text{total} > 0$ and **not all** sizes in `model.sizes` have the exact same quantity ($\exists s_i, s_j \text{ such that } Q(s_i) \neq Q(s_j)$).

#### C. Order Line Item Series Detection & Unit Pricing ([`NewOrderScreen.jsx`](file:///run/media/hamza/storage2tb/Project/systemorta/src/screens/NewOrderScreen.jsx#L118-L163))
When a user enters quantities per size `qtys[size]` in a New Order row:
1. [`computeSeriesType(qtys, series)`](file:///run/media/hamza/storage2tb/Project/systemorta/src/screens/NewOrderScreen.jsx#L118-L125):
   - Let $v = [ \text{qtys}[s] \text{ for } s \in \text{series.sizes} ]$, and let $m = \min(v)$.
   - If $m > 0$ and $\forall x \in v, \, x === m$: returns `'complete'`.
   - Otherwise: returns `'broken'`.
2. **Automatic Unit Price Selection**:
   - If `seriesType === 'complete'` $\rightarrow$ `unitPrice = model.wholesalePrice`.
   - If `seriesType === 'broken'` $\rightarrow$ `unitPrice = model.retailPrice || model.wholesalePrice`.
   - *(Note: The user can also manually override `unitPrice` in the input field).*
3. **Series Stepper Buttons (`-` / `+`)**:
   - Clicking `+` increments **every** size in `series.sizes` by $+1$ simultaneously (adding 1 full series).
   - Clicking `-` decrements **every** size in `series.sizes` by $-1$ (clamped at $0$).

#### D. Stock Deduction & Restoration Rules
- **Deducting Stock on New Order**:
  - `paid` and `deposit` orders **deduct stock immediately** (`Q(s) = Math.max(0, Q(s) - qty)`), write a `type: 'out'` entry to `db.stockLog` with `qty: -sq.qty`, and trigger `evaluateAndUpdateChannels(modelId)` + `updateLiveStockChannel()`.
  - `nopaid` (Preforma) orders **DO NOT deduct stock** and **DO NOT affect Casa or Customer Credit**.
- **Restoring Stock on Return / Edit**:
  - Returning an order (`paid` or `deposit`) adds `sq.qty` back to `modelColors.stock`, writes `type: 'customer_return'` (`qty: +sq.qty`) to `db.stockLog`, and updates Telegram channels.

---

### 4.3 Factory Financial Calculations (`FactoriesRoom` & `FactoryDetailScreen`)

#### A. Factory 3-Pillar Credit Formula ([`FactoriesRoom.getFactoryFinancials(factoryId)`](file:///run/media/hamza/storage2tb/Project/systemorta/src/core/store.js#L62-L90))
For a given factory:
1. ** Ledger Sums**:
   $$\text{totalIn (Imports)} = \sum_{inv \in \text{factoryInvoices}, \, inv.\text{type} = \text{'in'}} inv.\text{amount}$$
   $$\text{totalOut (Returns)} = \sum_{inv \in \text{factoryInvoices}, \, inv.\text{type} = \text{'return'}} inv.\text{amount}$$
   $$\text{totalPayments (Payments)} = \sum_{inv \in \text{factoryInvoices}, \, inv.\text{type} = \text{'payment'}} inv.\text{amount}$$
2. **Total Debt (`totalCredit`)** — Total book liability to the factory:
   $$\text{totalCredit} = (\text{factory.startCredit} \parallel 0) + \text{totalIn} - \text{totalOut} - \text{totalPayments}$$
3. **Current Stock Value (`stockCredit`)** — Value of unsold factory merchandise currently sitting in your warehouse at factory cost:
   $$\text{stockCredit} = \sum_{m \in \text{factoryModels}} \left( m.\text{factoryPrice} \times \sum_{c \in m.\text{colors}} \sum_{s \in c.\text{stock}} s.\text{qty} \right)$$
4. **Net Balance Owed (`netCredit`)** — Debt for merchandise that has **already been sold** (Total Debt minus Goods Still in Stock):
   $$\text{netCredit} = \text{totalCredit} - \text{stockCredit}$$

#### B. Factory Running Debt Timeline ([`FactoryDetailScreen.jsx`](file:///run/media/hamza/storage2tb/Project/systemorta/src/screens/FactoryDetailScreen.jsx#L61-L72))
In the Factory `Transactions` tab:
1. Invoices are sorted **oldest first** (`a.date - b.date`).
2. Starting with `runningDebt = factory.startCredit || 0`:
   - If `inv.type === 'in'` $\rightarrow$ `runningDebt += inv.amount`
   - If `inv.type === 'return'` $\rightarrow$ `runningDebt -= inv.amount`
   - If `inv.type === 'payment'` $\rightarrow$ `runningDebt -= inv.amount`
   - Assign `inv.runningDebt = runningDebt`.
3. The list is then reversed (`reverse()`) so the newest transactions appear at the top with their accurate historical `runningDebt`.

#### C. Factory Import (`in`) & Return (`return`) Stock Distribution ([`FactoryDetailScreen.jsx`](file:///run/media/hamza/storage2tb/Project/systemorta/src/screens/FactoryDetailScreen.jsx#L127-L185))
When saving a Factory Import (`in`) or Factory Return (`return`) modal:
- Each row has either per-size quantities `item.sizeQtys = { '44': 2, '46': 2, ... }` (when a catalog model is linked) or a flat `item.qty` (if entered manually).
- Line item amount:
  $$\text{effectiveQty} = \begin{cases} \sum_{s} \text{sizeQtys}[s] & \text{if } \sum_{s} \text{sizeQtys}[s] > 0 \\ \text{item.qty} & \text{otherwise} \end{cases}$$
  $$\text{lineTotal} = \text{effectiveQty} \times \text{item.factoryPrice}$$
- **How Stock Updates**:
  - **Mode 1 (`hasSizeBreakdown === true`)**: Updates each size $s$ in `modelColors.stock` by $+\text{sizeQtys}[s]$ (for `'in'`) or $-\text{sizeQtys}[s]$ (clamped to $0$, for `'return'`).
  - **Mode 2 (`hasSizeBreakdown === false`, flat `qty`)**: Distributes `item.qty` evenly across all sizes in the model's `sizeSeries`:
    $$\text{perSize} = \left\lfloor \frac{\text{qty}}{N_{\text{sizes}}} \right\rfloor, \quad \text{rem} = \text{qty} \bmod N_{\text{sizes}}$$
    Each size index $i \in [0, N_{\text{sizes}}-1]$ receives $\text{perSize} + (i < \text{rem} ? 1 : 0)$.
  - Also updates `model.factoryPrice = item.factoryPrice` if `item.factoryPrice > 0`.

---

### 4.4 Factures (Customer Invoices) & Customer Credit Calculations

#### A. Invoice Totals ([`NewOrderScreen.jsx`](file:///run/media/hamza/storage2tb/Project/systemorta/src/screens/NewOrderScreen.jsx#L171-L176))
For an order with items $i \in \{1 \dots n\}$:
$$\text{item}_i.\text{totalQty} = \sum_{s} \text{item}_i.\text{qtys}[s]$$
$$\text{item}_i.\text{totalPrice} = \text{item}_i.\text{totalQty} \times \text{item}_i.\text{unitPrice}$$
$$\text{subtotal} = \sum_{i=1}^{n} \text{item}_i.\text{totalPrice}$$
$$\text{totalPrice} = \max(0, \, \text{subtotal} - \text{discount})$$
$$\text{remaining (for Deposit)} = \max(0, \, \text{totalPrice} - \text{depositAmount})$$

#### B. The 5 Order Types (`order.type`)
| `order.type` | UI Label | Deducts Stock? | Affects Casa? | Affects Customer Debt? |
| :--- | :--- | :--- | :--- | :--- |
| `'paid'` | `Paid` | **Yes** | **Yes** (`+ActualPaid` net) | **No** (`paidAmount = ActualPaid`) |
| `'deposit'` | `Deposit` | **Yes** | **Yes** (`+depositAmount`) | **Yes** (Tracked as **Deposit Debt** $= \text{totalPrice} - \text{paidAmount}$) |
| `'nopaid'` | `Preforma` / `No Paid`| **No** | **No** | **No** (Quotation / Proforma invoice only) |
| `'returned'` | `Returned` | **Restores Stock** | **Yes** (`-refundAmount` out) | Cancels any unpaid deposit balance |
| `'manual_debt'`| `Manual Debt` | **No** | **No** | **Yes** (Increases `customer.credit` by `totalPrice`) |

#### C. Separation of Customer Manual Debt vs. Deposit Debt
> [!IMPORTANT]
> System Orta maintains **two distinct debt buckets** for every customer (enforced by the startup migration `migrated_deposit_debts_v1` in [`App.jsx`](file:///run/media/hamza/storage2tb/Project/systemorta/src/App.jsx#L106-L137)):
1. **Manual Debt (`customer.credit`)**:
   - Stored directly on `db.customers.credit`.
   - Increased when adding a Manual Debt (`type: 'manual_debt'`) in [`CustomerDetailScreen.jsx`](file:///run/media/hamza/storage2tb/Project/systemorta/src/screens/CustomerDetailScreen.jsx#L129-L170) or [`CustomerCreditScreen.jsx`](file:///run/media/hamza/storage2tb/Project/systemorta/src/screens/CustomerCreditScreen.jsx#L75-L115).
   - Decreased when clicking **Pay Debt** (`customer.credit = Math.max(0, customer.credit - amt)`).
2. **Deposit Unpaid Balance (`totalDepositDebt`)**:
   - Calculated dynamically from `db.orders` where `o.customerId === id && o.type === 'deposit'`:
     $$\text{totalDepositDebt} = \sum_{o \in \text{depositOrders}} \max\left(0, \, o.\text{totalPrice} - (o.\text{paidAmount} \parallel o.\text{depositAmount} \parallel 0)\right)$$
   - Settled by opening the specific Deposit Invoice and clicking **Pay Remaining Balance** (which converts `o.type` from `'deposit'` to `'paid'`).

#### D. Customer Credit Ledger Running Debt (`CustomerCreditScreen.jsx`)
In [`CustomerCreditScreen.jsx`](file:///run/media/hamza/storage2tb/Project/systemorta/src/screens/CustomerCreditScreen.jsx#L38-L73), the unified credit ledger combines:
- Orders where `o.type === 'manual_debt'` or `(o.type === 'deposit' && o.totalPrice > o.paidAmount)`.
- Transactions where `t.category === 'Debt Payment'`.
Sorted chronologically (oldest to newest), `runningDebt` starts at `0`:
- For `manual_debt`: `debtChange = o.totalPrice`, `runningDebt += debtChange`.
- For `deposit`: `debtChange = o.totalPrice - (o.paidAmount || o.depositAmount || 0)`, `runningDebt += debtChange`.
- For `debt_payment`: `runningDebt = Math.max(0, runningDebt - tx.amount)`.

#### E. Edit Order ("Clone & Auto-Return") Flow ([`NewOrderScreen.jsx`](file:///run/media/hamza/storage2tb/Project/systemorta/src/screens/NewOrderScreen.jsx#L66-L103) & [L218-L265](file:///run/media/hamza/storage2tb/Project/systemorta/src/screens/NewOrderScreen.jsx#L218-L265))
When a user clicks **Edit Invoice** in [`InvoiceDetailModal.jsx`](file:///run/media/hamza/storage2tb/Project/systemorta/src/components/InvoiceDetailModal.jsx#L228-L238):
1. Navigates to `/new-order` with `location.state.cloneOrder = order` and `cloneItems = items`.
2. [`NewOrderScreen`](file:///run/media/hamza/storage2tb/Project/systemorta/src/screens/NewOrderScreen.jsx) pre-fills the customer, order type, discount, deposit/paid amounts, and all items/sizes, and stores `editingOrder = cOrder`.
3. Displays an amber banner: `Editing Order #INV-XXXX — Saving this order will automatically mark #INV-XXXX as Returned and create a new updated invoice.`
4. Upon clicking **Save Order**:
   - First, if `editingOrder.type === 'paid' || editingOrder.type === 'deposit'`:
     - Marks the old order `type: 'returned'` with note `[Returned via Edit]`.
     - Restores all old item quantities back into `modelColors.stock` and logs `customer_return` in `db.stockLog`.
     - Records a Casa `'out'` transaction for `refundAmount = Math.max(0, Math.min(editingOrder.paidAmount, editingOrder.totalPrice))` (`Category: 'Customer Return'`).
     - Sends a Casa return notification to `casaChatId`.
   - Next, creates the brand-new order with a new `INV-XXXX` number, deducts the new stock, and records the new Casa transaction!

---

## 5. Dedicated Subsystems Deep-Dive

### 5.1 Telegram System (`telegramPublisher.js` & `telegramFormatter.js`)

#### A. The 10 Configured Telegram Channels (`settings` keys)
Configured in [`TelegramScreen.jsx`](file:///run/media/hamza/storage2tb/Project/systemorta/src/screens/TelegramScreen.jsx#L6-L17):
1. `wholesaleChatId` (**Wholesale Channel — Series Only**): Public/client channel for models that have at least 1 complete series ($\text{fullSeriesCount} \ge 1$).
2. `retailChatId` (**Retail Channel — Broken Sizes**): Public/client channel for models that have leftover broken sizes ($\text{brokenSizes.length} > 0$).
3. `salesChatId` (**Sales / Discount Channel**): Public/client channel for models marked `onSale = 1` (and `discount > 0`) with $\text{totalStock} > 0$.
4. `liveStockChatId` (**Live Stock Monitoring Channel**): Real-time stock dashboard channel where each model has a persistent message edited in-place whenever stock changes.
5. `factureChatId` (**Customer Invoices / Factures Channel**): Receives formatted HTML receipts for every new order (`paid`, `deposit`, `nopaid`).
6. `casaChatId` (**Casa / Treasury Updates Channel**): Receives notifications for every Casa movement (`in`, `out`, `balance_confirm`, sales, deposits, returns, factory payments, debt payments).
7. `factoryInvoiceChatId` (**Factory Invoices Channel**): Receives notifications for factory imports (`in`), returns (`return`), payments (`payment`), and balance confirmations (`balance_confirm`).
8. `syncChatId` (**Database Sync Channel — Private**): Holds the pinned `sync_data.json.zip` document for multi-device synchronization.
9. `backupChatId` (**System Backup Channel**): Receives manual/scheduled ZIP backups (`backup_YYYY-MM-DD.zip`) and acts as the temporary forwarding target for `photoRecoveryService.js`.
10. `archiveChatId` (**Photo Archive Channel**): Private storage channel where product photos/videos are uploaded when saving a model in `ModelDetailScreen.jsx` to obtain permanent Telegram `file_id`s.

#### B. Per-Channel Settings
In `settings`:
- `silent_mode_${chatIdKey}` (`true`/`false`): Passes `disable_notification: true` to Telegram Bot API.
- `auto_publish_${chatIdKey}` (`true`/`false`): Controls whether saving/updating a model automatically publishes to `wholesaleChatId`, `retailChatId`, `salesChatId`, or `liveStockChatId`.

#### C. Queue Processor & Rate Limiting ([`telegramPublisher.js`](file:///run/media/hamza/storage2tb/Project/systemorta/src/core/telegramPublisher.js#L291-L407))
- Runs every **5 seconds** (`setInterval(processQueue, 5000)` started in [`App.jsx`](file:///run/media/hamza/storage2tb/Project/systemorta/src/App.jsx#L103)).
- Pauses immediately if `isWatcherDevice()` is true (Watcher Device 2 never processes the Telegram queue) or `!navigator.onLine`.
- Queries `db.telegramQueue.where('status').equals('pending')`, sorted by `priority` ascending (`1` = highest priority, `3` = lowest), then `createdAt` ascending.
- Processes **up to 3 items per tick** (`items.slice(0, 3)`) with a **1500ms delay** between items to respect Telegram Bot API rate limits.
- Supports item types:
  - `'text'` $\rightarrow$ `sendMessage` (`parse_mode: 'HTML'`)
  - `'photo'` $\rightarrow$ `sendPhoto` (accepts `fileId` string or `Blob`)
  - `'video'` $\rightarrow$ `sendVideo` (accepts `fileId` string or `Blob`)
  - `'media_group'` $\rightarrow$ `sendMediaGroup` (up to 10 photos/videos in one album; caption attached to the first item `idx === 0`)
  - `'delete'` $\rightarrow$ `deleteMessage`
- **Retry Logic**: On failure, increments `attemptCount`. After `attemptCount >= 3`, marks `status = 'failed'`.

#### D. Automatic Channel Evaluation (`evaluateAndUpdateChannels(modelId)`)
Whenever stock changes (New Order, Return, Factory Import/Return, Stock Adjust), [`evaluateAndUpdateChannels(modelId)`](file:///run/media/hamza/storage2tb/Project/systemorta/src/core/telegramPublisher.js#L69-L195) runs:
- Loops through every color (`modelColors`) of the model and computes `calcColorChannelInfo(color, seriesSizes)`:
  - `qualifiesWholesale = fullSeriesCount >= 1`
  - `qualifiesRetail = brokenSizes.length > 0`
  - `qualifiesSales = Boolean(model.onSale && model.discount > 0 && totalStock > 0)`
- For each of the 3 channels (`wholesale`, `retail`, `sales`):
  - If the color **no longer qualifies** AND has an existing `color.telegramMsgIds[channel]` $\rightarrow$ queues a `'delete'` task to remove the outdated post from Telegram and clears `telegramMsgIds[channel]`.
  - If the color **newly qualifies** AND has no `telegramMsgIds[channel]` AND `auto_publish_${chatIdKey}` is enabled $\rightarrow$ queues a `'media_group'` (or `'photo'`/`'video'`/`'text'`) task to publish the color card and stores the returned `message_id` in `color.telegramMsgIds[channel]`.

#### E. Live Stock Channel In-Place Editing (`updateLiveStockChannel(specificModelId)`)
In [`telegramPublisher.js`](file:///run/media/hamza/storage2tb/Project/systemorta/src/core/telegramPublisher.js#L197-L288):
- Stores a map `liveStockMsgMap: { [modelId]: messageId }` in `settings`.
- Formats the model's live stock via [`formatLiveStockModel(model, series, colors)`](file:///run/media/hamza/storage2tb/Project/systemorta/src/toolbox/telegramFormatter.js#L114-L162), which shows:
  - Status header (`🟢 AVAILABLE`, `🟡 LOW STOCK`, or `🔴 OUT OF STOCK`).
  - Every color with its status icon, per-size count, `📦 Series: X`, and `🔨 Broken: ...`.
- If `liveStockMsgMap[model.id]` exists:
  - Calls Telegram `editMessageText` (or `editMessageCaption` if the message has a photo).
  - If Telegram returns `"message is not modified"`, ignores it cleanly.
  - If Telegram returns `"message to edit not found"`, deletes the stale ID and sends a fresh message (with the primary color's photo if available).

---

### 5.2 Pictures & Media System (`telegramMedia.js` & `photoRecoveryService.js`)

#### A. How Product Photos & Videos Are Stored (`modelColors.assets`)
Each `modelColors` row has an `assets` array:
```js
assets: [
  {
    id: "uuid",
    type: "image" | "video",
    blob: Blob | null,     // Local binary file (stripped in backups/sync once fileId exists)
    fileId: "AgACAgQAA...", // Permanent Telegram file_id
    isPrimary: true | false
  }
]
```

#### B. Automatic Upload to Archive Channel on Model Save
In [`ModelDetailScreen.jsx`](file:///run/media/hamza/storage2tb/Project/systemorta/src/screens/ModelDetailScreen.jsx#L139-L176):
- When the user clicks **Save Model**, for every color asset that has a `blob` (`instanceof Blob`) but **no `fileId` yet**:
  - If online and `archiveChatId` is configured, it immediately uploads the `blob` to `archiveChatId` via `sendPhoto` or `sendVideo` (`disable_notification: true`).
  - Extracts the highest-resolution `photo.pop().file_id` (or `video.file_id`) from Telegram's response and saves it into `asset.fileId`.
  - Why? Because `Blob` objects cannot be serialized cleanly into lightweight JSON sync packets—once `fileId` is obtained, every synced device can stream the image directly from Telegram's servers!

#### C. Lazy-Loading Images via `fileId` ([`telegramMedia.js`](file:///run/media/hamza/storage2tb/Project/systemorta/src/core/telegramMedia.js))
- [`resolveTelegramUrl(fileId)`](file:///run/media/hamza/storage2tb/Project/systemorta/src/core/telegramMedia.js#L18-L65):
  1. Checks in-memory `urlCache` (`Map<fileId, objectUrl>`).
  2. Calls `https://api.telegram.org/bot${token}/getFile?file_id=${fileId}` to get `file_path`.
  3. Downloads the binary file:
     - **On Android (`Capacitor.isNativePlatform()`)**: Uses `CapacitorHttp.get({ url, responseType: 'blob' })` to bypass CORS, converts base64 to `Blob`, and creates a `URL.createObjectURL(blob)`.
     - **On Web/Dev**: Fetches via Vite proxy `/tg-file/bot${token}/${filePath}` (with fallback to direct URL).
- [`<TgImg fileId={...} blob={...} />`](file:///run/media/hamza/storage2tb/Project/systemorta/src/core/telegramMedia.js#L81-L108): React component used across `ModelsScreen`, `ModelDetailScreen`, and `StockScreen` that renders `blob` immediately if present locally, or resolves `fileId` asynchronously with a loading placeholder.

#### D. Photo Recovery Service ([`photoRecoveryService.js`](file:///run/media/hamza/storage2tb/Project/systemorta/src/core/photoRecoveryService.js))
Triggered from **Settings → Recover Missing Photos from Telegram**:
- Scans all models & colors where `assets` lack a `fileId`, or where a `telegramMsgIds` (`wholesale`, `retail`, `sales`, `liveStock`) exists.
- Uses a clever Telegram Bot API technique: calls `forwardMessage` from the source channel (`wholesaleChatId`, `retailChatId`, `salesChatId`, or `liveStockChatId`) to `backupChatId` (`disable_notification: true`), inspects the returned `result.photo` / `result.video` from the forwarded message to extract the `file_id`, immediately deletes the temporary forwarded message (`deleteMessage`), and saves the recovered `fileId` into `db.modelColors`!

---

### 5.3 Multi-Device Sync & Role System (`syncService.js`, `deviceSync.js`, `SyncManager.jsx`)

#### A. The 3 Device Roles ([`deviceSync.js`](file:///run/media/hamza/storage2tb/Project/systemorta/src/core/deviceSync.js))
Stored in `localStorage['orta_device_role']`:
1. **Device 1 — Main Admin (`'device1'`, Default)**:
   - Full Read/Write access (`canWrite() === true`).
   - Protected by PIN **`141425`** (` verifyDevice1Pin(pin)`).
   - Automatically **pushes** database changes to Telegram (`syncChatId`) and runs the Telegram message queue.
2. **Device 2 — Watcher (`'device2'`)**:
   - Read-restricted mode (`isWatcherDevice() === true`, `canWrite() === false`).
   - **Customer Phone Masking**: [`maskPhone(phone)`](file:///run/media/hamza/storage2tb/Project/systemorta/src/core/deviceSync.js#L35-L42) hides customer phone numbers (`+216******78`) across `CustomersScreen`, `CustomerDetailScreen`, `HistoryScreen`, `InvoiceDetailModal`, and `NewOrderScreen`.
   - **UI Restrictions**: Hides the `Logs` tab in Sidebar; disables Add/Edit/Delete buttons in `CustomersScreen`, `SettingsScreen`, `BackupScreen`, and `SyncScreen`.
   - **Auto-Pull**: [`SyncManager.jsx`](file:///run/media/hamza/storage2tb/Project/systemorta/src/core/SyncManager.jsx#L31-L58) automatically calls `syncService.pullSync(true)` on mount, every **30 seconds**, and whenever the app tab regains focus (`visibilitychange`).
3. **Device 3 — Monitor (`'device3'`)**:
   - Read-only (`canWrite() === false`), does not auto-push.

#### B. How `pushSync` Works ([`syncService.js`](file:///run/media/hamza/storage2tb/Project/systemorta/src/core/syncService.js#L131-L246))
1. **Debounce & Full-Sync Timers**:
   - Any DB write calls `triggerAutoPush()`.
   - Waits **10 seconds** (`DEBOUNCE_DELAY = 10000`) after the last write before pushing an **incremental** sync (or full sync if first time).
   - Forces a **full** sync at least once every **3 minutes** (`MAX_WAIT_DELAY = 3 * 60 * 1000`).
2. **Payload Construction (`exportDatabaseToZip`)**:
   - Exports all 12 tables (`settings`, `transactions`, `customers`, `factories`, `sizeSeries`, `colorTemplates`, `models`, `modelColors`, `orders`, `orderItems`, `stockLog`, `factoryInvoices`) plus `deletedRecords`.
   - Strips sensitive/device-local settings (`telegramBotToken`, `deviceId`, `syncHistory`).
   - Strips binary `blob` objects from `modelColors.assets` so only lightweight metadata and `fileId`s are zipped.
   - Compresses `sync_data.json` using `JSZip` (`DEFLATE` level 6) into `sync_data.json.zip`.
3. **Uploading & Pinning on Telegram**:
   - Sends `sync_data.json.zip` to `syncChatId` via `sendDocument` with caption:
     `🔄 SYNC_PACKET | Device: ... | Time: ... | Incremental: true/false`
   - Calls `pinChatMessage` (`disable_notification: true`) on the newly uploaded message so other devices can find the latest sync state by checking the chat's pinned message!

#### C. How `pullSync` & `mergeIncomingData` Work ([`syncService.js`](file:///run/media/hamza/storage2tb/Project/systemorta/src/core/syncService.js#L252-L407))
1. Calls `getChat(syncChatId)` to inspect `chat.pinned_message`.
2. Checks `pinned.document.file_id`. If `file_id === localStorage['orta_last_pulled_file_id']`, skips download and returns `'Already up to date'`.
3. Downloads the `.zip` file via `getFile`, unzips `sync_data.json`, and runs [`mergeIncomingData(syncPayload)`](file:///run/media/hamza/storage2tb/Project/systemorta/src/core/syncService.js#L350-L407):
   - Sets `window.__ortaPullingSync = true` (disables dirty-row hooks).
   - **Incremental Payload (`isIncremental === true`)**: Calls `bulkPut` for modified rows and applies `deletedRecords` tombstones (`db[table].delete(recordId)`).
   - **Full Payload (`isIncremental === false`)**:
     - For `modelColors`: preserves any local `blob` binary objects (`localAssetMap`) so locally cached images aren't lost, then replaces the table (`clear()` + `bulkPut()`).
     - For `settings`: preserves local `telegramBotToken`, `deviceId`, and `syncHistory`, and merges `liveStockMsgMap`.
     - For all other tables: `clear()` + `bulkPut()`.
   - Emits `EVENTS.SYNC_COMPLETED` so active screens reload live without refreshing the browser.

---

### 5.4 Backup System (`BackupScreen.jsx`)

Located in [`src/screens/BackupScreen.jsx`](file:///run/media/hamza/storage2tb/Project/systemorta/src/screens/BackupScreen.jsx):
- Packs all 13 tables (`settings`, `transactions`, `customers`, `factories`, `sizeSeries`, `colorTemplates`, `models`, `modelColors`, `orders`, `orderItems`, `stockLog`, `factoryInvoices`, `telegramQueue`) into a ZIP containing:
  - `system_orta_backup.json` (`version: '2.5.0'`, `createdAt`, `tables`)
  - `manifest.json` (`version`, `createdAt`, `app: 'System Orta'`)
- **3 Backup Actions**:
  1. **Download Local Backup (`.zip`)**: Saves `backup_YYYY-MM-DD.zip` to disk (or opens Android Share dialog via `@capacitor/filesystem` + `@capacitor/share`).
  2. **Send Backup to Telegram**: Uploads `backup_YYYY-MM-DD.zip` directly to `backupChatId` via `sendDocument`.
  3. **Import Backup (`.zip` or `.json`)**: Reads an uploaded `.zip` (extracts `system_orta_backup.json` or `sync_data.json`) or raw `.json`, clears existing tables, and calls `bulkPut` to restore the entire database.

---

### 5.5 PDF, WhatsApp & Excel Engine (`invoicePdf.js` & `exportExcel.js`)

#### A. Invoice PDF Generator ([`src/core/invoicePdf.js`](file:///run/media/hamza/storage2tb/Project/systemorta/src/core/invoicePdf.js))
- Generates an A4 portrait PDF using `jsPDF` and `jspdf-autotable`:
  - **Header**: Dark luxury banner (`#141414`), gold `SYSTEM ORTA` title, invoice number (`#INV-XXXX`), date, and color-coded status badge (`PAID`, `DEPOSIT`, `PREFORMA`, `RETURNED`).
  - **Customer Info Box**: Customer Name, Brand, Phone, Country.
  - **QR Code**: Generated via `QRCode.toDataURL` containing invoice metadata (`#INV-XXXX | Customer | Total`).
  - **Items Table**: Includes **Product Thumbnail Image** (rendered via canvas from local `blob` or resolved Telegram `fileId`!), Model Code & Name, Color, Size Breakdown (`44:2  46:2 ...`), Series Type, Total Pcs, Unit Price, and Line Total.
  - **Totals Summary Box**: Subtotal, Discount, Grand Total, Paid/Deposit Amount, and Remaining Balance.
  - **Barcode Footer**: Code128 barcode generated via `JsBarcode` for `order.number`.
- **Two Trigger Modes**:
  1. `generateInvoicePDF(order, items, customer)`: Downloads `Invoice_INV-XXXX.pdf` (or shares the PDF file natively on Android).
  2. `shareInvoiceWhatsApp(order, items, customer)`: Saves/downloads the PDF and opens `https://wa.me/${cleanPhone}?text=...` pre-filled with a formatted WhatsApp receipt summary.

#### B. Universal Excel Exporter ([`src/core/exportExcel.js`](file:///run/media/hamza/storage2tb/Project/systemorta/src/core/exportExcel.js))
- [`exportToExcel(sheets, filename)`](file:///run/media/hamza/storage2tb/Project/systemorta/src/core/exportExcel.js#L15-L59): Accepts an array of `{ name, data }` sheets, auto-calculates column widths (`!cols`), builds an `.xlsx` workbook via SheetJS (`XLSX`), and triggers a download on Web or native file share on Android.

---

## 6. Complete UI Reference: Every Screen, Tab, Button & Popup/Modal

### 6.0 Global App Shell (`src/App.jsx` & Global Components)
- **Topbar**:
  - **Mobile Menu Toggle (`☰`)**: Opens/closes Sidebar drawer on screens `< 768px`.
  - **Logo (`SYSTEM ORTA`)**: Gold gradient title.
  - **Telegram Queue Pill (`📤 X pending`)**: Appears when `pendingCount > 0`. Clicking navigates to `/telegram`.
  - **Connection Status Pill**: Shows `Online` (green dot), `Offline` (red dot), or `No Sync` (amber dot if token/`syncChatId` missing) + live clock (`HH:MM`).
  - **`Sync` Button (`RefreshCw`)**: Manually triggers `syncService.pullSync(false)` and displays the Global Sync Modal.
- **Sidebar Navigation**:
  - **Main Links**: `Home` (`/`), `New Order` (`/new-order`), `History` (`/history`), `Stock` (`/stock`), divider, `Casa` (`/casa`), `Customers` (`/customers`), `Models` (`/models`), `Factory` (`/factories`).
  - **`More` / `Less` Toggle Button**: Expands secondary tools navigation:
    - `Sync` (`/sync`), `Stock Log` (`/stock-log`), `Telegram` (`/telegram`), `Backup` (`/backup`), `Logs` (`/logs` — hidden on Device 2), `Settings` (`/settings`).
- **Global Overlays**:
  - [`Toaster.jsx`](file:///run/media/hamza/storage2tb/Project/systemorta/src/components/Toaster.jsx): Renders toast notifications (`toast.success`, `toast.error`, `toast.info`) at bottom-right.
  - [`GlobalSyncModal.jsx`](file:///run/media/hamza/storage2tb/Project/systemorta/src/components/GlobalSyncModal.jsx): Blocking overlay shown during manual `Sync` pull (`Connecting to Telegram...` $\rightarrow$ `Sync Complete` or `Sync Failed`).
  - [`GlobalConsole.jsx`](file:///run/media/hamza/storage2tb/Project/systemorta/src/components/GlobalConsole.jsx): Floating bottom-left terminal icon (`>_`). Clicking opens a live developer console drawer showing `LOG`, `WARN`, `ERROR` entries with `Clear` and `Close` buttons.

---

### 6.1 Home Screen ([`src/screens/HomeScreen.jsx`](file:///run/media/hamza/storage2tb/Project/systemorta/src/screens/HomeScreen.jsx)) — Route: `/`
- **4 KPI Stat Cards** (Top Grid):
  1. **Casa Balance**: Current treasury balance (`$`), plus `+In` and `-Out` sub-labels.
  2. **Today's Sales**: Count of today's orders (`paid` + `deposit`) and total revenue (`$`).
  3. **Total Stock**: Total pieces across all models (`pcs`) across `X` models.
  4. **Pending Deposits**: Count of open `'deposit'` orders and total unpaid deposit balance (`$`).
- **Quick Actions Card**:
  - `+ New Order` (navigates to `/new-order`)
  - `Casa (Treasury)` (navigates to `/casa`)
  - `Stock Overview` (navigates to `/stock`)
  - `Models Catalog` (navigates to `/models`)
  - `Customers` (navigates to `/customers`)
  - `Factories` (navigates to `/factories`)
- **Low Stock Alerts Card**: Lists up to 8 color variants where `0 < totalStock < 5` (amber badge) or `totalStock === 0` (red badge). Clicking a row navigates to `/models/:modelId`.
- **Recent Orders Card**: Lists the 6 most recent customer orders (`#INV-XXXX`, Customer, Type Badge, Total `$`). Clicking a row opens [`InvoiceDetailModal`](file:///run/media/hamza/storage2tb/Project/systemorta/src/components/InvoiceDetailModal.jsx). `View All` button navigates to `/history`.

---

### 6.2 New Order Screen ([`src/screens/NewOrderScreen.jsx`](file:///run/media/hamza/storage2tb/Project/systemorta/src/screens/NewOrderScreen.jsx)) — Route: `/new-order`
- **Header**: Shows `New Order` (or `Edit Order #INV-XXXX` when cloning/editing an invoice).
- **Left Column — Customer & Items**:
  1. **Customer Selection Card**:
     - **Search/Autocomplete Input**: Search existing customers by name, brand, or phone.
     - **`+ New Customer` Toggle Button**: Switches to inline new customer creation fields (`Full Name *`, `Brand Name`, `Phone Number` with automatic country flag badge, `Country`).
  2. **Order Items Card**:
     - **Header Buttons**:
       - `Scan Barcode` (`Camera`): Opens [`BarcodeScanner`](file:///run/media/hamza/storage2tb/Project/systemorta/src/components/BarcodeScanner.jsx) to scan a model/color barcode and auto-add/increment it in the order.
       - `+ Add Item`: Appends a new blank item row.
     - **Per-Item Row Controls**:
       - `Model Search Input`: Autocomplete dropdown by `code` or `name` (shows available stock count per model).
       - `Color Dropdown`: Select from the model's colors (displays color hex dot and available stock).
       - `Size Matrix Controls`:
         - `-` Button (decrements all sizes by 1 full series).
         - Individual `Size Qty Inputs` (shows available stock `Avail: X` under each size; turns red if entered qty exceeds stock).
         - `+` Button (increments all sizes by 1 full series).
       - `Series Badge`: Automatically shows `Complete Series (Wholesale)` (gold) or `Broken Sizes (Retail)` (purple).
       - `Unit Price ($)` Input: Auto-filled from `wholesalePrice` or `retailPrice`, editable manually.
       - `Row Total ($)` & `Remove Item (Trash)` button.
- **Right Column — Order Type & Payment Summary**:
  - **Order Type Selector Buttons (3 Tabs)**:
    1. `Paid` (Green): Full payment / immediate settlement.
    2. `Deposit` (Amber): Partial payment now, remaining balance tracked as Deposit Debt.
    3. `Preforma` (`nopaid`, Purple): Proforma quotation (no stock deduction, no Casa transaction).
  - **Financial Inputs**:
    - `Subtotal`: Auto-calculated sum of item totals.
    - `Discount ($)` Input: Subtracted from subtotal.
    - `Total`: $\max(0, \text{Subtotal} - \text{Discount})$.
    - **If `Paid` selected**:
      - `Casa Cash ($)` (`paidExact` input): Exact cash entering Casa. Displays dynamic helper text if a broker commission is deducted ($\text{Casa Cash} < \text{Total}$) or overpaid ($\text{Casa Cash} > \text{Total}$).
    - **If `Deposit` selected**:
      - `Deposit Paid ($)` Input: Cash entering Casa now.
      - `Remaining Debt`: Auto-calculated $\text{Total} - \text{Deposit}$.
    - `Order Notes` Textarea.
  - **`Save Order` Button**: Validates stock & customer, writes order + items + stock logs + Casa transactions + Telegram queue items, and opens the **Post-Save Success Modal**.
- **Popups / Modals in `NewOrderScreen`**:
  - **Post-Save Success Modal**: Shows order number `#INV-XXXX`, total amount, and 4 buttons:
    - `Download PDF` (`generateInvoicePDF`)
    - `Send WhatsApp` (`shareInvoiceWhatsApp`)
    - `View History` (navigates to `/history`)
    - `New Order` (resets form for next order)
  - **Camera Barcode Scanner Modal** ([`BarcodeScanner.jsx`](file:///run/media/hamza/storage2tb/Project/systemorta/src/components/BarcodeScanner.jsx)).

---

### 6.3 History Screen ([`src/screens/HistoryScreen.jsx`](file:///run/media/hamza/storage2tb/Project/systemorta/src/screens/HistoryScreen.jsx)) — Route: `/history`
- **Header Buttons**:
  - `Export Excel`: Exports filtered orders and all order line items into a 2-sheet `.xlsx` file (`Orders Summary`, `Order Items`).
  - `+ New Order`: Navigates to `/new-order`.
- **Filters Bar**:
  - **Search Input**: Filters by invoice `#`, customer name, brand, or phone.
  - **Type Filter Pills**: `All`, `Paid`, `Deposit`, `Preforma` (`nopaid`), `Returned`.
  - **Date Period Pills**: `All Time`, `Today`, `This Week`, `This Month`, `Custom` (reveals From/To date pickers).
- **Summary Cards (4 Cards)**: `Total Orders`, `Total Value ($)`, `Cash Collected ($)`, `Pending Deposits ($)`.
- **Orders Table**:
  - Columns: `Order #`, `Date`, `Customer`, `Brand`, `Items (pcs)`, `Total ($)`, `Paid ($)`, `Status Badge`, `Actions`.
  - **Row Actions**:
    - Clicking anywhere on a row opens [`InvoiceDetailModal`](file:///run/media/hamza/storage2tb/Project/systemorta/src/components/InvoiceDetailModal.jsx).
    - `Pay Now` button (on `deposit` rows): Opens inline **Pay Deposit Modal**.
    - `PDF` icon button: Downloads Invoice PDF.
    - `WhatsApp` icon button: Shares Invoice via WhatsApp.
- **Popups / Modals**:
  1. **Inline Pay Deposit Modal**: Input `Amount ($)` to settle deposit balance.
  2. **[`InvoiceDetailModal.jsx`](file:///run/media/hamza/storage2tb/Project/systemorta/src/components/InvoiceDetailModal.jsx)**:
     - Displays full invoice header, customer info, line items table (Model, Color, Series Type, Size breakdown, Qty, Unit Price, Total), financial breakdown (Subtotal, Discount, Total, Paid, Commission, Remaining), and action buttons:
       - `Download PDF`
       - `Share WhatsApp`
       - `Edit Invoice` (clones order into `/new-order` and auto-returns old order on save)
       - `Pay Remaining Balance` (for `deposit` orders — opens inline payment input with automatic broker commission calculation if amount paid < remaining)
       - `Return Order` (for `paid` or `deposit` orders — opens confirmation prompt, restores stock, refunds Casa, updates customer debt).

---

### 6.4 Stock Screen ([`src/screens/StockScreen.jsx`](file:///run/media/hamza/storage2tb/Project/systemorta/src/screens/StockScreen.jsx)) — Route: `/stock`
- **Header Buttons**:
  - `Sync Live Stock` (`Send`): Calls `updateLiveStockChannel()` to refresh all model messages in `liveStockChatId`.
  - `Export Excel`: Exports current filtered stock matrix to `.xlsx`.
  - `Stock Log`: Navigates to `/stock-log`.
- **4 KPI Summary Cards**: `Total Pieces`, `Active Models`, `Color Variants`, `Total Stock Value ($)` (calculated at `wholesalePrice`).
- **Filters Bar**:
  - **Search Input**: Search by model code, name, or color.
  - **Factory Dropdown**: Filter by factory.
  - **Stock Status Pills**: `All`, `In Stock (>0)`, `Low Stock (<5)`, `Out of Stock (0)`, `Complete Series`, `Broken Sizes`.
- **Stock Table**:
  - Columns: `Photo` (`<TgImg>`), `Model Code & Name`, `Factory`, `Color` (hex dot + name), `Sizes Breakdown` (badges showing `size: qty`), `Total Pcs`, `Status` (`Complete` vs `Broken` + `Low`/`Out`), `Wholesale $`, `Actions`.
  - **Row Action**: `Adjust` button (`Edit2`) opens the **Manual Stock Adjustment Modal**.
- **Popup — Manual Stock Adjustment Modal**:
  - Shows current quantities for each size in the selected Model + Color.
  - Allows editing exact new quantities per size and entering a `Reason` (default `'Manual Adjustment'`).
  - On Save: calculates $\Delta = \text{newQty} - \text{oldQty}$ per size, updates `db.modelColors`, writes `'adjust'` entries to `db.stockLog`, and triggers `evaluateAndUpdateChannels(modelId)` + `updateLiveStockChannel(modelId)`.

---

### 6.5 Stock Log Screen ([`src/screens/StockLogScreen.jsx`](file:///run/media/hamza/storage2tb/Project/systemorta/src/screens/StockLogScreen.jsx)) — Route: `/stock-log`
- **Header Button**: `Export Excel` (exports audit log to `.xlsx`).
- **Filters**: Search Input (model code, color, reason), Movement Type Filter (`All`, `In (Factory)`, `Out (Sales)`, `Customer Return`, `Factory Return`, `Manual Adjust`), Date Period Filter (`All`, `Today`, `Week`, `Month`, `Custom`).
- **Table Columns**: `Date & Time`, `Model`, `Color`, `Size`, `Type Badge`, `Qty Change` (`+X` green / `-X` red), `Balance After`, `Reason / Ref`.

---

### 6.6 Casa / Treasury Screen ([`src/screens/TreasuryScreen.jsx`](file:///run/media/hamza/storage2tb/Project/systemorta/src/screens/TreasuryScreen.jsx)) — Route: `/casa`
- **Header Action Buttons**:
  - `+ Cash In` (Green): Opens **Cash In Modal**.
  - `- Cash Out` (Red): Opens **Cash Out Modal**.
  - `Confirm Balance` (Blue): Opens **Confirm Balance Modal**.
  - `Start Budget` (Secondary): Opens **Start Budget Modal**.
  - `Export Excel`: Exports Casa ledger to `.xlsx`.
- **4 KPI Cards**:
  1. `Period Cash In` (`+ $`)
  2. `Period Cash Out` (`- $`)
  3. `Net Period` (`In - Out`)
  4. `Total Casa Balance` (Global all-time balance: `startBudget + allIn - allOut`, highlighted in gold).
- **Filters Bar**:
  - Search Input (description, person, category).
  - Type Filter (`All`, `Cash In`, `Cash Out`, `Confirmations`).
  - Category Dropdown (`All Categories`, `Sale`, `Deposit`, `Factory Payment`, `Commission Paid`, `Customer Return`, `Debt Payment`, etc.).
  - Date Period Pills (`Today`, `Week`, `Month`, `Year`, `All`, `Custom`).
- **Transactions Table**:
  - Columns: `Date`, `Type Badge` (`IN`, `OUT`, `CONFIRM`), `Category`, `Description`, `Person / Entity`, `Amount ($)`, `Running Balance ($)`.
  - Clicking any row opens [`TransactionDetailModal.jsx`](file:///run/media/hamza/storage2tb/Project/systemorta/src/components/TransactionDetailModal.jsx).
- **Popups / Modals in `TreasuryScreen`**:
  1. **Cash In / Cash Out Modal**: Fields for `Amount ($)`, `Category` dropdown, `Person / Counterparty`, `Description / Note`. Saves to `db.transactions` and queues message to `casaChatId`.
  2. **Confirm Balance Modal**: Displays current global Casa Balance and records a `type: 'balance_confirm'` checkpoint in `db.transactions` + sends confirmation to `casaChatId`.
  3. **Start Budget Modal**: Updates `startBudget` in `settings`.
  4. **[`TransactionDetailModal.jsx`](file:///run/media/hamza/storage2tb/Project/systemorta/src/components/TransactionDetailModal.jsx)**: Shows full transaction details. If the transaction is linked to an `orderId`, `customerId`, or `factoryId`, displays a button to jump directly to that Invoice, Customer, or Factory!

---

### 6.7 Customers Screen ([`src/screens/CustomersScreen.jsx`](file:///run/media/hamza/storage2tb/Project/systemorta/src/screens/CustomersScreen.jsx)) — Route: `/customers`
- **Header Buttons**: `Export Excel`, `+ Add Customer` (disabled on Watcher Device 2).
- **Summary Cards**: `Total Customers`, `Customers with Debt`, `Total Manual Debt ($)`, `Total Deposit Debt ($)`.
- **Search & Filter**: Search by name, brand, phone, or country; Filter pill for `All` vs `Has Debt`.
- **Customers Table**:
  - Columns: `Customer Name`, `Brand`, `Phone` (with country flag; masked on Device 2), `Country`, `Orders Count`, `Total Spent ($)`, `Deposit Debt ($)`, `Manual Debt ($)`, `Actions` (`View`, `Edit`, `Delete`).
- **Popup — Add/Edit Customer Modal**: Fields: `Name *`, `Brand`, `Phone` (auto-detects country & flag via `phoneParser.js`), `Country`, `Initial Manual Credit/Debt ($)`, `Notes`.

---

### 6.8 Customer Detail Screen ([`src/screens/CustomerDetailScreen.jsx`](file:///run/media/hamza/storage2tb/Project/systemorta/src/screens/CustomerDetailScreen.jsx)) — Route: `/customers/:id`
- **Header Buttons**:
  - `Credit Ledger` (navigates to `/customers/:id/credit`)
  - `+ Add Debt` (opens **Add Manual Debt Modal**)
  - `Pay Debt` (opens **Pay Manual Debt Modal** — enabled when `customer.credit > 0`)
  - `Edit Customer` (opens Edit Modal)
  - `Export Excel` (exports customer's orders & debt history)
- **KPI Cards**: `Total Purchases ($)`, `Total Paid ($)`, `Unpaid Deposits ($)` (from `'deposit'` orders), `Manual Debt ($)` (`customer.credit`).
- **2 Tabs**:
  1. `Orders History`: All invoices for this customer (`paid`, `deposit`, `nopaid`, `returned`). Clicking a row opens `InvoiceDetailModal`.
  2. `Debt & Payments`: Shows Manual Debt entries (`manual_debt`) and Debt Payments (`Debt Payment`).
- **Popups / Modals**:
  1. **Add Manual Debt Modal**: `Amount ($)`, `Reason / Note`. Increments `customer.credit` and creates an order record with `type: 'manual_debt'`.
  2. **Pay Manual Debt Modal**: `Amount ($)`, `Note`. Decrements `customer.credit`, creates a Casa `'in'` transaction (`Category: 'Debt Payment'`), and notifies `casaChatId`.

---

### 6.9 Customer Credit Ledger Screen ([`src/screens/CustomerCreditScreen.jsx`](file:///run/media/hamza/storage2tb/Project/systemorta/src/screens/CustomerCreditScreen.jsx)) — Route: `/customers/:id/credit`
- Dedicated statement of account for a customer's debts.
- **Header Buttons**: `+ Add Manual Debt`, `Record Payment`, `Export Excel`.
- **3 Summary Cards**: `Manual Debt Balance ($)`, `Unpaid Deposit Orders ($)`, `Combined Total Owed ($)`.
- **Chronological Ledger Table**: Shows every debt increase (`Manual Debt` or unpaid `Deposit Order`) and every `Debt Payment` with a `Running Debt ($)` column.

---

### 6.10 Models Catalog Screen ([`src/screens/ModelsScreen.jsx`](file:///run/media/hamza/storage2tb/Project/systemorta/src/screens/ModelsScreen.jsx)) — Route: `/models`
- **Header Buttons**:
  - `Print Barcodes`: Opens **Print Barcodes Modal** (select models & quantities to print barcode labels on A4/thermal layout).
  - `Export Excel`: Exports full catalog with colors, prices, and stock to `.xlsx`.
  - `+ New Model`: Navigates to `/models/new`.
- **Filters**: Search Input (code, name), Type Dropdown (`All Types`, `Long Dress`, `Short Dress`, `Ensemble`, etc.), Factory Dropdown, On-Sale toggle pill (`🔥 On Sale`), View Mode toggle (`Grid View` vs `Table View`).
- **Model Cards / Rows**: Shows primary photo (`<TgImg>`), `code`, `name`, `factoryName`, `Wholesale $`, `Retail $`, `On Sale` badge, color hex dots, total stock count, and quick `Delete` button. Clicking opens `/models/:id`.

---

### 6.11 Model Detail / Editor Screen ([`src/screens/ModelDetailScreen.jsx`](file:///run/media/hamza/storage2tb/Project/systemorta/src/screens/ModelDetailScreen.jsx)) — Route: `/models/:id` (and `/models/new`)
- **Header Buttons**:
  - `Publish to Telegram` (`Send`): Manually triggers `publishModelToChannels` for selected channels.
  - `Save Model`: Saves model + colors, uploads any new photo/video blobs to `archiveChatId` to get `fileId`s, and evaluates auto-publish channels.
  - `Delete Model` (if editing existing model).
- **Left Column — Model Information & Pricing**:
  - `Model Code / Barcode *` (with `Generate` button and `Scan` camera button + live `<Barcode>` preview).
  - `Model Name *`, `Dress / Garment Type` dropdown, `Factory` dropdown, `Size Series` dropdown (`44-50`, `36-42`, etc.).
  - **Pricing Grid**:
    - `Factory Price ($)` (cost price from factory)
    - `Wholesale Price ($)` (price per piece when buying complete series)
    - `Retail Price ($)` (price per piece when buying broken sizes)
    - `Discount ($)` + `On Sale` toggle switch (enables publishing to `salesChatId`).
- **Right Column — Color Variants & Stock/Media Manager**:
  - `+ Add Color Variant` dropdown (picks from `colorTemplates` or creates a custom color name + hex picker).
  - **Per-Color Card**:
    - Color swatch, name, custom color barcode, and `Remove Color` button.
    - **Series Breakdown Banner**: Live calculation showing `Total: X pcs`, `Full Series: Y`, and `Broken Sizes: ...`.
    - **Per-Size Stock Inputs**: Quick `-` / `+` series steppers plus individual size quantity inputs.
    - **Media Gallery (`assets`)**:
      - `+ Upload Photos/Videos` button (supports multi-file selection).
      - Thumbnails for each image/video with `Set Primary (Star)` button and `Delete (×)` button.

---

### 6.12 Factories Screen ([`src/screens/FactoriesScreen.jsx`](file:///run/media/hamza/storage2tb/Project/systemorta/src/screens/FactoriesScreen.jsx)) — Route: `/factories`
- **Header Buttons**: `Export Excel`, `+ Add Factory`.
- **Summary Cards**: `Total Factories`, `Total Debt (All Factories)`, `Total Stock Value (At Factory Cost)`, `Net Balance Owed (Sold Goods)`.
- **Factories Grid/Table**: Displays each factory's `name`, `code`, `phone`, `location`, and the 3 financial metrics (`Total Debt`, `Stock Value`, `Net Owed`). Clicking opens `/factories/:id`.
- **Popup — Add/Edit Factory Modal**: `Factory Name *`, `Factory Code *`, `Phone`, `Location`, `Initial Debt / Start Credit ($)`, `Notes`.

---

### 6.13 Factory Detail Screen ([`src/screens/FactoryDetailScreen.jsx`](file:///run/media/hamza/storage2tb/Project/systemorta/src/screens/FactoryDetailScreen.jsx)) — Route: `/factories/:id`
- **Header Action Buttons**:
  - `Import Excel` (`Upload`): Bulk-imports models, colors, stock, or factory invoices from an `.xlsx` file.
  - `Export Excel` (`Download`): Exports a 3-sheet workbook (`Summary`, `Transactions`, `Models & Stock`).
  - `+ New Invoice (Import)` (Gold): Opens **Factory Import Modal (`type = 'in'`)**.
  - `Return` (Red): Opens **Factory Return Modal (`type = 'return'`)**.
  - `Payment` (Green): Opens **Factory Payment Modal (`type = 'payment'`)**.
  - `Confirm Balance` (Blue): Opens **Confirm Balance Modal (`type = 'balance_confirm'`)**.
- **5 Financial KPI Cards**:
  1. `Total Imports ($)` (`fin.totalIn`)
  2. `Total Returns ($)` (`fin.totalOut`)
  3. `Total Paid ($)` (`fin.totalPayments`)
  4. `Total Debt ($)` (`fin.totalCredit = startCredit + in - out - payments`)
  5. `Stock Value ($)` (`fin.stockCredit`) & `Net Owed ($)` (`fin.netCredit = totalCredit - stockCredit`).
- **2 Tabs**:
  1. **`Transactions` Tab**:
     - Filters: Date Period (`All`, `Today`, `Week`, `Month`, `Year`, `Custom`), Type (`All`, `Import`, `Return`, `Payment`, `Confirm`), Model Code Search.
     - Table Columns: `Number`, `Type Badge`, `Date`, `Details / Models`, `Amount ($)`, `Running Debt ($)`.
     - Clicking any row opens [`FactoryInvoiceDetailModal.jsx`](file:///run/media/hamza/storage2tb/Project/systemorta/src/components/FactoryInvoiceDetailModal.jsx).
  2. **`Catalog Models` Tab**:
     - Lists all models belonging to this factory with their colors, per-size stock, `Factory Price ($)`, and `Total Stock Value ($)`. Includes `+ Add Model for Factory` shortcut.
- **Popups / Modals in `FactoryDetailScreen`**:
  1. **Import (`in`) / Return (`return`) Modal**:
     - Multi-row table where each row links to a factory model (via autocomplete or camera `Scan Barcode`), selects a `Color` (or types a new color to auto-create it!), enters per-size quantities (with `-` / `+` full-series steppers) or flat `qty`, and sets `Factory Price ($)`.
     - Saving updates `db.modelColors` stock, logs `'in'` or `'return'` in `db.stockLog`, creates the `db.factoryInvoices` record, queues a notification to `factoryInvoiceChatId`, and triggers `evaluateAndUpdateChannels` + `updateLiveStockChannel`.
  2. **Payment Modal (`payment`)**:
     - Inputs: `Amount ($)`, `Receiver Name`, `Note`.
     - Saving creates a `'payment'` record in `db.factoryInvoices`, creates a `'out'` transaction in `db.transactions` (Casa `Category: 'Factory Payment'`), and sends notifications to **both** `factoryInvoiceChatId` and `casaChatId`.
  3. **Confirm Balance Modal (`confirm`)**:
     - Records a `'balance_confirm'` checkpoint with current `fin.totalCredit` in `db.factoryInvoices` and notifies `factoryInvoiceChatId`.
  4. **[`FactoryInvoiceDetailModal.jsx`](file:///run/media/hamza/storage2tb/Project/systemorta/src/components/FactoryInvoiceDetailModal.jsx)**: Read-only detail popup showing every model, color, size breakdown, factory price, and total for a factory import/return/payment.

---

### 6.14 Telegram Screen ([`src/screens/TelegramScreen.jsx`](file:///run/media/hamza/storage2tb/Project/systemorta/src/screens/TelegramScreen.jsx)) — Route: `/telegram`
- **Bot Configuration Card**:
  - `Bot Token` input + `Test Connection` button (calls `/getMe` and displays `@bot_username`).
  - `Save Configuration` button.
- **10 Channel Cards**:
  - Each card has: `Chat ID` input (`-100...`), `Test` button (sends a test ping message to that channel), `Silent Mode` toggle (`🔕`), and (for product channels) `Auto-Publish` toggle.
- **Outbound Queue Manager Card**:
  - Shows counts of `Pending`, `Sent`, and `Failed` messages in `db.telegramQueue`.
  - Buttons: `Process Queue Now`, `Retry Failed` (resets `'failed'` items back to `'pending'`), `Clear Sent/Failed`.
  - Table listing recent queue items with status badge, priority, target channel, preview text, error message (if failed), and individual `Delete` button.

---

### 6.15 Sync Screen ([`src/screens/SyncScreen.jsx`](file:///run/media/hamza/storage2tb/Project/systemorta/src/screens/SyncScreen.jsx)) — Route: `/sync`
- **Sync Controls Card**:
  - Displays `Device ID`, current `Device Role`, `Last Sync Time`, and `Dirty Rows Count`.
  - **Action Buttons**:
    - `Push Database to Telegram (Upload)` (`syncService.pushSync(false)` — forces full push; disabled on Watcher Device 2).
    - `Pull Database from Telegram (Download)` (`syncService.pullSync(false)` — downloads and merges pinned ZIP).
- **Sync History Table**: Displays the last 30 sync operations (`Push` or `Pull`, timestamp, status, message).

---

### 6.16 Backup Screen ([`src/screens/BackupScreen.jsx`](file:///run/media/hamza/storage2tb/Project/systemorta/src/screens/BackupScreen.jsx)) — Route: `/backup`
- **Export Card**:
  - `Download Local Backup (.zip)` button.
  - `Send Backup to Telegram` button (uploads to `backupChatId`).
- **Restore / Import Card**:
  - File picker accepting `.zip` or `.json` files $\rightarrow$ restores full database.
- **Database Statistics Grid**: Live row counts for Models, Colors, Customers, Orders, Transactions, and Factories.
- **Backup Log Table**: History of local and Telegram backups.

---

### 6.17 Settings Screen ([`src/screens/SettingsScreen.jsx`](file:///run/media/hamza/storage2tb/Project/systemorta/src/screens/SettingsScreen.jsx)) — Route: `/settings`
- **Device Role & Security Card**:
  - Switch between **Device 1 (Main Admin — Full Access)**, **Device 2 (Watcher — Read Only & Masked Phones)**, and **Device 3 (Monitor)**.
  - Switching to Device 1 requires entering the 6-digit PIN (**`141425`**).
- **General Financial & Order Settings**:
  - `Casa Starting Budget ($)` (`startBudget`)
  - `Next Invoice Number` (`nextOrderNum`)
- **Size Series Manager Card**:
  - List existing size series (`44-50`, `36-42`, etc.), add new size series (`Series Name`, comma-separated `Sizes`), or delete unused series.
- **Color Templates Manager Card**:
  - Manage master color swatches (`Color Name` + `Hex Color Picker`), add or delete swatches.
- **Media & Photo Recovery Card**:
  - `Recover Missing Photos from Telegram` button (runs [`recoverMissingPhotos`](file:///run/media/hamza/storage2tb/Project/systemorta/src/core/photoRecoveryService.js) with a live progress bar).
- **Danger Zone Card**:
  - `Factory Reset Database`: Requires typing confirmation; wipes IndexedDB and reloads.

---

### 6.18 System Logs Screen ([`src/screens/LogsScreen.jsx`](file:///run/media/hamza/storage2tb/Project/systemorta/src/screens/LogsScreen.jsx)) — Route: `/logs`
- Displays persisted logs from `db.logs` (captured by `logger.js`).
- **Controls**: Filter by level (`ALL`, `LOG`, `WARN`, `ERROR`), Search input, `Refresh`, `Export Logs (.txt)`, and `Clear All Logs`.

---

## 7. Playbook for Future AI Agents Modifying System Orta

When the user asks you to modify or add features to System Orta, follow these architectural rules:

1. **Adding or Modifying Database Fields / Tables ([`src/core/db.js`](file:///run/media/hamza/storage2tb/Project/systemorta/src/core/db.js))**:
   - If you add a new indexed field or table, increment `db.version(X)` in `src/core/db.js`.
   - Add any new synced table name to `SYNCED_TABLES` in **both** [`src/core/db.js`](file:///run/media/hamza/storage2tb/Project/systemorta/src/core/db.js#L62-L66) (dirty tracking hooks) and [`src/core/syncService.js`](file:///run/media/hamza/storage2tb/Project/systemorta/src/core/syncService.js#L13-L26) (`TABLES_TO_SYNC`) as well as [`src/screens/BackupScreen.jsx`](file:///run/media/hamza/storage2tb/Project/systemorta/src/screens/BackupScreen.jsx#L10-L24) (`BACKUP_TABLES`).
2. **Respecting Watcher Device Restrictions ([`src/core/deviceSync.js`](file:///run/media/hamza/storage2tb/Project/systemorta/src/core/deviceSync.js))**:
   - Any new customer phone display must pass through `maskPhone(phone)` so Device 2 cannot see raw client phone numbers.
   - Any new destructive or administrative action should check `canWrite()` or `!isWatcherDevice()`.
3. **Keeping Financial Ledgers Consistent**:
   - **Casa**: Every cash movement must write to `db.transactions` (`type: 'in' | 'out'`) and queue a formatted message to `casaChatId` via `formatCasaTransaction`.
   - **Stock**: Every stock quantity change on `db.modelColors` must also write an audit row to `db.stockLog` and call `evaluateAndUpdateChannels(modelId)` + `updateLiveStockChannel(modelId)`.
   - **Customer Debt**: Keep `customer.credit` strictly for **Manual Debt** (`type: 'manual_debt'` and `category: 'Debt Payment'`), and compute **Deposit Debt** from open `type: 'deposit'` orders (`totalPrice - paidAmount`).
   - **Factory Debt**: Remember the 3-part relationship:
     $$\text{totalCredit} = \text{startCredit} + \text{totalIn} - \text{totalOut} - \text{totalPayments}$$
     $$\text{netCredit} = \text{totalCredit} - \text{stockCredit}$$
