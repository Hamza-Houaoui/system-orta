import React, { useState, useEffect } from 'react';
import { Boxes, Search, Download, FileText } from 'lucide-react';
import db from '../core/db';
import { toast } from '../components/Toaster';
import { exportRowsToExcel } from '../core/exportExcel';
import { processTelegramQueue } from '../core/telegramPublisher';
import { escapeHtml } from '../toolbox/telegramFormatter';

const buildStockReport = (models) => {
  const blocks = [];
  for (const m of models) {
    const lines = [];
    lines.push(`━━━━━━━━━━━━━━━━━━━━━`);
    lines.push(`🐝 <b>${escapeHtml(m.code || 'Model')}</b>`);
    if (m.factoryName) lines.push(`🏭 ${escapeHtml(m.factoryName)}`);
    const prices = [];
    if (m.factoryPrice) prices.push(`F: $${m.factoryPrice}`);
    if (m.wholesalePrice) prices.push(`W: $${m.wholesalePrice}`);
    if (m.retailPrice) prices.push(`R: $${m.retailPrice}`);
    if (prices.length) lines.push(`💰 ${prices.join('  |  ')}`);
    if (m.sizes && m.sizes.length) lines.push(`📏 Sizes: ${m.sizes.map(escapeHtml).join(' · ')}`);

    let hasStock = false;
    for (const c of m.colors || []) {
      const total = c.total || 0;
      if (total <= 0) continue;
      hasStock = true;
      const stock = c.stock || [];
      const sizes = m.sizes || [];
      let fullSeriesCount = 0;
      let leftover = 0;
      if (sizes.length > 0) {
        const qtys = sizes.map(sz => {
          const o = stock.find(x => x.size === sz);
          return o ? (Number(o.qty) || 0) : 0;
        });
        fullSeriesCount = Math.min(...qtys);
        leftover = stock.reduce((s, x) => s + (Number(x.qty) || 0), 0) - fullSeriesCount * sizes.length;
      } else {
        leftover = total;
      }
      if (fullSeriesCount < 0) fullSeriesCount = 0;
      if (leftover < 0) leftover = 0;

      const seriesTxt = fullSeriesCount > 0 ? `<b>${fullSeriesCount} serie</b>` : '';
      const brokenTxt = leftover > 0 ? `<b>${leftover} broken</b>` : '';
      const detail = [seriesTxt, brokenTxt].filter(Boolean).join(' + ');
      lines.push(`🎨 <b>${escapeHtml(c.colorName || c.colorCode || 'Unknown')}</b>: ${detail}`);
    }

    if (hasStock) blocks.push(lines.join('\n'));
  }
  if (blocks.length === 0) return [];

  const chunks = [];
  let current = '';
  for (const block of blocks) {
    if (current && (current + '\n' + block).length > 3700) {
      chunks.push(current);
      current = block;
    } else {
      current = current ? current + '\n' + block : block;
    }
  }
  if (current) chunks.push(current);
  return chunks;
};

