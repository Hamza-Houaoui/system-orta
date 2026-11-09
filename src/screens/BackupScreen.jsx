import React, { useState, useEffect } from 'react';
import { Shield, Download, Upload, RefreshCw, CheckCircle, AlertTriangle, Send, Cloud } from 'lucide-react';
import db from '../core/db';
import { Logger } from '../core/logger';
import { toast } from '../components/Toaster';
import { getSettings } from '../core/store';
import { isWatcherDevice } from '../core/deviceSync';
import ErrorBoundary from '../components/ErrorBoundary';
import { recoverMissingPhotos } from '../core/photoRecoveryService';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { Capacitor } from '@capacitor/core';

async function serializeData(data) {
  // Deep copy data to avoid mutating indexeddb objects in memory
  const backupData = JSON.parse(JSON.stringify(data, (key, value) => {
    if (value instanceof Blob || value instanceof File) return undefined;
    return value;
  }));

  if (!backupData.modelColors) return backupData;
  for (const mc of backupData.modelColors) {
    if (mc.assets) {
      for (const key in mc.assets) {
        const asset = mc.assets[key];
        if (asset) {
          delete asset.blob;
          delete asset.base64;
        }
      }
    }
  }
  return backupData;
}

async function deserializeData(data) {
  // Media blobs are no longer backed up to save space.
  // UI will lazy-load them using fileId from Telegram Archive Channel.
  return data;
}

const BACKUP_TABLES = ['settings','factories','factoryInvoices','colors','sizeSeries','catalog','modelColors','customers','orders','transactions','stockLog','telegramMessages','backupLog'];

