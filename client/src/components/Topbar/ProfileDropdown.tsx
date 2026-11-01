import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useDashboard } from '../../contexts/DashboardContext';
import { LogOut, LogIn, User, ChevronUp } from 'lucide-react';
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
  const navigate = useNavigate();
  const { user, profile, signOut } = useAuth();
  const { setActiveTab } = useDashboard();
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

  const handleLogout = async () => {
    try {
      setIsOpen(false);
      await signOut();
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      setActiveTab('Overview');
      navigate('/');
    }
  };

  const handleSignIn = () => {
    setIsOpen(false);
    navigate('/');
  };

  const username = user?.email ? user.email.split('@')[0] : 'Guest Trader';

  return (
    <div className="profile-dropdown-container" ref={dropdownRef}>
      {/* Sleek User Card Trigger inside Sidebar */}
      <div 
        className={`profile-user-card ${isOpen ? 'is-open' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        title={user ? user.email : 'Terminal Open Access'}
      >
        <div className="profile-card-avatar">
          {selectedAvatar ? (
            <img src={selectedAvatar} alt="User Avatar" className="avatar-image" />
          ) : (
            <div className="avatar-initials">
              {user ? getInitials() : <User size={16} />}
            </div>
          )}
          <div className="status-indicator online" />
        </div>

        <div className="profile-user-info">
          <div className="profile-user-name" title={user?.email || 'Guest Trader'}>
            {user?.email || 'Guest Trader'}
          </div>
          <div className="profile-user-sub">
            {user ? (profile?.is_admin ? 'Administrator' : 'Active Member') : 'Terminal Open Access'}
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
              <span className="user-email-title" title={user?.email || 'Active Member'}>
                {user?.email || 'Active Member'}
              </span>
              <span className={`user-role-badge ${profile?.is_admin ? 'admin' : ''}`}>
                {profile?.is_admin ? 'ADMIN' : 'MEMBER'}
              </span>
            </div>
            <p className="user-status">
              Terminal Open Access · Real-Time Feed
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

          {user && (
            <>
              <div className="dropdown-divider"></div>
              <button className="logout-button" onClick={handleLogout}>
                <LogOut size={15} />
                <span>Log Out</span>
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
