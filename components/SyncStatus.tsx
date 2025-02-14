"use client"

import { Cloud, CloudOff, RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';

export type SyncState = 'synced' | 'syncing' | 'error' | 'offline';

interface SyncStatusProps {
  state: SyncState;
  lastSynced?: Date;
}

export function SyncStatus({ state, lastSynced }: SyncStatusProps) {
  const [timeAgo, setTimeAgo] = useState<string>('');

  useEffect(() => {
    if (!lastSynced) return;

    const updateTimeAgo = () => {
      const now = new Date();
      const diff = now.getTime() - lastSynced.getTime();
      
      if (diff < 60000) { // less than 1 minute
        setTimeAgo('just now');
      } else if (diff < 3600000) { // less than 1 hour
        const minutes = Math.floor(diff / 60000);
        setTimeAgo(`${minutes}m ago`);
      } else if (diff < 86400000) { // less than 1 day
        const hours = Math.floor(diff / 3600000);
        setTimeAgo(`${hours}h ago`);
      } else {
        const days = Math.floor(diff / 86400000);
        setTimeAgo(`${days}d ago`);
      }
    };

    updateTimeAgo();
    const interval = setInterval(updateTimeAgo, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [lastSynced]);

  return (
    <div className="flex items-center gap-2 text-sm">
      {state === 'synced' && (
        <>
          <Cloud className="h-4 w-4 text-green-600" />
          <span className="text-gray-600">
            Synced {timeAgo && `• ${timeAgo}`}
          </span>
        </>
      )}
      {state === 'syncing' && (
        <>
          <RefreshCw className="h-4 w-4 text-blue-600 animate-spin" />
          <span className="text-gray-600">Syncing...</span>
        </>
      )}
      {state === 'error' && (
        <>
          <CloudOff className="h-4 w-4 text-red-600" />
          <span className="text-red-600">Sync failed</span>
        </>
      )}
      {state === 'offline' && (
        <>
          <CloudOff className="h-4 w-4 text-gray-400" />
          <span className="text-gray-600">Offline</span>
        </>
      )}
    </div>
  );
}
