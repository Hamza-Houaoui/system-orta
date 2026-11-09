const fs = require('fs');
let code = fs.readFileSync('src/core/photoRecoveryService.js', 'utf8');

// Fix 1: Object.values(mc.assets)[0] -> mc.assets[0]
code = code.replace(
  'const firstAsset = mc.assets && Object.values(mc.assets)[0];',
  'const firstAsset = (Array.isArray(mc.assets) ? mc.assets[0] : null);'
);

// Fix 2: Rebuilding assets as an Array
code = code.replace(
  `        const updatedAssets = mc.assets || {};
        
        // Remove old empty assets to keep it clean
        if (Object.keys(updatedAssets).length > 0) {
            const firstKey = Object.keys(updatedAssets)[0];
            delete updatedAssets[firstKey];
        }

        updatedAssets[assetId] = {
           id: assetId,
           type: fwdData.result.video ? 'video' : 'photo',
           blob: blob,
           name: \`recovered_\${assetId}\`
        };`,
  `        let updatedAssets = Array.isArray(mc.assets) ? [...mc.assets] : [];
        
        if (updatedAssets.length > 0) {
            updatedAssets.shift(); // Remove the old empty asset
        }

        updatedAssets.push({
           id: assetId,
           type: fwdData.result.video ? 'video' : 'photo',
           blob: blob,
           name: \`recovered_\${assetId}\`
        });`
);

fs.writeFileSync('src/core/photoRecoveryService.js', code);
console.log('Fixed photoRecoveryService.js');
