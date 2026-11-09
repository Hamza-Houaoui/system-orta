import { isWatcherDevice } from './core/deviceSync';
import { toast } from "./components/Toaster";
import React, { useEffect, useState } from 'react';
import { HashRouter as Router, Routes, Route, NavLink, useLocation } from 'react-router-dom';
import {
  Search, ShoppingBag, History, Boxes, PackageCheck, Wallet,
  Users, Store, Building2, SlidersHorizontal, ClipboardList,
  Settings2, Send, Shield, RefreshCw, Check, FileText,
  WifiOff, RefreshCwOff, ChevronDown, ChevronUp
} from 'lucide-react';

import Toaster from './components/Toaster';
import ErrorBoundary from './components/ErrorBoundary';
import { loadSettings, getSettings } from './core/store';
import { Logger } from './core/logger';
import { processTelegramQueue } from './core/telegramPublisher';
import { syncService } from './core/syncService';

// ── Screens ──────────────────────────────────────────────
import HomeScreen          from './screens/HomeScreen';
import NewOrderScreen      from './screens/NewOrderScreen';
import HistoryScreen       from './screens/HistoryScreen';
import StockScreen         from './screens/StockScreen';
import StockLogScreen      from './screens/StockLogScreen';
import CustomersScreen     from './screens/CustomersScreen';
import CustomerDetailScreen from './screens/CustomerDetailScreen';
import CustomerCreditScreen from './screens/CustomerCreditScreen';
import ModelsScreen        from './screens/ModelsScreen';
import ModelDetailScreen   from './screens/ModelDetailScreen';
import FactoriesScreen     from './screens/FactoriesScreen';
import FactoryDetailScreen from './screens/FactoryDetailScreen';
import TreasuryScreen      from './screens/TreasuryScreen';
import TelegramScreen      from './screens/TelegramScreen';
import SyncScreen          from './screens/SyncScreen';
import BackupScreen        from './screens/BackupScreen';
import SettingsScreen      from './screens/SettingsScreen';
import LogsScreen          from './screens/LogsScreen';

import SyncManager         from './core/SyncManager';

import './index.css';

// ── Nav Config ───────────────────────────────────────────
const MAIN_NAV = [
  { to: '/',            icon: Search,          label: 'Home' },
  { to: '/new-order',   icon: ShoppingBag,     label: 'New Order' },
  { to: '/history',     icon: History,         label: 'History' },
  { to: '/stock',       icon: Boxes,           label: 'Stock' },
  null, // divider
  { to: '/casa',        icon: Wallet,          label: 'Casa' },
  { to: '/customers',   icon: Users,           label: 'Customers' },
  { to: '/models',      icon: Store,           label: 'Models' },
  { to: '/factories',   icon: Building2,       label: 'Factory' },
];

// Tools group — hidden behind the "More" arrow to keep the main tabs clean
const TOOLS_NAV = [
  { to: '/sync',        icon: SlidersHorizontal, label: 'Sync' },
  { to: '/stock-log',   icon: ClipboardList,   label: 'Stock Log' },
  { to: '/telegram',    icon: Send,            label: 'Telegram' },
  { to: '/backup',      icon: Shield,          label: 'Backup' },
  { to: '/logs',        icon: FileText,        label: 'Logs' },
  { to: '/settings',    icon: Settings2,       label: 'Settings' },
];
const TOOLS_PATHS = TOOLS_NAV.map(t => t.to);