export default function BackupScreen() {
  const [backups, setBackups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingLabel, setLoadingLabel] = useState('');
  const [lastBackup, setLastBackup] = useState(null);
  const [stats, setStats] = useState({});
  const [recoveryStatus, setRecoveryStatus] = useState('');

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      const all = await db.backupLog.orderBy('timestamp').reverse().toArray();
      setBackups(all);
      setLastBackup(all[0] || null);
      const [cats, customers, orders, factories, transactions] = await Promise.all([
        db.catalog.count(), db.customers.count(), db.orders.count(),
        db.factories.count(), db.transactions.count(),
      ]);
      setStats({ cats, customers, orders, factories, transactions });
    } catch(e) { Logger.error('backup', 'load', e.message); }
  };

  // ── Build zip blob from DB data ─────────────────────────────────────────
  const buildZip = async (onProgress) => {
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();
    const data = {};

    if (onProgress) onProgress('Exporting tables...');
    Logger.debug('backup', 'buildZip', 'Starting to extract tables from IndexedDB...');
    for (const table of BACKUP_TABLES) {
      try { 
        data[table] = await db[table].toArray(); 
        Logger.debug('backup', 'buildZip', `Extracted ${data[table].length} rows from ${table}`);
      } catch { 
        data[table] = []; 
        Logger.warn('backup', 'buildZip', `Failed to extract table ${table}`);
      }
    }

    if (onProgress) onProgress('Preparing data payload...');
    Logger.debug('backup', 'buildZip', 'Stripping media blobs to minimize payload...');
    const serializedData = await serializeData(data);

    zip.file('system_orta_backup.json', JSON.stringify(serializedData));
    zip.file('manifest.json', JSON.stringify({
      version: '2.0', date: new Date().toISOString(),
      tables: Object.keys(data),
      counts: Object.fromEntries(Object.entries(data).map(([k,v]) => [k, v.length]))
    }));

    if (onProgress) onProgress('Compressing...');
    Logger.debug('backup', 'buildZip', 'Starting DEFLATE compression of ZIP archive...');
    return zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
  };

  // ── Restore from zip blob ───────────────────────────────────────────────
  const restoreZip = async (blob, onProgress) => {
    Logger.debug('backup', 'restoreZip', `Starting restore from blob size: ${Math.round(blob.size/1024)}KB`);
    const JSZip = (await import('jszip')).default;
    const zip = await JSZip.loadAsync(blob);
    const json = await zip.file('system_orta_backup.json')?.async('string');
    if (!json) {
       Logger.error('backup', 'restoreZip', 'Could not find system_orta_backup.json inside ZIP.');
       throw new Error('Invalid backup file');
    }
    const data = JSON.parse(json);

    if (onProgress) onProgress('Decoding photos...');
    Logger.debug('backup', 'restoreZip', 'Deserializing Base64 to Blobs...');
    await deserializeData(data);

    if (onProgress) onProgress('Restoring database...');
    Logger.debug('backup', 'restoreZip', 'Bulk inserting tables...');
    for (const [table, rows] of Object.entries(data)) {
      if (db[table] && rows.length) {
        await db[table].clear();
        await db[table].bulkAdd(rows);
        Logger.debug('backup', 'restoreZip', `Restored ${rows.length} rows to ${table}`);
      }
    }
    Logger.info('backup', 'restoreZip', 'Database restored successfully.');
  };

  // ── Export Local ────────────────────────────────────────────────────────
  const exportBackup = async () => {
    setLoading(true);
    setLoadingLabel('Preparing backup...');
    try {
      const blob = await buildZip(setLoadingLabel);
      const filename = `system_orta_${new Date().toISOString().slice(0,10)}.zip`;

      if (Capacitor.isNativePlatform()) {
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = async () => {
          const base64data = reader.result.split(',')[1];
          const savedFile = await Filesystem.writeFile({ path: filename, data: base64data, directory: Directory.Cache });
          const size = Math.round(blob.size / 1024);
          try {
            await Share.share({ title: filename, url: savedFile.uri, dialogTitle: 'Share Backup' });
          } catch (e) {
            Logger.warn('backup', 'exportBackup', `Share failed: ${e.message}`);
          }
          await db.backupLog.add({ id: crypto.randomUUID(), timestamp: Date.now(), type: 'local-export', status: 'success', size });
          toast.success(`Backup ready to share (${size}KB)`);
          load();
        };
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = filename; a.click();
        URL.revokeObjectURL(url);
        const size = Math.round(blob.size / 1024);
        await db.backupLog.add({ id: crypto.randomUUID(), timestamp: Date.now(), type: 'local-export', status: 'success', size });
        toast.success(`Backup downloaded (${size}KB)`);
        load();
      }
    } catch(e) {
      Logger.error('backup', 'exportBackup', e.message);
      toast.error('Backup failed: ' + e.message);
    }
    setLoading(false);
    setLoadingLabel('');
  };

  // ── Import Local ────────────────────────────────────────────────────────
  const importBackup = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!confirm('⚠️ This will REPLACE all data. Are you sure?')) return;
    setLoading(true);
    setLoadingLabel('Restoring...');
    try {
      await restoreZip(file, setLoadingLabel);
      await db.backupLog.add({ id: crypto.randomUUID(), timestamp: Date.now(), type: 'local-import', status: 'success', size: Math.round(file.size / 1024) });
      toast.success('Backup restored successfully! Reloading...');
      load();
      setTimeout(() => window.location.reload(), 1500);
    } catch(e) {
      Logger.error('backup', 'importBackup', e.message);
      toast.error('Restore failed: ' + e.message);
    }
    setLoading(false);
    setLoadingLabel('');
    e.target.value = '';
  };

  // ── Export to Telegram ──────────────────────────────────────────────────
  const exportToTelegram = async () => {
    const settings = getSettings();
    if (!settings.botToken || !settings.backupChatId) {
      toast.error('Configure Bot Token & Backup Channel ID in Settings first');
      return;
    }
    setLoading(true);
    setLoadingLabel('Building backup...');
    Logger.debug('backup', 'exportToTelegram', 'Initiating Telegram backup...');
    try {
      const blob = await buildZip(setLoadingLabel);
      const filename = `system_orta_backup_${new Date().toISOString().slice(0,10)}.zip`;

      setLoadingLabel('Uploading to Telegram...');
      Logger.debug('backup', 'exportToTelegram', `Sending ${filename} to Telegram chat ${settings.backupChatId}...`);
      const formData = new FormData();
      formData.append('chat_id', settings.backupChatId);
      formData.append('document', blob, filename);
      formData.append('caption', `☁️ System Orta Backup — ${new Date().toLocaleString()}`);

      const res = await fetch(`https://api.telegram.org/bot${settings.botToken}/sendDocument`, {
        method: 'POST', body: formData
      });
      const result = await res.json();
      if (!result.ok) throw new Error(result.description || 'Upload failed');

      // Pin the backup message
      setLoadingLabel('Pinning backup message...');
      const messageId = result.result.message_id;
      const pinRes = await fetch(`https://api.telegram.org/bot${settings.botToken}/pinChatMessage`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: settings.backupChatId, message_id: messageId, disable_notification: true })
      });
      const pinData = await pinRes.json();
      if (!pinData.ok) {
        toast.info('Backup uploaded but pinning failed — give bot "Pin Messages" admin rights in the backup channel');
      }

      const size = Math.round(blob.size / 1024);
      await db.backupLog.add({ id: crypto.randomUUID(), timestamp: Date.now(), type: 'telegram-export', status: 'success', size, messageId });
      Logger.info('backup', 'exportToTelegram', `Backup uploaded to Telegram (${size}KB), message ${messageId}`);
      toast.success(`Backup uploaded & pinned to Telegram (${size}KB)!`);
      load();
    } catch(e) {
      Logger.error('backup', 'exportToTelegram', e.message);
      toast.error('Telegram backup failed: ' + e.message);
    }
    setLoading(false);
    setLoadingLabel('');
  };

  // ── Import from Telegram ────────────────────────────────────────────────
  const importFromTelegram = async () => {
    if (!confirm('This will fetch the pinned backup from Telegram and replace ALL your local data. Are you sure?')) return;
    const settings = getSettings();
    if (!settings.botToken || !settings.backupChatId) {
      toast.error('Telegram Bot or Backup Channel ID not configured');
      return;
    }
    setLoading(true);
    setLoadingLabel('Fetching from Telegram...');
    try {
      const chatRes = await fetch(`https://api.telegram.org/bot${settings.botToken}/getChat?chat_id=${settings.backupChatId}`);
      const chatData = await chatRes.json();
      if (!chatData.ok || !chatData.result.pinned_message) throw new Error('No pinned message found in backup channel');

      const pinnedMessage = chatData.result.pinned_message;
      const document = pinnedMessage.document;
      if (!document) throw new Error('Pinned message does not contain a document');

      setLoadingLabel('Downloading backup...');
      const fileRes = await fetch(`https://api.telegram.org/bot${settings.botToken}/getFile?file_id=${document.file_id}`);
      const fileData = await fileRes.json();
      if (!fileData.ok) throw new Error('Could not get file path from Telegram');

      const isWeb = !Capacitor.isNativePlatform();
      let blob;

      if (isWeb) {
          const blobRes = await fetch(`/tg-file/bot${settings.botToken}/${fileData.result.file_path}`);
          if (!blobRes.ok) throw new Error(`Failed to download backup file (HTTP ${blobRes.status})`);
          blob = await blobRes.blob();
      } else {
          const { CapacitorHttp } = await import('@capacitor/core');
          const fileUrl = `https://api.telegram.org/file/bot${settings.botToken}/${fileData.result.file_path}`;
          const response = await CapacitorHttp.get({
              url: fileUrl,
              responseType: 'blob'
          });
          if (response.status !== 200) throw new Error(`Failed to download backup file (HTTP ${response.status})`);
          
          const base64Str = response.data;
          const b64Res = await fetch(`data:application/zip;base64,${base64Str}`);
          blob = await b64Res.blob();
      }

      await restoreZip(blob, setLoadingLabel);
      await db.backupLog.add({ id: crypto.randomUUID(), timestamp: Date.now(), type: 'telegram-import', status: 'success', size: Math.round(blob.size / 1024) });
      Logger.info('backup', 'importFromTelegram', 'Telegram backup restored');
      toast.success('Backup restored from Telegram! Reloading...');
      load();
      setTimeout(() => window.location.reload(), 1500);
    } catch(e) {
      Logger.error('backup', 'importFromTelegram', e.message);
      toast.error('Import failed: ' + e.message);
    }
    setLoading(false);
    setLoadingLabel('');
  };

  // ── Photo Recovery ──────────────────────────────────────────────────────
  const handleRecoverPhotos = async () => {
    if (!confirm('This will scan and attempt to download missing photos from Telegram. Proceed?')) return;
    setLoading(true);
    setRecoveryStatus('Starting...');
    try {
      await recoverMissingPhotos((progress) => {
        if (progress.message) setRecoveryStatus(progress.message);
        else if (progress.current) setRecoveryStatus(`Recovering ${progress.current}/${progress.total}...`);
      });
      toast.success('Recovery finished');
    } catch(e) { toast.error(e.message); }
    setLoading(false);
    setRecoveryStatus('');
  };

  return (
    <ErrorBoundary room="backup">
      <div className="page-container fade-in">
        <div className="page-header">
          <div className="page-title"><Shield size={22}/> BACKUP</div>
          <div className="page-actions" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {/* Local */}
            {!isWatcherDevice() && (<>
            <button className="btn btn-primary" onClick={exportBackup} disabled={loading}>
              {loading && loadingLabel ? <><RefreshCw size={14} className="spin"/> {loadingLabel}</> : <><Download size={14}/> Export Local</>}
            </button>
            <label className="btn btn-secondary" style={{ cursor: 'pointer' }}>
              <Upload size={14}/> Import Local
              <input type="file" accept=".zip" style={{ display: 'none' }} onChange={importBackup} />
            </label>
            </>)}
            {/* Telegram */}
            <button className="btn btn-secondary" onClick={exportToTelegram} disabled={loading} style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)', color: 'var(--blue)' }}>
              <Cloud size={14}/> Backup to Telegram
            </button>
            {!isWatcherDevice() && (
            <button className="btn btn-secondary" onClick={importFromTelegram} disabled={loading}>
              <Download size={14}/> Import Telegram
            </button>
            )}
          </div>
        </div>

        {/* Photo Recovery */}
        <div className="card" style={{ marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderLeft: '4px solid var(--blue)' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text)' }}>Missing Photos Recovery</div>
            <div className="text-muted text-sm" style={{ marginTop: 4 }}>Scan database for broken photos and download them from Telegram</div>
            {recoveryStatus && <div style={{ marginTop: 8, fontSize: '0.85rem', color: 'var(--blue)' }}>{recoveryStatus}</div>}
          </div>
          <button className="btn btn-primary btn-sm" onClick={handleRecoverPhotos} disabled={loading}>
            <RefreshCw size={14} className={loading && recoveryStatus ? 'spin' : ''}/> Recover Photos
          </button>
        </div>

        {/* Status card */}
        <div className="card-gold" style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 20 }}>
          {lastBackup ? (
            <>
              <CheckCircle size={36} color="var(--green)" style={{ flexShrink: 0 }} />
              <div>
                <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--green)' }}>Last Backup: OK</div>
                <div className="text-muted text-sm">{new Date(lastBackup.timestamp).toLocaleString()} · {lastBackup.size}KB · {lastBackup.type}</div>
              </div>
            </>
          ) : (
            <>
              <AlertTriangle size={36} color="var(--orange)" style={{ flexShrink: 0 }} />
              <div>
                <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--orange)' }}>No Backups Yet</div>
                <div className="text-muted text-sm">Create your first backup now</div>
              </div>
            </>
          )}
        </div>

        {/* DB Stats */}
        <div className="grid-5" style={{ marginBottom: 20 }}>
          {[['Models', stats.cats],['Customers', stats.customers],['Orders', stats.orders],['Factories', stats.factories],['Transactions', stats.transactions]].map(([l, v]) => (
            <div key={l} className="stat-card"><div className="stat-label">{l}</div><div className="stat-value">{v || 0}</div></div>
          ))}
        </div>

        {/* Backup History */}
        <div className="text-gold text-bold" style={{ marginBottom: 12 }}>BACKUP HISTORY</div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Date</th><th>Type</th><th>Status</th><th>Size</th></tr></thead>
            <tbody>
              {backups.length === 0 ? (
                <tr><td colSpan={4} style={{ textAlign:'center', padding: 40, color: 'var(--text-muted)' }}>No backups recorded</td></tr>
              ) : backups.map(b => (
                <tr key={b.id}>
                  <td className="text-sm">{new Date(b.timestamp).toLocaleString()}</td>
                  <td><span className="badge badge-gray">{b.type}</span></td>
                  <td><span className={`badge ${b.status === 'success' ? 'badge-green' : 'badge-red'}`}>{b.status}</span></td>
                  <td className="text-muted text-sm">{b.size ? `${b.size}KB` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </ErrorBoundary>
  );
}
