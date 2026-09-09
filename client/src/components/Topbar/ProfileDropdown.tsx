import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { LogOut, User } from 'lucide-react';
import './ProfileDropdown.css';

const AVATARS = [
  'https://assets.watermelon.sh/wm_emma.png',
  'https://assets.watermelon.sh/wm_ben.png',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Aneka',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Oliver',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Mia'
];

export function ProfileDropdown() {
  const { user, signOut } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedAvatar, setSelectedAvatar] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Load saved avatar on mount
  useEffect(() => {
    const saved = localStorage.getItem('mmi-user-avatar');
    if (saved) setSelectedAvatar(saved);
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectAvatar = (url: string) => {
    setSelectedAvatar(url);
    if (url) {
      localStorage.setItem('mmi-user-avatar', url);
    } else {
      localStorage.removeItem('mmi-user-avatar');
    }
  };

  const getInitials = () => {
    if (user?.email) {
      return user.email.substring(0, 2).toUpperCase();
    }
    return 'MM';
  };

  return (
    <div className="profile-dropdown-container" ref={dropdownRef}>
      <div className="avatar-trigger" onClick={() => setIsOpen(!isOpen)}>
        {selectedAvatar ? (
          <img src={selectedAvatar} alt="User Avatar" className="avatar-image" />
        ) : (
          <div className="avatar-initials">{getInitials()}</div>
        )}
        <div className="status-indicator"></div>
      </div>

      {isOpen && (
        <div className="profile-dropdown-menu">
          <div className="dropdown-header">
            <p className="user-email">{user?.email || 'Guest User'}</p>
            <p className="user-status">Available</p>
          </div>

          <div className="avatar-selection-section">
            <p className="section-title">Choose Avatar</p>
            <div className="avatar-grid">
              {AVATARS.map((url, i) => (
                <img 
                  key={i} 
                  src={url} 
                  alt={"Avatar " + i}
                  className={"avatar-option " + (selectedAvatar === url ? 'selected' : '')}
                  onClick={() => handleSelectAvatar(url)}
                />
              ))}
              <div 
                className={"avatar-option initials-option " + (!selectedAvatar ? 'selected' : '')}
                onClick={() => handleSelectAvatar('')}
              >
                {getInitials()}
              </div>
            </div>
          </div>

          <div className="dropdown-divider"></div>

          <button className="logout-button" onClick={signOut}>
            <LogOut size={16} />
            <span>Log Out</span>
          </button>
        </div>
      )}
    </div>
  );
}
