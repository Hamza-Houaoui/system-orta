const fs = require('fs');
let code = fs.readFileSync('src/core/telegramPublisher.js', 'utf8');

// We will find:
//     let allPending = await db.telegramQueue.where('status').equals('pending').toArray();
//     allPending.sort((a, b) => (a.priority || 99) - (b.priority || 99));
//     if (allPending.length === 0) {
//       isProcessingQueue = false;
//       return;
//     }
//     const pending = allPending.slice(0, 20); // Process in batches of 20
//     Logger.info('telegram', 'processQueue', `Processing batch of ${pending.length} messages (out of ${allPending.length} total)`);
//     let lastChannel = null;
//     for (const item of pending) {

const oldBatch = `
    let allPending = await db.telegramQueue.where('status').equals('pending').toArray();
    allPending.sort((a, b) => (a.priority || 99) - (b.priority || 99));
    if (allPending.length === 0) {
      isProcessingQueue = false;
      return;
    }

    const pending = allPending.slice(0, 20); // Process in batches of 20
    Logger.info('telegram', 'processQueue', \`Processing batch of \${pending.length} messages (out of \${allPending.length} total)\`);

    let lastChannel = null;

    for (const item of pending) {`;

const newBatch = `
    let lastChannel = null;
    let hasMore = true;
    while (hasMore) {
      if (window._stopTelegramQueue) {
         window._stopTelegramQueue = false;
         break;
      }
      
      let allPending = await db.telegramQueue.where('status').equals('pending').toArray();
      allPending.sort((a, b) => (a.priority || 99) - (b.priority || 99));
      
      if (allPending.length === 0) {
        hasMore = false;
        break;
      }

      const pending = allPending.slice(0, 20);
      Logger.info('telegram', 'processQueue', \`Processing batch of \${pending.length} messages (out of \${allPending.length} total)\`);

      for (const item of pending) {
         if (window._stopTelegramQueue) break;`;

code = code.replace(oldBatch, newBatch);

// Add the closing brace for the while loop
// The end of the for loop is:
//       } catch(e) { ... }
//     }
//   } catch (e) {
const oldEnd = `      }
    }
  } catch (e) {`;

const newEnd = `      }
    }
  } catch (e) {`;

// Wait, the for loop closing is just:
//     }
//   } catch (e) {
// I need to add one more `}` for the while loop!
code = code.replace(
  `      }
    }
  } catch (e) {`,
  `      }
    } // end while
  } catch (e) {`
);

fs.writeFileSync('src/core/telegramPublisher.js', code);
console.log('Fixed batch loop');
