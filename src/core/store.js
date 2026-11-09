import db from './db';
import { Logger } from './logger';

// ============================================================
// System Orta — Settings Store
// Persists all app configuration to Dexie settings table
// ============================================================

export const DEFAULT_SETTINGS = {
  // Shop Info
  shopName: 'System Orta',
  shopPhone: '',
  shopAddress: '',
  shopLogo: '',
  website: '',
  // Telegram
  botToken: '',
  archiveChatId: '',
  wholesaleChatId: '',
  retailChatId: '',
  salesChatId: '',
  factureChatId: '',
  liveStockChatId: '',
  syncChatId: '',
  factoryInvoiceChatId: '',
  casaChatId: '',
  backupChatId: '',
  telegramAutoMode: false,
  // Device & Sync
  deviceId: 1,
  syncEnabled: true,
  // Treasury
  startBudget: 0,
};

let _cache = null;

export const loadSettings = async () => {
  try {
    const rows = await db.settings.toArray();
    _cache = { ...DEFAULT_SETTINGS };
    rows.forEach(r => { _cache[r.key] = r.value; });
    Logger.info('core', 'loadSettings', 'Settings loaded');
  } catch (e) {
    Logger.error('core', 'loadSettings', 'Failed to load settings', e.message);
    _cache = { ...DEFAULT_SETTINGS };
  }
  return _cache;
};

export const getSettings = () => _cache ?? { ...DEFAULT_SETTINGS };

export const saveSetting = async (key, value) => {
  try {
    await db.settings.put({ key, value });
    if (_cache) _cache[key] = value;
  } catch (e) {
    Logger.error('core', 'saveSetting', `Failed to save setting: ${key}`, e.message);
    throw e;
  }
};

export const saveSettings = async (obj) => {
  for (const [key, value] of Object.entries(obj)) {
    await saveSetting(key, value);
  }
};
