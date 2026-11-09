// ============================================================
// System Orta — Device Sync Config
// Controls multi-device operation (Device 1 & 2 active, 3 monitor-only)
// ============================================================

const DEVICE_KEY = 'orta_device_id';
const SYNC_KEY   = 'orta_sync_enabled';

export const getDeviceId    = () => parseInt(localStorage.getItem(DEVICE_KEY) || '1');
export const setDeviceId    = (id) => localStorage.setItem(DEVICE_KEY, String(id));
export const isSyncEnabled  = () => localStorage.getItem(SYNC_KEY) !== 'false';
export const setSyncEnabled = (v) => localStorage.setItem(SYNC_KEY, String(v));
export const isMonitorOnly  = () => getDeviceId() === 3;
export const canWrite       = () => !isMonitorOnly();

export function isWatcherDevice() {
  return Number(getDeviceId()) === 2;
}

export const maskPhone = (phone) => {
  if (!phone) return phone;
  if (!isWatcherDevice()) return phone;
  const s = String(phone);
  if (s.length <= 3) return s;
  return '*'.repeat(s.length - 3) + s.slice(-3);
};
