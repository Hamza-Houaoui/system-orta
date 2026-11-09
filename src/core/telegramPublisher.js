import { isWatcherDevice } from './deviceSync';
import db from './db';
import { getSettings } from './store';
import { Logger } from './logger';
import { buildSalesCaption,  buildWholesaleCaption, buildRetailCaption, buildLiveStockCaption  } from '../toolbox/telegramFormatter';


// ============================================================
// Per-Color Channel Info Calculator (pure function)
// ============================================================

/**
 * Calculate which channels a specific color should be published to,
 * plus its full-series count and broken sizes.
 *
 * Rules (evaluated per color, not per model):
 * - fullSeriesCount = min(qty) across ALL required sizes (from size series)
 *   If fullSeriesCount > 0 → color has full serie(s) → wholesaleChatId
 * - brokenSizes = sizes where (qty - fullSeriesCount) > 0
 *   If brokenSizes exist → retailChatId
 * - A single color CAN appear on BOTH wholesale AND retail simultaneously
 * - If totalStock = 0 → no channels (but existing messages are NOT deleted)
 * - Discount → salesChatId (in addition to above)
 */
export function calcColorChannelInfo(model, color, series, settings) {
  const stock = color.stock || [];
  const sizes = series?.sizes || [];
  const totalStock = stock.reduce((s, x) => s + (Number(x.qty) || 0), 0);

  // Full series count: min qty across ALL required sizes
  let fullSeriesCount = 0;
  if (sizes.length > 0) {
    const qtys = sizes.map(size => {
      const sObj = stock.find(s => s.size === size);
      return sObj ? (Number(sObj.qty) || 0) : 0;
    });
    fullSeriesCount = Math.min(...qtys);
  }

  // Broken sizes: leftover pieces after removing full series
  const brokenSizes = [];
  if (sizes.length > 0) {
    for (const size of sizes) {
      const sObj = stock.find(s => s.size === size);
      const qty = sObj ? (Number(sObj.qty) || 0) : 0;
      const effectiveFullSeries = Math.max(0, fullSeriesCount);
      const brokenQty = qty - effectiveFullSeries;
      if (brokenQty > 0) {
        brokenSizes.push({ size, qty: brokenQty });
      }
    }
  }

  // Global + per-model toggles
  const globalWholesale = settings.wholesaleEnabled !== false;
  const globalSales = settings.salesEnabled !== false;
  const globalRetail = settings.retailEnabled !== false;
  const modelWholesale = model.publishedWholesale !== false;
  const modelSales = model.publishedSales !== false;
  const modelRetail = model.publishedRetail !== false;

  const hasDiscount = model.onSale === true || (model.discount && model.discount > 0);

  const channels = [];
  if (totalStock > 0) {
    if (fullSeriesCount > 0 && globalWholesale && modelWholesale) channels.push('wholesaleChatId');
    if (brokenSizes.length > 0 && globalRetail && modelRetail) channels.push('retailChatId');
    if (hasDiscount && globalSales && modelSales) channels.push('salesChatId');
  }

  return { channels, fullSeriesCount, brokenSizes, totalStock };
}

// Legacy wrapper — kept for compatibility
export async function getTargetChannels(modelId) {
  const model = await db.catalog.get(modelId);
  if (!model) return [];

  const settings = await getSettings();
  const series = model.sizeSeriesId ? await db.sizeSeries.get(model.sizeSeriesId) : null;
  const mColors = await db.modelColors.where('catalogId').equals(modelId).toArray();

  const channelSet = new Set();
  for (const mc of mColors) {
    const { channels } = calcColorChannelInfo(model, mc, series, settings);
    channels.forEach(c => channelSet.add(c));
  }
  return [...channelSet];
}

/**
 * Queue media to appropriate Telegram channels based on color stock status.
 * Captions are generated per-channel (wholesale/retail get different info).
 *
 * @param {string} modelId - The model ID
 * @param {string} colorId - The model-color ID
 * @param {Blob} fileBlob - The file to send
 * @param {string} fileType - 'photo' or 'video'
 * @param {string} refId - Optional reference ID override
 */
export async function publishMediaToChannels(modelId, colorId, fileBlob, fileType, refId = null) {
  const model = await db.catalog.get(modelId);
  if (!model) return [];

  const color = await db.modelColors.get(colorId);
  if (!color) return [];

  const settings = await getSettings();
  const series = model.sizeSeriesId ? await db.sizeSeries.get(model.sizeSeriesId) : null;

  const { channels, brokenSizes } = calcColorChannelInfo(model, color, series, settings);

  for (const chatIdKey of channels) {
    // Build channel-specific caption
    let caption = '';
    if (chatIdKey === 'wholesaleChatId') {
      caption = buildWholesaleCaption(model, color, series);
    } else if (chatIdKey === 'retailChatId') {
      caption = buildRetailCaption(model, color, brokenSizes);
    } else if (chatIdKey === 'salesChatId') {
      caption = buildSalesCaption(model, color, series);
    } else {
      caption = `${model.code || 'Model'} — ${color.colorName || color.colorCode || ''}`;
    }

    await queueColorMediaGroup(chatIdKey, color, caption, refId || colorId, fileBlob, fileType);
  }

  return channels;
}

