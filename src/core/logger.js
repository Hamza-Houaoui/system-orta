import db from './db';

// ============================================================
// System Orta — Logger
// Ring-buffer logger with room+tool context for each entry
// Helps developer pinpoint which room/tool caused an error
// ============================================================

const MAX_MEMORY = 500;
let memoryLogs = [];
let persistQueue = [];
let persistTimer = null;

const flush = () => {
  if (persistTimer) return;
  persistTimer = setTimeout(async () => {
    const batch = [...persistQueue];
    persistQueue = [];
    persistTimer = null;
    try {
      await db.logs.bulkAdd(batch);
      const count = await db.logs.count();
      if (count > 5000) {
        const oldest = await db.logs.orderBy('id').limit(count - 5000).primaryKeys();
        await db.logs.bulkDelete(oldest);
      }
    } catch { /* non-critical, silently fail */ }
  }, 2000);
};

const addLog = (level, room, tool, message, data) => {
  const entry = {
    timestamp: Date.now(),
    level,
    room: room || 'app',
    tool: tool || 'general',
    message: String(message),
    data: data ? JSON.stringify(data).slice(0, 500) : null,
  };
  memoryLogs.unshift(entry);
  if (memoryLogs.length > MAX_MEMORY) memoryLogs.pop();
  persistQueue.push(entry);
  flush();

  if (level === 'ERROR') {
    window.dispatchEvent(new CustomEvent('orta:error', { detail: entry }));
  }
  // Broadcast to global console
  window.dispatchEvent(new CustomEvent('orta:log_added', { detail: entry }));
  // Console output (suppress DEBUG in production)
  if (import.meta.env.DEV || level !== 'DEBUG') {
    const color = level === 'ERROR' ? '#ef4444' : level === 'WARN' ? '#f59e0b' : level === 'INFO' ? '#10b981' : '#6b7280';
    console.log(`%c[${level}][${room}/${tool}]%c ${message}`, `color:${color};font-weight:bold`, 'color:inherit', data ?? '');
  }
};

export const Logger = {
  debug: (room, tool, msg, data) => addLog('DEBUG', room, tool, msg, data),
  info:  (room, tool, msg, data) => addLog('INFO',  room, tool, msg, data),
  warn:  (room, tool, msg, data) => addLog('WARN',  room, tool, msg, data),
  error: (room, tool, msg, data) => addLog('ERROR', room, tool, msg, data),

  getMemoryLogs: () => [...memoryLogs],

  fetchLogs: async (filters = {}) => {
    const results = await db.logs.orderBy('id').reverse().limit(1000).toArray();
    return results.filter(l => {
      if (filters.level  && l.level  !== filters.level)  return false;
      if (filters.room   && l.room   !== filters.room)   return false;
      if (filters.search && !l.message?.toLowerCase().includes(filters.search.toLowerCase())) return false;
      return true;
    });
  },

  clearLogs: async () => {
    await db.logs.clear();
    memoryLogs = [];
  },

  // Simple perf timing
  time:    (label) => { window.__ortaT = window.__ortaT || {}; window.__ortaT[label] = Date.now(); },
  timeEnd: (label) => {
    const d = Date.now() - (window.__ortaT?.[label] ?? Date.now());
    delete window.__ortaT?.[label];
    return d;
  },
};

export default Logger;
