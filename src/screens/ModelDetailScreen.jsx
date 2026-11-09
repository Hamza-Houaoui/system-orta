import { isWatcherDevice } from '../core/deviceSync';
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Store, ChevronLeft, Upload, Trash2, Image as ImageIcon, Video, Plus, Minus, Save, Edit2 } from 'lucide-react';
import ErrorBoundary from '../components/ErrorBoundary';
import { toast } from '../components/Toaster';
import { v4 as uuidv4 } from 'uuid';
import Barcode from 'react-barcode';
import { Logger } from '../core/logger';
import db from '../core/db';
import { onStockChanged, forceResendModel } from '../core/telegramPublisher';
import { loadTelegramMedia } from '../core/telegramMedia';
import { getSettings } from '../core/store';
import { Capacitor } from '@capacitor/core';

const Toggle = ({ label, active, onChange }) => (
  <button
    onClick={onChange}
    style={{
      display: 'flex', alignItems: 'center', gap: 6, padding: '4px 12px',
      borderRadius: 16, cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700,
      border: active ? '1px solid var(--gold)' : '1px solid var(--border)',
      background: active ? 'rgba(212,175,55,0.2)' : 'var(--surface2)',
      color: active ? 'var(--gold)' : 'var(--text-muted)',
      transition: 'all 0.2s',
    }}
  >
    <div style={{ width: 8, height: 8, borderRadius: '50%', background: active ? 'var(--gold)' : 'var(--text-muted)' }} />
    {label}
  </button>
);

