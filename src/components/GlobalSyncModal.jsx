import React, { useState, useEffect } from 'react';
import { Download, AlertTriangle, RefreshCw } from 'lucide-react';
import { syncService } from '../core/syncService';

export default function GlobalSyncModal({ pendingUpdate, onClose }) {
  const [status, setStatus] = useState('idle');
  const [progress, setProgress] = useState('');
  const [error, setError] = useState(null);
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    if (!pendingUpdate || status !== 'idle') return;
    
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(c => c - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      handleUpdate();
    }
  }, [countdown, pendingUpdate, status]);

  if (!pendingUpdate) return null;

  const handleUpdate = async () => {
    setStatus('syncing');
    setError(null);
    try {
      await syncService.pullSync(setProgress, pendingUpdate.message);
      setStatus('success');
      setTimeout(() => {
        onClose();
        window.location.reload(); // Reload to ensure all components see new data safely
      }, 1500);
    } catch (e) {
      if (e.message !== 'ALREADY_UP_TO_DATE') {
        setStatus('error');
        setError(e.message);
      } else {
        onClose();
      }
    }
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 99999
    }}>
      <div style={{
        background: 'var(--surface)', padding: 30, borderRadius: 20,
        maxWidth: 400, width: '90%', border: '1px solid var(--border-gold)',
        boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
        textAlign: 'center'
      }}>
        {status === 'success' ? (
          <div>
            <div style={{ background: 'rgba(16,185,129,0.1)', color: 'var(--green)', width: 60, height: 60, borderRadius: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
              <Download size={32} />
            </div>
            <h2 style={{ marginBottom: 10, color: 'var(--gold)' }}>Update Complete!</h2>
            <p className="text-muted">Restarting application...</p>
          </div>
        ) : (
          <div>
            <div style={{ background: 'rgba(212,175,55,0.1)', color: 'var(--gold)', width: 60, height: 60, borderRadius: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
              <AlertTriangle size={32} />
            </div>
            <h2 style={{ marginBottom: 10, color: '#fff' }}>Critical Update Available</h2>
            <p className="text-muted" style={{ marginBottom: 20 }}>
              Device {pendingUpdate.sourceDeviceId} has updated the database. You must pull these changes before continuing to prevent data loss.
            </p>
            
            {status === 'error' && (
              <div style={{ color: 'var(--red)', background: 'rgba(239,68,68,0.1)', padding: 10, borderRadius: 8, marginBottom: 20 }}>
                {error}
              </div>
            )}
            
            {status === 'syncing' && (
              <div style={{ color: 'var(--blue)', marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                <RefreshCw size={18} className="spin" />
                <span>{progress}</span>
              </div>
            )}

            <button 
              className="btn btn-primary" 
              style={{ width: '100%', padding: 15, fontSize: '1.1rem' }}
              onClick={handleUpdate}
              disabled={status === 'syncing'}
            >
              {status === 'syncing' ? 'Updating...' : (countdown > 0 ? `Update Now (Auto in ${countdown}s)` : 'Update Now')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
