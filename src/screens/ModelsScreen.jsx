import { isWatcherDevice } from '../core/deviceSync';
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Store, Plus, Search, Download, Upload, ChevronRight,
  Eye, EyeOff, Boxes, Edit2, LayoutGrid, List
} from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import db from '../core/db';
import { Logger } from '../core/logger';
import { toast } from '../components/Toaster';
import ErrorBoundary from '../components/ErrorBoundary';
import { exportRowsToExcel, readImportRows } from '../core/exportExcel';

const ModelCardBackground = ({ asset }) => {
  const [url, setUrl] = useState(null);
  
  useEffect(() => {
    if (!asset?.blob) return;
    const objectUrl = URL.createObjectURL(asset.blob);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [asset]);

  if (!url) return null;

  return (
    <>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 0, opacity: 0.6 }}>
        {asset.type === 'video' ? (
          <video src={url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} muted loop autoPlay />
        ) : (
          <img src={url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="model bg" />
        )}
      </div>
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1,
        boxShadow: 'inset 0 0 60px 30px var(--surface)', /* Blurred edges effect */
        background: 'linear-gradient(to top, rgba(20,20,20,0.9) 0%, rgba(20,20,20,0.2) 60%, rgba(20,20,20,0.6) 100%)'
      }} />
    </>
  );
};

