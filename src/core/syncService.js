import db, { getDirtySet, clearDirtySet } from './db';
import { getSettings } from './store';
import { getDeviceId, isWatcherDevice } from './deviceSync';
import { Logger } from './logger';
import { Capacitor } from '@capacitor/core';

export const syncService = {
  async pushSync(onProgress, { incremental = false } = {}) {
    if (isWatcherDevice()) {
      console.warn("Device 2 cannot push sync updates");
      return;
    }
    const settings = getSettings();
    Logger.debug('sync', 'pushSync', 'Starting pushSync flow');
    if (!settings.botToken || !settings.syncChatId) {
      Logger.error('sync', 'pushSync', 'Missing Telegram config');
      throw new Error('Configure Telegram Bot & Sync Channel in Settings first');
    }

    // NOTE: telegramMessages is NOT synced — each device tracks its own
    // published messages. Syncing would overwrite local records and cause
    // duplicate sends when the device forgets it already published.
    const tables = ['factories','factoryInvoices','colors','sizeSeries','catalog','modelColors','customers','orders','transactions','stockLog'];

    // ── Build JSON incrementally, one table at a time ──────
    // This avoids loading the entire database into RAM at once.
    // Each table is serialized and freed before moving to the next.
    if (onProgress) onProgress('Exporting database...');
    Logger.debug('sync', 'pushSync', `Mode: ${incremental ? 'INCREMENTAL (dirty rows only)' : 'FULL'}. Building JSON payload table-by-table...`);

    const stripBlobReplacer = (key, value) => {
      if (value instanceof Blob || value instanceof File) return undefined;
      return value;
    };

    // In incremental mode, only send rows whose IDs are in the dirty set.
    const dirty = incremental ? getDirtySet() : null;
    const isDirty = (table, key) => !dirty || dirty.has(`${table}:${key}`);

    const chunks = [];
    chunks.push('{');
    let totalRows = 0;

    for (let i = 0; i < tables.length; i++) {
      const t = tables[i];
      try {
        let rows = await db[t].toArray();

        // In incremental mode, only include rows that changed since last push
        if (incremental && dirty.size > 0) {
          rows = rows.filter(r => isDirty(t, r.id));
        }

        // Skip tables with nothing to send (saves bandwidth in incremental mode)
        if (rows.length === 0 && incremental) continue;

        totalRows += rows.length;
        if (chunks.length > 1) chunks.push(',');

        if (t === 'modelColors') {
          // Strip media blobs inline — no separate deep copy pass
          if (onProgress) onProgress(`Stripping media from ${rows.length} models...`);
          for (const mc of rows) {
            if (mc.assets) {
              for (const k in mc.assets) {
                delete mc.assets[k].blob;
                delete mc.assets[k].base64;
              }
            }
          }
        }

        chunks.push(`"${t}":${JSON.stringify(rows, stripBlobReplacer)}`);
        // Explicitly free the reference so GC can reclaim memory
        rows.length = 0;
      } catch (e) {
        Logger.warn('sync', 'pushSync', `Table ${t} failed: ${e.message}`);
        chunks.push(`"${t}":[]`);
      }
    }
    chunks.push('}');

    if (onProgress) onProgress('Compressing...');
    Logger.debug('sync', 'pushSync', `Total rows: ${totalRows}. Building final JSON string...`);
    const jsonStr = chunks.join('');
    chunks.length = 0; // free chunk array

    Logger.debug('sync', 'pushSync', `JSON size: ${Math.round(jsonStr.length / 1024)}KB. Compressing into ZIP...`);
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();
    zip.file('sync_data.json', jsonStr);
    const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
    Logger.debug('sync', 'pushSync', `Compression complete. Final zip size: ${Math.round(blob.size / 1024)}KB`);

    if (onProgress) onProgress('Uploading to Telegram...');
    Logger.debug('sync', 'pushSync', `Uploading ZIP to Telegram channel: ${settings.syncChatId}`);
    const formData = new FormData();
    formData.append('chat_id', settings.syncChatId);
    formData.append('document', blob, `sync_device${getDeviceId()}_${Date.now()}.zip`);
    formData.append('caption', `🔄 Sync Push — Device ${getDeviceId()} — ${new Date().toLocaleString()}`);

    const res = await fetch(`https://api.telegram.org/bot${settings.botToken}/sendDocument`, {
      method: 'POST', body: formData
    });
    const result = await res.json();

    if (result.ok) {
      const messageId = result.result?.message_id;

      // Log BEFORE pinning so history always has a record even if pin fails
      try {
        await db.syncLog.add({
          id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
          timestamp: Date.now(), deviceId: getDeviceId(),
          action: 'push', status: 'success', messageId
        });
      } catch(e) { Logger.error('sync', 'log', e.message); }

      // Save last pushed message id so we don't prompt for it on same device
      localStorage.setItem('lastPulledMessageId', messageId.toString());

      // Pin the message (non-fatal if it fails)
      if (onProgress) onProgress('Pinning sync message...');
      try {
        const pinRes = await fetch(`https://api.telegram.org/bot${settings.botToken}/pinChatMessage`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: settings.syncChatId, message_id: messageId, disable_notification: true })
        });
        const pinData = await pinRes.json();
        if (!pinData.ok) {
          Logger.error('sync', 'pin', `Pin failed: ${pinData.description}`);
          // Dispatch warning but DO NOT throw — sync already succeeded
          window.dispatchEvent(new CustomEvent('orta:sync_warning', {
            detail: { message: `⚠️ Sync uploaded but could not pin: ${pinData.description}. Give bot "Pin Messages" admin rights in the Sync Channel.` }
          }));
        }
      } catch(pinErr) {
        Logger.error('sync', 'pin', pinErr.message);
      }

      Logger.info('sync', 'pushSync', 'Push sync success');

      // Clear dirty set after successful push — all changes are now on Telegram
      if (incremental) {
        clearDirtySet();
        Logger.debug('sync', 'pushSync', 'Cleared dirty set after successful incremental push');
      } else {
        clearDirtySet(); // Full push also clears dirty set
      }

      return messageId;
    } else {
      // Log failure to syncLog
      try {
        await db.syncLog.add({
          id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
          timestamp: Date.now(), deviceId: getDeviceId(),
          action: 'push', status: 'failed', error: result.description || 'Upload failed'
        });
      } catch(e) { Logger.error('sync', 'log', e.message); }
      throw new Error(result.description || 'Upload failed');
    }
  },

  async pullSync(onProgress, specificMessage = null) {
    const settings = getSettings();
    Logger.debug('sync', 'pullSync', 'Starting pullSync flow');
    if (!settings.botToken || !settings.syncChatId) {
      Logger.error('sync', 'pullSync', 'Missing Telegram config');
      throw new Error('Configure Telegram Bot & Sync Channel in Settings first');
    }

    if (onProgress) onProgress('Fetching pinned sync from Telegram...');
    Logger.debug('sync', 'pullSync', 'Fetching latest pinned message from Telegram...');

    let pinnedMessage = specificMessage;

    if (!pinnedMessage) {
        const chatRes = await fetch(`https://api.telegram.org/bot${settings.botToken}/getChat?chat_id=${settings.syncChatId}`);
        const chatData = await chatRes.json();
        if (!chatData.ok || !chatData.result.pinned_message) throw new Error('No pinned message found in sync channel');
        pinnedMessage = chatData.result.pinned_message;
    }

    const document = pinnedMessage.document;
    if (!document) throw new Error('Pinned message does not contain a document');

    // Extract device info from caption
    const caption = pinnedMessage.caption || '';
    if (!caption.includes('🔄 Sync Push')) {
        throw new Error('Pinned message is not a valid Sync Push. You might have pinned a Backup file in the Sync channel.');
    }
    const match = caption.match(/Device (\d+)/);
    const sourceDeviceId = match ? parseInt(match[1]) : 0;

    if (sourceDeviceId === getDeviceId()) {
       // Log as "up to date" so sync history shows something
       try {
         await db.syncLog.add({
           id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
           timestamp: Date.now(), deviceId: getDeviceId(),
           action: 'pull', status: 'up_to_date', messageId: pinnedMessage.message_id
         });
       } catch(e) { Logger.error('sync', 'log', e.message); }
       localStorage.setItem('lastPulledMessageId', pinnedMessage.message_id.toString());
       throw new Error('ALREADY_UP_TO_DATE');
    }

    window.isPulling = true; // Prevent debounced auto-push
    try {
        if (onProgress) onProgress('Downloading sync file...');
        Logger.debug('sync', 'pullSync', `Fetching file_id: ${document.file_id} from Telegram...`);
        const fileRes = await fetch(`https://api.telegram.org/bot${settings.botToken}/getFile?file_id=${document.file_id}`);
        const fileData = await fileRes.json();
        if (!fileData.ok) throw new Error('Could not get file path from Telegram');

        const isWeb = !Capacitor.isNativePlatform();
        let blob;

        if (isWeb) {
            const blobRes = await fetch(`/tg-file/bot${settings.botToken}/${fileData.result.file_path}`);
            if (!blobRes.ok) throw new Error(`Failed to download backup file (HTTP ${blobRes.status})`);
            blob = await blobRes.blob();
        } else {
            // On Android, use CapacitorHttp to bypass WebView CORS
            const { CapacitorHttp } = await import('@capacitor/core');
            const fileUrl = `https://api.telegram.org/file/bot${settings.botToken}/${fileData.result.file_path}`;
            const response = await CapacitorHttp.get({
                url: fileUrl,
                responseType: 'blob'
            });
            if (response.status !== 200) throw new Error(`Failed to download backup file (HTTP ${response.status})`);
            
            // Capacitor returns 'blob' responseType as a base64 string
            const base64Str = response.data;
            const b64Res = await fetch(`data:application/zip;base64,${base64Str}`);
            blob = await b64Res.blob();
        }

        Logger.debug('sync', 'pullSync', `Downloaded ZIP size: ${Math.round(blob.size/1024)}KB`);

        if (onProgress) onProgress('Restoring database...');
        Logger.debug('sync', 'pullSync', 'Extracting sync_data.json from ZIP...');
        const JSZip = (await import('jszip')).default;
        const zip = await JSZip.loadAsync(blob);
        const json = await zip.file('sync_data.json')?.async('string');
        if (!json) throw new Error('Invalid sync file structure');

        const data = JSON.parse(json);

        // Media blobs are no longer synced to save bandwidth and memory.
        // The UI will lazy-load them from Telegram using fileId when needed.
        Logger.debug('sync', 'pullSync', 'Merging remote data into local DB (UUID-based)...');
        for (const [table, rows] of Object.entries(data)) {
          if (!db[table]) continue;
          if (rows.length > 0) {
            // bulkPut = upsert: if UUID exists locally → update it; if new → insert it.
            // Rows that exist locally but NOT in the remote data stay untouched.
            // This prevents destroying local-only work when the other device pushes.
            await db[table].bulkPut(rows);
          }
        }

        try {
           await db.syncLog.add({
             id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
             timestamp: Date.now(), deviceId: getDeviceId(),
             action: 'pull', status: 'success', messageId: pinnedMessage.message_id
           });
        } catch(e) { Logger.error('sync', 'log', e.message); }

        localStorage.setItem('lastPulledMessageId', pinnedMessage.message_id.toString());
        Logger.info('sync', 'pullSync', 'Pull sync success');
        return { sourceDeviceId, messageId: pinnedMessage.message_id };
    } catch(e) {
        // Log pull failure (but don't double-log ALREADY_UP_TO_DATE)
        if (e.message !== 'ALREADY_UP_TO_DATE') {
          try {
            await db.syncLog.add({
              id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
              timestamp: Date.now(), deviceId: getDeviceId(),
              action: 'pull', status: 'failed', error: e.message
            });
          } catch(logErr) { Logger.error('sync', 'log', logErr.message); }
        }
        throw e;
    } finally {
        setTimeout(() => { window.isPulling = false; }, 2000);
    }
  },

  async checkPendingUpdate() {
     const settings = getSettings();
     if (!settings.botToken || !settings.syncChatId) return null;

     try {
        const chatRes = await fetch(`https://api.telegram.org/bot${settings.botToken}/getChat?chat_id=${settings.syncChatId}`);
        const chatData = await chatRes.json();
        if (!chatData.ok || !chatData.result.pinned_message) return null;

        const pinnedMessage = chatData.result.pinned_message;
        const lastPulled = localStorage.getItem('lastPulledMessageId');

        if (lastPulled && lastPulled === pinnedMessage.message_id.toString()) {
            return null; // Already pulled
        }

        const caption = pinnedMessage.caption || '';
        if (!caption.includes('🔄 Sync Push')) {
            return null; // Ignore backups or other pinned messages
        }
        
        const match = caption.match(/Device (\d+)/);
        const sourceDeviceId = match ? parseInt(match[1]) : 0;

        if (sourceDeviceId === getDeviceId()) {
            localStorage.setItem('lastPulledMessageId', pinnedMessage.message_id.toString());
            return null;
        }

        return {
            sourceDeviceId,
            message: pinnedMessage
        };
     } catch (e) {
        return null;
     }
  }
};
