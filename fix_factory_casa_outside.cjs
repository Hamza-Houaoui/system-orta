const fs = require('fs');
let code = fs.readFileSync('src/screens/FactoryDetailScreen.jsx', 'utf8');

// Remove the casa block from INSIDE the transaction
const innerCasa = `        
        // ── Send FACTORY PAYMENT to Casa Channel ──────────────────────
        try {
          const allTxForCasa = await db.transactions.orderBy('date').toArray();
          const casaBalanceBefore = allTxForCasa.reduce((s, t) => s + (t.type === 'in' ? t.amount : -t.amount), 0);
          const todayStart = new Date(); todayStart.setHours(0,0,0,0);
          const todayTx = allTxForCasa.filter(t => t.date >= todayStart.getTime());
          const casaTodayIn = todayTx.filter(t => t.type === 'in').reduce((s,t) => s + t.amount, 0);
          const casaTodayOut = todayTx.filter(t => t.type === 'out').reduce((s,t) => s + t.amount, 0);
          const casaBalanceAfter = casaBalanceBefore - amt; // Since it's 'out'
          
          await db.telegramQueue.add({
            priority: 3, type: 'text', status: 'pending',
            createdAt: Date.now(), attemptCount: 0,
            chatIdKey: 'casaChatId',
            text: formatCasaTransaction({
              type: 'out',
              amount: amt,
              category: 'Factory Payment',
              customerName: factory.name,
              balanceBefore: casaBalanceBefore,
              balance: casaBalanceAfter,
              todayIn: casaTodayIn,
              todayOut: casaTodayOut + amt,
            }),
          });
        } catch(tgErr) {
          Logger.warn('factories', 'saveInvoice', \`Failed to queue Telegram casa: \${tgErr.message}\`);
        }
      }
      }); // End transaction`;

const innerCasaReplacement = `      }
      }); // End transaction`;

code = code.replace(innerCasa, innerCasaReplacement);

// Add the casa block OUTSIDE the transaction, after the closing
const afterTransaction = `      }); // End transaction
      
      // Update Telegram for all modified catalogs outside the transaction`;

const afterTransactionWithCasa = `      }); // End transaction
      
      // ── Send FACTORY PAYMENT to Casa Channel (outside transaction for accurate balance) ──
      if (type === 'payment') {
        try {
          const amt = parseFloat(form.amount) || 0;
          const allTxForCasa = await db.transactions.orderBy('date').toArray();
          const casaBalance = allTxForCasa.reduce((s, t) => s + (t.type === 'in' ? t.amount : -t.amount), 0);
          const todayStart = new Date(); todayStart.setHours(0,0,0,0);
          const todayTx = allTxForCasa.filter(t => t.date >= todayStart.getTime());
          const casaTodayIn = todayTx.filter(t => t.type === 'in').reduce((s,t) => s + t.amount, 0);
          const casaTodayOut = todayTx.filter(t => t.type === 'out').reduce((s,t) => s + t.amount, 0);
          await db.telegramQueue.add({
            priority: 3, type: 'text', status: 'pending',
            createdAt: Date.now(), attemptCount: 0,
            chatIdKey: 'casaChatId',
            text: formatCasaTransaction({
              type: 'out',
              amount: amt,
              category: 'Factory Payment',
              customerName: factory.name,
              balanceBefore: casaBalance + amt,
              balance: casaBalance,
              todayIn: casaTodayIn,
              todayOut: casaTodayOut,
            }),
          });
        } catch(tgErr) {
          Logger.warn('factories', 'saveInvoice', \`Failed to queue Telegram casa: \${tgErr.message}\`);
        }
      }

      // Update Telegram for all modified catalogs outside the transaction`;

code = code.replace(afterTransaction, afterTransactionWithCasa);
fs.writeFileSync('src/screens/FactoryDetailScreen.jsx', code);
console.log('✅ FactoryDetailScreen.jsx fixed — casa block moved outside transaction');
