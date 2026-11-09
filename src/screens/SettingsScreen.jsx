import React, { useState, useEffect } from 'react';
import { Settings2, Save, TestTube, Check, X, RefreshCw, Eye, EyeOff, Trash2, AlertTriangle } from 'lucide-react';
import { getSettings, saveSettings, DEFAULT_SETTINGS } from '../core/store';
import { db } from '../core/db';
import { setDeviceId, setSyncEnabled } from '../core/deviceSync';
import { Logger } from '../core/logger';
import { toast } from '../components/Toaster';
import ErrorBoundary from '../components/ErrorBoundary';

const CHANNELS = [
  { key: 'wholesaleChatId',      label: 'Wholesale Channel',      desc: 'Models for wholesale customers' },
  { key: 'retailChatId',         label: 'Retail Channel',         desc: 'Broken series — retail prices' },
  { key: 'salesChatId',          label: 'Sales Channel',          desc: 'Sales & promotions' },
  { key: 'factureChatId',        label: 'Facture Channel',        desc: 'Customer invoices' },
  { key: 'liveStockChatId',      label: 'Live Stock Channel',     desc: 'Real-time stock updates' },
  { key: 'syncChatId',           label: 'Sync Channel',           desc: 'Multi-device sync' },
  { key: 'factoryInvoiceChatId', label: 'Factory Invoice Channel',desc: 'Factory import invoices' },
  { key: 'casaChatId',           label: 'Casa Channel',           desc: 'Treasury transactions' },
  { key: 'backupChatId',         label: 'Backup Channel',         desc: 'Database backups' },
  { key: 'archiveChatId',        label: 'Archive Channel',        desc: 'Media archive (photos/videos)' },
];