/**
 * Collect all media (photos + videos) available for a color, in order.
 * Assets must have either a blob or a previously-known fileId to be usable.
 *
 * @param color - the modelColors record
 * @param fallbackBlob - an optional just-added blob not yet stored in color.assets
 * @param fallbackType - 'photo' or 'video' for the fallback blob
 */
function collectAvailableAssets(color, fallbackBlob, fallbackType) {
  const assets = Array.isArray(color.assets) ? color.assets : [];
  const list = assets
    .filter(a => a && (a.blob || a.fileId))
    .map(a => ({
      assetId: a.id,
      type: (a.type === 'video') ? 'video' : 'photo',
      fileName: a.name || 'media',
    }));

  if (fallbackBlob && !assets.some(a => a && a.blob === fallbackBlob)) {
    list.unshift({
      assetId: null,
      type: (fallbackType === 'video') ? 'video' : 'photo',
      fileName: 'media',
      fallbackBlob,
    });
  }

  return list;
}

/**
 * Queue a color's media to a single display channel. If the color has more
 * than one usable asset, everything is grouped into ONE Telegram media group
 * (album) so the customer sees all photos + videos in a single message.
 *
 * @param chatIdKey - the display channel (wholesale/retail/sales)
 * @param color - the modelColors record
 * @param caption - channel-specific caption
 * @param refId - reference id (usually color.id)
 * @param fallbackBlob - optional just-added blob
 * @param fallbackType - 'photo' | 'video' for the fallback blob
 */
async function queueColorMediaGroup(chatIdKey, color, caption, refId, fallbackBlob, fallbackType) {
  const list = collectAvailableAssets(color, fallbackBlob, fallbackType);

  // No usable media at all → fall back to a text message
  if (list.length === 0) {
    await db.telegramQueue.add({
      priority: 2,
      type: 'text',
      status: 'pending',
      createdAt: Date.now(),
      attemptCount: 0,
      chatIdKey,
      text: caption,
      refId,
      modelColorId: color.id,
    });
    return;
  }

  // Single media → send as a normal photo/video (recovered at send time)
  if (list.length === 1) {
    const only = list[0];
    const item = {
      priority: 2,
      type: only.type,
      status: 'pending',
      createdAt: Date.now(),
      attemptCount: 0,
      chatIdKey,
      caption,
      refId,
      modelColorId: color.id,
      assetId: only.assetId,
      fileName: only.fileName,
    };
    if (only.fallbackBlob) item.blob = only.fallbackBlob;
    await db.telegramQueue.add(item);
    return;
  }

  // 2+ media → one Telegram album (media group). Blobs are NOT stored here to
  // avoid IndexedDB bloat; they are recovered from color.assets at send time.
  await db.telegramQueue.add({
    priority: 2,
    type: 'media_group',
    status: 'pending',
    createdAt: Date.now(),
    attemptCount: 0,
    chatIdKey,
    caption,
    refId,
    modelColorId: color.id,
    media: list.slice(0, 10), // Telegram max = 10 per group
  });
}

/**
 * Re-evaluate and update channel publishing when stock changes.
 * Called after any stock-changing operation.
 *
 * Key behaviors:
 * 1. Per-color evaluation (each color goes to its own channels)
 * 2. Wholesale: publish if full series, delete if no longer full
 * 3. Retail: always delete + re-publish to reflect updated broken sizes
 * 4. Stock = 0: DO NOT delete existing messages from any channel
 * 5. Live Stock: delete old message, send model photo with detailed breakdown
 */

const stockChangeLocks = {};

/**
 * Queue deletion of a published message record. For an album (media group) this
 * deletes EVERY message_id in the album, because deleting just one photo leaves
 * the rest of the album behind in the channel.
 */
async function queueDeleteForRecord(record) {
  const ids = (record.messageIds && Array.isArray(record.messageIds) && record.messageIds.length > 0)
    ? record.messageIds
    : [record.messageId];

  for (const mid of ids) {
    if (!mid) continue;
    await db.telegramQueue.add({
      chatIdKey: record.channel,
      type: 'delete',
      messageId: mid,
      status: 'pending',
      refId: record.refId,
      createdAt: Date.now(),
      attemptCount: 0,
    });
  }

  await db.telegramMessages.delete(record.id);
}