export default function ModelsScreen() {
  const navigate = useNavigate();
  const [catalog, setCatalog] = useState([]);
  const [factories, setFactories] = useState([]);
  const [colors, setColors] = useState([]);
  const [series, setSeries] = useState([]);
  const [q, setQ] = useState('');
  const [filterFactory, setFilterFactory] = useState('all');
  const [filterStock, setFilterStock] = useState('all');
  const [showAdd, setShowAdd] = useState(false);
  const [activeTab, setActiveTab] = useState('models'); // 'models' | 'colors' | 'sizes'
  const [form, setForm] = useState({ code: '', factoryId: '', sizeSeriesId: '', factoryPrice: '', wholesalePrice: '', retailPrice: '' });
  const [colorForm, setColorForm] = useState({ name: '', code: '', hex: '#D4AF37' });
  const [seriesForm, setSeriesForm] = useState({ name: '', sizes: '44,46,48,50', piecesPerSerie: 4 });
  const [saving, setSaving] = useState(false);
  const [listView, setListView] = useState(false);

  const fileInputRef = React.useRef(null);

  const handleExport = async () => {
    try {
      const allModels = await db.catalog.toArray();
      const allColors = await db.modelColors.toArray();
      const allFactories = await db.factories.toArray();
      const allSeries = await db.sizeSeries.toArray();

      const factoryMap = {}; allFactories.forEach(f => factoryMap[f.id] = f.name);
      const seriesMap = {}; allSeries.forEach(s => seriesMap[s.id] = s.name);
      const seriesSizes = {}; allSeries.forEach(s => seriesSizes[s.id] = Array.isArray(s.sizes) ? s.sizes.join(', ') : String(s.sizes || ''));

      const rows = [['Model Code', 'Factory', 'Size Series', 'Sizes', 'Factory Price', 'Wholesale Price', 'Retail Price', 'Color', 'Message ID', 'Stock']];

      for (const m of allModels) {
        const mColors = allColors.filter(c => c.catalogId === m.id);
        const fname = factoryMap[m.factoryId] || '';
        const sname = seriesMap[m.sizeSeriesId] || '';
        const sizesStr = seriesSizes[m.sizeSeriesId] || '';

        if (mColors.length === 0) {
          rows.push([m.code, fname, sname, sizesStr, m.factoryPrice || 0, m.wholesalePrice || 0, m.retailPrice || 0, '', '', '']);
        } else {
          for (const mc of mColors) {
            const colorName = mc.colorName || mc.colorCode || '';
            const assetsArr = Array.isArray(mc.assets) ? mc.assets : Object.values(mc.assets || {});
            const msgId = assetsArr.map(a => a ? a.messageId : null).filter(Boolean).join('|');
            const stockStr = (mc.stock || []).map(s => `${s.size}:${s.qty}`).join('|');
            rows.push([m.code, fname, sname, sizesStr, m.factoryPrice || 0, m.wholesalePrice || 0, m.retailPrice || 0, colorName, msgId, stockStr]);
          }
        }
      }

      exportRowsToExcel(`models_${Date.now()}.xlsx`, rows);
      toast.success('Exported models to Excel');
    } catch(e) {
      toast.error('Failed to export: ' + e.message);
    }
  };

  const handleImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
        const rows = await readImportRows(file);
        const lines = rows;
        
        const allFactories = await db.factories.toArray();
        const allSeries = await db.sizeSeries.toArray();
        const fMap = {}; allFactories.forEach(f => fMap[f.name.toLowerCase()] = f.id);
        const sMap = {}; allSeries.forEach(s => sMap[s.name.toLowerCase()] = s.id);

        let modelsUpdated = 0;
        let colorsUpdated = 0;

        await db.transaction('rw', [db.catalog, db.modelColors, db.factories, db.sizeSeries], async () => {
          for (let i = 1; i < rows.length; i++) {
            const cols = rows[i] || [];
            if (!cols[0]) continue;

            const code = cols[0];
            const fName = cols[1] || '';
            const sName = cols[2] || '';
            const sizesFromExcel = cols[3] || '';
            const fPrice = parseFloat(cols[4]) || 0;
            const wPrice = parseFloat(cols[5]) || 0;
            const rPrice = parseFloat(cols[6]) || 0;
            const cName = cols[7] || '';
            const msgId = cols[8] || '';
            const stockStr = cols[9] || '';

            // Parse sizes from Excel
            const sizesArr = sizesFromExcel
              .toString().split(/[,;]+/).map(s => s.trim()).filter(Boolean);

            // Resolve Factory
            let fId = fName ? fMap[fName.toLowerCase()] : '';
            if (fName && !fId) {
               fId = uuidv4();
               await db.factories.add({ id: fId, name: fName, createdAt: Date.now() });
               fMap[fName.toLowerCase()] = fId;
            }

            // Resolve Series — use sizes from Excel if provided
            let sId = sName ? sMap[sName.toLowerCase()] : '';
            if (sName && !sId) {
               sId = uuidv4();
               await db.sizeSeries.add({ id: sId, name: sName, sizes: sizesArr.length ? sizesArr : [], piecesPerSerie: sizesArr.length || 1 });
               sMap[sName.toLowerCase()] = sId;
            } else if (sId && sizesArr.length) {
               // Update existing series sizes with what Excel says
               const existing = await db.sizeSeries.get(sId);
               if (existing && (!existing.sizes || existing.sizes.length === 0 || JSON.stringify(existing.sizes) !== JSON.stringify(sizesArr))) {
                 await db.sizeSeries.update(sId, { sizes: sizesArr, piecesPerSerie: sizesArr.length });
               }
            }

            // Find or create Model
            let m = await db.catalog.where('code').equals(code).first();
            if (!m) {
              m = {
                id: uuidv4(), code, factoryId: fId, sizeSeriesId: sId,
                factoryPrice: fPrice, wholesalePrice: wPrice, retailPrice: rPrice,
                onSale: false, createdAt: Date.now()
              };
              await db.catalog.add(m);
              modelsUpdated++;
            } else {
              // Update prices if provided
              let changed = false;
              if (fPrice && m.factoryPrice !== fPrice) { m.factoryPrice = fPrice; changed = true; }
              if (wPrice && m.wholesalePrice !== wPrice) { m.wholesalePrice = wPrice; changed = true; }
              if (rPrice && m.retailPrice !== rPrice) { m.retailPrice = rPrice; changed = true; }
              if (fId && m.factoryId !== fId) { m.factoryId = fId; changed = true; }
              if (sId && m.sizeSeriesId !== sId) { m.sizeSeriesId = sId; changed = true; }
              if (changed) { await db.catalog.put(m); modelsUpdated++; }
            }

            // Find or create Color
            if (cName) {
              let mc = await db.modelColors.where('catalogId').equals(m.id).toArray();
              let existingColor = mc.find(c => (c.colorName || c.colorCode) === cName);
              
              // Parse stock
              let stock = [];
              if (stockStr) {
                stockStr.split('|').forEach(part => {
                  const [sz, qty] = part.split(':');
                  if (sz) stock.push({ size: sz, qty: parseInt(qty)||0 });
                });
              }

              if (!existingColor) {
                
                const newAssets = [];
                if (msgId) {
                  msgId.split('|').filter(Boolean).forEach(mid => {
                    newAssets.push({ id: uuidv4(), type: 'image', messageId: parseInt(mid, 10) });
                  });
                }
                await db.modelColors.add({
                  id: uuidv4(), catalogId: m.id, colorName: cName, colorCode: cName,
                  assets: newAssets, stock, createdAt: Date.now()
                });
                colorsUpdated++;
              } else {
                let colorChanged = false;
                if (msgId) {
                  let assets = existingColor.assets || [];
                  const existingMsgIds = assets.map(a => String(a.messageId));
                  const importedMsgIds = msgId.split('|').filter(Boolean);
                  let added = false;
                  for (const mid of importedMsgIds) {
                    if (!existingMsgIds.includes(mid)) {
                      assets.push({ id: uuidv4(), type: 'image', messageId: parseInt(mid, 10) });
                      added = true;
                    }
                  }
                  if (added) {
                    existingColor.assets = assets;
                    colorChanged = true;
                  }
                }
                if (stockStr) { existingColor.stock = stock; colorChanged = true; }
                if (colorChanged) { await db.modelColors.put(existingColor); colorsUpdated++; }
              }
            }
          }
        });

        toast.success(`Imported/Updated ${modelsUpdated} models, ${colorsUpdated} colors`);
        load();
      } catch (err) {
        toast.error('Failed to import: ' + err.message);
      } finally {
        e.target.value = null;
      }
  };

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      const [cats, facts, cols, sers] = await Promise.all([
        db.catalog.toArray(),
        db.factories.toArray(),
        db.colors.toArray(),
        db.sizeSeries.toArray(),
      ]);
      // Attach color swatches and stock info
      const enriched = await Promise.all(cats.map(async cat => {
        const mcs = await db.modelColors.where('catalogId').equals(cat.id).toArray();
        const totalStock = mcs.reduce((s, mc) =>
          s + (mc.stock || []).reduce((ss, x) => ss + (x.qty || 0), 0), 0);
        const factory = facts.find(f => f.id === cat.factoryId);
        
        let firstAsset = null;
        if (cat.assets && cat.assets.length > 0) {
          firstAsset = cat.assets[0];
        } else {
          for (const mc of mcs) {
            if (mc.assets && mc.assets.length > 0) {
              firstAsset = mc.assets[0];
              break;
            }
          }
        }
        
        const swatches = mcs.map(mc => {
          const col = cols.find(c => c.id === mc.colorId);
          return { hex: col?.hex, name: col?.name || mc.colorCode };
        });
        
        const serie = sers.find(s => s.id === cat.sizeSeriesId);
        let sizes = '';
        if (serie && serie.sizes) {
          sizes = Array.isArray(serie.sizes) 
            ? serie.sizes.join(', ') 
            : String(serie.sizes).split(',').map(s => s.trim()).join(', ');
        }
        // Fallback: derive sizes from the actual colors' stock (always real sizes)
        if (!sizes) {
          const sizeSet = new Set();
          mcs.forEach(mc => (mc.stock || []).forEach(x => sizeSet.add(x.size)));
          if (sizeSet.size) sizes = [...sizeSet].join(', ');
        }

        return { ...cat, factory, swatches, totalStock, colorCount: mcs.length, firstAsset, sizes };
      }));
      setCatalog(enriched);
      setFactories(facts);
      setColors(cols);
      setSeries(sers);
    } catch (e) {
      Logger.error('models', 'load', e.message);
    }
  };

  const addModel = async () => {
    if (!form.code.trim()) { toast.error('Model code required'); return; }
    setSaving(true);
    try {
      const id = uuidv4();
      await db.catalog.add({
        id, code: form.code.toUpperCase().trim(),
        factoryId: form.factoryId, sizeSeriesId: form.sizeSeriesId,
        factoryPrice: parseFloat(form.factoryPrice) || 0,
        wholesalePrice: parseFloat(form.wholesalePrice) || 0,
        retailPrice: parseFloat(form.retailPrice) || 0,
        onSale: false, publishedWholesale: false, publishedRetail: false, publishedSales: false,
        createdAt: Date.now(),
      });
      Logger.info('models', 'addModel', 'Model added', { id, code: form.code });
      toast.success(`Model ${form.code} added`);
      setShowAdd(false);
      setForm({ code: '', factoryId: '', sizeSeriesId: '', factoryPrice: '', wholesalePrice: '', retailPrice: '' });
      load();
    } catch (e) {
      Logger.error('models', 'addModel', e.message);
      toast.error(e.message.includes('constraint') ? 'Model code already exists' : e.message);
    }
    setSaving(false);
  };

  const addColor = async () => {
    if (!colorForm.name.trim()) { toast.error('Color name required'); return; }
    setSaving(true);
    try {
      await db.colors.add({ id: uuidv4(), ...colorForm, createdAt: Date.now() });
      toast.success('Color added');
      setColorForm({ name: '', code: '', hex: '#D4AF37' });
      load();
    } catch (e) { toast.error(e.message); }
    setSaving(false);
  };

  const deleteColor = async (id) => {
    if (!confirm('Delete this color?')) return;
    await db.colors.delete(id);
    load();
  };

  const addSeries = async () => {
    if (!seriesForm.name.trim()) { toast.error('Series name required'); return; }
    setSaving(true);
    try {
      const sizes = seriesForm.sizes.split(',').map(s => s.trim()).filter(Boolean);
      await db.sizeSeries.add({ id: uuidv4(), name: seriesForm.name, sizes, piecesPerSerie: parseInt(seriesForm.piecesPerSerie) || sizes.length, createdAt: Date.now() });
      toast.success('Size series added');
      setSeriesForm({ name: '', sizes: '44,46,48,50', piecesPerSerie: 4 });
      load();
    } catch (e) { toast.error(e.message); }
    setSaving(false);
  };

  const deleteSeries = async (id) => {
    if (!confirm('Delete this size series?')) return;
    await db.sizeSeries.delete(id);
    load();
  };

  // Filter models
  const filtered = catalog.filter(c => {
    if (q && !c.code?.toLowerCase().includes(q.toLowerCase())) return false;
    if (filterFactory !== 'all' && c.factoryId !== filterFactory) return false;
    if (filterStock === 'instock' && c.totalStock === 0) return false;
    if (filterStock === 'empty' && c.totalStock > 0) return false;
    return true;
  });

  return (
    <ErrorBoundary room="models">
      <div className="page-container fade-in">
        <div className="page-header">
          <div className="page-title"><Store size={22} /> MODELS</div>
          <div className="page-actions">
            <input type="file" accept=".xlsx,.xls,.csv,.txt,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv,text/plain" style={{display: 'none'}} ref={fileInputRef} onChange={handleImport} />
            <button className="btn btn-secondary btn-sm" onClick={() => fileInputRef.current?.click()}><Upload size={13}/> Import Excel</button>
            <button className="btn btn-secondary btn-sm" onClick={handleExport}><Download size={13}/> Export Excel</button>
            {!isWatcherDevice() && <button className="btn btn-primary btn-sm" onClick={() => setShowAdd(true)}><Plus size={14}/> Add Model</button>}
          </div>
        </div>

        {/* Tabs */}
        <div className="filters-bar" style={{ marginBottom: 16 }}>
          {[['models','Models'],['colors','Colors'],['sizes','Size Series']].map(([t, l]) => (
            <button key={t} className={`filter-btn ${activeTab === t ? 'active' : ''}`} onClick={() => setActiveTab(t)}>{l}</button>
          ))}
        </div>

        {/* ── MODELS TAB ────────────────────────────────── */}
        {activeTab === 'models' && (
          <>
            <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ position: 'relative', flex: 1, minWidth: 180 }}>
                <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                <input className="search-input" placeholder="Search model code..." value={q} onChange={e => setQ(e.target.value)} />
              </div>
              <select value={filterFactory} onChange={e => setFilterFactory(e.target.value)} style={{ width: 160 }}>
                <option value="all">All Factories</option>
                {factories.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
              <div className="filters-bar" style={{ gap: 6, margin: 0 }}>
                {[['all','All Stock'],['instock','In Stock'],['empty','Empty']].map(([v, l]) => {
                  let activeStyle = {};
                  if (filterStock === v) {
                    if (v === 'instock') activeStyle = { background: 'rgba(16,185,129,0.15)', color: 'var(--green)', borderColor: 'var(--green)' };
                    if (v === 'empty') activeStyle = { background: 'rgba(239,68,68,0.15)', color: 'var(--red)', borderColor: 'var(--red)' };
                  }
                  return (
                    <button key={v} className={`filter-btn ${filterStock === v ? 'active' : ''}`} onClick={() => setFilterStock(v)} style={{ padding: '6px 12px', fontSize: '0.8rem', ...activeStyle }}>{l}</button>
                  );
                })}
              </div>
              <button
                className="btn btn-secondary btn-sm btn-icon"
                onClick={() => setListView(v => !v)}
                title={listView ? 'Switch to Grid view' : 'Switch to List view'}
                style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px' }}
              >
                {listView ? <LayoutGrid size={14}/> : <List size={14}/>}
                <span>{listView ? 'Grid' : 'List'}</span>
              </button>
            </div>

            {!listView && <div className="grid-models">
              {filtered.length === 0 ? (
                <div className="empty-state" style={{ gridColumn: '1/-1' }}>
                  <Store size={48}/><h3>No models yet</h3>
                  {!isWatcherDevice() && <button className="btn btn-primary" onClick={() => setShowAdd(true)}><Plus size={14}/> Add Model</button>}
                </div>
              ) : filtered.map(cat => (
                <div
                  key={cat.id}
                  className="model-card"
                  onClick={() => navigate(`/models/${cat.id}`)}
                  style={{ position: 'relative', overflow: 'hidden' }}
                >
                  <ModelCardBackground asset={cat.firstAsset} />
                  
                  <div style={{ position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between' }}>
                    
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6 }}>
                        <div className="model-code">{cat.code}</div>
                        <div className={`badge ${cat.totalStock > 0 ? 'badge-green' : 'badge-red'}`} style={{ flexShrink: 0 }}>
                          {cat.totalStock > 0 ? `${cat.totalStock} pcs` : 'Empty'}
                        </div>
                      </div>
                      <div className="model-factory" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}>{cat.factory?.name || 'No factory'}</div>
                    </div>
                    
                    <div className="model-prices" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'center', flex: 1, gap: 4, margin: '10px 0' }}>
                      <span className="price-tag price-factory">F: ${cat.factoryPrice}</span>
                      <span className="price-tag price-wholesale">W: ${cat.wholesalePrice}</span>
                      <span className="price-tag price-retail">R: ${cat.retailPrice}</span>
                    </div>

                    <div>
                      <div className="color-swatches">
                        {cat.swatches.slice(0, 8).map((s, i) => (
                          <div key={i} className="color-dot" style={{ background: s.hex || '#888', border: '1px solid rgba(255,255,255,0.2)' }} title={s.name} />
                        ))}
                        {cat.colorCount > 8 && <span className="text-xs text-muted">+{cat.colorCount - 8}</span>}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <span className={`badge ${cat.publishedWholesale ? 'badge-green' : 'badge-gray'}`} style={{ fontSize: '0.65rem', backdropFilter: 'blur(2px)' }}>W</span>
                          <span className={`badge ${cat.publishedSales ? 'badge-blue' : 'badge-gray'}`} style={{ fontSize: '0.65rem', backdropFilter: 'blur(2px)' }}>S</span>
                          <span className={`badge ${cat.publishedRetail ? 'badge-orange' : 'badge-gray'}`} style={{ fontSize: '0.65rem', backdropFilter: 'blur(2px)' }}>R</span>
                        </div>
                        {cat.sizes && (
                          <div className="text-muted text-xs" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.9)' }}>
                            {cat.sizes}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>}

            {/* Lightweight list view — no images, renders fast with many models */}
            {listView && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {filtered.length === 0 ? (
                  <div className="empty-state">
                    <Store size={48}/><h3>No models yet</h3>
                    {!isWatcherDevice() && <button className="btn btn-primary" onClick={() => setShowAdd(true)}><Plus size={14}/> Add Model</button>}
                  </div>
                ) : filtered.map(cat => (
                  <div
                    key={cat.id}
                    onClick={() => navigate(`/models/${cat.id}`)}
                    className="nav-item-card"
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
                      background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10,
                      cursor: 'pointer', transition: 'all 0.2s',
                    }}
                  >
                    <div style={{ minWidth: 130, minHeight: 40, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                      <div style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--gold)', letterSpacing: 1, lineHeight: 1.2 }}>
                        {cat.code}
                      </div>
                      <div className="text-xs text-muted" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.2, marginTop: 2 }}>
                        {cat.factory?.name || '—'}
                      </div>
                    </div>
                    {cat.sizes && (
                      <div style={{ display: 'flex', gap: 3, flexShrink: 0, maxWidth: 190, flexWrap: 'wrap' }}>
                        {(cat.sizes.split(',').map(s => s.trim()).filter(Boolean)).map((sz, i) => (
                          <span key={i} title={sz} style={{
                            minWidth: 22, height: 22, padding: '0 5px', borderRadius: 11,
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            background: 'rgba(212,175,55,0.15)', border: '1px solid var(--border-gold)',
                            color: 'var(--gold)', fontSize: '0.62rem', fontWeight: 600, lineHeight: 1,
                          }}>{sz}</span>
                        ))}
                      </div>
                    )}
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                      <div className="color-swatches" style={{ flexShrink: 0 }}>
                        {cat.swatches.slice(0, 5).map((s, i) => (
                          <div key={i} className="color-dot" style={{ width: 12, height: 12, background: s.hex || '#888' }} title={s.name} />
                        ))}
                        {cat.colorCount > 5 && <span className="text-xs text-muted">+{cat.colorCount - 5}</span>}
                      </div>
                    </div>
                    <div className="text-sm" style={{ display: 'flex', gap: 10, flexShrink: 0, minWidth: 150, justifyContent: 'flex-end' }}>
                      <span className="price-tag price-factory">F ${cat.factoryPrice}</span>
                      <span className="price-tag price-wholesale">W ${cat.wholesalePrice}</span>
                      <span className="price-tag price-retail">R ${cat.retailPrice}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                      <span className={`badge ${cat.publishedWholesale ? 'badge-green' : 'badge-gray'}`} style={{ fontSize: '0.65rem' }}>W</span>
                      <span className={`badge ${cat.publishedSales ? 'badge-blue' : 'badge-gray'}`} style={{ fontSize: '0.65rem' }}>S</span>
                      <span className={`badge ${cat.publishedRetail ? 'badge-orange' : 'badge-gray'}`} style={{ fontSize: '0.65rem' }}>R</span>
                    </div>
                    <div className={`badge ${cat.totalStock > 0 ? 'badge-green' : 'badge-red'}`} style={{ flexShrink: 0 }}>
                      {cat.totalStock > 0 ? `${cat.totalStock} pcs` : 'Empty'}
                    </div>
                    <ChevronRight size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── COLORS TAB ──────────────────────────────── */}
        {activeTab === 'colors' && (
          <>
            {!isWatcherDevice() && <div className="card" style={{ marginBottom: 16 }}>
              <div className="form-label" style={{ marginBottom: 12 }}>ADD COLOR</div>
              <div className="form-row">
                <div className="form-group"><label className="form-label">Name</label><input placeholder="e.g. Navy Blue" value={colorForm.name} onChange={e => setColorForm(p => ({ ...p, name: e.target.value }))} /></div>
                <div className="form-group"><label className="form-label">Code</label><input placeholder="e.g. NVY" value={colorForm.code} onChange={e => setColorForm(p => ({ ...p, code: e.target.value }))} /></div>
                <div className="form-group"><label className="form-label">Color</label><input type="color" value={colorForm.hex} onChange={e => setColorForm(p => ({ ...p, hex: e.target.value }))} style={{ height: 42, padding: 4 }} /></div>
                <div className="form-group" style={{ alignSelf: 'flex-end' }}>
                  <button className="btn btn-primary" onClick={addColor} disabled={saving}>Add</button>
                </div>
              </div>
            </div>}
            <div className="grid-4">
              {colors.map(c => (
                <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8 }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: c.hex, border: '2px solid rgba(255,255,255,0.15)', flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div className="text-bold text-sm">{c.name}</div>
                    <div className="text-xs text-muted">{c.code}</div>
                  </div>
                  <button className="btn btn-danger btn-sm btn-icon" onClick={() => deleteColor(c.id)}>×</button>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ── SIZES TAB ─────────────────────────────────── */}
        {activeTab === 'sizes' && (
          <>
            {!isWatcherDevice() && <div className="card" style={{ marginBottom: 16 }}>
              <div className="form-label" style={{ marginBottom: 12 }}>ADD SIZE SERIES</div>
              <div className="form-row">
                <div className="form-group"><label className="form-label">Series Name</label><input placeholder="e.g. European S-XXL" value={seriesForm.name} onChange={e => setSeriesForm(p => ({ ...p, name: e.target.value }))} /></div>
                <div className="form-group"><label className="form-label">Sizes (comma-separated)</label><input placeholder="44,46,48,50,52" value={seriesForm.sizes} onChange={e => setSeriesForm(p => ({ ...p, sizes: e.target.value }))} /></div>
                <div className="form-group"><label className="form-label">Pcs/Serie</label><input type="number" value={seriesForm.piecesPerSerie} onChange={e => setSeriesForm(p => ({ ...p, piecesPerSerie: e.target.value }))} style={{ width: 80 }} /></div>
                <div className="form-group" style={{ alignSelf: 'flex-end' }}>
                  <button className="btn btn-primary" onClick={addSeries} disabled={saving}>Add</button>
                </div>
              </div>
            </div>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {series.map(s => (
                <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10 }}>
                  <div style={{ flex: 1 }}>
                    <div className="text-bold">{s.name}</div>
                    <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                      {(s.sizes || []).map(sz => <span key={sz} className="badge badge-gray">{sz}</span>)}
                    </div>
                  </div>
                  <span className="text-muted text-sm">{s.piecesPerSerie} pcs/serie</span>
                  <button className="btn btn-danger btn-sm btn-icon" onClick={() => deleteSeries(s.id)}>×</button>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Add Model Modal */}
      {showAdd && (
        <div className="modal-overlay" onClick={() => setShowAdd(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="modal-title"><Store size={16}/> Add New Model</div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">Model Code *</label><input placeholder="e.g. 12345" value={form.code} onChange={e => setForm(p => ({ ...p, code: e.target.value }))} autoFocus /></div>
              <div className="form-group"><label className="form-label">Factory</label>
                <select value={form.factoryId} onChange={e => setForm(p => ({ ...p, factoryId: e.target.value }))}>
                  <option value="">Select factory...</option>
                  {factories.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
              </div>
            </div>
            <div className="form-group"><label className="form-label">Size Series</label>
              <select value={form.sizeSeriesId} onChange={e => setForm(p => ({ ...p, sizeSeriesId: e.target.value }))}>
                <option value="">Select series...</option>
                {series.map(s => <option key={s.id} value={s.id}>{s.name} ({s.sizes?.join(',')})</option>)}
              </select>
            </div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">Factory Price ($)</label><input type="number" placeholder="0" value={form.factoryPrice} onChange={e => setForm(p => ({ ...p, factoryPrice: e.target.value }))} /></div>
              <div className="form-group"><label className="form-label">Wholesale Price ($)</label><input type="number" placeholder="0" value={form.wholesalePrice} onChange={e => setForm(p => ({ ...p, wholesalePrice: e.target.value }))} /></div>
              <div className="form-group"><label className="form-label">Retail Price ($)</label><input type="number" placeholder="0" value={form.retailPrice} onChange={e => setForm(p => ({ ...p, retailPrice: e.target.value }))} /></div>
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setShowAdd(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={addModel} disabled={saving}>{saving ? 'Saving...' : 'Add Model'}</button>
            </div>
          </div>
        </div>
      )}
    </ErrorBoundary>
  );
}