const ModelCellContent = ({ model }) => {
  const [url, setUrl] = useState(null);

  useEffect(() => {
    if (!model.mainAsset?.blob) return;
    const objectUrl = URL.createObjectURL(model.mainAsset.blob);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [model.mainAsset]);

  const bgImage = url ? `url(${url})` : 'none';

  return (
    <div style={{
      position: 'relative',
      display: 'flex',
      flexDirection: 'column',
      padding: '16px 12px',
      overflow: 'hidden',
      height: '100%',
      minHeight: '160px',
      justifyContent: 'flex-end'
    }}>
      {/* Base Layer: Sharp Image or Video */}
      {url ? (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 0 }}>
          {model.mainAsset.type === 'video' ? (
            <video src={url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} muted loop autoPlay />
          ) : (
            <img src={url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="bg" />
          )}
        </div>
      ) : (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 0, background: 'var(--surface3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Boxes size={32} color="var(--text-muted)" />
        </div>
      )}

      {/* Blur Layer: Blurs only the edges */}
      {url && (
        <div style={{
          position: 'absolute',
          top: 0, left: 0, right: 0, bottom: 0,
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          WebkitMaskImage: 'radial-gradient(circle at center, transparent 40%, black 90%)',
          maskImage: 'radial-gradient(circle at center, transparent 40%, black 90%)',
          zIndex: 1
        }} />
      )}
      
      {/* Dark Vignette: Darkens edges for text readability */}
      <div style={{
        position: 'absolute',
        top: 0, left: 0, right: 0, bottom: 0,
        background: 'radial-gradient(circle at center, rgba(15,15,15,0) 20%, rgba(15,15,15,0.95) 90%)',
        zIndex: 2
      }} />
      
      {/* Top Left: Code & Sizes (Absolute) */}
      <div style={{ position: 'absolute', top: 8, left: 8, zIndex: 4, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span className="badge" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', color: 'var(--gold)', fontSize: '1.1rem', fontWeight: 'bold', border: '1px solid rgba(212,175,55,0.3)', textShadow: '0 1px 2px rgba(0,0,0,0.8)', alignSelf: 'flex-start' }}>
          {model.code}
        </span>
        {model.sizes && model.sizes.length > 0 && (
          <span style={{ fontSize: '0.65rem', color: '#bbb', fontWeight: 400, textShadow: '0 1px 2px rgba(0,0,0,1)', paddingLeft: 4, letterSpacing: '0.5px' }}>
            {model.sizes.join(' - ')}
          </span>
        )}
      </div>

      {/* Bottom Right: Prices (Absolute) */}
      <div style={{ position: 'absolute', bottom: 8, right: 8, zIndex: 4 }}>
        <div className="model-prices" style={{ display: 'flex', gap: 3, flexWrap: 'wrap', justifyContent: 'flex-end', maxWidth: '120px' }}>
          <span className="price-tag price-factory" style={{ fontSize: '0.45rem', padding: '1px 3px', opacity: 0.9, background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(4px)', borderColor: 'transparent', textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}>F: ${model.factoryPrice}</span>
          <span className="price-tag price-wholesale" style={{ fontSize: '0.5rem', padding: '1px 4px', background: 'rgba(16, 185, 129, 0.25)', backdropFilter: 'blur(4px)', borderColor: 'rgba(16, 185, 129, 0.4)', textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}>W: ${model.wholesalePrice}</span>
          <span className="price-tag price-retail" style={{ fontSize: '0.5rem', padding: '1px 4px', background: 'rgba(59, 130, 246, 0.25)', backdropFilter: 'blur(4px)', borderColor: 'rgba(59, 130, 246, 0.4)', textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}>R: ${model.retailPrice}</span>
        </div>
      </div>

      {/* Bottom Left: Factory Name (Absolute) */}
      <div style={{ position: 'absolute', bottom: 8, left: 8, zIndex: 4, maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        <span className="text-sm" style={{ color: 'var(--text-sec)', textShadow: '0 1px 4px rgba(0,0,0,1)', fontWeight: 500 }} title={model.factoryName}>{model.factoryName}</span>
      </div>

      {/* Content Overlay */}
      <div style={{ position: 'relative', zIndex: 3, display: 'flex', flexDirection: 'column', height: '100%', width: '100%' }}>
      </div>
    </div>
  );
};

export default function StockScreen() {
  const [models, setModels] = useState([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadStock(); }, []);

  const handleExport = () => {
    const rows = [['Model Code', 'Factory', 'Color', 'Total Stock', 'Sizes Detail', 'Factory Price', 'Wholesale Price', 'Retail Price']];
    models.forEach(m => {
      if (!m.colors || m.colors.length === 0) {
        rows.push([m.code || '', m.factoryName || '', '', 0, '', m.factoryPrice, m.wholesalePrice, m.retailPrice]);
      } else {
        m.colors.forEach(c => {
          const sizesDetail = (c.stock || []).map(s => `${s.size}:${s.qty}`).join(' | ');
          rows.push([m.code || '', m.factoryName || '', c.name || '', c.total, sizesDetail, m.factoryPrice, m.wholesalePrice, m.retailPrice]);
        });
      }
    });
    exportRowsToExcel(`stock_report_${Date.now()}.xlsx`, rows);
    toast.success('Exported stock to Excel');
  };

  const handleReport = async () => {
    const chunks = buildStockReport(models);
    if (chunks.length === 0) {
      toast.error('No stock data to report');
      return;
    }
    const ts = Date.now();
    for (let i = 0; i < chunks.length; i++) {
      let text = chunks[i];
      if (chunks.length > 1) {
        const header = `📊 <b>STOCK REPORT</b>  (${i + 1}/${chunks.length})\n━━━━━━━━━━━━━━━━━━━━━\n`;
        text = header + text + `\n🐝 System Orta`;
      } else {
        const header = `📊 <b>STOCK REPORT</b>\n━━━━━━━━━━━━━━━━━━━━━\n`;
        text = header + text + `\n━━━━━━━━━━━━━━━━━━━━━\n🐝 System Orta`;
      }
      await db.telegramQueue.add({
        chatIdKey: 'liveStockChatId',
        type: 'text',
        status: 'pending',
        text,
        refId: `stock_report_${ts}_${i}`,
        createdAt: Date.now(),
        attemptCount: 0,
      });
    }
    setTimeout(() => processTelegramQueue().catch(() => {}), 100);
    toast.success(`Stock report sent (${chunks.length} message${chunks.length > 1 ? 's' : ''})`);
  };

  const loadStock = async () => {
    setLoading(true);
    try {
      const colors = await db.modelColors.toArray();
      const catalog = await db.catalog.toArray();
      const allColors = await db.colors.toArray();
      const colorMap = Object.fromEntries(allColors.map(c => [c.id, c]));
      const allSeries = await db.sizeSeries.toArray();
      const seriesMap = Object.fromEntries(allSeries.map(s => [s.id, s.sizes || []]));
      const allFactories = await db.factories.toArray();
      const factoryMap = Object.fromEntries(allFactories.map(f => [f.id, f.name]));

      const modelsMap = {};
      for (const cat of catalog) {
        modelsMap[cat.id] = { 
          id: cat.id, 
          code: cat.code, 
          factoryName: factoryMap[cat.factoryId] || 'Unknown',
          factoryPrice: cat.factoryPrice || 0,
          wholesalePrice: cat.wholesalePrice || 0,
          retailPrice: cat.retailPrice || 0,
          sizes: seriesMap[cat.sizeSeriesId] || [],
          colors: [], 
          totalStock: 0,
          mainAsset: null
        };
      }

      for (const mc of colors) {
        if (!modelsMap[mc.catalogId]) continue;
        
        const col = colorMap[mc.colorId] || {};
        const stock = mc.stock || [];
        const total = stock.reduce((s, x) => s + (x.qty || 0), 0);
        
        // Grab the first available asset for the model
        if (!modelsMap[mc.catalogId].mainAsset && mc.assets && mc.assets.length > 0) {
          modelsMap[mc.catalogId].mainAsset = mc.assets[0];
        }

        const modelSizes = modelsMap[mc.catalogId].sizes;
        let isBroken = false;
        if (total > 0 && modelSizes.length > 0) {
          const qtys = modelSizes.map(sz => {
            const s = stock.find(x => x.size === sz);
            return s ? (s.qty || 0) : 0;
          });
          const firstQty = qtys[0];
          const allSame = qtys.every(q => q === firstQty);
          isBroken = !allSame;
        }

        modelsMap[mc.catalogId].colors.push({
          ...mc, 
          colorName: col.name, 
          hex: col.hex, 
          total,
          isBroken
        });
        modelsMap[mc.catalogId].totalStock += total;
      }

      const rows = Object.values(modelsMap).filter(m => m.colors.length > 0);
      setModels(rows);
    } catch(e) { console.error(e); }
    setLoading(false);
  };

  const filtered = q ? models.filter(m =>
    m.code?.toLowerCase().includes(q.toLowerCase()) ||
    m.colors.some(c => c.colorName?.toLowerCase().includes(q.toLowerCase()))
  ) : models;

  return (
    <div className="page-container fade-in">
      <div className="page-header">
        <div className="page-title"><Boxes size={22} /> STOCK</div>
        <div className="page-actions">
          <div className="search-wrap">
            <Search size={15} className="search-icon" />
            <input className="search-input" placeholder="Model code or color..." value={q} onChange={e => setQ(e.target.value)} style={{ width: 240 }} />
          </div>
          <button className="btn btn-secondary btn-sm" onClick={handleReport}><FileText size={14} /> RAPORT</button>
          <button className="btn btn-secondary btn-sm" onClick={handleExport}><Download size={14} /> Export Excel</button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingBottom: 40 }}>
        {loading ? (
          <div style={{ textAlign:'center', color:'var(--text-muted)', padding:40 }}>Loading...</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign:'center', color:'var(--text-muted)', padding:40 }}>No stock data found</div>
        ) : filtered.map(model => (
          <div key={model.id} style={{ 
            background: 'var(--surface-light)', borderRadius: 16, 
            border: '1px solid rgba(212, 175, 55, 0.4)', padding: 16, 
            display: 'flex', gap: 20, flexWrap: 'wrap',
            boxShadow: '0 4px 20px rgba(0,0,0,0.2)'
          }}>
            {/* Left side: Model Info & Photo */}
            <div style={{ width: 220, flexShrink: 0, borderRight: '1px solid var(--border)', paddingRight: 20 }}>
              <ModelCellContent model={model} />
            </div>
            
            {/* Right side: Colors Grid */}
            <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12, alignContent: 'start', minWidth: 280 }}>
              {model.colors.map(c => (
                <div key={c.id} style={{ 
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', 
                  padding: '12px', 
                  background: c.hex ? `linear-gradient(to right, ${c.hex}25 0%, transparent 70%), var(--surface)` : 'var(--surface)', 
                  borderRadius: 10, border: '1px solid var(--border)'
                }}>
                  {/* Color Info */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {c.hex && <div style={{ width: 14, height: 14, borderRadius: '50%', background: c.hex, border: '1px solid rgba(255,255,255,0.2)' }} />}
                      <span className="text-bold" style={{ fontSize: '0.95rem' }}>{c.colorName}</span>
                    </div>
                    {c.isBroken && (
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {(c.stock || []).map(s => (
                          <span key={s.size} className="badge badge-gray" style={{ fontSize: '0.7rem', padding: '2px 4px' }}>
                            {s.size}: <strong style={{ color: s.qty > 0 ? 'var(--green)' : 'var(--text-muted)' }}>{s.qty}</strong>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  {/* Qty & Status */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div className="text-bold" style={{ fontSize: '1.2rem', color: 'var(--gold)' }}>{c.total}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      {c.total > 0 ? (
                        <div style={{ width: 12, height: 12, borderRadius: '50%', background: 'var(--green)', boxShadow: '0 0 8px var(--green)' }} title="In Stock" />
                      ) : (
                        <div style={{ width: 12, height: 12, borderRadius: '50%', background: 'var(--red)', boxShadow: '0 0 8px var(--red)' }} title="Empty" />
                      )}
                      {c.isBroken && (
                        <div style={{ width: 12, height: 12, borderRadius: '50%', background: 'var(--orange)', boxShadow: '0 0 8px var(--orange)' }} title="Broken Series" />
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
