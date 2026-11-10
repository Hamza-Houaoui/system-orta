import React, { useState, useEffect } from 'react';
import { X, FileText, RotateCcw, Building2 } from 'lucide-react';
import db from '../core/db';
import { Logger } from '../core/logger';

const HistoryModelCell = ({ asset, code }) => {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    if (!asset?.blob) return;
    const objectUrl = URL.createObjectURL(asset.blob);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [asset]);

  return (
    <div style={{
      position: 'relative', display: 'flex', flexDirection: 'column',
      padding: '8px', overflow: 'hidden', height: '80px', width: '120px',
      justifyContent: 'center', borderRadius: 8,
      border: '1px solid var(--border)', boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
    }}>
      {url ? (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 0 }}>
          {asset.type === 'video' ? (
            <video src={url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} muted loop autoPlay />
          ) : (
            <img src={url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="bg" />
          )}
        </div>
      ) : (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 0, background: 'var(--surface3)' }} />
      )}
      {url && <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1 }} />}
      <div style={{ position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100%', gap: 6 }}>
        <span className="badge" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', color: 'var(--gold)', fontSize: '1.1rem', fontWeight: 'bold', border: '1px solid rgba(212,175,55,0.4)', textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}>
          {code}
        </span>
        {!url && <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 500 }}>No Image</span>}
      </div>
    </div>
  );
};

