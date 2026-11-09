import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Users, Plus, Search, Download, Upload, MessageCircle, Edit2, ShoppingCart } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import db from '../core/db';
import { toast } from '../components/Toaster';
import { Logger } from '../core/logger';
import ErrorBoundary from '../components/ErrorBoundary';
import { exportRowsToExcel, readImportRows } from '../core/exportExcel';

import COUNTRIES from '../core/countries.json';
import { parsePhoneNumber } from '../core/phoneParser';
import { maskPhone } from '../core/deviceSync';
import { isWatcherDevice } from '../core/deviceSync';

const getFlag = (country) => COUNTRIES.find(c=>c.name===country)?.flag || '';

const getCountryColor = (countryName) => {
  const map = {
    'Tunisia': '#e3000f', 'Turkey': '#e30a17', 'Algeria': '#006233',
    'Libya': '#239e46', 'Morocco': '#c1272d', 'Egypt': '#ce1126',
    'Senegal': '#00853f', 'Mali': '#fcd116', 'Iraq': '#ce1126',
    'France': '#002654', 'Italy': '#009246', 'Spain': '#aa151b',
    'Germany': '#ffce00', 'United Kingdom': '#012169', 'United States': '#b22234',
    'Saudi Arabia': '#006c35', 'United Arab Emirates': '#00732f'
  };
  if (map[countryName]) return map[countryName];
  if (!countryName) return 'transparent';
  let hash = 0;
  for (let i = 0; i < countryName.length; i++) hash = countryName.charCodeAt(i) + ((hash << 5) - hash);
  const color = (hash & 0x00FFFFFF).toString(16).toUpperCase();
  return '#' + '00000'.substring(0, 6 - color.length) + color;
};