export async function onStockChanged(modelId) {
  // Proper mutex queue
  let releaseLock;
  const nextLock = new Promise(r => { releaseLock = r; });
  const currentLock = stockChangeLocks[modelId] || Promise.resolve();
  
  const finalLock = currentLock.then(() => nextLock);
  stockChangeLocks[modelId] = finalLock;

  await currentLock;

  try {

  const model = await db.catalog.get(modelId);
  if (!model) return;

  const settings = await getSettings();
  const series = model.sizeSeriesId ? await db.sizeSeries.get(model.sizeSeriesId) : null;
  const mColors = await db.modelColors.where('catalogId').equals(modelId).toArray();

  // ── Per-color channel management ───────────────────────────
  for (const color of mColors) {
    const { channels: targetChannels, brokenSizes, totalStock } = calcColorChannelInfo(model, color, series, settings);

    // Find where this color is currently published
    const publishedRecords = await db.telegramMessages.where('refId').equals(color.id).toArray();

    // ★ Stock = 0 → delete from all sale channels (nothing to sell)
    if (totalStock === 0) {
      for (const record of publishedRecords) {
        if (record.channel === 'liveStockChatId') continue;
        await queueDeleteForRecord(record);
        Logger.debug('telegram', 'onStockChanged', `Stock=0: queued delete for color ${color.id} from ${record.channel}`);
      }
      continue;
    }

    // ── Delete from channels no longer targeted ──────────────
    for (const record of publishedRecords) {
      if (record.channel === 'liveStockChatId') continue; // Live stock handled separately

      if (!targetChannels.includes(record.channel)) {
        // No longer targeted → delete
        await queueDeleteForRecord(record);
        Logger.debug('telegram', 'onStockChanged', `Queued delete for color ${color.id} from ${record.channel}`);
      } else if (record.channel === 'retailChatId') {
        // ★ Retail: ALWAYS delete old to re-publish with updated sizes
        await queueDeleteForRecord(record);
        Logger.debug('telegram', 'onStockChanged', `Queued retail refresh-delete for color ${color.id}`);
      }
    }

    // ── Publish to channels that need it ─────────────────────
    for (const channel of targetChannels) {
      // Re-read published records (may have changed after deletes above)
      const currentRecords = await db.telegramMessages.where('refId').equals(color.id).toArray();
      const isAlreadyPublished = currentRecords.some(r => r.channel === channel);

      if (!isAlreadyPublished) {
        // Build channel-specific caption
        let caption = '';
        if (channel === 'wholesaleChatId') {
          caption = buildWholesaleCaption(model, color, series);
        } else if (channel === 'retailChatId') {
          caption = buildRetailCaption(model, color, brokenSizes);
        } else if (channel === 'salesChatId') {
          caption = buildSalesCaption(model, color, series);
        } else {
          caption = `${model.code || 'Model'} — ${color.colorName || color.colorCode || ''}`;
        }

        // Send the color's FULL media set as ONE album (all photos + videos)
        await queueColorMediaGroup(channel, color, caption, color.id, null, null);
        Logger.debug('telegram', 'onStockChanged', `Queued media group for color ${color.id} to ${channel}`);
      }
    }
  }

  // ── Live Stock update (EDIT existing message instead of delete+send) ──
  try {
    const liveCaption = buildLiveStockCaption(model, mColors, series);
    const oldLiveRecords = (await db.telegramMessages.where('refId').equals(modelId).toArray())
      .filter(r => r.channel === 'liveStockChatId');

    // Check for existing pending live stock item (coalesce rapid updates)
    const allPending = await db.telegramQueue.where('status').anyOf('pending', 'sending').toArray();
    const existingPending = allPending.find(i =>
      i.chatIdKey === 'liveStockChatId' && i.refId === modelId
    );

    if (oldLiveRecords.length > 0) {
      // 1. Edit existing message
      const old = oldLiveRecords[0];
      const editType = (old.type === 'text') ? 'edit_text' : 'edit_caption';
      
      const queueItem = {
        priority: 1,
        type: editType,
        status: 'pending',
        createdAt: Date.now(),
        attemptCount: 0,
        chatIdKey: 'liveStockChatId',
        text: liveCaption, // we use 'text' for both text and caption in the queue for edits
        refId: modelId,
        messageId: old.messageId
      };

      if (existingPending) {
        Object.assign(existingPending, queueItem, { id: existingPending.id });
        await db.telegramQueue.put(existingPending);
        Logger.debug('telegram', 'onStockChanged', `Updated pending live stock edit for model ${modelId}`);
      } else {
        await db.telegramQueue.add(queueItem);
        Logger.debug('telegram', 'onStockChanged', `Queued live stock edit for model ${modelId}`);
      }

      // Cleanup duplicates if any exist somehow
      for (let i = 1; i < oldLiveRecords.length; i++) {
        if (oldLiveRecords[i].messageId !== old.messageId) {
          await db.telegramQueue.add({
            chatIdKey: 'liveStockChatId',
            type: 'delete',
            messageId: oldLiveRecords[i].messageId,
            status: 'pending',
            refId: modelId,
            createdAt: Date.now(),
            attemptCount: 0,
          });
        }
        await db.telegramMessages.delete(oldLiveRecords[i].id);
      }
    } else {
      // 2. No old message, send a new one
      let photoBlob = null;
      let photoAsset = null;
      let photoColorId = null;
      for (const mc of mColors) {
        const assets = Array.isArray(mc.assets) ? mc.assets : [];
        const imgAsset = assets.find(a => a.type === 'image' || a.type === 'photo');
        const anyAsset = imgAsset || assets[0];
        if (anyAsset && (anyAsset.blob || anyAsset.fileId)) {
          photoBlob = anyAsset.blob || null;
          photoAsset = anyAsset;
          photoColorId = mc.id;
          break;
        }
      }

      if (photoAsset) {
        const queueItem = {
          priority: 1,
          type: photoAsset.type === 'video' ? 'video' : 'photo',
          status: 'pending',
          createdAt: Date.now(),
          attemptCount: 0,
          chatIdKey: 'liveStockChatId',
          caption: liveCaption,
          refId: modelId,
          modelColorId: photoColorId,
          assetId: photoAsset.id,
        };
        // if (photoBlob) queueItem.blob = photoBlob; // Prevent storage bloat

        if (existingPending) {
          Object.assign(existingPending, queueItem, { id: existingPending.id });
          await db.telegramQueue.put(existingPending);
        } else {
          await db.telegramQueue.add(queueItem);
        }
      } else {
        const queueItem = {
          priority: 1,
          type: 'text',
          status: 'pending',
          createdAt: Date.now(),
          attemptCount: 0,
          chatIdKey: 'liveStockChatId',
          text: liveCaption,
          refId: modelId,
        };

        if (existingPending) {
          Object.assign(existingPending, queueItem, { id: existingPending.id });
          await db.telegramQueue.put(existingPending);
        } else {
          await db.telegramQueue.add(queueItem);
        }
      }
    } // end while
  } catch (e) {
    Logger.warn('telegram', 'onStockChanged', `Failed to queue live stock: ${e.message}`);
  }

  Logger.info('telegram', 'onStockChanged', `Model ${modelId} stock evaluated across ${mColors.length} colors`);

  // Kick the queue immediately after adding items (don't wait for the 15s timer)
  setTimeout(() => processTelegramQueue().catch(() => {}), 100);
  } finally {
    if (releaseLock) releaseLock();
    if (stockChangeLocks[modelId] === finalLock) {
       delete stockChangeLocks[modelId];
    }
  }
}

