import db from './db';
import { getSettings } from './store';
import { Logger } from './logger';
import { Capacitor } from '@capacitor/core';

// Set of asset IDs currently being downloaded to prevent duplicates
const downloadingAssets = new Set();

export async function loadTelegramMedia(asset, colorId) {
    if (!asset || !asset.fileId || asset.blob) return null;
    if (downloadingAssets.has(asset.id)) return null;
    
    downloadingAssets.add(asset.id);
    try {
        const settings = await getSettings();
        if (!settings.botToken) throw new Error("No bot token");
        
        const res = await fetch(`https://api.telegram.org/bot${settings.botToken}/getFile?file_id=${asset.fileId}`);
        const data = await res.json();
        
        if (!data.ok) throw new Error(data.description || "Failed to get file path");
        
        const filePath = data.result.file_path;
        const isWeb = !Capacitor.isNativePlatform();
        let blob;

        if (isWeb) {
            const fileRes = await fetch(`/tg-file/bot${settings.botToken}/${filePath}`);
            if (!fileRes.ok) throw new Error("Failed to download file from Telegram");
            blob = await fileRes.blob();
        } else {
            const { CapacitorHttp } = await import('@capacitor/core');
            const fileUrl = `https://api.telegram.org/file/bot${settings.botToken}/${filePath}`;
            const response = await CapacitorHttp.get({
                url: fileUrl,
                responseType: 'blob'
            });
            if (response.status !== 200) throw new Error("Failed to download file from Telegram");
            
            const base64Str = response.data;
            const b64Res = await fetch(`data:${asset.type === 'video' ? 'video/mp4' : 'image/jpeg'};base64,${base64Str}`);
            blob = await b64Res.blob();
        }
        
        // Save back to DB
        const mc = await db.modelColors.get(colorId);
        if (mc && mc.assets) {
            const aIdx = mc.assets.findIndex(a => a.id === asset.id);
            if (aIdx >= 0) {
                mc.assets[aIdx].blob = blob;
                await db.modelColors.update(mc.id, { assets: mc.assets });
                downloadingAssets.delete(asset.id);
                return blob;
            }
        }
    } catch(e) {
        Logger.error('media', 'loadTelegramMedia', e.message);
    }
    
    downloadingAssets.delete(asset.id);
    return null;
}