export default function ModelDetailScreen() {
  const navigate = useNavigate();
  const { id } = useParams();
  
  const [model, setModel] = useState(null);
  const [colors, setColors] = useState([]);
  const [allColors, setAllColors] = useState([]);
  const [series, setSeries] = useState(null);
  
  const [activeColorId, setActiveColorId] = useState(null);
  const [showAddColor, setShowAddColor] = useState(false);
  const [newColorId, setNewColorId] = useState('');
  
  // Media handling
  const [objectUrls, setObjectUrls] = useState({}); // To cleanup ObjectURLs
  const [downloadingAssets, setDownloadingAssets] = useState({});
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    load();
    return () => {
      // Cleanup ObjectURLs on unmount
      Object.values(objectUrls).forEach(url => URL.revokeObjectURL(url));
    };
  }, [id]);

  const load = async () => {
    try {
      const cat = await db.catalog.get(id);
      if (!cat) { navigate('/models'); return; }
      
      const factory = await db.factories.get(cat.factoryId);
      const ser = cat.sizeSeriesId ? await db.sizeSeries.get(cat.sizeSeriesId) : null;
      setModel({ ...cat, factory });
      setSeries(ser);

      const mColors = await db.modelColors.where('catalogId').equals(id).toArray();
      const dbColors = await db.colors.toArray();
      setAllColors(dbColors);
      
      const enrichedColors = mColors.map(mc => {
        const cDef = dbColors.find(c => c.id === mc.colorId) || {};
        return { ...mc, name: cDef.name || mc.colorCode, hex: cDef.hex };
      });
      
      setColors(enrichedColors);
      if (enrichedColors.length > 0 && !activeColorId) {
        setActiveColorId(enrichedColors[0].id);
      }
    } catch (e) {
      Logger.error('models', 'loadDetail', e.message);
    }
  };

  const togglePublish = async (field) => {
    try {
      const newVal = !model[field];
      await db.catalog.update(id, { [field]: newVal });
      setModel(prev => ({ ...prev, [field]: newVal }));
      toast.success(`${field} sync ${newVal ? 'enabled' : 'disabled'}`);
    } catch (e) {
      toast.error('Failed to update sync setting');
    }
  };

  const addColorToModel = async () => {
    if (!newColorId) return;
    try {
      const cDef = allColors.find(c => c.id === newColorId);
      if (!cDef) return;
      
      // Check if already exists
      if (colors.some(c => c.colorId === newColorId)) {
        toast.warning('Color already added to this model');
        return;
      }

      const mcId = crypto.randomUUID();
      const newMc = {
        id: mcId,
        catalogId: id,
        colorId: newColorId,
        colorCode: cDef.code,
        stock: (series?.sizes || []).map(size => ({ size, qty: 0 })),
        assets: []
      };

      await db.modelColors.add(newMc);
      toast.success(`${cDef.name} added`);
      setShowAddColor(false);
      setNewColorId('');
      
      // Deferred: Live Stock is updated on Save (avoid premature sends)
      
      load();
      setActiveColorId(mcId);
    } catch (e) {
      toast.error('Failed to add color');
      Logger.error('models', 'addColor', e.message);
    }
  };

  const handleFileUpload = async (e, colorId) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    try {
      const mc = await db.modelColors.get(colorId);
      const newAssets = [...(mc.assets || [])];

      for (const file of files) {
        const type = file.type.startsWith('video/') ? 'video' : 'image';
        const assetId = crypto.randomUUID();
        newAssets.push({
          id: assetId,
          type,
          name: file.name,
          blob: file, 
          addedAt: Date.now(),
          dispatched: false
        });
      }

      await db.modelColors.update(colorId, { assets: newAssets });

      toast.success(`${files.length} files added (not sent yet — press Save to publish)`);
      load();
    } catch (err) {
      toast.error('Failed to upload files');
      Logger.error('models', 'upload', err.message);
    }
    
    e.target.value = '';
  };

  const deleteAsset = async (colorId, assetId) => {
    if (!confirm('Delete this media?')) return;
    try {
      const mc = await db.modelColors.get(colorId);
      const newAssets = (mc.assets || []).filter(a => a.id !== assetId);
      await db.modelColors.update(colorId, { assets: newAssets });
      toast.success('Media deleted');
      load();
    } catch (err) {
      toast.error('Failed to delete media');
    }
  };

  const updateStock = async (colorId, size, newQty) => {
    try {
      const qty = parseInt(newQty) || 0;
      let changed = false;
      
      await db.transaction('rw', [db.modelColors, db.stockLog], async () => {
        const mc = await db.modelColors.get(colorId);
        const stock = [...(mc.stock || [])];
        const oldQty = stock.find(s => s.size === size)?.qty || 0;
        
        if (qty === oldQty) return;
        changed = true;
        
        const sIdx = stock.findIndex(s => s.size === size);
        if (sIdx >= 0) stock[sIdx].qty = qty;
        else stock.push({ size, qty });

        await db.modelColors.update(colorId, { stock });

        const colorDef = colors.find(c => c.id === colorId);
        const changeQty = qty - oldQty;
        const newBalance = stock.reduce((s, x) => s + (parseInt(x.qty) || 0), 0);
        
        await db.stockLog.add({
          id: crypto.randomUUID(),
          date: Date.now(),
          type: 'manual',
          ref: `Manual: ${model.code}`,
          catalogCode: model.code,
          colorName: colorDef?.name || mc.colorCode || '',
          change: changeQty,
          sizesChanged: { [size]: changeQty },
          balance: newBalance
        });
      });
      
      if (changed) {
        // Deferred: Live Stock update happens on Save (avoid flooding the bot)
        load();
      }
    } catch (e) {
      toast.error('Failed to update stock');
    }
  };

  const bulkAdjustStock = async (colorId, delta) => {
    try {
      const mc = await db.modelColors.get(colorId);
      const stock = [...(mc.stock || [])];
      
      const sizesToUpdate = series?.sizes || [];
      if (sizesToUpdate.length === 0) return;

      const sizesChanged = {};
      let totalChange = 0;
      
      sizesToUpdate.forEach(size => {
        const oldQty = stock.find(s => s.size === size)?.qty || 0;
        const newQty = Math.max(0, parseInt(oldQty) + delta);
        
        const sIdx = stock.findIndex(s => s.size === size);
        if (sIdx >= 0) stock[sIdx].qty = newQty;
        else stock.push({ size, qty: newQty });
        
        const change = newQty - oldQty;
        if (change !== 0) {
          sizesChanged[size] = change;
          totalChange += change;
        }
      });

      if (totalChange === 0) return;

      await db.modelColors.update(colorId, { stock });

      const colorDef = colors.find(c => c.id === colorId);
      const newBalance = stock.reduce((s, x) => s + (parseInt(x.qty) || 0), 0);
      
      await db.stockLog.add({
        id: crypto.randomUUID(),
        date: Date.now(),
        type: 'manual',
        ref: `Bulk Adjust: ${model.code}`,
        catalogCode: model.code,
        colorName: colorDef?.name || mc.colorCode || '',
        change: totalChange,
        sizesChanged,
        balance: newBalance
      });

      // Deferred: Live Stock update happens on Save (avoid flooding the bot)
      load();
      toast.success(`Adjusted ${delta > 0 ? '+' : ''}${delta} for all sizes`);
    } catch (e) {
      toast.error('Failed to bulk adjust stock');
    }
  };

  const syncModel = async () => {
    if (!model) return;
    setSyncing(true);
    try {
      const mColors = await db.modelColors.where('catalogId').equals(id).toArray();

      // 1) Archive any unsent local media + publish to display channels
      for (const mc of mColors) {
        const assets = (mc.assets && Array.isArray(mc.assets)) ? mc.assets : [];
        const pending = assets.filter(a => a.blob && !a.dispatched);
        if (pending.length === 0) continue;

        for (const asset of pending) {
          const type = asset.type === 'video' ? 'video' : 'photo';
          await db.telegramQueue.add({
            priority: 2,
            type,
            status: 'pending',
            createdAt: Date.now(),
            attemptCount: 0,
            chatIdKey: 'archiveChatId',
            caption: `👗 <b>Model:</b> ${model.code}\n🎨 <b>Color:</b> ${mc.colorName || mc.colorCode || ''}\n🏭 <b>Factory:</b> ${model.factory?.name || model.factoryId || 'Unknown'}\n💰 <b>Wholesale:</b> $${model.wholesalePrice || 0} | 🏭 <b>Factory:</b> $${model.factoryPrice || 0}`,
            fileName: asset.name || (asset.blob && asset.blob.name) || 'media',
            blob: asset.blob,
            modelColorId: mc.id,
            assetId: asset.id
          });
          asset.dispatched = true;
        }
        await db.modelColors.update(mc.id, { assets });
      }

      // 2) Update Live Stock once (reflects new colors + stock changes)
      await onStockChanged(id);

      setSyncing(false);
      toast.success('Saved & published to Telegram');
    } catch (e) {
      setSyncing(false);
      toast.error('Save failed: ' + e.message);
      Logger.error('models', 'sync', e.message);
    }
  };

  const updateLink = async (colorId, newLink) => {
    try {
      await db.modelColors.update(colorId, { link: newLink });
      setColors(prev => prev.map(c => c.id === colorId ? { ...c, link: newLink } : c));
      toast.success('Link saved');
    } catch (e) {
      toast.error('Failed to update link');
    }
  };

  // Generate URL for blobs safely and trigger lazy loading
  const loadTelegramMediaLocal = async (asset, colorId) => {
    if (downloadingAssets[asset.id]) return;
    setDownloadingAssets(prev => ({ ...prev, [asset.id]: true }));
    
    const blob = await loadTelegramMedia(asset, colorId);
    
    if (blob) {
       // Update React state directly to avoid full reload
       const mc = await db.modelColors.get(colorId);
       setColors(prev => prev.map(c => c.id === colorId ? { ...c, assets: mc.assets } : c));
       setDownloadingAssets(prev => ({ ...prev, [asset.id]: false }));
    } else {
       setDownloadingAssets(prev => ({ ...prev, [asset.id]: 'failed' }));
    }
  };

  const getAssetUrl = (asset, colorId) => {
    if (asset.blob) {
      if (objectUrls[asset.id]) return objectUrls[asset.id];
      const url = URL.createObjectURL(asset.blob);
      setObjectUrls(prev => ({ ...prev, [asset.id]: url }));
      return url;
    }
    
    // If no blob but has fileId, start lazy loading
    if (asset.fileId && downloadingAssets[asset.id] !== true && downloadingAssets[asset.id] !== 'failed') {
       loadTelegramMedia(asset, colorId);
    }
    return ''; // Loading placeholder or empty string
  };

  if (!model) return <div className="loading-screen"><div className="spin" style={{ width: 30, height: 30, border: '3px solid var(--gold)', borderTopColor: 'transparent', borderRadius: '50%' }} /></div>;

  const activeColor = colors.find(c => c.id === activeColorId);

  return (
    <ErrorBoundary room="model-detail">
      <div className="page-container fade-in">
        {/* ── Header ────────────────────────────────────────── */}
        <div className="page-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button className="btn btn-secondary btn-icon" onClick={() => navigate('/models')}><ChevronLeft size={18}/></button>
            <div>
              <div className="page-title">{model.code}</div>
              <div className="text-muted text-sm">{model.factory?.name || 'No Factory'}</div>
            </div>
          </div>
          <div className="page-actions">
            <div style={{ display: 'flex', gap: 8, marginRight: 16, alignItems: 'center', borderRight: '1px solid var(--border)', paddingRight: 16 }}>
              <Toggle label="W" active={!!model.publishedWholesale} onChange={() => togglePublish('publishedWholesale')} />
              <Toggle label="S" active={!!model.publishedSales} onChange={() => togglePublish('publishedSales')} />
              <Toggle label="R" active={!!model.publishedRetail} onChange={() => togglePublish('publishedRetail')} />
            </div>
            <button 
              className="btn btn-success btn-sm" 
              style={{ marginRight: 8 }}
              onClick={syncModel}
              disabled={syncing}
            >
              <Save size={14}/> {syncing ? 'Saving...' : 'Save & Publish'}
            </button>
            <button 
              className="btn btn-secondary btn-sm" 
              style={{ marginRight: 8, color: 'var(--blue)', borderColor: 'var(--blue)' }}
              onClick={async () => {
                await forceResendModel(model.id);
                toast.success('Queued full resync for ' + model.code);
              }}
            >
              <Upload size={14}/> Resend
            </button>
            {!isWatcherDevice() && (
            <button className="btn btn-primary btn-sm" onClick={() => {
              const f = prompt('Factory Price:', model.factoryPrice || 0);
              if (f === null) return;
              const w = prompt('Wholesale Price:', model.wholesalePrice || 0);
              if (w === null) return;
              const r = prompt('Retail Price:', model.retailPrice || 0);
              if (r === null) return;
              const d = prompt('Discount (0 for none):', model.discount || 0);
              if (d === null) return;
              
              db.catalog.update(model.id, {
                factoryPrice: parseFloat(f) || 0,
                wholesalePrice: parseFloat(w) || 0,
                retailPrice: parseFloat(r) || 0,
                discount: parseFloat(d) || 0,
                onSale: (parseFloat(d) || 0) > 0
              }).then(() => {
                toast.success('Prices updated');
                load();
                onStockChanged(model.id);
              });
            }}><Edit2 size={14}/> Edit Prices</button>
          )}
          </div>
        </div>

        {/* ── Prices & Info ─────────────────────────────────── */}
        <div className="grid-4" style={{ marginBottom: 20 }}>
          <div className="stat-card">
            <div className="stat-label">Factory Price</div>
            <div className="stat-value text-muted">${model.factoryPrice}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Wholesale Price</div>
            <div className="stat-value green">${model.wholesalePrice}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Retail Price</div>
            <div className="stat-value" style={{color: 'var(--blue)'}}>${model.retailPrice}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Size Series</div>
            <div className="stat-value text-gold" style={{ fontSize: '1.1rem' }}>
              {series ? series.name : 'No Series'}
            </div>
            <div className="text-xs text-muted mt-4">
              {series?.sizes?.join(' - ')}
            </div>
          </div>
        </div>

        {/* ── Colors Tabs ──────────────────────────────────── */}
        <div className="text-gold text-bold" style={{ marginBottom: 12 }}>MODEL COLORS & MEDIA</div>
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
          {colors.map(c => (
            <button
              key={c.id}
              onClick={() => setActiveColorId(c.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderRadius: 20, cursor: 'pointer',
                border: activeColorId === c.id ? '2px solid var(--gold)' : '1px solid var(--border)',
                background: activeColorId === c.id ? 'rgba(212,175,55,0.15)' : 'var(--surface)',
                color: activeColorId === c.id ? 'var(--gold)' : 'var(--text)',
                fontWeight: 600, fontSize: '0.85rem'
              }}
            >
              {c.hex && <div style={{ width: 14, height: 14, borderRadius: '50%', background: c.hex, border: '1px solid rgba(255,255,255,0.3)' }} />}
              {c.name}
            </button>
          ))}
          {!isWatcherDevice() && (
            <button
              onClick={() => setShowAddColor(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 20, cursor: 'pointer',
                border: '1px dashed var(--border-gold)', background: 'transparent', color: 'var(--gold)',
                fontWeight: 600, fontSize: '0.85rem'
              }}
            >
              <Plus size={14} /> Add Color
            </button>
          )}
        </div>

        {/* ── Active Color Workspace ───────────────────────── */}
        {activeColor ? (
          <>
          <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            
            {/* Left: Media Gallery */}
            <div className="card" style={{ flex: '1 1 400px', marginTop: 24, background: activeColor.hex ? `linear-gradient(to right, ${activeColor.hex}25 0%, transparent 70%), var(--surface)` : 'var(--surface)' }}>
              <div className="flex-between" style={{ marginBottom: 16 }}>
                <div className="form-label" style={{ margin: 0 }}>MEDIA ASSETS</div>
                <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer' }}>
                  <Upload size={14}/> Upload Photos/Videos
                  <input type="file" multiple accept="image/*,video/*" style={{ display: 'none' }} onChange={(e) => handleFileUpload(e, activeColor.id)} />
                </label>
              </div>

              {(activeColor.assets || []).length === 0 ? (
                <div className="empty-state" style={{ padding: '40px 20px', background: 'var(--surface2)', borderRadius: 8 }}>
                  <ImageIcon size={32} />
                  <div style={{ fontWeight: 600, marginTop: 8 }}>No media uploaded</div>
                  <div className="text-sm text-muted">Upload photos or videos for {activeColor.name}</div>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12 }}>
                  {(activeColor.assets || []).map(asset => (
                    <div key={asset.id} style={{ position: 'relative', borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)', aspectRatio: '3/4', background: '#000' }}>
                      {downloadingAssets[asset.id] && !asset.blob && (
                         <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <div className="spin" style={{ width: 20, height: 20, border: '2px solid var(--gold)', borderTopColor: 'transparent', borderRadius: '50%' }} />
                         </div>
                      )}
                      {asset.type === 'video' ? (
                        <video src={getAssetUrl(asset, activeColor.id)} style={{ width: '100%', height: '100%', objectFit: 'cover', display: asset.blob ? 'block' : 'none' }} controls controlsList="nodownload" />
                      ) : (
                        <img src={getAssetUrl(asset, activeColor.id)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: asset.blob ? 'block' : 'none' }} />
                      )}
                      <button
                        onClick={() => deleteAsset(activeColor.id, asset.id)}
                        style={{
                          position: 'absolute', top: 4, right: 4, background: 'rgba(239,68,68,0.8)', color: 'white',
                          border: 'none', borderRadius: '50%', width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer'
                        }}
                      >
                        <Trash2 size={12} />
                      </button>
                      {asset.type === 'video' && <Video size={16} color="white" style={{ position: 'absolute', bottom: 6, left: 6, filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.8))' }} />}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Right Side Controls */}
            <div style={{ flex: '0 0 300px', display: 'flex', flexDirection: 'column', gap: 20 }}>
              
              {/* Color Link */}
              <div className="card" style={{ background: activeColor.hex ? `linear-gradient(to right, ${activeColor.hex}25 0%, transparent 70%), var(--surface)` : 'var(--surface)' }}>
                <div className="form-label" style={{ marginBottom: 12 }}>COLOR LINK</div>
                <div className="text-muted text-xs" style={{ marginBottom: 10 }}>Add a specific Telegram or external link for this color.</div>
                <input
                  type="text"
                  placeholder="https://t.me/..."
                  defaultValue={activeColor.link || ''}
                  onBlur={(e) => updateLink(activeColor.id, e.target.value)}
                  style={{ width: '100%' }}
                />
              </div>

              {/* Manual Stock Control */}
              {!isWatcherDevice() && (
              <div className="card" style={{ background: activeColor.hex ? `linear-gradient(to right, ${activeColor.hex}25 0%, transparent 70%), var(--surface)` : 'var(--surface)' }}>
              <div className="form-label" style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>MANUAL STOCK ADJUSTMENT</span>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="btn btn-secondary btn-sm btn-icon" onClick={() => bulkAdjustStock(activeColor.id, -1)} title="Decrease all sizes by 1"><Minus size={14}/></button>
                  <button className="btn btn-primary btn-sm btn-icon" onClick={() => bulkAdjustStock(activeColor.id, 1)} title="Increase all sizes by 1"><Plus size={14}/></button>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {(series?.sizes || []).map(size => {
                  const qty = (activeColor.stock || []).find(s => s.size === size)?.qty || 0;
                  return (
                    <div key={size} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--surface2)', borderRadius: 8, border: '1px solid var(--border)' }}>
                      <div className="text-bold" style={{ fontSize: '1.1rem' }}>Size {size}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <input
                          key={`${activeColor.id}-${size}-${qty}`}
                          type="number"
                          defaultValue={qty}
                          disabled={isWatcherDevice()}
                          onBlur={(e) => updateStock(activeColor.id, size, e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); }}
                          style={{ width: 80, textAlign: 'center', fontSize: '1.1rem', fontWeight: 700 }}
                        />
                        <span className="text-muted text-xs">pcs</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            )}

            </div>
          </div>

          <div className="card" style={{ marginTop: 24, marginBottom: 20, width: 'fit-content', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'center', background: '#fff', padding: '18px 24px 14px' }}>
             <div className="text-muted" style={{ marginBottom: 8, fontSize: '0.85rem' }}>SCAN BARCODE FOR THIS COLOR</div>
             <Barcode value={`${model.code}${activeColor.colorCode || ''}`.toUpperCase()} height={44} width={1.5} fontSize={9} margin={0} />
          </div>
          </>
        ) : (
          <div className="empty-state" style={{ marginTop: 40 }}>
            <Store size={48} />
            <h3>No colors added</h3>
            <p>Add a color to this model to manage media and stock.</p>
          </div>
        )}
      </div>

      {/* Add Color Modal */}
      {showAddColor && (
        <div className="modal-overlay" onClick={() => setShowAddColor(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="modal-title"><Plus size={16}/> Add Color to {model.code}</div>
            <div className="form-group">
              <label className="form-label">Select Color</label>
              {allColors.length === 0 ? (
                <div style={{ padding: 12, textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', background: 'var(--surface2)', borderRadius: 8 }}>No colors defined yet</div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, maxHeight: 260, overflowY: 'auto' }}>
                  {allColors.map(c => {
                    const already = colors.some(existing => existing.colorId === c.id);
                    const selected = newColorId === c.id;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        disabled={already}
                        onClick={() => setNewColorId(c.id)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px',
                          borderRadius: 10, cursor: already ? 'not-allowed' : 'pointer',
                          background: selected ? 'rgba(212,175,55,0.12)' : (c.hex ? `linear-gradient(to right, ${c.hex}18 0%, transparent 70%), var(--surface)` : 'var(--surface)'),
                          border: already ? '1px solid var(--border)' : selected ? '1px solid var(--gold)' : '1px solid var(--border)',
                          opacity: already ? 0.45 : 1, textAlign: 'left'
                        }}
                      >
                        <div style={{ width: 14, height: 14, borderRadius: '50%', background: c.hex || '#ccc', border: '1px solid rgba(255,255,255,0.25)', flexShrink: 0 }} />
                        <div style={{ fontSize: '0.82rem', color: 'var(--text)', lineHeight: 1.15 }}>
                          <div>{c.name}</div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{c.code}{already ? ' — already added' : ''}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setShowAddColor(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={addColorToModel}>Add Color</button>
            </div>
          </div>
        </div>
      )}
    </ErrorBoundary>
  );
}
