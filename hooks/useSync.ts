'use client';

import { useState, useEffect, useCallback } from 'react';
import syncEngine from '@/lib/sync/engine';
import db from '@/lib/db';
import { QueueStatus } from '@/types';

export function useSync() {
  const [status, setStatus] = useState<QueueStatus>({
    pendingCount: 0,
    syncing: false,
    isOnline: true,
  });

  // Update pending count
  const updatePendingCount = useCallback(async () => {
    const pendingItems = await db.getPendingSyncItems();
    const lastSync = await db.getSetting('lastSync');
    
    setStatus((prev) => ({
      ...prev,
      pendingCount: pendingItems.length,
      lastSync,
      isOnline: typeof navigator !== 'undefined' && navigator.onLine,
    }));
  }, []);

  // Perform sync
  const sync = useCallback(async () => {
    if (syncEngine.isCurrentlySyncing) {
      return { success: false, message: 'Sync already in progress' };
    }

    setStatus((prev) => ({ ...prev, syncing: true }));

    try {
      const result = await syncEngine.sync();
      await updatePendingCount();
      
      return {
        success: result.success,
        message: result.success 
          ? `Synced ${result.processed} items successfully`
          : `Sync completed with ${result.errors.length} errors`,
        processed: result.processed,
        errors: result.errors,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, message };
    } finally {
      setStatus((prev) => ({ ...prev, syncing: false }));
    }
  }, [updatePendingCount]);

  // Initial load and interval
  useEffect(() => {
    updatePendingCount();

    // Update pending count every 5 seconds
    const interval = setInterval(updatePendingCount, 5000);

    // Listen for online status changes
    const handleOnline = () => {
      setStatus((prev) => ({ ...prev, isOnline: true }));
      // Auto-sync when coming back online
      sync();
    };

    const handleOffline = () => {
      setStatus((prev) => ({ ...prev, isOnline: false }));
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      clearInterval(interval);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [updatePendingCount, sync]);

  return {
    ...status,
    sync,
    refreshPendingCount: updatePendingCount,
  };
}

export default useSync;
