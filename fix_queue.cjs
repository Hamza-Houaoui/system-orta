const fs = require('fs');

let code = fs.readFileSync('src/core/telegramPublisher.js', 'utf8');

// 1. Add fetchWithTimeout helper
const fetchHelper = `
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
`;
if (!code.includes('fetchWithTimeout')) {
    code = code.replace('export async function processTelegramQueue() {', fetchHelper + '\nexport async function processTelegramQueue() {\n');
}

// 2. Replace all fetch( with fetchWithTimeout( inside processTelegramQueue
// We'll just do a regex replace for fetch( inside the function.
// Since fetch is only used in processTelegramQueue in this file, we can do global replace for fetch(
code = code.replace(/await fetch\(/g, 'await fetchWithTimeout(');

// 3. Add sweep for stuck 'sending' items
const sweepCode = `
  try {
    // 1. Sweep stuck 'sending' items back to 'pending'
    const stuckItems = await db.telegramQueue.where('status').equals('sending').toArray();
    if (stuckItems.length > 0) {
      for (const stuck of stuckItems) {
        stuck.status = 'pending';
        await db.telegramQueue.put(stuck);
      }
      Logger.warn('telegram', 'processQueue', \`Recovered \${stuckItems.length} stuck 'sending' items.\`);
    }

    const allPending = await db.telegramQueue.where('status').equals('pending').toArray();
`;
code = code.replace(/  try \{\n    const allPending = await db\.telegramQueue\.where\('status'\)\.equals\('pending'\)\.toArray\(\);/, sweepCode);

// 4. Fix Network Retry (lines 666-676)
const oldCatch = `      } catch(e) {
        Logger.error('telegram', 'processQueue', \`[Item \${item?.id}] Exception caught during processing: \${e.message}\`, { e });
        try {
           item.status = 'failed';
           item.error = e.message;
           item.attemptCount = (item.attemptCount || 0) + 1;
           await db.telegramQueue.put(item);
        } catch(innerE) {
           Logger.error('telegram', 'processQueue', \`Failed to update queue item \${item.id}\`, innerE.message);
        }
      }`;
const newCatch = `      } catch(e) {
        Logger.error('telegram', 'processQueue', \`[Item \${item?.id}] Exception caught during processing: \${e.message}\`, { e });
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
           Logger.error('telegram', 'processQueue', \`Failed to update queue item \${item.id}\`, innerE.message);
        }
      }`;
code = code.replace(oldCatch, newCatch);

// 5. Fix 429 Too Many Requests and HTML Entities
const oldDataOk = `        const data = await res.json();
        
        if (data.ok) {`;
const newDataOk = `        const data = await res.json();
        
        if (res.status === 429) {
           const retryAfter = data.parameters?.retry_after || 5;
           Logger.warn('telegram', 'processQueue', \`[Item \${item.id}] RATE LIMIT 429. Waiting \${retryAfter}s.\`);
           item.status = 'pending';
           item.error = \`Rate limited. Retry after \${retryAfter}s\`;
           await db.telegramQueue.put(item);
           await new Promise(r => setTimeout(r, retryAfter * 1000));
           continue;
        }
        
        if (data.ok) {`;
code = code.replace(oldDataOk, newDataOk);

const oldCaptionTooLong = `             // Handle caption too long error
             if (data.description?.includes('caption is too long') && item.caption) {`;
const newCaptionTooLong = `             if (data.description?.includes('can\\'t parse entities')) {
                 Logger.warn('telegram', 'processQueue', \`[Item \${item.id}] HTML parsing failed. Stripping tags and retrying.\`);
                 const stripHtml = (html) => html.replace(/<[^>]*>?/gm, '');
                 if (item.type === 'edit_caption' || item.type === 'photo' || item.type === 'video') {
                     item.caption = stripHtml(item.caption || item.text || '');
                 } else {
                     item.text = stripHtml(item.text || item.caption || '');
                 }
                 item.status = 'pending';
                 item.attemptCount = 0;
                 await db.telegramQueue.put(item);
                 continue;
             }
             
             // Handle caption too long error
             if (data.description?.includes('caption is too long') && item.caption) {`;
code = code.replace(oldCaptionTooLong, newCaptionTooLong);

// 6. Fix Archive refId clobbering modelColors.link
// In telegramPublisher.js:603 -> if (item.modelColorId || item.refId) {
// The archive channel has NO refId, but it DOES have modelColorId. We don't want archive links to clobber the modelColors link.
// We only want 'wholesaleChatId' or 'retailChatId' to clobber the link maybe? Wait, what channel gives the main link?
// The user says: "Archive items are not tracked in telegramMessages — same reason refId missing causes clobbering"
// The user says: "archive channel has modelColorId but no refId... the condition \`if (item.modelColorId || item.refId)\` evaluates true... so link is clobbered by archive"
// Fix: We can just ignore 'archiveChatId' from updating the link!
code = code.replace(
  `if (item.modelColorId || item.refId) {
              const colorId = item.modelColorId || item.refId;
              let link = '';`,
  `if ((item.modelColorId || item.refId) && item.chatIdKey !== 'archiveChatId') {
              const colorId = item.modelColorId || item.refId;
              let link = '';`
);

fs.writeFileSync('src/core/telegramPublisher.js', code);
console.log('Fixes applied to telegramPublisher.js');
