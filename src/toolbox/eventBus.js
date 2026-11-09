// ============================================================
// System Orta — Event Bus (Toolbox Bridge)
// Connects rooms without direct imports — maintains isolation
// ============================================================

const _listeners = {};

export const EventBus = {
  on(event, cb) {
    if (!_listeners[event]) _listeners[event] = [];
    _listeners[event].push(cb);
    return () => this.off(event, cb);
  },
  off(event, cb) {
    if (_listeners[event])
      _listeners[event] = _listeners[event].filter(f => f !== cb);
  },
  emit(event, data) {
    (_listeners[event] || []).forEach(cb => {
      try { cb(data); } catch (e) {
        console.error(`[EventBus] Error in listener for "${event}":`, e);
      }
    });
    window.dispatchEvent(new CustomEvent(`orta:${event}`, { detail: data }));
  },
};

export const EVENTS = {
  // Stock room
  STOCK_UPDATED:        'stock:updated',
  // Invoice room
  ORDER_CREATED:        'order:created',
  ORDER_UPDATED:        'order:updated',
  ORDER_RETURNED:       'order:returned',
  DEPOSIT_COMPLETED:    'order:deposit_completed',
  DEPOSIT_CANCELLED:    'order:deposit_cancelled',
  // Factory room
  FACTORY_INVOICE_IN:   'factory:invoice_in',
  FACTORY_INVOICE_RET:  'factory:invoice_return',
  FACTORY_PAYMENT:      'factory:payment',
  FACTORY_PRICE_CHANGE: 'factory:price_change',
  // Treasury room
  TREASURY_CHANGED:     'treasury:changed',
  // Telegram room
  TELEGRAM_QUEUED:      'telegram:queued',
  TELEGRAM_DONE:        'telegram:done',
  TELEGRAM_FAILED:      'telegram:failed',
  // Sync
  SYNC_TRIGGERED:       'sync:triggered',
  SYNC_RECEIVED:        'sync:received',
};
