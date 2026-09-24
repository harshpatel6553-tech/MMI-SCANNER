import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useDashboard } from '../../contexts/DashboardContext';
import { LogOut, LogIn, User } from 'lucide-react';
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
      navigate('/login');
    }
  };

  const handleSignIn = () => {
    setIsOpen(false);
    navigate('/login');
  };

  return (
    <div className="profile-dropdown-container" ref={dropdownRef}>
      <div 
        className="avatar-trigger" 
        onClick={() => setIsOpen(!isOpen)}
        title={user ? user.email : 'Guest User · Click to Sign In'}
      >
        {selectedAvatar ? (
          <img src={selectedAvatar} alt="User Avatar" className="avatar-image" />
        ) : (
          <div className="avatar-initials">
            {user ? getInitials() : <User size={18} />}
          </div>
        )}
        <div className={`status-indicator ${user ? 'online' : 'offline'}`}></div>
      </div>

      {isOpen && (
        <div className="profile-dropdown-menu">
          <div className="dropdown-header">
            <p className="user-email">{user?.email || 'Guest User'}</p>
            <p className={`user-status ${!user ? 'offline' : ''}`}>
              {user ? (profile?.is_admin ? 'Administrator' : 'Active Member') : 'Not Signed In'}
            </p>
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

          {user ? (
            <button className="logout-button" onClick={handleLogout}>
              <LogOut size={16} />
              <span>Log Out</span>
            </button>
          ) : (
            <button className="login-button" onClick={handleSignIn}>
              <LogIn size={16} />
              <span>Sign In / Register</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
