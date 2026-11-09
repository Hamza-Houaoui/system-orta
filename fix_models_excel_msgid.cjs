const fs = require('fs');
let code = fs.readFileSync('src/screens/ModelsScreen.jsx', 'utf8');

// Replace export logic
const exportTarget = `const msgId = mc.messageId || '';`;
const exportReplacement = `const msgId = (mc.assets || []).map(a => a.messageId).filter(Boolean).join('|');`;
code = code.replace(exportTarget, exportReplacement);

// Replace import logic
const importTarget = `if (msgId && existingColor.messageId !== msgId) { existingColor.messageId = msgId; colorChanged = true; }`;
const importReplacement = `if (msgId) {
                  let assets = existingColor.assets || [];
                  const existingMsgIds = assets.map(a => String(a.messageId));
                  const importedMsgIds = msgId.split('|').filter(Boolean);
                  let added = false;
                  for (const mid of importedMsgIds) {
                    if (!existingMsgIds.includes(mid)) {
                      assets.push({ id: uuidv4(), type: 'image', messageId: parseInt(mid, 10) });
                      added = true;
                    }
                  }
                  if (added) {
                    existingColor.assets = assets;
                    colorChanged = true;
                  }
                }`;
code = code.replace(importTarget, importReplacement);

// Fix the case where the color is completely NEW
const newColorTarget = `await db.modelColors.add({
                  id: uuidv4(), catalogId: m.id, colorName: cName, colorCode: cName,
                  messageId: msgId, stock, createdAt: Date.now()
                });`;
const newColorReplacement = `
                const newAssets = [];
                if (msgId) {
                  msgId.split('|').filter(Boolean).forEach(mid => {
                    newAssets.push({ id: uuidv4(), type: 'image', messageId: parseInt(mid, 10) });
                  });
                }
                await db.modelColors.add({
                  id: uuidv4(), catalogId: m.id, colorName: cName, colorCode: cName,
                  assets: newAssets, stock, createdAt: Date.now()
                });`;
code = code.replace(newColorTarget, newColorReplacement);

fs.writeFileSync('src/screens/ModelsScreen.jsx', code);
console.log('Fixed Models Excel Message IDs');
