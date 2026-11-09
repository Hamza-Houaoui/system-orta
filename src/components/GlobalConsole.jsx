import React, { useState, useEffect, useRef } from 'react';
import { Terminal, ChevronUp, ChevronDown, X, Trash2 } from 'lucide-react';

export default function GlobalConsole() {
  const [logs, setLogs] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    const handleLog = (e) => {
      const entry = e.detail;
      setLogs((prev) => {
        const newLogs = [...prev, entry];
        // Keep only the last 100 logs in memory for the console
        if (newLogs.length > 100) newLogs.shift();
        return newLogs;
      });
    };

    window.addEventListener('orta:log_added', handleLog);
    return () => window.removeEventListener('orta:log_added', handleLog);
  }, []);

  useEffect(() => {
    if (isOpen && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, isOpen]);

  const formatTime = (ts) => {
    const d = new Date(ts);
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`;
  };

  const getLevelColor = (level) => {
    if (level === 'ERROR') return '#ef4444';
    if (level === 'WARN') return '#f59e0b';
    if (level === 'INFO') return '#10b981';
    return '#6b7280';
  };

  if (!isOpen) {
    return (
      <div 
        onClick={() => setIsOpen(true)}
        style={{
          position: 'fixed', bottom: 0, right: 20, width: 280, height: 32,
          background: '#0f172a', borderTopLeftRadius: 8, borderTopRightRadius: 8,
          border: '1px solid #334155', borderBottom: 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 12px', cursor: 'pointer', zIndex: 9999, color: 'var(--gold)',
          boxShadow: '0 -2px 10px rgba(0,0,0,0.5)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem', fontWeight: 600 }}>
          <Terminal size={14} /> Dev Console
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {logs.length > 0 && (
            <span style={{ fontSize: '0.75rem', color: getLevelColor(logs[logs.length-1].level) }}>
              {logs[logs.length-1].message.substring(0, 20)}...
            </span>
          )}
          <ChevronUp size={16} />
        </div>
      </div>
    );
  }

  return (
    <div style={{
      position: 'fixed', bottom: 0, right: 20, width: 450, height: 300,
      background: '#0f172a', borderTopLeftRadius: 8, borderTopRightRadius: 8,
      border: '1px solid #334155', borderBottom: 'none',
      display: 'flex', flexDirection: 'column', zIndex: 9999,
      boxShadow: '0 -5px 20px rgba(0,0,0,0.5)'
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 12px', borderBottom: '1px solid #334155', background: '#1e293b',
        borderTopLeftRadius: 8, borderTopRightRadius: 8
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem', fontWeight: 600, color: 'var(--gold)' }}>
          <Terminal size={14} /> System Orta Console
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => setLogs([])} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
            <Trash2 size={14} />
          </button>
          <button onClick={() => setIsOpen(false)} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
            <ChevronDown size={16} />
          </button>
        </div>
      </div>

      {/* Logs Body */}
      <div 
        ref={scrollRef}
        style={{
          flex: 1, overflowY: 'auto', padding: 8, fontFamily: 'monospace', fontSize: '0.75rem',
          color: '#e2e8f0', display: 'flex', flexDirection: 'column', gap: 4
        }}
      >
        {logs.length === 0 ? (
          <div style={{ color: '#64748b', textAlign: 'center', marginTop: 20 }}>No logs yet...</div>
        ) : (
          logs.map((l, i) => (
            <div key={i} style={{ borderBottom: '1px dashed #334155', paddingBottom: 4 }}>
              <div style={{ display: 'flex', gap: 6 }}>
                <span style={{ color: '#64748b' }}>[{formatTime(l.timestamp)}]</span>
                <span style={{ color: getLevelColor(l.level), fontWeight: 'bold' }}>[{l.level}]</span>
                <span style={{ color: '#38bdf8' }}>[{l.room}/{l.tool}]</span>
              </div>
              <div style={{ paddingLeft: 12, marginTop: 2, wordBreak: 'break-all', color: l.level === 'ERROR' ? '#fca5a5' : '#e2e8f0' }}>
                {l.message}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