export default function SettingsScreen() {
  const [form, setForm] = useState({ ...DEFAULT_SETTINGS });
  const [showToken, setShowToken] = useState(false);
  const [testing, setTesting] = useState({});
  const [testResults, setTestResults] = useState({});
  const [saving, setSaving] = useState(false);
  const [resetText, setResetText] = useState('');
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    const s = getSettings();
    setForm({ ...DEFAULT_SETTINGS, ...s });
  }, []);

  const set = (key, val) => setForm(p => ({ ...p, [key]: val }));

  const logoInputRef = React.useRef(null);

  const handleLogoUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => set('shopLogo', reader.result);
    reader.readAsDataURL(file);
    e.target.value = null;
  };

  const DEVICE_1_PIN = '141425';
  const isDev2 = Number(form.deviceId) === 2;
  const selectDevice = (id) => {
    if (id === 1) {
      const pin = window.prompt('Enter PIN to switch to Device 1:');
      if (pin !== DEVICE_1_PIN) {
        toast.error('Wrong PIN');
        return;
      }
      toast.success('Device 1 unlocked');
    }
    set('deviceId', id);
  };

  const save = async () => {
    setSaving(true);
    try {
      await saveSettings(form);
      setDeviceId(form.deviceId);
      setSyncEnabled(form.syncEnabled);
      Logger.info('settings', 'save', 'Settings saved');
      toast.success('Settings saved');
    } catch (e) {
      Logger.error('settings', 'save', e.message);
      toast.error('Failed to save: ' + e.message);
    }
    setSaving(false);
  };

  const handleReset = async () => {
    setResetting(true);
    try {
      await db.delete();
      localStorage.clear();
      Logger.info('system', 'reset', 'App data reset to fresh state');
    } catch (e) {
      Logger.error('system', 'reset', e.message);
      toast.error('Reset failed: ' + e.message);
      setResetting(false);
      return;
    }
    window.location.reload();
  };

  const testChannel = async (key) => {
    const chatId = form[key];
    const token = form.botToken;
    if (!token || !chatId) { toast.error('Enter bot token and chat ID first'); return; }
    setTesting(p => ({ ...p, [key]: true }));
    setTestResults(p => ({ ...p, [key]: null }));
    try {
      const res = await fetch(`https://api.telegram.org/bot${token}/getChat?chat_id=${chatId}`);
      const data = await res.json();
      if (data.ok) {
        setTestResults(p => ({ ...p, [key]: { ok: true, title: data.result.title || data.result.username || 'Connected' } }));
      } else {
        setTestResults(p => ({ ...p, [key]: { ok: false, error: data.description } }));
      }
    } catch (e) {
      setTestResults(p => ({ ...p, [key]: { ok: false, error: e.message } }));
    }
    setTesting(p => ({ ...p, [key]: false }));
  };

  const testAllChannels = async () => {
    for (const { key } of CHANNELS) {
      if (form[key]) await testChannel(key);
    }
  };

  const Section = ({ title, children }) => (
    <div className="card" style={{ marginBottom: 16 }}>
      <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--gold)', letterSpacing: 1.5, marginBottom: 16, paddingBottom: 10, borderBottom: '1px solid var(--border-gold)' }}>
        {title}
      </div>
      {children}
    </div>
  );

  return (
    <ErrorBoundary room="settings">
      <div className="page-container fade-in">
        <div className="page-header">
          <div className="page-title"><Settings2 size={22}/> SETTINGS</div>
          <div className="page-actions">
            <button className="btn btn-primary" onClick={save} disabled={saving}>
              {saving ? <><RefreshCw size={14} className="spin"/> Saving...</> : <><Save size={14}/> Save Settings</>}
            </button>
          </div>
        </div>

        {/* General */}
        <Section title="GENERAL">
          <div className="form-row">
            <div className="form-group"><label className="form-label">Shop Name</label><input value={form.shopName} onChange={e => set('shopName', e.target.value)} /></div>
            <div className="form-group"><label className="form-label">Shop Phone</label><input value={form.shopPhone} onChange={e => set('shopPhone', e.target.value)} /></div>
          </div>
          <div className="form-group"><label className="form-label">Shop Address</label><textarea value={form.shopAddress} onChange={e => set('shopAddress', e.target.value)} style={{ height: 60, resize: 'none' }} /></div>
          <div className="form-group">
            <label className="form-label">Shop Logo (appears at top of invoices)</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {form.shopLogo ? (
                <img src={form.shopLogo} alt="logo" style={{ width: 48, height: 48, objectFit: 'contain', borderRadius: 8, border: '1px solid var(--border-gold)', background: '#fff' }} />
              ) : (
                <div style={{ width: 48, height: 48, borderRadius: 8, border: '1px dashed var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.7rem' }}>No logo</div>
              )}
              <input type="file" accept="image/*" ref={logoInputRef} onChange={handleLogoUpload} style={{ display: 'none' }} />
              <button className="btn btn-secondary btn-sm" onClick={() => logoInputRef.current?.click()}>Upload Logo</button>
              {form.shopLogo && <button className="btn btn-danger btn-sm" onClick={() => set('shopLogo', '')}>Remove</button>}
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Website Link (scanned as QR code on invoices)</label>
            <input placeholder="https://example.com" value={form.website} onChange={e => set('website', e.target.value)} />
          </div>
          {Number(form.deviceId) !== 2 && <div className="form-group"><label className="form-label">Starting Budget ($)</label><input type="number" value={form.startBudget} onChange={e => set('startBudget', parseFloat(e.target.value) || 0)} style={{ maxWidth: 200 }} /></div>}
        </Section>

        {/* Telegram Bot */}
        {!isDev2 && (
        <Section title="TELEGRAM BOT TOKEN">
          <div style={{ position: 'relative' }}>
            <input
              type={showToken ? 'text' : 'password'}
              placeholder="123456789:ABCdefGHIjklMNOpqrSTUvwxYZ"
              value={form.botToken}
              onChange={e => set('botToken', e.target.value)}
              style={{ paddingRight: 80 }}
            />
            <div style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', display: 'flex', gap: 6 }}>
              <button className="btn btn-secondary btn-sm btn-icon" onClick={() => setShowToken(!showToken)}>
                {showToken ? <EyeOff size={14}/> : <Eye size={14}/>}
              </button>
              <button className="btn btn-info btn-sm" onClick={() => testChannel('archiveChatId')}>Test</button>
            </div>
          </div>
          <div className="text-xs text-muted" style={{ marginTop: 6 }}>
            Create a bot via @BotFather on Telegram and paste the token here.
          </div>
        </Section>
        )}

        {/* Channels */}
        <Section title="TELEGRAM CHANNELS">
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
            <button className="btn btn-secondary btn-sm" onClick={testAllChannels}>
              <TestTube size={13}/> Test All Channels
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {!isDev2 && CHANNELS.map(({ key, label, desc }) => {
              const result = testResults[key];
              return (
                <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 200, flexShrink: 0 }}>
                    <div className="text-sm text-bold">{label}</div>
                    <div className="text-xs text-muted">{desc}</div>
                  </div>
                  <input
                    placeholder="-100123456789"
                    value={form[key] || ''}
                    onChange={e => set(key, e.target.value)}
                    style={{ flex: 1 }}
                  />
                  <button
                    className={`btn btn-sm ${result?.ok ? 'btn-success' : result?.ok === false ? 'btn-danger' : 'btn-secondary'}`}
                    onClick={() => testChannel(key)}
                    disabled={testing[key]}
                    style={{ minWidth: 70 }}
                  >
                    {testing[key] ? <RefreshCw size={13} className="spin"/> : result?.ok ? <Check size={13}/> : result?.ok === false ? <X size={13}/> : <TestTube size={13}/>}
                    <span>{testing[key] ? '...' : result?.ok ? 'OK' : result?.ok === false ? 'Fail' : 'Test'}</span>
                  </button>
                  {result?.title && <span className="text-xs text-green">{result.title}</span>}
                  {result?.error && <span className="text-xs text-red">{result.error}</span>}
                </div>
              );
            })}
          </div>
        </Section>

        {/* Device */}
        <Section title="DEVICE & SYNC">
          <div className="form-group">
            <label className="form-label">Device ID</label>
            <div style={{ display: 'flex', gap: 10 }}>
              {[1, 2, 3].filter(id => !(Number(form.deviceId) === 2 && id === 3)).map(id => (
                <button
                  key={id}
                  onClick={() => selectDevice(id)}
                  style={{
                    width: 56, height: 56, borderRadius: 12, cursor: 'pointer',
                    border: `2px solid ${form.deviceId === id ? 'var(--gold)' : 'var(--border)'}`,
                    background: form.deviceId === id ? 'rgba(212,175,55,0.15)' : 'transparent',
                    color: form.deviceId === id ? 'var(--gold)' : 'var(--text-sec)',
                    fontWeight: 700, fontSize: '1.2rem', fontFamily: 'inherit',
                  }}
                >{id}</button>
              ))}
            </div>
            {form.deviceId === 3 && (
              <div className="badge badge-orange" style={{ marginTop: 8 }}>⚠ Device 3 = Monitor Only (no writes)</div>
            )}
          </div>
          <div className="form-group">
            <label className="form-label">Sync</label>
            <label className="toggle-wrap">
              <label className="toggle">
                <input type="checkbox" checked={form.syncEnabled} onChange={e => set('syncEnabled', e.target.checked)} />
                <span className="toggle-slider" />
              </label>
              <span className="text-sm">{form.syncEnabled ? 'Sync Enabled' : 'Sync Disabled'}</span>
            </label>
          </div>
        </Section>

        {/* Danger Zone */}
        <Section title="DANGER ZONE">
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 12 }}>
            <AlertTriangle size={18} color="var(--red)" style={{ flexShrink: 0, marginTop: 2 }} />
            <div className="text-sm text-muted">
              Reset all app data and start fresh. This deletes <b>everything</b> stored on this device
              (models, customers, invoices, treasury, logs, settings...) — it cannot be undone.
              Messages already published in your Telegram channels are <b>not</b> deleted.
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <input
              type="text"
              placeholder="Type RESET to confirm"
              value={resetText}
              onChange={e => setResetText(e.target.value)}
              style={{ maxWidth: 200 }}
            />
            <button
              className="btn btn-danger"
              disabled={resetText !== 'RESET' || resetting}
              onClick={handleReset}
            >
              {resetting ? <RefreshCw size={14} className="spin"/> : <Trash2 size={14}/>}
              {resetting ? 'Resetting...' : 'Reset App Data'}
            </button>
          </div>
        </Section>

        <div style={{ display: 'flex', justifyContent: 'flex-end', paddingBottom: 40 }}>
          <button className="btn btn-primary btn-lg" onClick={save} disabled={saving}>
            {saving ? 'Saving...' : <><Save size={16}/> Save All Settings</>}
          </button>
        </div>
      </div>
    </ErrorBoundary>
  );
}