/**
 * Force resend all messages for a model (Resend button).
 * This queues deletes for everything currently published, removes the records,
 * and calls onStockChanged to queue fresh publishes.
 */
export async function forceResendModel(modelId) {
  const model = await db.catalog.get(modelId);
  if (!model) return;

  const mColors = await db.modelColors.where('catalogId').equals(modelId).toArray();
  const colorIds = mColors.map(c => c.id);
  
  // Find all messages for this model's colors + the live stock message
  const allRecords = await db.telegramMessages.toArray();
  const recordsToDelete = allRecords.filter(r => 
    colorIds.includes(r.refId) || (r.refId === modelId && r.channel === 'liveStockChatId')
  );

  for (const record of recordsToDelete) {
    await queueDeleteForRecord(record);
  }
  
  Logger.info('telegram', 'forceResend', `Queued deletes for ${recordsToDelete.length} existing messages for model ${modelId}`);

  // Recalculate and queue fresh publishes
  await onStockChanged(modelId);
}

let isProcessingQueue = false;


async function fetchWithTimeout(resource, options = {}) {
  const { timeout = 15000 } = options;
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(resource, { ...options, signal: controller.signal });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
}

export async function processTelegramQueue() {
  if (isWatcherDevice()) return; // Device 2 does not send to Telegram


  if (isProcessingQueue) return;
  const settings = await getSettings();
  if (!settings.botToken) return;

  isProcessingQueue = true;
  Logger.debug('telegram', 'processQueue', 'Lock acquired. Starting queue processor.');
  

  try {
    // 1. Sweep stuck 'sending' items back to 'pending'
    const stuckItems = await db.telegramQueue.where('status').equals('sending').toArray();
    if (stuckItems.length > 0) {
      for (const stuck of stuckItems) {
        stuck.status = 'pending';
        await db.telegramQueue.put(stuck);
      }
      Logger.warn('telegram', 'processQueue', `Recovered ${stuckItems.length} stuck 'sending' items.`);
    }

    let allPending = await db.telegramQueue.where('status').equals('pending').toArray();
    allPending.sort((a, b) => (a.priority || 99) - (b.priority || 99));

    if (allPending.length === 0) {
      isProcessingQueue = false;
      return;
    }

    const pending = allPending.slice(0, 20); // Process in batches of 20
    Logger.info('telegram', 'processQueue', `Processing batch of ${pending.length} messages (out of ${allPending.length} total)`);

    let lastChannel = null;

    for (const item of pending) {
      if (lastChannel) {
        const delayTime = lastChannel === item.chatIdKey ? 1200 : 350;
        await new Promise(r => setTimeout(r, delayTime));
      }
      lastChannel = item.chatIdKey;
      try {
        if (!item.id) {
           Logger.error('telegram', 'processQueue', 'Item has no ID!', { item });
           continue;
        }
        
        item.status = 'sending';
        await db.telegramQueue.put(item);
        Logger.debug('telegram', 'processQueue', `[Item ${item.id}] Status set to 'sending'. Type: ${item.type}, Channel: ${item.chatIdKey}`);
        
        const chatId = settings[item.chatIdKey] || item.chatId;
        if (!chatId) { 
          item.status = 'failed';
          item.error = `No chat ID configured for ${item.chatIdKey}`;
          await db.telegramQueue.put(item);
          continue; 
        }

        // Wholesale + Retail: send silently (disable_notification) so customers
        // aren't pinged on every stock/update — they check the channel when they want.
        const silent = item.chatIdKey === 'wholesaleChatId' || item.chatIdKey === 'retailChatId';

        let res;
        if (item.type === 'delete') {
          Logger.debug('telegram', 'processQueue', `[Item ${item.id}] Executing deleteMessage for chat ${chatId}, msgId ${item.messageId}`);
          res = await fetchWithTimeout(`https://api.telegram.org/bot${settings.botToken}/deleteMessage`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId, message_id: item.messageId }),
          });
        } else if (item.type === 'edit_caption' || item.type === 'edit_text') {
          const endpoint = item.type === 'edit_caption' ? 'editMessageCaption' : 'editMessageText';
          Logger.debug('telegram', 'processQueue', `[Item ${item.id}] Executing ${endpoint} for chat ${chatId}, msgId ${item.messageId}`);
          const body = {
            chat_id: chatId,
            message_id: item.messageId,
            parse_mode: 'HTML'
          };
          if (item.type === 'edit_caption') {
            body.caption = item.text || item.caption || '';
          } else {
            body.text = item.text || item.caption || '';
          }
          res = await fetchWithTimeout(`https://api.telegram.org/bot${settings.botToken}/${endpoint}`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          });
        } else if (item.type === 'text') {
          Logger.debug('telegram', 'processQueue', `[Item ${item.id}] Executing sendMessage for chat ${chatId}`);
          const textBody = { chat_id: chatId, text: item.text || '', parse_mode: 'HTML' };
          if (silent) textBody.disable_notification = true;
          res = await fetchWithTimeout(`https://api.telegram.org/bot${settings.botToken}/sendMessage`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(textBody),
          });
        } else if ((item.type === 'photo' || item.type === 'video') && item.blob) {
          const endpoint = item.type === 'video' ? 'sendVideo' : 'sendPhoto';
          Logger.debug('telegram', 'processQueue', `[Item ${item.id}] Executing ${endpoint} for chat ${chatId}. Payload size: ~${Math.round(item.blob.size/1024)}KB`);
          const formData = new FormData();
          formData.append('chat_id', chatId);
          formData.append(item.type, item.blob, item.fileName || 'media');
          if (item.caption || item.text) formData.append('caption', item.caption || item.text);
          formData.append('parse_mode', 'HTML');
          if (silent) formData.append('disable_notification', 'true');
          
          res = await fetchWithTimeout(`https://api.telegram.org/bot${settings.botToken}/${endpoint}`, {
            method: 'POST',
            body: formData,
          });
        } else if (item.type === 'media_group') {
          Logger.debug('telegram', 'processQueue', `[Item ${item.id}] Executing sendMediaGroup for chat ${chatId}`);
          const color = await db.modelColors.get(item.modelColorId);
          const mediaRefs = Array.isArray(item.media) ? item.media : [];
          const inputs = [];
          const formData = new FormData();
          formData.append('chat_id', chatId);
          let uploadedAny = false;

          for (let i = 0; i < mediaRefs.length; i++) {
            const ref = mediaRefs[i];
            const asset = (color && Array.isArray(color.assets))
              ? color.assets.find(a => a && a.id === ref.assetId)
              : null;
            const effectiveBlob = ref.fallbackBlob
              ? ref.fallbackBlob
              : (asset && asset.blob ? asset.blob : null);
            const fileId = asset && asset.fileId ? asset.fileId : null;
            const input = { type: ref.type, media: null };
            if (i === 0) {
              input.caption = item.caption || '';
              input.parse_mode = 'HTML';
            }

            if (effectiveBlob) {
              const attach = 'file' + i;
              input.media = 'attach://' + attach;
              formData.append(attach, effectiveBlob, (asset && asset.name) || ref.fileName || 'media');
              uploadedAny = true;
            } else if (fileId) {
              input.media = fileId;
            } else {
              continue; // skip unusable media
            }
            inputs.push(input);
          }

          if (inputs.length === 0) {
            Logger.warn('telegram', 'processQueue', `[Item ${item.id}] No usable media for group. Falling back to text!`);
            const textContent = item.caption || item.text || 'No description';
            const mgBody = { chat_id: chatId, text: textContent, parse_mode: 'HTML' };
            if (silent) mgBody.disable_notification = true;
            res = await fetchWithTimeout(`https://api.telegram.org/bot${settings.botToken}/sendMessage`, {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(mgBody),
            });
            item.type = 'text';
            item.text = textContent;
            await db.telegramQueue.put(item);
          } else {
            formData.append('media', JSON.stringify(inputs));
            if (silent) formData.append('disable_notification', 'true');
            res = await fetchWithTimeout(`https://api.telegram.org/bot${settings.botToken}/sendMediaGroup`, {
              method: 'POST',
              body: formData,
            });
          }
        } else if (item.type === 'photo' || item.type === 'video') {
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
               Logger.debug('telegram', 'processQueue', `[Item ${item.id}] Executing ${endpoint} for chat ${chatId} using recovered blob! Payload size: ~${Math.round(recoveredBlob.size/1024)}KB`);
               const formData = new FormData();
               formData.append('chat_id', chatId);
               formData.append(item.type, recoveredBlob, item.fileName || 'media');
               if (item.caption || item.text) formData.append('caption', item.caption || item.text);
               formData.append('parse_mode', 'HTML');
               if (silent) formData.append('disable_notification', 'true');
               
               res = await fetchWithTimeout(`https://api.telegram.org/bot${settings.botToken}/${endpoint}`, {
                 method: 'POST',
                 body: formData,
               });
           } else if (fileId) {
               const endpoint = item.type === 'video' ? 'sendVideo' : 'sendPhoto';
               Logger.debug('telegram', 'processQueue', `[Item ${item.id}] Executing ${endpoint} for chat ${chatId} using file_id!`);
               const body = {
                   chat_id: chatId,
                   [item.type]: fileId,
                   parse_mode: 'HTML'
               };
               if (item.caption || item.text) body.caption = item.caption || item.text;
               if (silent) body.disable_notification = true;
               
               res = await fetchWithTimeout(`https://api.telegram.org/bot${settings.botToken}/${endpoint}`, {
                 method: 'POST', headers: { 'Content-Type': 'application/json' },
                 body: JSON.stringify(body)
               });
           } else {
               Logger.warn('telegram', 'processQueue', `[Item ${item.id}] Missing media blob/fileId. Falling back to text message!`);
               const textContent = item.caption || item.text || 'No description';
               const missBody = { chat_id: chatId, text: textContent, parse_mode: 'HTML' };
               if (silent) missBody.disable_notification = true;
               res = await fetchWithTimeout(`https://api.telegram.org/bot${settings.botToken}/sendMessage`, {
                 method: 'POST', headers: { 'Content-Type': 'application/json' },
                 body: JSON.stringify(missBody)
               });
               item.type = 'text';
               item.text = textContent;
               await db.telegramQueue.put(item);
           }
        }

        Logger.debug('telegram', 'processQueue', `[Item ${item.id}] HTTP Response status: ${res.status}`);
        const data = await res.json();
        
        if (item.type === 'media_group') {
          if (data.ok) {
            const results = Array.isArray(data.result) ? data.result : [data.result];
            item.status = 'done';
            item.sentAt = Date.now();
            item.messageId = results[0] && results[0].message_id;
            await db.telegramQueue.put(item);

            // Capture file_ids + message ids for each media in the group, in order
            if (item.modelColorId && results.length > 0) {
              const col = await db.modelColors.get(item.modelColorId);
              if (col && Array.isArray(col.assets)) {
                for (let i = 0; i < results.length; i++) {
                  const ref = (Array.isArray(item.media) && item.media[i]) ? item.media[i] : null;
                  const r = results[i];
                  if (!ref || !r || !ref.assetId) continue;
                  const asset = col.assets.find(a => a && a.id === ref.assetId);
                  if (!asset) continue;
                  let fileId = null;
                  if (r.photo && r.photo.length > 0) fileId = r.photo[r.photo.length - 1].file_id;
                  else if (r.video) fileId = r.video.file_id;
                  if (fileId) asset.fileId = fileId;
                  asset.messageId = r.message_id;
                }
                await db.modelColors.update(col.id, { assets: col.assets });
              }
            }

            if (item.refId && results[0] && results[0].message_id) {
              await db.telegramMessages.put({
                id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString() + Math.random().toString(36),
                channel: item.chatIdKey,
                type: 'media_group',
                refId: item.refId,
                messageId: results[0].message_id,
                // An album spans multiple messages; keep them all so a stock=0 /
                // refresh delete can remove the ENTIRE album, not just the first photo.
                messageIds: results.map(r => r.message_id).filter(Boolean),
              });
              const chatStr = String(chatId);
              let link = '';
              if (chatStr.startsWith('@')) link = `https://t.me/${chatStr.slice(1)}/${results[0].message_id}`;
              else if (chatStr.startsWith('-100')) link = `https://t.me/c/${chatStr.slice(4)}/${results[0].message_id}`;
              else link = `https://t.me/c/${chatStr.replace(/^-/, '')}/${results[0].message_id}`;
              const colorId = item.modelColorId || item.refId;
              await db.modelColors.update(colorId, { link }).catch(() => {});
            }
            Logger.info('telegram', 'processQueue', `[Item ${item.id}] Media group sent (${results.length} items).`);
          } else {
            if (data.description?.includes('can\'t parse entities')) {
              if (item.caption) item.caption = item.caption.replace(/<[^>]*>?/gm, '');
              item.status = 'pending';
              item.attemptCount = (item.attemptCount || 0) + 1;
              await db.telegramQueue.put(item);
              continue;
            }
            if (data.description?.includes('caption is too long') && item.caption) {
              item.caption = item.caption.substring(0, 1000) + '...';
              item.status = 'pending';
              item.attemptCount = 0;
              await db.telegramQueue.put(item);
              continue;
            }
            Logger.warn('telegram', 'processQueue', `[Item ${item.id}] Media group rejected: ${data.description}`);
            item.attemptCount = (item.attemptCount || 0) + 1;
            if (item.attemptCount > 3 || data.description.includes('chat not found')) {
              item.status = 'failed';
              item.error = data.description;
            } else {
              item.status = 'pending';
              item.error = data.description;
            }
            await db.telegramQueue.put(item);
          }
          continue;
        }

        if (res.status === 429) {
           const retryAfter = data.parameters?.retry_after || 5;
           Logger.warn('telegram', 'processQueue', `[Item ${item.id}] RATE LIMIT 429. Waiting ${retryAfter}s.`);
           item.status = 'pending';
           item.error = `Rate limited. Retry after ${retryAfter}s`;
           await db.telegramQueue.put(item);
           await new Promise(r => setTimeout(r, retryAfter * 1000));
           continue;
        }
        
        if (data.ok) {
          Logger.info('telegram', 'processQueue', `[Item ${item.id}] Successfully sent. Message ID: ${data.result.message_id}`);
          item.status = 'done';
          item.sentAt = Date.now();
          item.messageId = data.result.message_id;
          await db.telegramQueue.put(item);

          // Capture file_id if it's a media upload and we have the reference
          if ((item.type === 'photo' || item.type === 'video') && item.assetId && item.modelColorId) {
             let fileId = null;
             if (item.type === 'photo' && data.result.photo && data.result.photo.length > 0) {
                 fileId = data.result.photo[data.result.photo.length - 1].file_id;
             } else if (item.type === 'video' && data.result.video) {
                 fileId = data.result.video.file_id;
             }
             
             if (fileId) {
                 const color = await db.modelColors.get(item.modelColorId);
                 if (color && color.assets) {
                     const assetIndex = color.assets.findIndex(a => a.id === item.assetId);
                     if (assetIndex >= 0) {
                         color.assets[assetIndex].fileId = fileId;
                         color.assets[assetIndex].messageId = data.result.message_id;
                         await db.modelColors.update(color.id, { assets: color.assets });
                         Logger.debug('telegram', 'processQueue', `Saved file_id ${fileId} to asset ${item.assetId}`);
                     }
                 }
             }
          }
          
          if (item.type !== 'delete' && item.type !== 'edit_caption' && item.type !== 'edit_text' && item.refId) {
            await db.telegramMessages.put({
               id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString() + Math.random().toString(36),
               channel: item.chatIdKey,
               type: item.type,
               refId: item.refId,
               messageId: item.messageId
            });
            
            // Also update legacy link in modelColors if needed
            if ((item.modelColorId || item.refId) && item.chatIdKey !== 'archiveChatId') {
              const colorId = item.modelColorId || item.refId;
              let link = '';
              const chatStr = String(chatId);
              if (chatStr.startsWith('@')) {
                link = `https://t.me/${chatStr.slice(1)}/${item.messageId}`;
              } else if (chatStr.startsWith('-100')) {
                link = `https://t.me/c/${chatStr.slice(4)}/${item.messageId}`;
              } else {
                link = `https://t.me/c/${chatStr.replace(/^-/, '')}/${item.messageId}`;
              }
              const color = await db.modelColors.get(colorId);
              if (color) {
                await db.modelColors.update(colorId, { link });
              }
            }
          }

          Logger.info('telegram', 'processQueue', `Action completed: ${item.id}`);
        } else {
          // Handle specific non-fatal errors
          if (item.type === 'delete' && data.description?.includes('message to delete not found')) {
             item.status = 'done';
             item.sentAt = Date.now();
             await db.telegramQueue.put(item);
          } else if ((item.type === 'edit_caption' || item.type === 'edit_text') && data.description?.includes('message to edit not found')) {
             item.status = 'done';
             item.sentAt = Date.now();
             await db.telegramQueue.put(item);
             await db.telegramMessages.where('messageId').equals(item.messageId).delete();
             
             // If this was a live stock edit, trigger onStockChanged again to recreate it!
             if (item.chatIdKey === 'liveStockChatId' && item.refId) {
                setTimeout(() => onStockChanged(item.refId).catch(() => {}), 1000);
             }
          } else if ((item.type === 'edit_caption' || item.type === 'edit_text') && data.description?.includes('message is not modified')) {
             item.status = 'done';
             item.sentAt = Date.now();
             await db.telegramQueue.put(item);
          } else {
             if (data.description?.includes('can\'t parse entities')) {
                 Logger.warn('telegram', 'processQueue', `[Item ${item.id}] HTML parsing failed. Stripping tags and retrying.`);
                 const stripHtml = (html) => html.replace(/<[^>]*>?/gm, '');
                 if (item.caption) item.caption = stripHtml(item.caption);
                 if (item.text) item.text = stripHtml(item.text);
                 item.status = 'pending';
                 item.attemptCount = (item.attemptCount || 0) + 1;
                 await db.telegramQueue.put(item);
                 continue;
             }
             
             // Handle caption too long error
             if (data.description?.includes('caption is too long') && item.caption) {
                Logger.warn('telegram', 'processQueue', `[Item ${item.id}] Caption too long. Truncating...`);
                item.caption = item.caption.substring(0, 1000) + '...';
                item.status = 'pending';
                item.attemptCount = 0; // Reset attempts to ensure it tries again
                await db.telegramQueue.put(item);
                continue;
             }
             Logger.warn('telegram', 'processQueue', `[Item ${item.id}] Telegram API rejected request: ${data.description}`);
             item.attemptCount = (item.attemptCount || 0) + 1;
             if (item.attemptCount > 3 || data.description.includes('chat not found')) {
               Logger.error('telegram', 'processQueue', `[Item ${item.id}] Abandoned after ${item.attemptCount} attempts or fatal error: ${data.description}`);
               item.status = 'failed';
               item.error = data.description;
             } else {
               Logger.debug('telegram', 'processQueue', `[Item ${item.id}] Will retry. Attempt: ${item.attemptCount}`);
               item.status = 'pending'; // retry
               item.error = data.description;
             }
             await db.telegramQueue.put(item);
          }
        }
      } catch(e) {
        Logger.error('telegram', 'processQueue', `[Item ${item?.id}] Exception caught during processing: ${e.message}`, { e });
        try {
           item.attemptCount = (item.attemptCount || 0) + 1;
           if (item.attemptCount > 3) {
             item.status = 'failed';
           } else {
             item.status = 'pending'; // retry
           }
           item.error = e.message;
           await db.telegramQueue.put(item);
        } catch(innerE) {
           Logger.error('telegram', 'processQueue', `Failed to update queue item ${item.id}`, innerE.message);
        }
      }
    }
  } catch (e) {
    Logger.error('telegram', 'processQueue', 'Queue runner crashed', e.message);
  } finally {
    Logger.debug('telegram', 'processQueue', 'Releasing queue processor lock.');
    isProcessingQueue = false;
    window.dispatchEvent(new CustomEvent('orta:queue_processed'));
  }
}
