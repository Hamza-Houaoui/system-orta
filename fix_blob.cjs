const fs = require('fs');
let code = fs.readFileSync('src/core/telegramPublisher.js', 'utf8');

// Replace the fallback branch to first check for blob in asset
const oldFallback = `
        } else if (item.type === 'photo' || item.type === 'video') {
           // We don't have the blob. Check if we have fileId in the DB!
           let fileId = null;
           if (item.modelColorId && item.assetId) {
               const mc = await db.modelColors.get(item.modelColorId);
               if (mc && mc.assets) {
                   const asset = (Array.isArray(mc.assets) ? mc.assets : Object.values(mc.assets)).find(a => a.id === item.assetId);
                   if (asset && asset.fileId) {
                       fileId = asset.fileId;
                   }
               }
           }`;

const newFallback = `
        } else if (item.type === 'photo' || item.type === 'video') {
           // We don't have the blob in the item directly. Check if we have it or a fileId in the DB!
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
               // We found a blob in the DB! Let's upload it!
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
           }`;

code = code.replace(oldFallback, newFallback);
code = code.replace(
  `           if (fileId) {`,
  `           else if (fileId) {`
);

// We also need to fix onStockChanged to NOT store the blob in the queue item!
code = code.replace(
  `if (firstAsset.blob) queueItem.blob = firstAsset.blob;`,
  `// if (firstAsset.blob) queueItem.blob = firstAsset.blob; // Prevent storage bloat`
);
code = code.replace(
  `if (photoBlob) queueItem.blob = photoBlob;`,
  `// if (photoBlob) queueItem.blob = photoBlob; // Prevent storage bloat`
);

fs.writeFileSync('src/core/telegramPublisher.js', code);
console.log('Fixed storage bloat');
