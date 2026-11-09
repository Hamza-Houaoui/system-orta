import React, { useState, useEffect, useRef } from 'react';
import { Send, RefreshCw, Check, X, AlertTriangle, Eye, Play, Pause, Trash2, ArrowUp, Zap } from 'lucide-react';
import db from '../core/db';
import { Logger } from '../core/logger';
import { toast } from '../components/Toaster';
import { getSettings, saveSetting } from '../core/store';
import ErrorBoundary from '../components/ErrorBoundary';
import { processTelegramQueue, onStockChanged } from '../core/telegramPublisher';
import { isWatcherDevice } from '../core/deviceSync';

const STATUS_BADGE = { pending: 'badge-orange', sending: 'badge-blue', done: 'badge-green', failed: 'badge-red' };

export default function TelegramScreen() {
  const [queue, setQueue] = useState([]);
  const [stats, setStats] = useState({ pending: 0, done: 0, failed: 0 });
  const [running, setRunning] = useState(false);
  const [botInfo, setBotInfo] = useState(null);
  const [testing, setTesting] = useState(false);
  const runnerRef = useRef(false);
  
  const [channelSettings, setChannelSettings] = useState({
    wholesaleChatId: '', salesChatId: '', retailChatId: '',
    wholesaleEnabled: true, salesEnabled: true, retailEnabled: true,
    telegramAutoMode: false
  });

  useEffect(() => {
    load();
    checkBot();
    loadChannelSettings();
    window.addEventListener('orta:queue_processed', load);
    return () => { 
       runnerRef.current = false; 
       window.removeEventListener('orta:queue_processed', load);
    };
  }, []);

  const loadChannelSettings = () => {
    const s = getSettings();
    setChannelSettings({
      wholesaleChatId: s.wholesaleChatId || '',
      salesChatId: s.salesChatId || '',
      retailChatId: s.retailChatId || '',
      wholesaleEnabled: s.wholesaleEnabled !== false,
      salesEnabled: s.salesEnabled !== false,
      retailEnabled: s.retailEnabled !== false,
      telegramAutoMode: s.telegramAutoMode || false
    });
  };

  const updateSetting = async (key, val) => {
    await saveSetting(key, val);
    setChannelSettings(prev => ({ ...prev, [key]: val }));
    toast.success('Setting saved');
    // We no longer auto-resync all models when toggling global settings 
    // to prevent duplicate message spam. The user can use the manual 
    // Resend button on each model or Test All Channels if needed.
  };

  const [resyncing, setResyncing] = useState(false);
  const resyncAllChannels = async (silent = false) => {
    if (!silent && !confirm('Re-evaluate all models and update Telegram channels based on current stock?')) return;
    setResyncing(true);
    try {
      const allModels = await db.catalog.toArray();
      let done = 0;
      for (const model of allModels) {
        try {
          await onStockChanged(model.id);
          done++;
        } catch(e) {
          Logger.error('telegram', 'resync', `Failed for model ${model.id}: ${e.message}`);
        }
        if (done % 5 === 0) await new Promise(r => setTimeout(r, 200)); // small pause to avoid flooding
      }
      if (!silent) toast.success(`Re-synced ${done} models to Telegram channels!`);
      load();
    } catch(e) {
      toast.error('Re-sync failed: ' + e.message);
    }
    setResyncing(false);
  };

  const load = async () => {
    try {
      const all = await db.telegramQueue.orderBy('createdAt').reverse().toArray();
      setQueue(all);
      setStats({
        pending: all.filter(q => q.status === 'pending').length,
        done: all.filter(q => q.status === 'done').length,
        failed: all.filter(q => q.status === 'failed').length,
      });
      window.dispatchEvent(new CustomEvent('orta:queue_updated', { detail: { count: all.filter(q => q.status === 'pending').length } }));
    } catch(e) { Logger.error('telegram', 'load', e.message); }
  };

  const checkBot = async () => {
    const settings = getSettings();
    if (!settings.botToken) return;
    setTesting(true);
    try {
      const res = await fetch(`https://api.telegram.org/bot${settings.botToken}/getMe`);
      const data = await res.json();
      if (data.ok) setBotInfo(data.result);
      else setBotInfo(null);
    } catch(e) { setBotInfo(null); }
    setTesting(false);
  };

  const runQueue = async () => {
    setRunning(true);
    await processTelegramQueue();
    setRunning(false);
    load();
    toast.success('Queue processing complete');
  };

  const stopQueue = () => { runnerRef.current = false; setRunning(false); };

  const retryFailed = async () => {
    await db.telegramQueue.where('status').equals('failed').modify({ status: 'pending', error: null });
    load();
    toast.info('Failed messages reset to pending');
  };

  const clearDone = async () => {
    await db.telegramQueue.where('status').equals('done').delete();
    load();
    toast.success('Sent messages cleared');
  };

  const clearAll = async () => {
    if (!confirm('Clear all messages from queue?')) return;
    const deletes = await db.telegramQueue.where('type').equals('delete').toArray();
    await db.telegramQueue.clear();
    if (deletes.length > 0) await db.telegramQueue.bulkAdd(deletes);
    setQueue([]);
    setStats({ pending: 0, done: 0, failed: 0 });
  };

  const formatTime = (ts) => ts ? new Date(ts).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';

  return (
    <ErrorBoundary room="telegram">
      <div className="page-container fade-in">
        <div className="page-header">
          <div className="page-title"><Send size={22}/> TELEGRAM QUEUE</div>
          <div className="page-actions" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--surface2)', padding: '4px 12px', borderRadius: '20px' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Auto Queue</span>
              <button
                onClick={() => updateSetting('telegramAutoMode', !channelSettings.telegramAutoMode)}
                style={{
                  width: 36, height: 20, borderRadius: 10, background: channelSettings.telegramAutoMode ? 'var(--blue)' : 'var(--border)',
                  position: 'relative', cursor: 'pointer', border: 'none', transition: 'background 0.3s'
                }}
              >
                <div style={{ width: 16, height: 16, borderRadius: '50%', background: 'white', position: 'absolute', top: 2, left: channelSettings.telegramAutoMode ? 18 : 2, transition: 'left 0.3s' }} />
              </button>
            </div>
            
            {channelSettings.telegramAutoMode ? (
               <div style={{ padding: '6px 12px', borderRadius: '6px', background: 'rgba(59, 130, 246, 0.1)', color: 'var(--blue)', fontSize: '0.8rem', fontWeight: 'bold' }}>
                 <RefreshCw size={12} className="spin" style={{ marginRight: 6 }}/> Auto-Processing
               </div>
            ) : running
              ? <button className="btn btn-danger" onClick={stopQueue}><Pause size={14}/> Stop</button>
              : <button className="btn btn-primary" onClick={runQueue} disabled={stats.pending === 0}>
                  <Play size={14}/> Process Queue ({stats.pending})
                </button>}
            <button className="btn btn-secondary btn-sm" onClick={retryFailed} disabled={stats.failed === 0}>
              <RefreshCw size={13}/> Retry Failed
            </button>
            <button className="btn btn-secondary btn-sm" onClick={clearDone}>
              <Trash2 size={13}/> Clear Sent
            </button>
            <button className="btn btn-secondary btn-sm" onClick={() => resyncAllChannels(false)} disabled={resyncing} style={{ background: 'rgba(212,175,55,0.08)', color: 'var(--gold)', border: '1px solid rgba(212,175,55,0.3)' }}>
              {resyncing ? <><RefreshCw size={13} className="spin"/> Re-syncing...</> : <><Zap size={13}/> Re-sync Channels</>}
            </button>
            <button className="btn btn-secondary btn-sm" onClick={clearAll} style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--red)', border: '1px solid rgba(239,68,68,0.3)' }}>
              <Trash2 size={13}/> Clear All
            </button>
          </div>
        </div>

        {/* Bot Status */}
        <div style={{ marginBottom: 16, padding: '12px 16px', borderRadius: 10, background: botInfo ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)', border: `1px solid ${botInfo ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`, display: 'flex', alignItems: 'center', gap: 12 }}>
          {testing ? (
            <RefreshCw size={18} className="spin" />
          ) : botInfo ? (
            <>
              <Check size={18} color="var(--green)" />
              <div>
                <span className="text-bold text-green">Bot Connected: @{botInfo.username}</span>
                <span className="text-muted text-sm" style={{ marginLeft: 12 }}>{botInfo.first_name}</span>
              </div>
            </>
          ) : (
            <>
              <AlertTriangle size={18} color="var(--red)" />
              <span className="text-red text-bold">Bot not configured — go to Settings</span>
            </>
          )}
          <button className="btn btn-secondary btn-sm" style={{ marginLeft: 'auto' }} onClick={checkBot} disabled={testing}>
            <RefreshCw size={12}/> Test
          </button>
        </div>

        {/* Channel Settings */}
        {!isWatcherDevice() && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="form-label" style={{ marginBottom: 12 }}>CHANNEL CONFIGURATION</div>
          <div className="grid-3" style={{ gap: 20 }}>
            {/* Wholesale */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="text-bold" style={{ color: 'var(--green)' }}>🟢 Wholesale Channel</span>
                <button
                  onClick={() => updateSetting('wholesaleEnabled', !channelSettings.wholesaleEnabled)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6, padding: '4px 12px',
                    borderRadius: 16, cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700,
                    border: channelSettings.wholesaleEnabled ? '1px solid var(--green)' : '1px solid var(--border)',
                    background: channelSettings.wholesaleEnabled ? 'rgba(16,185,129,0.1)' : 'var(--surface2)',
                    color: channelSettings.wholesaleEnabled ? 'var(--green)' : 'var(--text-muted)',
                  }}
                >
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: channelSettings.wholesaleEnabled ? 'var(--green)' : 'var(--text-muted)' }} />
                  {channelSettings.wholesaleEnabled ? 'ON' : 'OFF'}
                </button>
              </div>
              <input type="text" placeholder="Chat ID (e.g. -100...)" value={channelSettings.wholesaleChatId} onChange={e => setChannelSettings(prev => ({ ...prev, wholesaleChatId: e.target.value }))} onBlur={e => updateSetting('wholesaleChatId', e.target.value)} />
            </div>
            {/* Sales */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="text-bold" style={{ color: 'var(--orange)' }}>🟡 Sales Channel</span>
                <button
                  onClick={() => updateSetting('salesEnabled', !channelSettings.salesEnabled)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6, padding: '4px 12px',
                    borderRadius: 16, cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700,
                    border: channelSettings.salesEnabled ? '1px solid var(--orange)' : '1px solid var(--border)',
                    background: channelSettings.salesEnabled ? 'rgba(245,158,11,0.1)' : 'var(--surface2)',
                    color: channelSettings.salesEnabled ? 'var(--orange)' : 'var(--text-muted)',
                  }}
                >
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: channelSettings.salesEnabled ? 'var(--orange)' : 'var(--text-muted)' }} />
                  {channelSettings.salesEnabled ? 'ON' : 'OFF'}
                </button>
              </div>
              <input type="text" placeholder="Chat ID (e.g. -100...)" value={channelSettings.salesChatId} onChange={e => setChannelSettings(prev => ({ ...prev, salesChatId: e.target.value }))} onBlur={e => updateSetting('salesChatId', e.target.value)} />
            </div>
            {/* Retail */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="text-bold" style={{ color: 'var(--blue)' }}>🔵 Retail Channel</span>
                <button
                  onClick={() => updateSetting('retailEnabled', !channelSettings.retailEnabled)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6, padding: '4px 12px',
                    borderRadius: 16, cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700,
                    border: channelSettings.retailEnabled ? '1px solid var(--blue)' : '1px solid var(--border)',
                    background: channelSettings.retailEnabled ? 'rgba(59,130,246,0.1)' : 'var(--surface2)',
                    color: channelSettings.retailEnabled ? 'var(--blue)' : 'var(--text-muted)',
                  }}
                >
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: channelSettings.retailEnabled ? 'var(--blue)' : 'var(--text-muted)' }} />
                  {channelSettings.retailEnabled ? 'ON' : 'OFF'}
                </button>
              </div>
              <input type="text" placeholder="Chat ID (e.g. -100...)" value={channelSettings.retailChatId} onChange={e => setChannelSettings(prev => ({ ...prev, retailChatId: e.target.value }))} onBlur={e => updateSetting('retailChatId', e.target.value)} />
            </div>
          </div>
        </div>
        )}

        {/* Stats */}
        <div className="grid-3" style={{ marginBottom: 20 }}>
          <div className="stat-card"><div className="stat-label">Pending</div><div className="stat-value" style={{ color: 'var(--orange)' }}>{stats.pending}</div></div>
          <div className="stat-card"><div className="stat-label">Sent</div><div className="stat-value green">{stats.done}</div></div>
          <div className="stat-card"><div className="stat-label">Failed</div><div className="stat-value red">{stats.failed}</div></div>
        </div>

        {/* Queue Table */}
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Status</th><th>Type</th><th>Channel</th><th>Message</th><th>Priority</th><th>Created</th><th>Attempts</th></tr>
            </thead>
            <tbody>
              {queue.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Queue is empty</td></tr>
              ) : queue.map(item => (
                <tr key={item.id}>
                  <td><span className={`badge ${STATUS_BADGE[item.status] || 'badge-gray'}`}>{item.status}</span></td>
                  <td><span className="badge badge-gray">{item.type}</span></td>
                  <td className="text-gold text-xs">{item.chatIdKey || item.chatId || '—'}</td>
                  <td style={{ maxWidth: 280 }}>
                    <div className="text-ellipsis text-sm">{item.text?.slice(0, 80) || item.caption || '[media]'}</div>
                    {item.error && <div className="text-xs text-red" style={{ marginTop: 2 }}>{item.error}</div>}
                  </td>
                  <td>
                    {item.priority === 1 ? <span className="badge badge-red"><ArrowUp size={10}/>High</span> :
                     item.priority === 2 ? <span className="badge badge-orange">Med</span> :
                     <span className="badge badge-gray">Low</span>}
                  </td>
                  <td className="text-xs text-muted">{formatTime(item.createdAt)}</td>
                  <td className="text-center">{item.attemptCount || 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </ErrorBoundary>
  );
}
