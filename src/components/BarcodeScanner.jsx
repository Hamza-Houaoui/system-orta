import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Camera, X, ScanLine } from 'lucide-react';

const playBeep = () => {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.type = 'sine';
    osc.frequency.value = 2500; // High pitch like a scanner
    
    gain.gain.setValueAtTime(0.5, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
    
    osc.start();
    osc.stop(ctx.currentTime + 0.1);
  } catch (e) {}
};

/**
 * BarcodeScanner — reusable component for scanning barcodes/QR codes via camera.
 * 
 * Props:
 *   onScan(code: string) — called when a code is successfully scanned
 *   onClose() — called when user closes the scanner
 */
export default function BarcodeScanner({ onScan, onClose, inline = false }) {
  const scannerRef = useRef(null);
  const containerRef = useRef(null);
  const [error, setError] = useState(null);
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    let html5Qr = null;

    const startScanner = async () => {
      try {
        html5Qr = new Html5Qrcode('barcode-reader');
        scannerRef.current = html5Qr;

        await html5Qr.start(
          { facingMode: 'environment' },
          {
            fps: 10,
            qrbox: { width: 280, height: 120 },
            aspectRatio: 1.5,
            disableFlip: false,
          },
          (decodedText) => {
            // Success
            playBeep();
            try {
              html5Qr.stop().catch(() => {});
            } catch (e) {}
            onScan(decodedText);
          },
          () => {
            // Scan attempt (ignore failures)
          }
        );
        setScanning(true);
      } catch (err) {
        console.error('Scanner error:', err);
        setError(
          typeof err === 'string'
            ? err
            : err?.message || 'Camera access denied or unavailable'
        );
      }
    };

    startScanner();

    return () => {
      if (scannerRef.current) {
        try {
          scannerRef.current.stop().catch(() => {});
        } catch (err) {
          console.error('Error stopping scanner', err);
        }
        
        try {
          scannerRef.current.clear();
        } catch (err) {
          console.error('Error clearing scanner', err);
        }
      }
    };
  }, []);

  const content = (
    <div
      className={inline ? '' : 'modal-box'}
      onClick={(e) => !inline && e.stopPropagation()}
      style={{
        maxWidth: 420,
        padding: 0,
        overflow: 'hidden',
        width: '100%',
        margin: inline ? '0 auto' : undefined,
        borderRadius: inline ? 8 : undefined,
        border: inline ? '1px solid var(--border)' : undefined,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          borderBottom: '1px solid var(--border)',
          background: inline ? 'var(--surface2)' : undefined,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Camera size={18} color="var(--gold)" />
          <span style={{ fontWeight: 700, color: 'var(--gold)' }}>
            Scan Barcode
          </span>
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
          }}
        >
          <X size={20} />
        </button>
      </div>

      {/* Camera View */}
      <div
        style={{
          position: 'relative',
          background: '#000',
          minHeight: 280,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          id="barcode-reader"
          ref={containerRef}
          style={{ width: '100%', border: 'none' }}
        ></div>
        
        {scanning && !error && (
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: 280,
              height: 120,
              border: '2px solid rgba(212, 175, 55, 0.5)',
              borderRadius: 12,
              pointerEvents: 'none',
              boxShadow: '0 0 0 4000px rgba(0,0,0,0.5)',
            }}
          >
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: 2,
                background: 'var(--gold)',
                boxShadow: '0 0 8px var(--gold)',
                animation: 'scanLine 2s infinite linear',
              }}
            />
          </div>
        )}

        {error && (
          <div
            style={{
              position: 'absolute',
              top: 0, left: 0, right: 0, bottom: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(0,0,0,0.8)',
              color: '#ff4444',
              padding: 20,
              textAlign: 'center',
              gap: 12,
              zIndex: 10,
            }}
          >
            <Camera size={32} opacity={0.5} />
            <div style={{ fontWeight: 600 }}>Scanner Error</div>
            <div style={{ fontSize: '0.8rem', opacity: 0.8 }}>{error}</div>
          </div>
        )}
      </div>

      {/* Footer */}
      {!inline && (
        <div
          style={{
            padding: '12px 16px',
            textAlign: 'center',
            color: 'var(--text-muted)',
            fontSize: '0.8rem',
            borderTop: '1px solid var(--border)',
          }}
        >
          Point camera at barcode to scan automatically
        </div>
      )}

      <style>{`
        @keyframes scanLine {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(116px); }
        }
        #barcode-reader video {
          border-radius: 0 !important;
        }
        #barcode-reader__scan_region {
          min-height: 280px !important;
        }
        #barcode-reader__dashboard {
          display: none !important;
        }
      `}</style>
    </div>
  );

  if (inline) return content;

  return (
    <div className="modal-overlay" onClick={onClose}>
      {content}
    </div>
  );
}
