import React, { useState, useEffect } from 'react';
import { useSocketContext } from '../../context/SocketContext';
import { audioAlerts } from '../../utils/audioAlerts';
import './NameEntryModal.css';

const PRESET_AVATARS = [
  'https://assets.watermelon.sh/wm_emma.png',
  'https://assets.watermelon.sh/wm_ben.png',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Aneka',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Oliver',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Mia'
];

interface NameEntryModalProps {
  isOpen?: boolean;
  onSuccess?: (name: string) => void;
}

export function NameEntryModal({ isOpen: forcedOpen, onSuccess }: NameEntryModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const { socket } = useSocketContext();

  useEffect(() => {
    if (forcedOpen !== undefined) {
      setIsOpen(forcedOpen);
      const savedName = localStorage.getItem('mmi_user_name') || '';
      setName(savedName);
      setSelectedAvatar(localStorage.getItem('mmi-user-avatar') || PRESET_AVATARS[0]);
      return;
    }

    const savedName = localStorage.getItem('mmi_user_name');
    if (!savedName || savedName.trim().length === 0) {
      setIsOpen(true);
      setSelectedAvatar(localStorage.getItem('mmi-user-avatar') || PRESET_AVATARS[0]);
    } else {
      setIsOpen(false);
    }
  }, [forcedOpen]);

  // Listen for change name events triggered from ProfileDropdown
  useEffect(() => {
    const handleOpenModal = () => {
      setName(localStorage.getItem('mmi_user_name') || '');
      setSelectedAvatar(localStorage.getItem('mmi-user-avatar') || PRESET_AVATARS[0]);
      setIsOpen(true);
    };

    window.addEventListener('mmi:open_name_modal', handleOpenModal);
    return () => window.removeEventListener('mmi:open_name_modal', handleOpenModal);
  }, []);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = name.trim();

    if (!cleanName || cleanName.length < 2) {
      setError('Please enter your name (at least 2 letters)');
      return;
    }

    // Save trader name & avatar
    localStorage.setItem('mmi_user_name', cleanName);
    if (selectedAvatar) {
      localStorage.setItem('mmi-user-avatar', selectedAvatar);
    }

    const isAdmin = localStorage.getItem('mmi_admin_authorized') === 'true' ||
      ['harsh', 'harsh patel', 'admin', 'drakula', 'dhruvil', 'karan'].includes(cleanName.toLowerCase());

    // Emit live socket identification so admin sees them immediately
    if (socket) {
      socket.emit('auth:identify', {
        name: cleanName,
        email: cleanName,
        isAdmin,
        avatar: selectedAvatar || undefined,
        adminKey: isAdmin ? 'mmiadmin' : undefined
      });
    }

    // Dispatch global name update event for local components
    window.dispatchEvent(new CustomEvent('mmi:name_changed', {
      detail: { name: cleanName, avatar: selectedAvatar }
    }));

    audioAlerts.playHapticClick();
    setIsOpen(false);
    setError(null);

    if (onSuccess) {
      onSuccess(cleanName);
    }
  };

  return (
    <div className="name-entry-overlay">
      <div className="name-entry-card">
        <div className="name-entry-brand">
          <div className="name-entry-logo">
            <img src="/logo.jpg" alt="Market Minds" />
          </div>
          <div>
            <span className="name-entry-badge">MARKET MINDS ACCESS</span>
            <div style={{ fontSize: 13, color: '#94a3b8', fontWeight: 600 }}>Institutional Terminal</div>
          </div>
        </div>

        <h2 className="name-entry-title">Enter Terminal</h2>
        <p className="name-entry-desc">
          Instant real-time NSE equities, F&O derivatives telemetry, and institutional news alpha. Enter your name to enter.
        </p>

        <form className="name-entry-form" onSubmit={handleSubmit}>
          <div className="name-entry-input-group">
            <label className="name-entry-label">Trader Name</label>
            <div className="name-entry-input-wrapper">
              <input
                type="text"
                className="name-entry-input"
                placeholder="Enter your name (e.g. Harsh Patel, Rahul...)"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (error) setError(null);
                }}
                autoFocus
                maxLength={40}
              />
            </div>
            {error && <span className="name-entry-error">{error}</span>}
          </div>

          <div className="name-entry-input-group">
            <label className="name-entry-label">Choose Avatar</label>
            <div className="name-entry-avatars">
              {PRESET_AVATARS.map((avatarUrl, idx) => (
                <button
                  type="button"
                  key={idx}
                  className={`name-entry-avatar-btn ${selectedAvatar === avatarUrl ? 'selected' : ''}`}
                  onClick={() => setSelectedAvatar(avatarUrl)}
                >
                  <img src={avatarUrl} alt={`Avatar ${idx + 1}`} />
                </button>
              ))}
            </div>
          </div>

          <button type="submit" className="name-entry-submit-btn">
            <span>ENTER TERMINAL</span>
            <span>⚡</span>
          </button>
        </form>

        <p className="name-entry-footer-text">
          Zero passwords required · Connected directly to NSE feed
        </p>
      </div>
    </div>
  );
}