function AppContent() {
  const location = useLocation();
  const [ready, setReady] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncOk, setSyncOk] = useState(false);
  const [queueCount, setQueueCount] = useState(0);
  const [now, setNow] = useState(new Date());
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showTools, setShowTools] = useState(false);

  // Auto-open the tools group when on a tools page, close it on main tabs
  useEffect(() => {
    setShowTools(TOOLS_PATHS.includes(location.pathname));
  }, [location.pathname]);

  // Init app
  useEffect(() => {
    const init = async () => {
      Logger.info('app', 'init', '🚀 System Orta starting...');
      
      // ONE-TIME MIGRATION: Separate Deposit debt from Manual Debt
      try {
        if (!localStorage.getItem('migrated_deposit_debts_v1')) {
          const customers = await db.customers.toArray();
          const pre = await db.orders.where('type').equals('deposit').toArray();
          
          const depositUnpaidByCustomer = {};
          pre.forEach(o => {
            if (!o.customerId) return;
            const total = o.totalPrice || 0;
            const paid = o.paidAmount || o.depositAmount || 0;
            depositUnpaidByCustomer[o.customerId] = (depositUnpaidByCustomer[o.customerId] || 0) + (total - paid);
          });
        
          for (const c of customers) {
            const depositDebt = depositUnpaidByCustomer[c.id] || 0;
            if (depositDebt > 0) {
               const manualDebt = Math.max(0, (c.credit || 0) - depositDebt);
               await db.customers.update(c.id, { credit: manualDebt });
               Logger.info('app', 'migration', `Fixed ${c.name}: credit ${c.credit} -> ${manualDebt}`);
            }
          }
          localStorage.setItem('migrated_deposit_debts_v1', 'true');
          Logger.info('app', 'migration', 'Deposit debts successfully separated from Manual Debts.');
        }
      } catch (e) {
        Logger.error('app', 'migration', e.message);
      }
      await loadSettings();
      Logger.info('app', 'init', 'Settings loaded');
      setReady(true);
    };
    init();

    // Clock tick
    const tick = setInterval(() => setNow(new Date()), 30000);

    // Queue count listener
    const onQueue = (e) => {
       const count = e.detail?.count ?? 0;
       setQueueCount(count);
    };
    window.addEventListener('orta:queue_updated', onQueue);
    
    // Auto pull sync timer for Device 2 (every 30 seconds)
    const pullTimer = setInterval(() => {
      if (isWatcherDevice() && !isSyncing) {
         syncService.pullSync(() => {}).catch(() => {}); // silently pull updates
      }
    }, 30000);

    // Auto queue timer (every 15 seconds)
    const queueTimer = setInterval(() => {
       if (getSettings().telegramAutoMode) {
          processTelegramQueue().catch(() => {});
       }
    }, 15000);

    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);

    return () => { 
      clearInterval(tick); 
      clearInterval(queueTimer); clearInterval(pullTimer);
      window.removeEventListener('orta:queue_updated', onQueue); 
      window.removeEventListener('online', goOnline); 
      window.removeEventListener('offline', goOffline); 
    };
  }, []);

  const formatDate = (d) => d.toLocaleDateString('en-US', {
    month: 'numeric', day: 'numeric', year: 'numeric'
  }) + ', ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  const handleSync = async () => {
    const settings = getSettings();
    if (!settings.botToken || !settings.syncChatId) {
      toast && toast.info ? toast.info('Configure Telegram Sync Channel in Settings first') : null;
      return;
    }
    if (isSyncing) return;
    setIsSyncing(true);
    try {
      const result = await syncService.pullSync(() => {});
      setSyncOk(true);
      Logger.info('app', 'topSync', `Pull sync done from Device ${result.sourceDeviceId}`);
      setTimeout(() => { setSyncOk(false); setIsSyncing(false); }, 2000);
    } catch(e) {
      if (e.message === 'ALREADY_UP_TO_DATE') {
        setSyncOk(true);
        Logger.info('app', 'topSync', 'Already up to date');
      } else {
        Logger.warn('app', 'topSync', `Sync failed: ${e.message}`);
      }
      setTimeout(() => { setSyncOk(false); setIsSyncing(false); }, 2000);
    }
  };

  if (!ready) {
    return (
      <div className="loading-screen">
        <img src="/logo_small.png" alt="Logo" width={90} className="pulse logo-glow"
          onError={e => { e.target.style.display = 'none'; }} />
        <div style={{ color: 'var(--gold)', fontSize: '1.1rem', fontWeight: 600 }}>Loading System Orta...</div>
        <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Initializing database...</div>
      </div>
    );
  }

  return (
    <div className="app-layout">
      {/* ── Top Bar ──────────────────────────────────────── */}
      <div className="topbar">
        <img src="/logo_small.png" alt="Orta" className="topbar-logo"
          onError={e => { e.target.style.fontSize='1.4rem'; e.target.alt='⚜'; }} />

        <div className="topbar-right">
          {/* Queue indicator */}
          {queueCount > 0 && (
            <span style={{ fontSize: '0.75rem', color: 'var(--orange)', fontWeight: 600 }}>
              📤 {queueCount} pending
            </span>
          )}
          {/* Sync status */}
          <div className="sync-status">
            {!isOnline && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--danger)' }}>
                <div className="sync-dot warn" style={{ background: 'var(--danger)' }} />
                <WifiOff size={16} />
                <span style={{ color: 'var(--danger)', fontWeight: 600 }}>Offline</span>
              </div>
            )}
            {isOnline && (getSettings()?.syncEnabled === false || getSettings()?.syncEnabled === 'false') && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--warning)' }}>
                <RefreshCwOff size={16} />
                <span style={{ color: 'var(--warning)', fontWeight: 600 }}>No Sync</span>
              </div>
            )}
            {isOnline && (getSettings()?.syncEnabled !== false && getSettings()?.syncEnabled !== 'false') && (
              <div className={`sync-dot ${queueCount > 0 ? 'warn' : ''}`} />
            )}
            <span>{formatDate(now)}</span>
          </div>
          {/* Sync button */}
          <button className="btn-sync" onClick={handleSync} disabled={isSyncing || syncOk}>
            {syncOk
              ? <Check size={15} />
              : <RefreshCw size={15} className={isSyncing ? 'spin' : ''} />}
            <span>{syncOk ? 'Done' : isSyncing ? 'Syncing...' : 'Sync'}</span>
          </button>
        </div>
      </div>

      {/* ── Body ─────────────────────────────────────────── */}
      <div className="app-body">
        {/* ── Sidebar ──────────────────────────────────── */}
        <nav className="sidebar">
          {MAIN_NAV.map((item, i) =>
            item === null ? (
              <div key={`div-${i}`} className="nav-divider" />
            ) : (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
              >
                <item.icon size={20} />
                <span>{item.label}</span>
              </NavLink>
            )
          )}

          <div className="nav-divider" />

          <button
            className={`nav-item nav-tools-toggle${showTools ? ' tools-open' : ''}`}
            onClick={() => setShowTools(v => !v)}
            title={showTools ? 'Hide tools tabs' : 'Show tools tabs'}
          >
            {showTools ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
            <span>{showTools ? 'Less' : 'More'}</span>
          </button>

          {showTools && TOOLS_NAV
            .filter(item => !(isWatcherDevice() && item.to === '/logs'))
            .map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
              >
                <item.icon size={20} />
                <span>{item.label}</span>
              </NavLink>
            ))}
        </nav>

        {/* ── Main Content ─────────────────────────────── */}
        <main className="main-content">
          <ErrorBoundary room="router">
            <Routes>
              <Route path="/"              element={<HomeScreen />} />
              <Route path="/new-order"     element={<NewOrderScreen />} />
              <Route path="/history"       element={<HistoryScreen />} />
              <Route path="/stock"         element={<StockScreen />} />
              <Route path="/stock-log"     element={<StockLogScreen />} />
              <Route path="/customers"     element={<CustomersScreen />} />
              <Route path="/customers/:id" element={<CustomerDetailScreen />} />
              <Route path="/customers/:id/credit" element={<CustomerCreditScreen />} />
              <Route path="/models"        element={<ModelsScreen />} />
              <Route path="/models/:id"    element={<ModelDetailScreen />} />
              <Route path="/factories"     element={<FactoriesScreen />} />
              <Route path="/factories/:id" element={<FactoryDetailScreen />} />
              <Route path="/casa"          element={<TreasuryScreen />} />
              <Route path="/telegram"      element={<TelegramScreen />} />
              <Route path="/sync"          element={<SyncScreen />} />
              <Route path="/backup"        element={<BackupScreen />} />
              <Route path="/settings"      element={<SettingsScreen />} />
              <Route path="/logs"          element={<LogsScreen />} />
            </Routes>
          </ErrorBoundary>
        </main>
      </div>

      <Toaster />
      <SyncManager />
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}
