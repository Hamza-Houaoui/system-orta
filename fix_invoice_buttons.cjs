const fs = require('fs');
let code = fs.readFileSync('src/screens/NewOrderScreen.jsx', 'utf8');

const targetButtons = `<button
                          className="btn btn-success"
                          style={{ width: '100%', padding: '12px', fontSize: '1rem', fontWeight: 'bold' }}
                          disabled={!customer}
                          onClick={handleWhatsApp}
                        >
                          <MessageCircle size={18} /> WhatsApp
                        </button>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button className="btn btn-secondary btn-sm" style={{ flex: 1 }} disabled={items.length === 0} onClick={handlePDF}>
                            <FileText size={13} /> PDF
                          </button>
                          <button 
                            className="btn btn-primary btn-sm" 
                            style={{ flex: 1 }} 
                            onClick={saveOrder}
                            disabled={saving || !customer || items.length === 0}
                          >
                            {saving ? 'Saving...' : <><Check size={13} /> Save Order</>}
                          </button>
                          <button className="btn btn-secondary btn-sm" style={{ flex: 1 }} disabled={items.length === 0}>
                            <Send size={13} /> Telegram
                          </button>
                        </div>`;

const newButtons = `<div style={{ display: 'flex', gap: 12, marginTop: 10 }}>
                          <button
                            className="btn btn-success"
                            style={{ flex: 1, padding: '16px', fontSize: '1.1rem', fontWeight: 'bold', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8 }}
                            disabled={!customer || saving || items.length === 0}
                            onClick={handleWhatsApp}
                          >
                            <MessageCircle size={22} /> WhatsApp
                          </button>
                          <button 
                            className="btn btn-secondary" 
                            style={{ flex: 1, padding: '16px', fontSize: '1.1rem', fontWeight: 'bold', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8 }} 
                            disabled={!customer || saving || items.length === 0} 
                            onClick={handlePDF}
                          >
                            <FileText size={22} /> PDF
                          </button>
                        </div>`;

code = code.replace(targetButtons, newButtons);
fs.writeFileSync('src/screens/NewOrderScreen.jsx', code);
