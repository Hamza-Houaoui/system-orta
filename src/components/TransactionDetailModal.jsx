import React from 'react';
import { X, Calendar, FileText, TrendingDown, TrendingUp, Image } from 'lucide-react';

export default function TransactionDetailModal({ transaction, onClose }) {
  if (!transaction) return null;

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1000 }}>
      <div className="modal-box modal-box-lg" style={{ position: 'relative', overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
        
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 0,
          background: transaction.type === 'in' ? 'linear-gradient(to right, rgba(34, 197, 94, 0.15), transparent)' 
                    : transaction.type === 'out' ? 'linear-gradient(to right, rgba(239, 68, 68, 0.15), transparent)'
                    : 'linear-gradient(to right, rgba(59, 130, 246, 0.15), transparent)',
          pointerEvents: 'none'
        }} />
        
        <div style={{ position: 'relative', zIndex: 1 }}>
          <button onClick={onClose} style={{ position: 'absolute', top: 0, right: 0, background: 'none', border: 'none', color: 'var(--text-sec)', cursor: 'pointer' }}><X size={20}/></button>
          
          <div className="text-sec text-sm" style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
            <FileText size={14} /> {transaction.category || 'Transaction'}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, paddingRight: 40 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 48, height: 48, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: transaction.type === 'in' ? 'rgba(34,197,94,0.1)' : transaction.type === 'out' ? 'rgba(239,68,68,0.1)' : 'rgba(59,130,246,0.1)',
                color: transaction.type === 'in' ? 'var(--green)' : transaction.type === 'out' ? 'var(--red)' : 'var(--blue)'
              }}>
                {transaction.type === 'in' ? <TrendingUp size={24}/> : transaction.type === 'out' ? <TrendingDown size={24}/> : <FileText size={24}/>}
              </div>
              <div>
                <div style={{ fontSize: '1.2rem', fontWeight: 600 }}>
                  {transaction.type === 'in' ? 'Income' : transaction.type === 'out' ? 'Expense' : 'Transaction'}
                </div>
                <div className={`badge ${transaction.type === 'in' ? 'badge-green' : transaction.type === 'out' ? 'badge-red' : 'badge-blue'}`} style={{ marginTop: 4 }}>
                  {transaction.type.toUpperCase()}
                </div>
              </div>
            </div>
          </div>

          <div className="flex-between" style={{ paddingBottom: 16, borderBottom: '1px solid var(--border)' }}>
            <div>
              <div className="text-sec text-sm" style={{ marginBottom: 4 }}>Description</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="text-bold" style={{ fontSize: '1.2rem', color: 'var(--gold)' }}>
                  {transaction.description || 'Manual Transaction'}
                </span>
              </div>
            </div>
            
            <div style={{ textAlign: 'right' }}>
              <div className="text-sec text-sm" style={{ marginBottom: 4 }}>{new Date(transaction.date).toLocaleString()}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
                <Calendar size={14} /> Date
              </div>
            </div>
          </div>

          {transaction.photoBlob && (
            <div style={{ marginTop: 16 }}>
              <div className="text-sec text-sm" style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}><Image size={14}/> Attached Invoice/Receipt</div>
              <img src={URL.createObjectURL(transaction.photoBlob)} alt="Receipt" style={{ maxWidth: '100%', borderRadius: 8, border: '1px solid var(--border)' }} />
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 16, alignItems: 'flex-end' }}>
            <div className="text-muted" style={{ fontSize: '1.1rem' }}>Total Amount</div>
            <div className={`text-bold ${transaction.type === 'out' ? 'text-red' : 'text-green'}`} style={{ fontSize: '1.6rem' }}>
              {transaction.type === 'in' ? '+' : '-'}${(transaction.amount || 0).toFixed(2)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
