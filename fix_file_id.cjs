const fs = require('fs');
let code = fs.readFileSync('src/core/telegramPublisher.js', 'utf8');

// The block to replace:
const targetBlock = `        } else if (item.type === 'photo' || item.type === 'video') {
           // We don't have the blob. Check if we have fileId in the DB!
           let fileId = null;
           if (item.modelColorId && item.assetId) {
               const mc = await db.modelColors.get(item.modelColorId);
               if (mc && mc.assets) {
                   const asset = mc.assets.find(a => a.id === item.assetId);
                   if (asset && asset.fileId) {
                       fileId = asset.fileId;
                   }
               }
           }

           else if (fileId) {
               const endpoint = item.type === 'video' ? 'sendVideo' : 'sendPhoto';
               Logger.debug('telegram', 'processQueue', \`[Item \${item.id}] Executing \${endpoint} for chat \${chatId} using file_id!\`);
               const body = {
                   chat_id: chatId,
                   [item.type]: fileId,
                   parse_mode: 'HTML'
               };
               if (item.caption || item.text) body.caption = item.caption || item.text;
               
               res = await fetchWithTimeout(\`https://api.telegram.org/bot\${settings.botToken}/\${endpoint}\`, {
                 method: 'POST', headers: { 'Content-Type': 'application/json' },
                 body: JSON.stringify(body)
               });
           } else {
               Logger.warn('telegram', 'processQueue', \`[Item \${item.id}] Missing media blob/fileId. Falling back to text message!\`);
               const textContent = item.caption || item.text || 'No description';
               res = await fetchWithTimeout(\`https://api.telegram.org/bot\${settings.botToken}/sendMessage\`, {
                 method: 'POST', headers: { 'Content-Type': 'application/json' },
                 body: JSON.stringify({ chat_id: chatId, text: textContent, parse_mode: 'HTML' })
               });
               // Update item type so future edits know it's a text message
               item.type = 'text';
               item.text = textContent;
               await db.telegramQueue.put(item);
           }
        }`;

const replacementBlock = `        } else if (item.type === 'photo' || item.type === 'video') {
           let fileId = null;
           let recoveredBlob = null;
           
           if (item.modelColorId && item.assetId) {
               const mc = await db.modelColors.get(item.modelColorId);
               if (mc && mc.assets) {
                   const asset = (Array.isArray(mc.assets) ? mc.assets : Object.values(mc.assets)).find(a => a.id === item.assetId);
                   if (asset) {
                       if (asset.fileId) fileId = asset.fileId;
                       if (asset.blob) recoveredBlob = asset.blob;
                   }
               }
           }
           
           if (recoveredBlob && !fileId) {
               const endpoint = item.type === 'video' ? 'sendVideo' : 'sendPhoto';
               Logger.debug('telegram', 'processQueue', \`[Item \${item.id}] Executing \${endpoint} for chat \${chatId} using recovered blob! Payload size: ~\${Math.round(recoveredBlob.size/1024)}KB\`);
               const formData = new FormData();
               formData.append('chat_id', chatId);
               formData.append(item.type, recoveredBlob, item.fileName || 'media');
               if (item.caption || item.text) formData.append('caption', item.caption || item.text);
               formData.append('parse_mode', 'HTML');
               
               res = await fetchWithTimeout(\`https://api.telegram.org/bot\${settings.botToken}/\${endpoint}\`, {
                 method: 'POST',
                 body: formData,
               });
           } else if (fileId) {
               const endpoint = item.type === 'video' ? 'sendVideo' : 'sendPhoto';
               Logger.debug('telegram', 'processQueue', \`[Item \${item.id}] Executing \${endpoint} for chat \${chatId} using file_id!\`);
               const body = {
                   chat_id: chatId,
                   [item.type]: fileId,
                   parse_mode: 'HTML'
               };
               if (item.caption || item.text) body.caption = item.caption || item.text;
               
               res = await fetchWithTimeout(\`https://api.telegram.org/bot\${settings.botToken}/\${endpoint}\`, {
                 method: 'POST', headers: { 'Content-Type': 'application/json' },
                 body: JSON.stringify(body)
               });
           } else {
               Logger.warn('telegram', 'processQueue', \`[Item \${item.id}] Missing media blob/fileId. Falling back to text message!\`);
               const textContent = item.caption || item.text || 'No description';
               res = await fetchWithTimeout(\`https://api.telegram.org/bot\${settings.botToken}/sendMessage\`, {
                 method: 'POST', headers: { 'Content-Type': 'application/json' },
                 body: JSON.stringify({ chat_id: chatId, text: textContent, parse_mode: 'HTML' })
               });
               item.type = 'text';
               item.text = textContent;
               await db.telegramQueue.put(item);
           }
        }`;

code = code.replace(targetBlock, replacementBlock);
fs.writeFileSync('src/core/telegramPublisher.js', code);
console.log('Fixed file_id issue');
