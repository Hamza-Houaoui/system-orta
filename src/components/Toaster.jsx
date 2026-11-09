import React, { useState, useEffect, useCallback } from 'react';

// ── Toaster Context ──────────────────────────────────────
let _addToast = null;

export const toast = {
  success: (msg) => _addToast?.({ type: 'success', msg }),
  error:   (msg) => _addToast?.({ type: 'error',   msg }),
  warning: (msg) => _addToast?.({ type: 'warning', msg }),
  info:    (msg) => _addToast?.({ type: 'info',     msg }),
};

let _id = 0;

export default function Toaster() {
  const [toasts, setToasts] = useState([]);

  _addToast = useCallback((t) => {
    const id = ++_id;
    setToasts(prev => [...prev, { ...t, id }]);
    setTimeout(() => setToasts(prev => prev.filter(x => x.id !== id)), 4000);
  }, []);

  // Listen for orta:error events from Logger
  useEffect(() => {
    const handler = (e) => toast.error(`[${e.detail.room}/${e.detail.tool}] ${e.detail.message}`);
    window.addEventListener('orta:error', handler);
    return () => window.removeEventListener('orta:error', handler);
  }, []);

  if (!toasts.length) return null;

  return (
    <div className="toaster">
      {toasts.map(t => (
        <div key={t.id} className={`toast toast-${t.type}`}>
          <span style={{ fontSize: '1.1rem' }}>
            {t.type === 'success' ? '✓' : t.type === 'error' ? '✕' : t.type === 'warning' ? '⚠' : 'ℹ'}
          </span>
          <span style={{ flex: 1 }}>{t.msg}</span>
        </div>
      ))}
    </div>
  );
}
