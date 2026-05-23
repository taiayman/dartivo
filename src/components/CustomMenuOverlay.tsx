'use client';

import React from 'react';
import { LogOut, UserCircle, Settings as SettingsIcon } from 'lucide-react';
import Link from 'next/link';

interface CustomMenuOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  userName?: string;
  userEmail?: string;
  userAvatarUrl?: string;
  userProfileUrl?: string; // Optional link to user profile page
  onSignOut: () => void;
  isLoading?: boolean; // To handle loading state during sign out
  hideSettingsLink?: boolean; // New prop to hide settings link
}

const CustomMenuOverlay: React.FC<CustomMenuOverlayProps> = ({ 
  isOpen, 
  onClose, 
  userName, 
  userEmail, 
  userAvatarUrl,
  userProfileUrl,
  onSignOut,
  isLoading = false, // Default loading to false
  hideSettingsLink = false // Default hideSettingsLink to false
}) => {
  if (!isOpen) return null;

  // Simple initials calculation (can be made more robust)
  const getInitials = (name?: string) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
  };

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // Close only if the click is on the backdrop itself, not the content
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-end z-50"
      onClick={handleOverlayClick} // Add backdrop click handler
    >
      {/* Menu Panel */}
      <div className="w-64 h-full bg-custom-darker shadow-xl flex flex-col p-4">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-semibold text-white">Menu</h3>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-gray-400 hover:bg-custom-dark hover:text-white transition-colors"
            aria-label="Close menu"
          >
            <LogOut size={20} />
          </button>
        </div>

        {/* User Info */}
        <div className="flex items-center mb-6">
          <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center mr-3">
            {userAvatarUrl ? (
              <div className="w-full h-full rounded-full overflow-hidden">
                <div 
                  className="w-full h-full rounded-full bg-center bg-cover" 
                  style={{backgroundImage: `url(${userAvatarUrl})`}}
                  role="img"
                  aria-label="User Avatar"
                ></div>
              </div>
            ) : (
              <span className="text-sm font-semibold text-gray-300">{getInitials(userName)}</span>
            )}
          </div>
          <div>
            <p className="text-sm font-medium text-white truncate">{userName || 'User'}</p>
            {userEmail && <p className="text-xs text-gray-400 truncate">{userEmail}</p>}
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="flex-grow space-y-2">
          {userProfileUrl && (
            <Link 
              href={userProfileUrl} 
              onClick={onClose} // Close menu on navigation
              className="flex items-center px-3 py-2 text-gray-300 hover:bg-gray-700 hover:text-white rounded-md transition-colors text-sm"
            >
              <UserCircle className="mr-3 h-5 w-5" />
              View Profile
            </Link>
          )}
          {!hideSettingsLink && ( // Conditionally render the Settings link
            <Link 
              href="/settings" 
              onClick={onClose} // Close menu on navigation
              className="flex items-center px-3 py-2 text-gray-300 hover:bg-gray-700 hover:text-white rounded-md transition-colors text-sm"
            >
              <SettingsIcon className="mr-3 h-5 w-5" />
              Settings
            </Link>
          )}
        </nav>

        {/* Sign Out */}
        <div className="mt-auto pt-4 border-t border-gray-700">
          <button
            onClick={() => {
              onSignOut(); 
              // Optionally keep menu open during sign-out or close immediately:
              // onClose(); 
            }}
            disabled={isLoading} // Disable button when loading
            className={`
              flex items-center w-full px-3 py-2 text-gray-300 hover:bg-red-800 hover:bg-opacity-30 hover:text-red-400 
              rounded-md transition-colors text-sm group
              disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-gray-300
            `}
          >
            <LogOut className="mr-3 h-5 w-5 text-gray-300 group-hover:text-red-400 transition-colors" />
            {isLoading ? 'Signing Out...' : 'Sign Out'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CustomMenuOverlay; 