export default function CustomersScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const [customers, setCustomers] = useState([]);
  const [q, setQ] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [editCustomer, setEditCustomer] = useState(null);
  const [form, setForm] = useState({ name:'', phone:'', country:'Turkey', cargoName:'', code:'', note:'' });
  const [saving, setSaving] = useState(false);

  useEffect(() => { 
    load();
    if (location.state?.addCustomer) {
      const qry = location.state.query || '';
      const isPhone = /^[0-9+\s()-]+$/.test(qry);
      let initialPhone = isPhone ? qry : '';
      let initialName = isPhone ? '' : qry;
      let initialCountry = 'Turkey';
      
      if (initialPhone) {
        const parsed = parsePhoneNumber(initialPhone, COUNTRIES);
        if (parsed.country) initialCountry = parsed.country.name;
      }
      
      setForm({ name: initialName, phone: initialPhone, country: initialCountry, cargoName:'', code:'', note:'' });
      setEditCustomer(null);
      setShowAdd(true);
      
      // Clear state so it doesn't reopen on reload
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  const load = async () => {
    const all = await db.customers.orderBy('name').toArray();
    setCustomers(all);
  };

  const fileInputRef = React.useRef(null);

  const handleExport = () => {
    const rows = [['Name', 'Phone', 'Country', 'Cargo', 'Code', 'Note', 'Debt']];
    customers.forEach(c => {
      rows.push([c.name || '', c.phone || '', c.country || '', c.cargoName || '', c.code || '', c.note || '', c.credit || 0]);
    });
    exportRowsToExcel(`customers_${Date.now()}.xlsx`, rows);
    toast.success('Exported customers to Excel');
  };

  const handleImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const rows = await readImportRows(file);
      let updated = 0;
      let added = 0;

      await db.transaction('rw', db.customers, async () => {
        for (let i = 1; i < rows.length; i++) {
          const cols = rows[i] || [];
          const name = cols[0] != null ? String(cols[0]).trim() : '';
          if (!name) continue;

          const phone = cols[1] != null ? String(cols[1]) : '';
          const country = cols[2] != null ? String(cols[2]) : '';
          const cargoName = cols[3] != null ? String(cols[3]) : '';
          const code = cols[4] != null ? String(cols[4]) : '';
          const note = cols[5] != null ? String(cols[5]) : '';
          const credit = parseFloat(cols[6]) || 0;

          let existing = await db.customers.where('name').equals(name).first();
          if (existing) {
            await db.customers.update(existing.id, {
              phone: phone || existing.phone,
              country: country || existing.country,
              cargoName: cargoName || existing.cargoName,
              code: code || existing.code,
              note: note || existing.note,
              credit: credit || existing.credit
            });
            updated++;
          } else {
            await db.customers.add({
              id: uuidv4(),
              name, phone, country, cargoName, code, note, credit,
              createdAt: Date.now()
            });
            added++;
          }
        }
      });
      toast.success(`Imported: ${added} added, ${updated} updated`);
      load();
    } catch (err) {
      toast.error('Failed to import: ' + err.message);
    } finally {
      e.target.value = null;
    }
  };

  const openAdd = () => { setForm({ name:'', phone:'', country:'Turkey', cargoName:'', code:'', note:'' }); setEditCustomer(null); setShowAdd(true); };
  const openEdit = (c) => { setForm({ name:c.name||'', phone:c.phone||'', country:c.country||'Tanzania', cargoName:c.cargoName||'', code:c.code||'', note:c.note||'' }); setEditCustomer(c); setShowAdd(true); };

  const save = async () => {
    if (!form.name.trim()) { toast.error('Name is required'); return; }
    setSaving(true);
    try {
      if (editCustomer) {
        await db.customers.update(editCustomer.id, { ...form });
        Logger.info('customers','updateCustomer','Customer updated',{id:editCustomer.id});
        toast.success('Customer updated');
      } else {
        const id = uuidv4();
        await db.customers.add({ id, ...form, credit:0, createdAt:Date.now() });
        Logger.info('customers','addCustomer','Customer added',{id, name:form.name});
        toast.success('Customer added');
      }
      setShowAdd(false); load();
    } catch(e) { toast.error(e.message); Logger.error('customers','save',e.message); }
    setSaving(false);
  };

  const debtors = customers.filter(c => c.credit > 0).sort((a,b) => b.credit - a.credit);

  const filtered = q
    ? customers.filter(c =>
        c.name?.toLowerCase().includes(q.toLowerCase()) ||
        c.phone?.includes(q) || c.cargoName?.toLowerCase().includes(q.toLowerCase()) ||
        c.code?.toLowerCase().includes(q.toLowerCase()))
    : customers;

  return (
    <ErrorBoundary room="customers">
      <div className="page-container fade-in">
        <div className="page-header">
          <div className="page-title"><Users size={22}/> CUSTOMERS</div>
          <div className="page-actions">
            <input type="file" accept=".xlsx,.xls,.csv,.txt,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv,text/plain" style={{display: 'none'}} ref={fileInputRef} onChange={handleImport} />
            <button className="btn btn-secondary btn-sm" onClick={() => fileInputRef.current?.click()}><Upload size={13}/> Import Excel</button>
            {!isWatcherDevice() && <button className="btn btn-secondary btn-sm" onClick={handleExport}><Download size={13}/> Export Excel</button>}
            <button className="btn btn-primary btn-sm" onClick={openAdd}><Plus size={14}/> Add Customer</button>
          </div>
        </div>

        {/* Debtors bar */}
        {debtors.length > 0 && (
          <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:14, padding:'10px 14px', background:'rgba(239,68,68,0.06)', borderRadius:10, border:'1px solid rgba(239,68,68,0.2)' }}>
            <span className="text-xs text-muted" style={{alignSelf:'center',fontWeight:600}}>OUTSTANDING:</span>
            {debtors.map(c => (
              <div key={c.id} className="chip chip-debt" onClick={()=>navigate(`/customers/${c.id}/credit`)}>
                {getFlag(c.country)} {c.name} <strong>${(c.credit||0).toFixed(2)}</strong>
              </div>
            ))}
          </div>
        )}

        {/* Search */}
        <div style={{ position:'relative', marginBottom:14 }}>
          <Search size={16} style={{ position:'absolute', left:14, top:'50%', transform:'translateY(-50%)', color:'var(--text-muted)', pointerEvents:'none' }}/>
          <input className="search-input" placeholder="Search by name, phone or cargo..." value={q} onChange={e=>setQ(e.target.value)}/>
        </div>

        {/* Stats */}
        <div className="grid-3" style={{ marginBottom:16 }}>
          <div className="stat-card"><div className="stat-label">Total Customers</div><div className="stat-value">{customers.length}</div></div>
          <div className="stat-card"><div className="stat-label">With Debt</div><div className="stat-value red">{debtors.length}</div></div>
          <div className="stat-card"><div className="stat-label">Total Outstanding</div><div className="stat-value red">${debtors.reduce((s,c)=>s+(c.credit||0),0).toFixed(2)}</div></div>
        </div>

        {/* Customer List */}
        <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
          {filtered.length === 0 ? (
            <div className="empty-state"><Users size={48}/><h3>No customers yet</h3><button className="btn btn-primary" onClick={openAdd}><Plus size={14}/> Add Customer</button></div>
          ) : filtered.map(c => (
            <div key={c.id} className="customer-item" onClick={()=>navigate(`/customers/${c.id}`)} style={{ '--customer-color': c.country ? getCountryColor(c.country) + '25' : 'transparent' }}>
              <div className="avatar" style={{ overflow: 'hidden', background: 'var(--surface-light)', border: '1px solid rgba(212,175,55,0.2)' }}>
                {getFlag(c.country) !== '🌍' ? (
                  <span style={{ fontSize: '4.5rem', lineHeight: 1, opacity: 0.5 }}>{getFlag(c.country)}</span>
                ) : (
                  c.name?.[0]?.toUpperCase()
                )}
              </div>
              <div className="customer-info">
                <div className="customer-name">{c.name}</div>
                <div className="customer-sub">
                  <span>{c.country}</span>
                  {c.cargoName && <><span>·</span><span className="text-muted">{c.cargoName}</span></>}
                  {c.phone && <><span>·</span><span className="text-gold">{maskPhone(c.phone)}</span></>}
                </div>
              </div>
              {c.credit > 0 && <span className="chip chip-debt">${(c.credit||0).toFixed(2)}</span>}
              <div className="customer-actions" onClick={e=>e.stopPropagation()}>
                {c.phone && <a href={`https://wa.me/${c.phone.replace(/\D/g,'')}`} target="_blank" rel="noreferrer">
                  <button className="btn btn-success btn-sm btn-icon"><MessageCircle size={14}/></button></a>}
                <button className="btn btn-secondary btn-sm btn-icon" onClick={()=>openEdit(c)}><Edit2 size={14}/></button>
                <button className="btn btn-primary btn-sm btn-icon" onClick={()=>navigate(`/new-order?customer=${c.id}`)}><ShoppingCart size={14}/></button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {showAdd && (
        <div className="modal-overlay" onClick={()=>setShowAdd(false)}>
          <div className="modal-box" onClick={e=>e.stopPropagation()}>
            <div className="modal-title"><Users size={16}/> {editCustomer?'Edit Customer':'Add Customer'}</div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">Full Name *</label><input placeholder="Customer name" value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))} autoFocus/></div>
              <div className="form-group">
                <label className="form-label">Phone</label>
                <input 
                  placeholder="+255..." 
                  value={form.phone} 
                  onChange={e => {
                    const val = e.target.value;
                    const parsed = parsePhoneNumber(val, COUNTRIES);
                    setForm(p => ({
                      ...p,
                      phone: val,
                      ...(parsed.country && { country: parsed.country.name })
                    }));
                  }}
                  onBlur={() => {
                    if (form.phone) {
                      const parsed = parsePhoneNumber(form.phone, COUNTRIES);
                      setForm(p => ({ ...p, phone: parsed.formattedPhone }));
                    }
                  }}
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">Country</label>
                <select value={form.country} onChange={e=>setForm(p=>({...p,country:e.target.value}))}>
                  {COUNTRIES.map(c=><option key={c.name} value={c.name}>{c.flag} {c.name}</option>)}
                </select></div>
              <div className="form-group"><label className="form-label">Cargo Name</label><input placeholder="e.g. BARAKA CARGO" value={form.cargoName} onChange={e=>setForm(p=>({...p,cargoName:e.target.value}))}/></div>
            </div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">Customer Code</label><input placeholder="Short code" value={form.code} onChange={e=>setForm(p=>({...p,code:e.target.value}))}/></div>
              <div className="form-group"><label className="form-label">Note</label><input placeholder="Optional note" value={form.note} onChange={e=>setForm(p=>({...p,note:e.target.value}))}/></div>
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={()=>setShowAdd(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={save} disabled={saving}>{saving?'Saving...':editCustomer?'Save Changes':'Add Customer'}</button>
            </div>
          </div>
        </div>
      )}
    </ErrorBoundary>
  );
}
