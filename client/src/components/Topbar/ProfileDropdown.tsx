import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useDashboard } from '../../contexts/DashboardContext';
import { LogOut, User, ChevronUp, Edit3, Shield } from 'lucide-react';
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
  const { user, profile, signOut, revokeAdmin } = useAuth();
  const { setActiveTab } = useDashboard();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedAvatar, setSelectedAvatar] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Load saved avatar on mount
  useEffect(() => {
    const saved = localStorage.getItem('mmi-user-avatar');
    if (saved) setSelectedAvatar(saved);

    const handleAvatarChange = (e: any) => {
      if (e?.detail?.avatar) setSelectedAvatar(e.detail.avatar);
    };
    window.addEventListener('mmi:name_changed', handleAvatarChange);
    return () => window.removeEventListener('mmi:name_changed', handleAvatarChange);
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
    window.dispatchEvent(new CustomEvent('mmi:name_changed', {
      detail: { avatar: url, name: currentName }
    }));
  };

  const currentName = localStorage.getItem('mmi_user_name') || user?.email || 'Guest Trader';

  const getInitials = () => {
    if (currentName && currentName !== 'Guest Trader') {
      const parts = currentName.trim().split(' ');
      if (parts.length >= 2) {
        return (parts[0][0] + parts[1][0]).toUpperCase();
      }
      return currentName.substring(0, 2).toUpperCase();
    }
    return 'MM';
  };

  const handleEditName = () => {
    setIsOpen(false);
    window.dispatchEvent(new CustomEvent('mmi:open_name_modal'));
  };

  const handleLogout = async () => {
    try {
      setIsOpen(false);
      await signOut();
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      setActiveTab('Overview');
      window.dispatchEvent(new CustomEvent('mmi:open_name_modal'));
    }
  };

  return (
    <div className="profile-dropdown-container" ref={dropdownRef}>
      {/* Sleek User Card Trigger inside Sidebar */}
      <div 
        className={`profile-user-card ${isOpen ? 'is-open' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        title={currentName}
      >
        <div className="profile-card-avatar">
          {selectedAvatar ? (
            <img src={selectedAvatar} alt="User Avatar" className="avatar-image" />
          ) : (
            <div className="avatar-initials">
              {getInitials()}
            </div>
          )}
          <div className="status-indicator online" />
        </div>

        <div className="profile-user-info">
          <div className="profile-user-name" title={currentName}>
            {currentName}
          </div>
          <div className="profile-user-sub">
            {profile?.is_admin ? 'Administrator' : 'Active Trader'}
          </div>
        </div>

        <div className="profile-card-chevron">
          <ChevronUp 
            size={14} 
            style={{ 
              transform: isOpen ? 'rotate(180deg)' : 'none', 
              transition: 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)' 
            }} 
          />
        </div>
      </div>

      {/* Floating Menu positioned cleanly above sidebar footer */}
      {isOpen && (
        <div className="profile-dropdown-menu">
          <div className="dropdown-header">
            <div className="dropdown-header-top">
              <span className="user-email-title" title={currentName}>
                {currentName}
              </span>
              <span className={`user-role-badge ${profile?.is_admin ? 'admin' : ''}`}>
                {profile?.is_admin ? 'ADMIN' : 'TRADER'}
              </span>
            </div>
            <p className="user-status">
              Live Terminal Access · Real-Time Feed
            </p>
          </div>

          <div className="avatar-selection-section">
            <p className="section-title">Select Avatar</p>
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
                title="Use Default Initials"
              >
                {getInitials()}
              </div>
            </div>
          </div>

          <div className="dropdown-divider"></div>

          <button className="logout-button" onClick={handleEditName} style={{ color: 'var(--text-1)' }}>
            <Edit3 size={15} />
            <span>Change Name / Identity</span>
          </button>

          {profile?.is_admin && (
            <button
              className="logout-button"
              onClick={() => {
                revokeAdmin();
                setIsOpen(false);
              }}
              style={{ color: '#f59e0b' }}
            >
              <Shield size={15} />
              <span>Exit Admin Mode</span>
            </button>
          )}

          <button className="logout-button" onClick={handleLogout}>
            <LogOut size={15} />
            <span>Switch Trader</span>
          </button>
        </div>
      )}
    </div>
  );
}
