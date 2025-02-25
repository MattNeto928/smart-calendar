"use client"

import { useEffect, useState } from 'react';
import { Cloud, X, Trash2, PencilLine } from 'lucide-react';

interface SyncNotificationProps {
  message: string;
  type: 'success' | 'error';
  onClose: () => void;
  onCloseStart?: () => void;  // Called when close animation starts
  action?: 'delete' | 'modify';
}

export function SyncNotification({ message, type, onClose, onCloseStart, action }: SyncNotificationProps) {
  const [isVisible, setIsVisible] = useState(true);
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      handleClose();
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

  const handleClose = () => {
    setIsExiting(true);
    onCloseStart?.();  // Trigger immediate callback
    setTimeout(() => {
      setIsVisible(false);
      onClose();
    }, 200);
  };

  if (!isVisible) return null;

  return (
    <div
      className={`
        fixed top-4 right-4 max-w-sm w-full bg-white rounded-lg shadow-lg border p-4
        transition-all duration-200 ease-in-out
        ${isExiting ? 'opacity-0 -translate-y-2' : 'opacity-100 translate-y-0'}
        ${type === 'success' ? 'border-green-100' : 'border-red-100'}
      `}
    >
      <div className="flex items-center gap-3">
        <div
          className={`rounded-full p-2 ${
            type === 'success'
              ? 'bg-green-100 text-green-600'
              : 'bg-red-100 text-red-600'
          }`}
        >
          {type === 'success' ? (
            action === 'delete' ? (
              <Trash2 className="h-4 w-4" />
            ) : action === 'modify' ? (
              <PencilLine className="h-4 w-4" />
            ) : (
              <Cloud className="h-4 w-4" />
            )
          ) : (
            <X className="h-4 w-4" />
          )}
        </div>
        <p className="flex-1 text-sm text-gray-600">{message}</p>
        <button
          onClick={handleClose}
          className="text-gray-400 hover:text-gray-500"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
