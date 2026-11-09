import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, ShoppingCart, Plus, User } from 'lucide-react';
import db from '../core/db';
import COUNTRIES from '../core/countries.json';
import { maskPhone } from '../core/deviceSync';

export default function HomeScreen() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [debtors, setDebtors] = useState([]);
  const [preorders, setPreorders] = useState([]);
  const [recentOrders, setRecentOrders] = useState([]);
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const customers = await db.customers.toArray();
      setDebtors(customers.filter(c => c.credit > 0).sort((a,b) => b.credit - a.credit));
      const orders = await db.orders.orderBy('date').reverse().limit(5).toArray();
      setRecentOrders(orders);
      const pre = await db.orders.where('type').equals('deposit').toArray();
      setPreorders(pre);
    } catch (e) { console.error(e); }
  };

  const handleSearch = async (q) => {
    setQuery(q);
    if (!q.trim()) { setResults([]); setSearching(false); return; }
    setSearching(true);
    const lower = q.toLowerCase();
    const all = await db.customers.toArray();
    const found = all.filter(c =>
      c.name?.toLowerCase().includes(lower) ||
      c.phone?.includes(q) ||
      c.cargoName?.toLowerCase().includes(lower)
    ).slice(0, 8);
    setResults(found);
    setSearching(false);
  };

  const getFlag = (country) => {
    return COUNTRIES.find(c => c.name === country)?.flag || '🌍';
  };

  return (
    <div className="page-container fade-in" style={{ display: 'flex', flexDirection: 'column' }}>
      {/* ── Debtors Section ────────────────────────────────── */}
      {debtors.length > 0 && (
        <div style={{ marginBottom: 24 }}>

          <div className="text-sec text-sm" style={{ marginBottom: 10, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: 'var(--red)', animation: 'pulse 1.5s infinite' }}></span>
            OUTSTANDING DEBTS
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {debtors.map(c => (
              <div
                key={c.id}
                className="chip chip-debt"
                style={{ border: '1px solid var(--red)', width: 230, height: 42, boxSizing: 'border-box', justifyContent: 'space-between' }}
                onClick={() => navigate(`/customers/${c.id}/credit`)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, flex: 1 }}>
                  <div className="avatar" style={{ width: 28, height: 28, flexShrink: 0, overflow: 'hidden', background: 'var(--surface-light)' }}>
                    {getFlag(c.country) !== '🌍' ? (
                      <span style={{ fontSize: '3rem', lineHeight: 1, opacity: 0.5 }}>{getFlag(c.country)}</span>
                    ) : (
                      c.name?.[0]?.toUpperCase()
                    )}
                  </div>
                  <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {c.name}
                  </div>
                </div> 
                <span className="text-red text-bold" style={{ flexShrink: 0 }}>${c.credit?.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Pre-orders chips ──────────────────────────────── */}
      {preorders.length > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
          {Object.values(preorders.reduce((acc, o) => {
            const id = o.customerId;
            if (!id) return acc;
            if (!acc[id]) {
              acc[id] = { id, name: o.customerName || 'Unknown', count: 0 };
            }
            acc[id].count++;
            return acc;
          }, {})).map(({ id, name, count }) => (
            <div
              key={id}
              className="chip chip-preorder"
              style={{ width: 230, height: 42, boxSizing: 'border-box', justifyContent: 'space-between' }}
              onClick={() => navigate(`/customers/${id}`, { state: { filter: 'deposit' } })}
            >
              <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1, textAlign: 'left' }}>
                {name} 
              </div>
              {count > 1 && <span className="text-muted text-bold" style={{ flexShrink: 0 }}>({count})</span>}
            </div>
          ))}
        </div>
      )}

      {/* ── Logo + Search ─────────────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: 40, marginBottom: 40 }}>
        <img
          src="/beeaueen_logo.png" alt="System Orta"
          style={{ maxWidth: 420, maxHeight: 240, width: '100%', height: 'auto', objectFit: 'contain' }}
          className="logo-glow"
          onError={e => {
            e.target.style.display = 'none';
            document.getElementById('orta-text-logo').style.display = 'block';
          }}
        />
        <div id="orta-text-logo" style={{ display: 'none', fontSize: '2.2rem', fontWeight: 700, color: 'var(--gold)', letterSpacing: 3 }}>
          ⚜ ORTA
        </div>

        {/* Search bar */}
        <div style={{ position: 'relative', width: '100%', maxWidth: 480, marginTop: 32 }}>
          <Search size={18} style={{
            position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)',
            color: 'var(--text-muted)', pointerEvents: 'none'
          }} />
          <input
            type="text"
            placeholder="Search customers by name or phone..."
            value={query}
            onChange={e => handleSearch(e.target.value)}
            style={{
              paddingLeft: 44, paddingRight: 16, height: 52, fontSize: '0.95rem',
              background: 'rgba(212,175,55,0.04)', border: '1px solid rgba(212,175,55,0.2)',
              borderRadius: 26,
              boxShadow: query ? '0 0 20px rgba(212,175,55,0.2)' : '0 0 8px rgba(212,175,55,0.08)',
              transition: 'all 0.3s',
            }}
          />
        </div>

        {/* Search Results */}
        {(results.length > 0 || query) && !searching && (
          <div style={{
            width: '100%', maxWidth: 480, marginTop: 8,
            background: 'var(--surface)', border: '1px solid var(--border-gold)',
            borderRadius: 12, overflow: 'hidden',
            boxShadow: '0 10px 30px rgba(0,0,0,0.4)'
          }}>
            {results.map(c => (
              <div
                key={c.id}
                onClick={() => { navigate(`/new-order?customer=${c.id}`); setQuery(''); setResults([]); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '12px 16px', cursor: 'pointer', borderBottom: '1px solid var(--border)',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--surface2)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <div className="avatar" style={{ width: 36, height: 36, overflow: 'hidden', background: 'var(--surface-light)', border: '1px solid rgba(212,175,55,0.2)' }}>
                  {getFlag(c.country) !== '🌍' ? (
                    <span style={{ fontSize: '3.5rem', lineHeight: 1, opacity: 0.5 }}>{getFlag(c.country)}</span>
                  ) : (
                    c.name?.[0]?.toUpperCase()
                  )}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>
                    {c.name}
                  </div>
                  <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {c.phone && <span style={{ color: 'var(--gold)', fontSize: '0.9rem', fontWeight: 500 }}>{maskPhone(c.phone)}</span>}
                    {c.cargoName && <span style={{ marginLeft: c.phone ? 4 : 0 }}>{c.phone && '· '} {c.cargoName}</span>}
                  </div>
                </div>
                {c.credit > 0 && (
                  <span className="text-red text-sm text-bold">${c.credit?.toFixed(2)}</span>
                )}
                <button
                  className="btn btn-success btn-sm btn-icon"
                  onClick={e => { e.stopPropagation(); navigate(`/customers/${c.id}`); }}
                  title="Customer Profile"
                >
                  <User size={14} />
                </button>
              </div>
            ))}
            
            {results.length === 0 && query && (
              <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)' }}>
                No customers found matching "{query}"
              </div>
            )}

            {query && (
              <div
                onClick={() => navigate('/customers', { state: { addCustomer: true, query } })}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '12px 16px', cursor: 'pointer', borderTop: '1px solid var(--border-gold)',
                  background: 'rgba(212,175,55,0.05)', color: 'var(--gold)', fontWeight: 600,
                  transition: 'background 0.15s'
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(212,175,55,0.15)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(212,175,55,0.05)'}
              >
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--gold)', color: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Plus size={18} />
                </div>
                Add new customer: {query}
              </div>
            )}
          </div>
        )}
      </div>


    </div>
  );
}
