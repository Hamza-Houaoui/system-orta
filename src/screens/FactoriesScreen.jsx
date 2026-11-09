import { isWatcherDevice } from '../core/deviceSync';
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Plus, Search, Download, Upload, ChevronRight, AlertCircle } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import db from '../core/db';
import ErrorBoundary from '../components/ErrorBoundary';
import { toast } from '../components/Toaster';
import { Logger } from '../core/logger';
import { exportRowsToExcel, readImportRows } from '../core/exportExcel';

export default function FactoriesScreen() {
  const navigate = useNavigate();
  const [factories, setFactories] = useState([]);
  const [financials, setFinancials] = useState({});
  const [q, setQ] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', startCredit: '' });
  const [saving, setSaving] = useState(false);

  const fileInputRef = React.useRef(null);

  const handleExport = () => {
    const rows = [['Name', 'Phone', 'Address', 'Starting Debt']];
    factories.forEach(f => {
      rows.push([f.name || '', f.phone || '', f.address || '', f.startCredit || 0]);
    });
    exportRowsToExcel(`factories_${Date.now()}.xlsx`, rows);
    toast.success('Exported factories to Excel');
  };

  const handleImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
        const rows = await readImportRows(file);
        const newFactories = [];
        for (let i = 1; i < rows.length; i++) {
          const cols = rows[i] || [];
          if (cols[0]) {
             newFactories.push({
               id: uuidv4(),
               name: cols[0],
               phone: cols[1] || '',
               address: cols[2] || '',
               startCredit: parseFloat(cols[3]) || 0,
               createdAt: Date.now()
             });
          }
        }
        if (newFactories.length > 0) {
          await db.factories.bulkAdd(newFactories);
          toast.success(`Imported ${newFactories.length} factories`);
          loadFactories();
        } else {
          toast.error('No valid factories found in file');
        }
      } catch (err) {
        toast.error('Failed to import: ' + err.message);
      } finally {
        e.target.value = null;
      }
  };

  useEffect(() => { loadFactories(); }, []);

  const loadFactories = async () => {
    try {
      const all = await db.factories.orderBy('name').toArray();
      setFactories(all);
      // Compute financials per factory
      const fins = {};
      for (const f of all) {
        fins[f.id] = await computeFinancials(f.id, f.startCredit || 0);
      }
      setFinancials(fins);
    } catch (e) {
      Logger.error('factories', 'loadFactories', e.message);
    }
  };

  const computeFinancials = async (factoryId, startCredit) => {
    const invoices = await db.factoryInvoices.where('factoryId').equals(factoryId).toArray();
    let totalIn = 0, totalOut = 0, totalPayments = 0;
    invoices.forEach(inv => {
      if (inv.type === 'in')      totalIn += (inv.amount || 0);
      if (inv.type === 'return')  totalOut += (inv.amount || 0);
      if (inv.type === 'payment') totalPayments += (inv.amount || 0);
    });
    const totalCredit = (startCredit || 0) + totalIn - totalOut - totalPayments;

    // Stock value at factory price
    const models = await db.catalog.where('factoryId').equals(factoryId).toArray();
    let stockCredit = 0;
    for (const m of models) {
      const colors = await db.modelColors.where('catalogId').equals(m.id).toArray();
      for (const mc of colors) {
        const totalQty = (mc.stock || []).reduce((s, x) => s + (x.qty || 0), 0);
        stockCredit += totalQty * (m.factoryPrice || 0);
      }
    }
    return {
      totalCredit,
      stockCredit,
      netCredit: totalCredit - stockCredit,
      totalIn, totalOut, totalPayments,
      modelCount: models.length,
    };
  };

  const addFactory = async () => {
    if (!form.name.trim()) { toast.error('Factory name is required'); return; }
    setSaving(true);
    try {
      const id = uuidv4();
      const factory = {
        id,
        name: form.name.trim(),
        phone: form.phone.trim(),
        startCredit: parseFloat(form.startCredit) || 0,
        createdAt: Date.now(),
      };
      await db.factories.add(factory);
      Logger.info('factories', 'addFactory', 'Factory added', { id, name: factory.name });
      toast.success(`Factory "${factory.name}" added`);
      setForm({ name: '', phone: '', startCredit: '' });
      setShowAdd(false);
      loadFactories();
    } catch (e) {
      Logger.error('factories', 'addFactory', e.message);
      toast.error('Failed to add factory: ' + e.message);
    }
    setSaving(false);
  };

  const filtered = q
    ? factories.filter(f => f.name?.toLowerCase().includes(q.toLowerCase()) || f.phone?.includes(q))
    : factories;

  return (
    <ErrorBoundary room="factories">
      <div className="page-container fade-in">
        <div className="page-header">
          <div className="page-title"><Building2 size={22} /> FACTORIES</div>
          <div className="page-actions">
            <div className="search-wrap">
              <Search size={15} className="search-icon" />
              <input className="search-input" placeholder="Search factories..." value={q}
                onChange={e => setQ(e.target.value)} style={{ width: 220 }} />
            </div>
            <input type="file" accept=".xlsx,.xls,.csv,.txt,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv,text/plain" style={{display: 'none'}} ref={fileInputRef} onChange={handleImport} />
            <button className="btn btn-secondary btn-sm" onClick={() => fileInputRef.current?.click()}><Upload size={13} /> Import Excel</button>
            <button className="btn btn-secondary btn-sm" onClick={handleExport}><Download size={13} /> Export Excel</button>
            {!isWatcherDevice() && <button className="btn btn-primary btn-sm" onClick={() => setShowAdd(true)}><Plus size={14} /> Add Factory</button>}
          </div>
        </div>

        {/* Stats row */}
        <div className="grid-4" style={{ marginBottom: 20 }}>
          <div className="stat-card">
            <div className="stat-label">Total Factories</div>
            <div className="stat-value">{factories.length}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Total Debt</div>
            <div className="stat-value red">
              ${Object.values(financials).reduce((s, f) => s + (f.totalCredit || 0), 0).toFixed(2)}
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Stock Value</div>
            <div className="stat-value text-gold">
              ${Object.values(financials).reduce((s, f) => s + (f.stockCredit || 0), 0).toFixed(2)}
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Net Credit (Owed)</div>
            <div className="stat-value red">
              ${Object.values(financials).reduce((s, f) => s + (f.netCredit || 0), 0).toFixed(2)}
            </div>
          </div>
        </div>

        {/* Factory list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.length === 0 ? (
            <div className="empty-state">
              <Building2 size={48} />
              <h3>No factories yet</h3>
              <p>Add your first factory to get started</p>
              {!isWatcherDevice() && <button className="btn btn-primary" onClick={() => setShowAdd(true)}><Plus size={14} /> Add Factory</button>}
            </div>
          ) : filtered.map(f => {
            const fin = financials[f.id] || {};
            return (
              <div
                key={f.id}
                onClick={() => navigate(`/factories/${f.id}`)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 16,
                  padding: '14px 18px',
                  background: 'var(--surface)', border: '1px solid var(--border)',
                  borderRadius: 12, cursor: 'pointer', transition: 'all 0.2s',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-gold)'; e.currentTarget.style.background = 'var(--surface2)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--surface)'; }}
              >
                <div style={{
                  width: 44, height: 44, borderRadius: 10,
                  background: 'rgba(212,175,55,0.12)', border: '1px solid var(--border-gold)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                }}>
                  <Building2 size={20} color="var(--gold)" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: '1rem' }}>{f.name}</div>
                  <div className="text-muted text-xs">{f.phone || 'No phone'} · {fin.modelCount || 0} models</div>
                </div>
                <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
                  <div style={{ textAlign: 'center' }}>
                    <div className="text-xs text-muted">Debt</div>
                    <div className="text-red text-bold">${(fin.totalCredit || 0).toFixed(2)}</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div className="text-xs text-muted">Stock Value</div>
                    <div className="text-gold text-bold">${(fin.stockCredit || 0).toFixed(2)}</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div className="text-xs text-muted">Net Owed</div>
                    <div className={fin.netCredit > 0 ? 'text-red text-bold' : 'text-green text-bold'}>
                      ${(fin.netCredit || 0).toFixed(2)}
                    </div>
                  </div>
                  <ChevronRight size={18} color="var(--text-muted)" />
                </div>
              </div>
            );
          })}
        </div>

        {/* Add Factory Modal */}
        {showAdd && (
          <div className="modal-overlay" onClick={() => setShowAdd(false)}>
            <div className="modal-box" onClick={e => e.stopPropagation()}>
              <div className="modal-title"><Building2 size={18} /> Add New Factory</div>
              <div className="form-group">
                <label className="form-label">Factory Name *</label>
                <input placeholder="e.g. RESEDA" value={form.name}
                  onChange={e => setForm(p => ({ ...p, name: e.target.value }))} autoFocus />
              </div>
              <div className="form-group">
                <label className="form-label">Phone Number</label>
                <input placeholder="+90 ..." value={form.phone}
                  onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Initial Credit / Debt ($)</label>
                <input type="number" placeholder="0.00" value={form.startCredit}
                  onChange={e => setForm(p => ({ ...p, startCredit: e.target.value }))} />
              </div>
              <div className="modal-actions">
                <button className="btn btn-secondary" onClick={() => setShowAdd(false)}>Cancel</button>
                <button className="btn btn-primary" onClick={addFactory} disabled={saving}>
                  {saving ? 'Saving...' : 'Add Factory'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
}
