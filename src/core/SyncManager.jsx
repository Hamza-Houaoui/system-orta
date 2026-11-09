import React, { useState, useEffect } from 'react';
import { syncService } from './syncService';
import GlobalSyncModal from '../components/GlobalSyncModal';

export default function SyncManager() {
  const [pendingUpdate, setPendingUpdate] = useState(null);

  useEffect(() => {
    // Poll every 10 seconds
    const interval = setInterval(async () => {
      // Don't poll if we are already showing the modal or currently pulling
      if (pendingUpdate || window.isPulling) return;
      
      const update = await syncService.checkPendingUpdate();
      if (update) {
        setPendingUpdate(update);
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [pendingUpdate]);

  const handleClose = () => {
    setPendingUpdate(null);
  };

  return <GlobalSyncModal pendingUpdate={pendingUpdate} onClose={handleClose} />;
}
