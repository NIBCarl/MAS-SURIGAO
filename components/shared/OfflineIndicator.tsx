'use client';

import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useSync } from '@/hooks/useSync';
import { Wifi, WifiOff, Loader2, CloudOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState, useEffect } from 'react';

export function OfflineIndicator() {
  const { isOnline, isLieFi, effectiveOffline } = useOnlineStatus();
  const { pendingCount, syncing, sync, lastSync } = useSync();
  const [showDetails, setShowDetails] = useState(false);

  // Auto-show when offline with pending items
  useEffect(() => {
    if (effectiveOffline && pendingCount > 0) {
      setShowDetails(true);
    }
  }, [effectiveOffline, pendingCount]);

  // Don't show if online and nothing pending
  if (isOnline && !isLieFi && pendingCount === 0 && !syncing) {
    return (
      <div className="fixed top-0 left-0 right-0 z-50 bg-green-50 border-b border-green-200 px-4 py-1">
        <div className="flex items-center justify-center gap-2 text-xs text-green-700">
          <Wifi className="h-3 w-3" />
          <span>Live Sync</span>
          {lastSync && (
            <span className="text-green-600/70">
              Last sync: {new Date(lastSync).toLocaleTimeString()}
            </span>
          )}
        </div>
      </div>
    );
  }

  if (isLieFi) {
    return (
      <div className="fixed top-0 left-0 right-0 z-50 bg-yellow-50 border-b border-yellow-200 px-4 py-2">
        <div className="flex items-center justify-center gap-2 text-sm text-yellow-800">
          <CloudOff className="h-4 w-4" />
          <span>Slow connection - Working offline</span>
          {pendingCount > 0 && (
            <span className="bg-yellow-200 px-2 py-0.5 rounded-full text-xs">
              {pendingCount} pending
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-yellow-50 border-b border-yellow-200">
      <div className="flex items-center justify-between px-4 py-2">
        <div className="flex items-center gap-2 text-sm text-yellow-800">
          <WifiOff className="h-4 w-4" />
          <span>Offline Mode</span>
          {pendingCount > 0 && (
            <span className="bg-yellow-200 px-2 py-0.5 rounded-full text-xs">
              {pendingCount} pending
            </span>
          )}
        </div>
        
        {pendingCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => sync()}
            disabled={syncing || !isOnline}
            className="h-7 text-xs"
          >
            {syncing ? (
              <>
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                Syncing...
              </>
            ) : (
              'Sync Now'
            )}
          </Button>
        )}
      </div>
    </div>
  );
}

export default OfflineIndicator;
