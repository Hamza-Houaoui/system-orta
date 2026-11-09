import React, { useState, useEffect } from 'react';
import { FileText, RefreshCw, Trash2, Filter, Search, Info, AlertTriangle, XCircle, ChevronDown, ChevronUp, Copy, Check, Terminal } from 'lucide-react';
import { Logger } from '../core/logger';
import { toast } from '../components/Toaster';
import ErrorBoundary from '../components/ErrorBoundary';
import GlobalConsole from '../components/GlobalConsole';

const LEVELS = ['ALL', 'DEBUG', 'INFO', 'WARN', 'ERROR'];
const ROOMS = ['ALL', 'app', 'factories', 'models', 'customers', 'invoices', 'treasury', 'telegram', 'backup', 'stock', 'settings', 'core'];

const LEVEL_COLOR = { DEBUG: 'badge-gray', INFO: 'badge-blue', WARN: 'badge-orange', ERROR: 'badge-red' };

export default function LogsScreen() {
  const [logs, setLogs] = useState([]);
  const [levelFilter, setLevelFilter] = useState('ALL');
  const [roomFilter, setRoomFilter] = useState('ALL');
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [expandedIndex, setExpandedIndex] = useState(null);
  const [copiedIndex, setCopiedIndex] = useState(null);
  const [rawMode, setRawMode] = useState(false);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const all = await Logger.fetchLogs({
        level: levelFilter !== 'ALL' ? levelFilter : undefined,
        room: roomFilter !== 'ALL' ? roomFilter : undefined,
        search: q || undefined,
      });
      setLogs(all);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [levelFilter, roomFilter, q]);

  const clearLogs = async () => {
    if (!confirm('Clear all logs? This cannot be undone.')) return;
    await Logger.clearLogs();
    setLogs([]);
    setExpandedIndex(null);
    toast.success('Logs cleared');
  };

  const handleCopy = (dataStr, index) => {
    navigator.clipboard.writeText(dataStr);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const formatTime = (ts) => new Date(ts).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit'
  });

  const filtered = logs.filter(l => {
    if (levelFilter !== 'ALL' && l.level !== levelFilter) return false;
    if (roomFilter !== 'ALL' && l.room !== roomFilter) return false;
    if (q && !l.message?.toLowerCase().includes(q.toLowerCase()) && !l.tool?.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  const errorCount = logs.filter(l => l.level === 'ERROR').length;
  const warnCount = logs.filter(l => l.level === 'WARN').length;

  const copyAllLogs = () => {
    const text = filtered.map(l => {
      let str = `[${formatTime(l.timestamp)}] [${l.level}] [${l.room}] [${l.tool}] ${l.message}`;
      if (l.data) str += `\nData: ${l.data}`;
      return str;
    }).join('\n\n----------------------------------------\n\n');
    navigator.clipboard.writeText(text);
    toast.success('All logs copied in AI-friendly format!');
  };

  const generateRawLogs = () => {
    return filtered.map(l => {
      let str = `[${formatTime(l.timestamp)}] [${l.level}] [${l.room}] [${l.tool}] ${l.message}`;
      if (l.data) str += `\n${l.data}`;
      return str;
    }).join('\n\n');
  };

  return (
    <ErrorBoundary room="logs">
      <div className="page-container fade-in">
        <div className="page-header">
          <div className="page-title"><FileText size={22}/> SYSTEM LOGS</div>
          <div className="page-actions" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn btn-secondary btn-sm" onClick={() => setRawMode(!rawMode)} style={{ background: rawMode ? 'var(--gold)' : 'var(--surface2)', color: rawMode ? '#000' : 'var(--text)' }}>
              <Terminal size={13}/> {rawMode ? 'UI View' : 'Raw View'}
            </button>
            <button className="btn btn-secondary btn-sm" onClick={copyAllLogs} style={{ background: 'rgba(59,130,246,0.1)', color: 'var(--blue)', border: '1px solid rgba(59,130,246,0.3)' }}>
              <Copy size={13}/> Copy All (AI Format)
            </button>
            <button className="btn btn-secondary btn-sm" onClick={load}><RefreshCw size={13}/> Refresh</button>
            <button className="btn btn-danger btn-sm" onClick={clearLogs}><Trash2 size={13}/> Clear All</button>
          </div>
        </div>

        <div className="grid-4" style={{ marginBottom: 16 }}>
          <div className="stat-card"><div className="stat-label">Total Logs</div><div className="stat-value">{logs.length}</div></div>
          <div className="stat-card"><div className="stat-label">Errors</div><div className="stat-value red">{errorCount}</div></div>
          <div className="stat-card"><div className="stat-label">Warnings</div><div className="stat-value" style={{ color: 'var(--orange)' }}>{warnCount}</div></div>
          <div className="stat-card"><div className="stat-label">Showing</div><div className="stat-value">{filtered.length}</div></div>
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
            <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
            <input className="search-input" placeholder="Search messages..." value={q} onChange={e => setQ(e.target.value)} />
          </div>
          <select value={levelFilter} onChange={e => setLevelFilter(e.target.value)} style={{ width: 110 }}>
            {LEVELS.map(l => <option key={l}>{l}</option>)}
          </select>
          <select value={roomFilter} onChange={e => setRoomFilter(e.target.value)} style={{ width: 140 }}>
            {ROOMS.map(r => <option key={r}>{r}</option>)}
          </select>
        </div>

        {/* Log entries */}
        {loading ? (
          <div className="empty-state"><div className="spin" style={{ width: 28, height: 28, border: '3px solid var(--gold)', borderTopColor: 'transparent', borderRadius: '50%' }} /></div>
        ) : filtered.length === 0 ? (
          <div className="empty-state"><FileText size={48}/><h3>No log entries</h3></div>
        ) : rawMode ? (
          <div style={{ position: 'relative' }}>
            <pre style={{
              margin: 0, padding: 16, borderRadius: 8, background: '#0a0a0a', border: '1px solid #333',
              color: '#33ff33', fontSize: '0.85rem', overflowX: 'auto', whiteSpace: 'pre-wrap', fontFamily: 'monospace'
            }}>
              {generateRawLogs()}
            </pre>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {filtered.map((l, i) => {
              const isExpanded = expandedIndex === i;
              const isError = l.level === 'ERROR';
              const isWarn = l.level === 'WARN';
              
              return (
                <div key={i} style={{
                  display: 'flex', flexDirection: 'column', borderRadius: 8,
                  background: isError ? 'rgba(239,68,68,0.05)' : isWarn ? 'rgba(245,158,11,0.05)' : 'var(--surface)',
                  border: `1px solid ${isError ? 'rgba(239,68,68,0.3)' : isWarn ? 'rgba(245,158,11,0.3)' : 'var(--border)'}`,
                  overflow: 'hidden', transition: 'all 0.2s'
                }}>
                  {/* Header (Always visible) */}
                  <div 
                    onClick={() => setExpandedIndex(isExpanded ? null : i)}
                    style={{
                      display: 'flex', gap: 12, padding: '12px 16px', cursor: 'pointer', alignItems: 'center'
                    }}>
                    {/* Icon */}
                    <div style={{ flexShrink: 0 }}>
                      {isError ? <XCircle size={18} className="red" /> : 
                       isWarn ? <AlertTriangle size={18} style={{ color: 'var(--orange)' }} /> : 
                       <Info size={18} style={{ color: 'var(--gold)' }} />}
                    </div>

                    {/* Message (Main focus) */}
                    <div style={{ flex: 1, fontSize: '0.95rem', fontWeight: 500, color: 'var(--text)' }}>
                      {l.message}
                      {l.data && <span className="text-muted text-xs" style={{ marginLeft: 8 }}>(has data)</span>}
                    </div>

                    {/* Room Tag */}
                    <div style={{ flexShrink: 0, padding: '2px 8px', borderRadius: 12, background: 'var(--surface-light)', border: '1px solid var(--border)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {l.room}
                    </div>

                    {/* Timestamp */}
                    <div style={{ flexShrink: 0, fontSize: '0.8rem', color: 'var(--text-muted)', width: 130, textAlign: 'right' }}>
                      {formatTime(l.timestamp)}
                    </div>

                    {/* Expand Chevron */}
                    <div style={{ flexShrink: 0, color: 'var(--text-muted)' }}>
                      {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div style={{ borderTop: '1px solid var(--border)', padding: '12px 16px', background: 'rgba(0,0,0,0.2)' }}>
                      <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
                        <span className={`badge ${LEVEL_COLOR[l.level] || 'badge-gray'}`}>{l.level}</span>
                        <span className="badge badge-gray" style={{ color: 'var(--gold)' }}>Tool: {l.tool}</span>
                        <span className="badge badge-gray">Room: {l.room}</span>
                      </div>
                      {l.data && (
                        <div style={{ position: 'relative' }}>
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleCopy(l.data, i); }}
                            style={{ position: 'absolute', top: 8, right: 8, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 4, padding: 4, cursor: 'pointer', color: 'var(--text-muted)' }}
                          >
                            {copiedIndex === i ? <Check size={14} className="green" /> : <Copy size={14} />}
                          </button>
                          <pre style={{
                            margin: 0, padding: 12, borderRadius: 6, background: '#111', 
                            color: '#0f0', fontSize: '0.85rem', overflowX: 'auto', border: '1px solid #333', whiteSpace: 'pre-wrap'
                          }}>
                            {l.data}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
      <GlobalConsole />
    </ErrorBoundary>
  );
}