export default function FactoryInvoiceDetailModal({ invoice, factory, onClose }) {
  const [itemsWithAssets, setItemsWithAssets] = useState([]);

  useEffect(() => {
    if (!invoice?.items) return;
    
    const fetchAssets = async () => {
      const enriched = await Promise.all(invoice.items.map(async (item) => {
        let photo = null;
        if (item.catalogCode) {
          try {
            const cat = await db.catalog.where('code').equals(item.catalogCode.toUpperCase()).first();
            if (cat) {
              const mcs = await db.modelColors.where('catalogId').equals(cat.id).toArray();
              if (cat.assets && cat.assets.length > 0) photo = cat.assets[0];
              else {
                for (const mc of mcs) {
                  if (mc.assets && mc.assets.length > 0) { photo = mc.assets[0]; break; }
                }
              }
            }
          } catch (e) {
            Logger.error('factories', 'fetchAsset', e.message);
          }
        }
        return { ...item, photo };
      }));
      setItemsWithAssets(enriched);
    };
    fetchAssets();
  }, [invoice]);

  if (!invoice) return null;

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1000 }}>
      <div className="modal-box modal-box-lg" style={{ position: 'relative', overflowY: 'auto', overflowX: 'hidden', maxHeight: '90vh' }} onClick={e => e.stopPropagation()}>
        
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 0,
          background: invoice.type === 'in' ? 'linear-gradient(to right, rgba(239, 68, 68, 0.15), transparent 70%)' 
                    : invoice.type === 'return' ? 'linear-gradient(to right, rgba(245, 158, 11, 0.15), transparent 70%)'
                    : invoice.type === 'payment' ? 'linear-gradient(to right, rgba(16, 185, 129, 0.15), transparent 70%)'
                    : 'linear-gradient(to right, rgba(59, 130, 246, 0.15), transparent 70%)',
          pointerEvents: 'none'
        }} />
        
        <div style={{ position: 'relative', zIndex: 1 }}>
          <button onClick={onClose} style={{ position: 'absolute', top: 0, right: 0, background: 'none', border: 'none', color: 'var(--text-sec)', cursor: 'pointer' }}><X size={20}/></button>
          
          <div className="text-sec text-sm" style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
            <Building2 size={14} /> {factory?.name || 'Factory'}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, paddingRight: 40 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 48, height: 48, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: invoice.type === 'in' ? 'rgba(34,197,94,0.1)' : invoice.type === 'return' ? 'rgba(239,68,68,0.1)' : 'rgba(59,130,246,0.1)',
              color: invoice.type === 'in' ? 'var(--green)' : invoice.type === 'return' ? 'var(--red)' : 'var(--blue)'
            }}>
              {invoice.type === 'return' ? <RotateCcw size={24}/> : <FileText size={24}/>}
            </div>
            <div>
              <div style={{ fontSize: '1.2rem', fontWeight: 600 }}>
                {invoice.type === 'in' ? 'Factory Invoice' : invoice.type === 'return' ? 'Factory Return' : invoice.type.toUpperCase()}
              </div>
              <div className={`badge ${invoice.type === 'in' ? 'badge-green' : invoice.type === 'return' ? 'badge-red' : 'badge-blue'}`} style={{ marginTop: 4 }}>
                {invoice.type.toUpperCase()}
              </div>
            </div>
          </div>
        </div>

        <div className="flex-between" style={{ paddingBottom: 16, borderBottom: '1px solid var(--border)' }}>
          <div>
            <div className="text-sec text-sm" style={{ marginBottom: 4 }}>Receiver</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="text-bold" style={{ fontSize: '1.2rem', color: 'var(--gold)' }}>
                {invoice.receiverName || '-'}
              </span>
            </div>
          </div>
          
          <div style={{ textAlign: 'right' }}>
            <div className="text-sec text-sm" style={{ marginBottom: 4 }}>{new Date(invoice.date).toLocaleString()}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
              <FileText size={14} /> Invoice {invoice.number}
            </div>
          </div>
        </div>

        {invoice.type !== 'payment' && invoice.type !== 'confirm' && invoice.type !== 'balance_confirm' && itemsWithAssets.length > 0 && (
          <div className="table-wrap" style={{ marginTop: 16 }}>
            <table>
              <tbody>
                {itemsWithAssets.map((item, idx) => {
                  const sizeSum = Object.values(item.sizeQtys || {}).reduce((a, b) => a + (parseInt(b) || 0), 0);
                  const totalQty = sizeSum > 0 ? sizeSum : (item.qty || 0);
                  const lineTotal = totalQty * (item.factoryPrice || 0);

                  return (
                    <tr key={idx}>
                      <td style={{ padding: '8px', minWidth: 120 }}>
                        <HistoryModelCell asset={item.photo} code={item.catalogCode} />
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          {item.colorName || '-'}
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                          {Object.entries(item.sizeQtys || {})
                            .filter(([_, q]) => parseInt(q) > 0)
                            .map(([sz, q]) => (
                              <span key={sz} className="badge" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border)', color: 'var(--text-sec)' }}>
                                {sz}×{q}
                              </span>
                          ))}
                        </div>
                      </td>
                      <td>
                        <span style={{ color: 'var(--text-muted)' }}>{totalQty} &times;</span>&nbsp;&nbsp;&nbsp;${(item.factoryPrice || 0).toFixed(2)}
                      </td>
                      <td className="text-bold" style={{ fontSize: '1.15rem', color: 'var(--gold)' }}>${lineTotal.toFixed(2)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {invoice.note && (
          <div style={{ marginTop: 16 }}>
            <div className="text-sec text-sm" style={{ marginBottom: 4 }}>Note</div>
            <div style={{ background: 'var(--surface2)', padding: 12, borderRadius: 8 }}>{invoice.note}</div>
          </div>
        )}

        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: 16,
          padding: '12px 16px',
          borderRadius: 10,
          background: 'rgba(0,0,0,0.35)',
          border: '1px solid var(--border-gold)',
        }}>
          <div className="text-muted" style={{ fontSize: '1.1rem', fontWeight: 600 }}>Total Amount</div>
          <div className={`text-bold ${invoice.type === 'return' || invoice.type === 'payment' ? 'text-red' : 'text-green'}`} style={{ fontSize: '1.6rem' }}>
            {invoice.type === 'in' ? '+' : '-'}${(invoice.amount || 0).toFixed(2)}
          </div>
        </div>

        {invoice.photoBlob && (
          <div style={{ marginTop: 16 }}>
            <div className="text-sec text-sm" style={{ marginBottom: 8 }}>Receipt Photo</div>
            <img src={URL.createObjectURL(invoice.photoBlob)} alt="Receipt" style={{ width: '100%', maxWidth: '100%', borderRadius: 8, border: '1px solid var(--border)', display: 'block' }} />
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: 12,
              padding: '12px 16px',
              borderRadius: 10,
              background: 'rgba(0,0,0,0.35)',
              border: '1px solid var(--border-gold)',
            }}>
              <div className="text-muted" style={{ fontSize: '1.1rem', fontWeight: 600 }}>Total Amount</div>
              <div className={`text-bold ${invoice.type === 'return' || invoice.type === 'payment' ? 'text-red' : 'text-green'}`} style={{ fontSize: '1.6rem' }}>
                {invoice.type === 'in' ? '+' : '-'}${(invoice.amount || 0).toFixed(2)}
              </div>
            </div>
          </div>
        )}
        </div>
      </div>
    </div>
  );
}
