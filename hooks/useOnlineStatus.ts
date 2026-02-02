'use client';

import { useState, useEffect, useCallback } from 'react';

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [isLieFi, setIsLieFi] = useState<boolean>(false);

  useEffect(() => {
    // Set initial status
    setIsOnline(typeof navigator !== 'undefined' && navigator.onLine);

    // Heartbeat check for Lie-Fi detection
    const checkRealConnectivity = async () => {
      if (!navigator.onLine) {
        setIsLieFi(false);
        return;
      }

      try {
        const start = Date.now();
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 3000);

        const response = await fetch('/api/heartbeat', {
          method: 'HEAD',
          cache: 'no-store',
          signal: controller.signal,
        });

        clearTimeout(timeout);
        const duration = Date.now() - start;

        if (duration > 2500 || !response.ok) {
          setIsLieFi(true);
        } else {
          setIsLieFi(false);
        }
      } catch {
        setIsLieFi(true);
      }
    };

    const handleOnline = () => {
      setIsOnline(true);
      checkRealConnectivity();
    };

    const handleOffline = () => {
      setIsOnline(false);
      setIsLieFi(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Periodic heartbeat check
    const interval = setInterval(checkRealConnectivity, 30000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, []);

  const checkOnline = useCallback(async (): Promise<boolean> => {
    if (!navigator.onLine) return false;
    
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);
      
      const response = await fetch('/api/heartbeat', {
        method: 'HEAD',
        cache: 'no-store',
        signal: controller.signal,
      });
      
      clearTimeout(timeout);
      return response.ok;
    } catch {
      return false;
    }
  }, []);

  return {
    isOnline,
    isLieFi,
    effectiveOffline: !isOnline || isLieFi,
    checkOnline,
  };
}

export default useOnlineStatus;
