import db from './db';
import { getSettings } from './store';
import { Logger } from './logger';
import { Capacitor } from '@capacitor/core';

/**
 * Attempts to recover a photo by parsing its telegram link,
 * forwarding it to the backup channel, downloading the file,
 * and deleting the forwarded message.
 */
export async function recoverMissingPhotos(onProgress) {
  try {
    const settings = await getSettings();
    if (!settings.botToken || !settings.backupChatId) {
      throw new Error('Bot token or Backup Chat ID is not configured in Settings');
    }

    const mColors = await db.modelColors.toArray();
    let missingCount = 0;
    let recoveredCount = 0;
    let failedCount = 0;

    // Filter colors that have NO local blob
    const targets = mColors.filter(mc => {
      const firstAsset = (Array.isArray(mc.assets) ? mc.assets[0] : null);
      if (firstAsset && firstAsset.blob) return false;
      return true;
    });

    missingCount = targets.length;
    if (missingCount === 0) {
      if (onProgress) onProgress({ done: true, message: 'No missing photos found' });
      return { total: 0, recovered: 0, failed: 0 };
    }

    Logger.info('recovery', 'start', `Found ${missingCount} colors missing photos`);
    
    for (let i = 0; i < targets.length; i++) {
      const mc = targets[i];
      if (onProgress) onProgress({ done: false, current: i + 1, total: missingCount, message: `Recovering ${mc.colorName || mc.colorCode}...` });
      
      try {
        await new Promise(r => setTimeout(r, 500)); // Rate limiting
        
        // Parse link or fallback to telegramMessages table
        let fromChatId;
        let messageId;
        
        if (mc.link) {
          const cMatch = mc.link.match(/t\.me\/c\/(\d+)\/(\d+)/);
          if (cMatch) {
            fromChatId = `-100${cMatch[1]}`;
            messageId = parseInt(cMatch[2], 10);
          } else {
            const userMatch = mc.link.match(/t\.me\/([a-zA-Z0-9_]+)\/(\d+)/);
            if (userMatch) {
              fromChatId = `@${userMatch[1]}`;
              messageId = parseInt(userMatch[2], 10);
            }
          }
        }
        
        // Fallback to telegramMessages table
        if (!fromChatId || !messageId) {
           const tgRecords = await db.telegramMessages.where('refId').equals(mc.id).toArray();
           const mediaRecord = tgRecords.find(r => r.type === 'photo' || r.type === 'video');
           if (mediaRecord) {
              fromChatId = settings[mediaRecord.channel] || settings.wholesaleChatId;
              messageId = mediaRecord.messageId;
           }
        }

        if (!fromChatId || !messageId) {
          // Check if there is an old legacy messageId directly on mc
          if (mc.messageId) {
             fromChatId = settings.wholesaleChatId || settings.retailChatId || settings.backupChatId;
             messageId = mc.messageId;
          } else {
             throw new Error(`Could not find message ID for color ${mc.id}`);
          }
        }

        // 1. Forward message to backup channel
        const fwdRes = await fetch(`https://api.telegram.org/bot${settings.botToken}/forwardMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: settings.backupChatId,
            from_chat_id: fromChatId,
            message_id: messageId
          })
        });
        
        const fwdData = await fwdRes.json();
        if (!fwdData.ok) {
           throw new Error(`Forward failed: ${fwdData.description}`);
        }

        const fwdMessageId = fwdData.result.message_id;
        
        let fileId = null;
        if (fwdData.result.photo && fwdData.result.photo.length > 0) {
           // Get the highest resolution photo
           fileId = fwdData.result.photo[fwdData.result.photo.length - 1].file_id;
        } else if (fwdData.result.video) {
           fileId = fwdData.result.video.file_id;
        }

        if (!fileId) {
           // Cleanup forwarded message
           await deleteMessageSilent(settings.botToken, settings.backupChatId, fwdMessageId);
           throw new Error('No photo/video found in forwarded message');
        }

        // 2. Get file path
        const fileRes = await fetch(`https://api.telegram.org/bot${settings.botToken}/getFile?file_id=${fileId}`);
        const fileData = await fileRes.json();
        if (!fileData.ok) {
           await deleteMessageSilent(settings.botToken, settings.backupChatId, fwdMessageId);
           throw new Error(`getFile failed: ${fileData.description}`);
        }

        const filePath = fileData.result.file_path;

        // 3. Download the actual file
        const isWeb = !Capacitor.isNativePlatform();
        let blob;

        if (isWeb) {
            const blobRes = await fetch(`/tg-file/bot${settings.botToken}/${filePath}`);
            if (!blobRes.ok) {
               await deleteMessageSilent(settings.botToken, settings.backupChatId, fwdMessageId);
               throw new Error('Failed to download blob');
            }
            blob = await blobRes.blob();
        } else {
            const { CapacitorHttp } = await import('@capacitor/core');
            const fileUrl = `https://api.telegram.org/file/bot${settings.botToken}/${filePath}`;
            const response = await CapacitorHttp.get({
                url: fileUrl,
                responseType: 'blob'
            });
            if (response.status !== 200) {
               await deleteMessageSilent(settings.botToken, settings.backupChatId, fwdMessageId);
               throw new Error('Failed to download blob');
            }
            
            const base64Str = response.data;
            const b64Res = await fetch(`data:${fileId.startsWith('BA') || fileId.startsWith('video') ? 'video/mp4' : 'image/jpeg'};base64,${base64Str}`);
            blob = await b64Res.blob();
        }

        // 4. Update the DB
        const assetId = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString();
        let updatedAssets = Array.isArray(mc.assets) ? [...mc.assets] : [];
        
        if (updatedAssets.length > 0) {
            updatedAssets.shift(); // Remove the old empty asset
        }

        updatedAssets.push({
           id: assetId,
           type: fwdData.result.video ? 'video' : 'photo',
           blob: blob,
           name: `recovered_${assetId}`
        });

        await db.modelColors.update(mc.id, { assets: updatedAssets });
        
        // 5. Delete the forwarded message silently
        await deleteMessageSilent(settings.botToken, settings.backupChatId, fwdMessageId);
        
        recoveredCount++;
        Logger.info('recovery', 'success', `Recovered photo for ${mc.id}`);

      } catch (e) {
        failedCount++;
        Logger.error('recovery', 'failed', `Failed for ${mc.id}: ${e.message}`);
      }
    }

    if (onProgress) onProgress({ done: true, message: `Completed! Recovered: ${recoveredCount}, Failed: ${failedCount}` });
    return { total: missingCount, recovered: recoveredCount, failed: failedCount };
    
  } catch (err) {
    Logger.error('recovery', 'fatal', err.message);
    if (onProgress) onProgress({ done: true, message: `Error: ${err.message}` });
    throw err;
  }
}

async function deleteMessageSilent(botToken, chatId, messageId) {
   try {
     await fetch(`https://api.telegram.org/bot${botToken}/deleteMessage`, {
       method: 'POST',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify({ chat_id: chatId, message_id: messageId })
     });
   } catch(e) {
     // Ignore
   }
}
