"use client"

import { useState, useRef, useEffect } from 'react';
import { LogOut, Settings, User as UserIcon } from 'lucide-react';
import { Button } from './ui/button';
import Image from 'next/image';
import { User as AuthUser } from '@/lib/auth-context';

interface UserProfileProps {
  user: AuthUser | null;
  onSignOut: () => void;
}

export function UserProfile({ user, onSignOut }: UserProfileProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-center rounded-full overflow-hidden hover:ring-2 hover:ring-gray-200 transition-all"
      >
        {user?.picture ? (
          <Image
            src={user.picture}
            alt={user.name || 'User'}
            width={40}
            height={40}
            className="rounded-full"
          />
        ) : (
          <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
            <UserIcon className="w-6 h-6 text-gray-500" />
          </div>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg py-2 z-50 border">
          <div className="px-4 py-2 border-b">
            <p className="text-sm font-medium text-gray-900">{user?.name}</p>
            <p className="text-xs text-gray-500 truncate">{user?.email}</p>
          </div>
          
          <div className="py-1">
            <button
              onClick={() => {
                setIsOpen(false);
                onSignOut();
              }}
              className="w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
            >
              <LogOut className="w-4 h-4" />
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
