import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// Global override to fix Capacitor IndexedDB Blob prototype stripping issue
const originalCreateObjectURL = URL.createObjectURL;
URL.createObjectURL = (obj) => {
  if (!obj) return '';
  if (typeof obj === 'string') return obj;
  if (!(obj instanceof Blob)) {
    try {
      // Reconstruct blob if prototype was stripped
      const buffer = obj.buffer || obj; // Some implementations wrap it
      return originalCreateObjectURL(new Blob([buffer], { type: obj.type || 'image/jpeg' }));
    } catch (e) {
      console.warn('Fallback createObjectURL failed', e);
      return '';
    }
  }
  try {
    return originalCreateObjectURL(obj);
  } catch (e) {
    console.warn('Original createObjectURL failed', e);
    return '';
  }
};

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
