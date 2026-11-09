import { isWatcherDevice } from '../core/deviceSync';
import React, { useState, useEffect } from 'react';
import {
  SlidersHorizontal, RefreshCw, Download, Upload, Check, AlertTriangle, Settings
} from 'lucide-react';
import db from '../core/db';
import { Logger } from '../core/logger';
import { toast } from '../components/Toaster';
import { getSettings } from '../core/store';
import { getDeviceId, setDeviceId } from '../core/deviceSync';
import ErrorBoundary from '../components/ErrorBoundary';
import { syncService } from '../core/syncService';

export default function SyncScreen() {
  const [syncLog, setSyncLog] = useState([]);
  const [status, setStatus] = useState('idle');
  const [progress, setProgress] = useState('');
  const [stats, setStats] = useState({});
  const [currentDeviceId, setCurrentDeviceId] = useState(() => getDeviceId());

  // Re-read device ID every time this component mounts (navigation from Settings)
  useEffect(() => {
    setCurrentDeviceId(getDeviceId());
    load();
  }, []);

  // Listen for sync warnings (e.g. pin failed)
  useEffect(() => {
    const onWarning = (e) => toast.info(e.detail?.message || 'Sync warning');
    window.addEventListener('orta:sync_warning', onWarning);
    return () => window.removeEventListener('orta:sync_warning', onWarning);
  }, []);

  const load = async () => {
    try {
      const logs = await db.syncLog.orderBy('timestamp').reverse().limit(50).toArray();
      setSyncLog(logs);
      const [cats, customers, orders, factories] = await Promise.all([
        db.catalog.count(), db.customers.count(), db.orders.count(), db.factories.count()
      ]);
      const devId = getDeviceId();
      setCurrentDeviceId(devId);
      setStats({ cats, customers, orders, factories, deviceId: devId });
    } catch(e) { Logger.error('sync', 'load', e.message); }
  };

  const changeDevice = async (id) => {
    if (id === currentDeviceId) return;
    if (!confirm(`Switch to Device ${id}? This changes your device identity for sync.`)) return;
    setDeviceId(id);
    setCurrentDeviceId(id);
    setStats(prev => ({ ...prev, deviceId: id }));
    toast.success(`Now set as Device ${id}`);
    Logger.info('sync', 'changeDevice', `Device changed to ${id}`);
  };

  const runSync = async (direction) => {
    const settings = getSettings();
    if (!settings.botToken || !settings.syncChatId) {
      toast.error('Configure Telegram Bot & Sync Channel in Settings first');
      return;
    }
    setStatus('syncing');
    setProgress(`Starting ${direction} sync...`);
    Logger.info('sync', 'runSync', `Sync started: ${direction}`);

    try {
      if (direction === 'push') {
        await syncService.pushSync(setProgress);
        setStatus('done'); setProgress('Push sync complete!');
        toast.success('Database pushed and pinned to Telegram');
      } else {
        const result = await syncService.pullSync(setProgress);
        setStatus('done'); setProgress('Pull sync complete!');
        toast.success(`Database updated successfully from Device ${result.sourceDeviceId}`);
      }
    } catch(e) {
      if (e.message === 'ALREADY_UP_TO_DATE') {
         setStatus('done'); setProgress('Already up to date (You pushed this)');
         toast.info('This sync was pushed by your own device.');
      } else {
         Logger.error('sync', 'runSync', e.message);
         setStatus('error'); setProgress('Sync failed: ' + e.message);
         toast.error('Sync failed: ' + e.message);
      }
    }
    load();
    setTimeout(() => { setStatus('idle'); setProgress(''); }, 3000);
  };

  const statusBadgeColor = (s) => {
    if (s === 'success') return 'badge-green';
    if (s === 'up_to_date') return 'badge-blue';
    return 'badge-red';
  };

  return (
    <ErrorBoundary room="sync">
      <div className="page-container fade-in">
        <div className="page-header">
          <div className="page-title"><SlidersHorizontal size={22}/> MULTI-DEVICE SYNC</div>
          <div className="page-actions">
            {!isWatcherDevice() && (
              <button className="btn btn-primary" onClick={() => runSync('push')} disabled={status === 'syncing'}>
                {status === 'syncing' ? <><RefreshCw size={14} className="spin"/> Syncing...</> : <><Upload size={14}/> Push Sync</>}
              </button>
            )}
            <button className="btn btn-secondary" onClick={() => runSync('pull')} disabled={status === 'syncing'}>
              <Download size={14}/> Pull Sync
            </button>
          </div>
        </div>

        {/* Device Selector */}
        <div style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Settings size={14} color="var(--text-muted)"/>
          <span className="text-sm text-muted">Click a device card to set this device's identity:</span>
        </div>
        <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
          {[1, 2, 3].filter(id => !(isWatcherDevice() && id !== 2)).map(id => (
            <div
              key={id}
              onClick={() => changeDevice(id)}
              style={{
                flex: 1, minWidth: 160, padding: '16px 20px', borderRadius: 12, cursor: 'pointer',
                background: currentDeviceId === id ? 'rgba(212,175,55,0.1)' : 'var(--surface)',
                border: `2px solid ${currentDeviceId === id ? 'var(--border-gold)' : 'var(--border)'}`,
                transition: 'all 0.2s',
              }}
            >
              <div style={{ fontWeight: 700, color: currentDeviceId === id ? 'var(--gold)' : 'var(--text-sec)' }}>
                Device {id} {id === 3 ? '(Monitor)' : ''}
              </div>
              <div className="text-xs text-muted">{id === 3 ? 'Read-only' : 'Read/Write'}</div>
              {currentDeviceId === id && (
                <div style={{ marginTop: 6 }}>
                  <span className="badge badge-green" style={{ fontSize: '0.65rem' }}>THIS DEVICE ✓</span>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Status */}
        {progress && (
          <div style={{ marginBottom: 16, padding: '12px 16px', borderRadius: 10, background: status === 'error' ? 'rgba(239,68,68,0.08)' : status === 'done' ? 'rgba(16,185,129,0.08)' : 'rgba(59,130,246,0.08)', border: `1px solid ${status === 'error' ? 'rgba(239,68,68,0.3)' : status === 'done' ? 'rgba(16,185,129,0.3)' : 'rgba(59,130,246,0.3)'}`, display: 'flex', alignItems: 'center', gap: 10 }}>
            {status === 'syncing' ? <RefreshCw size={18} className="spin" color="var(--blue)"/> : status === 'done' ? <Check size={18} color="var(--green)"/> : <AlertTriangle size={18} color="var(--red)"/>}
            <span style={{ fontWeight: 600 }}>{progress}</span>
          </div>
        )}

        {/* DB Stats */}
        <div className="grid-4" style={{ marginBottom: 20 }}>
          <div className="stat-card"><div className="stat-label">Models</div><div className="stat-value">{stats.cats || 0}</div></div>
          <div className="stat-card"><div className="stat-label">Customers</div><div className="stat-value">{stats.customers || 0}</div></div>
          <div className="stat-card"><div className="stat-label">Orders</div><div className="stat-value">{stats.orders || 0}</div></div>
          <div className="stat-card"><div className="stat-label">Factories</div><div className="stat-value">{stats.factories || 0}</div></div>
        </div>

        {/* Sync Log */}
        <div className="text-gold text-bold" style={{ marginBottom: 12 }}>SYNC HISTORY</div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Time</th><th>Device</th><th>Action</th><th>Status</th><th>Note</th></tr></thead>
            <tbody>
              {syncLog.length === 0 ? (
                <tr><td colSpan={5} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>No sync history — push or pull sync to record entries</td></tr>
              ) : syncLog.map(l => (
                <tr key={l.id}>
                  <td className="text-xs text-muted">{new Date(l.timestamp).toLocaleString()}</td>
                  <td><span className="badge badge-gold">Device {l.deviceId}</span></td>
                  <td><span className="badge badge-blue">{l.action}</span></td>
                  <td><span className={`badge ${statusBadgeColor(l.status)}`}>{l.status}</span></td>
                  <td className="text-xs text-muted">{l.error || (l.messageId ? `msg #${l.messageId}` : '—')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </ErrorBoundary>
  );
}
