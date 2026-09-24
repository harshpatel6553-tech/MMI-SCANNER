import React, { useState, useEffect } from 'react';
import { useSocketContext } from '../../context/SocketContext';
import type { SystemAnnouncement } from '../../types';
import { motion, AnimatePresence } from 'framer-motion';
import { Megaphone, Sparkles, AlertTriangle, Wrench, X, CheckCircle2 } from 'lucide-react';
import { audioAlerts } from '../../utils/audioAlerts';
import './AnnouncementModal.css';

export function AnnouncementModal() {
  const { socket } = useSocketContext();
  const [announcement, setAnnouncement] = useState<SystemAnnouncement | null>(null);

  useEffect(() => {
    if (!socket) return;

    const handleAnnouncement = (data: SystemAnnouncement) => {
      if (!data || !data.id) return;
      
      // Check if already dismissed this specific announcement in this session
      const dismissed = sessionStorage.getItem(`mmi_dismissed_announcement_${data.id}`);
      if (dismissed === 'true') {
        return;
      }

      setAnnouncement(data);
      audioAlerts.playBreakoutChime();
    };

    const handleClearAnnouncement = () => {
      setAnnouncement(null);
    };

    socket.on('server:announcement' as any, handleAnnouncement);
    socket.on('server:clear-announcement' as any, handleClearAnnouncement);

    return () => {
      socket.off('server:announcement' as any, handleAnnouncement);
      socket.off('server:clear-announcement' as any, handleClearAnnouncement);
    };
  }, [socket]);

  const handleDismiss = () => {
    if (announcement) {
      audioAlerts.playClickHaptic();
      sessionStorage.setItem(`mmi_dismissed_announcement_${announcement.id}`, 'true');
    }
    setAnnouncement(null);
  };

  if (!announcement) return null;

  const getTypeMeta = (type: SystemAnnouncement['type']) => {
    switch (type) {
      case 'update':
        return {
          label: 'MAJOR RELEASE / UPDATE',
          color: 'var(--up, #00f59b)',
          icon: <Sparkles size={16} className="announcement-type-icon" />,
          accentClass: 'accent-update'
        };
      case 'alert':
        return {
          label: 'CRITICAL MARKET ALERT',
          color: 'var(--amber, #f59e0b)',
          icon: <AlertTriangle size={16} className="announcement-type-icon" />,
          accentClass: 'accent-alert'
        };
      case 'maintenance':
        return {
          label: 'SCHEDULED MAINTENANCE',
          color: 'var(--down, #f43f5e)',
          icon: <Wrench size={16} className="announcement-type-icon" />,
          accentClass: 'accent-maintenance'
        };
      case 'info':
      default:
        return {
          label: 'OFFICIAL ANNOUNCEMENT',
          color: 'var(--cyan, #00d4ff)',
          icon: <Megaphone size={16} className="announcement-type-icon" />,
          accentClass: 'accent-info'
        };
    }
  };

  const meta = getTypeMeta(announcement.type);
  const formattedTime = new Date(announcement.timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });

  return (
    <AnimatePresence>
      <div className="announcement-backdrop" onClick={handleDismiss}>
        <motion.div 
          className={`announcement-card ${meta.accentClass}`}
          initial={{ opacity: 0, scale: 0.9, y: 24 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Neon Top Accent Line */}
          <div className="announcement-glow-bar" style={{ background: meta.color }} />

          {/* Header */}
          <div className="announcement-header">
            <div className="announcement-pill" style={{ borderColor: meta.color, color: meta.color }}>
              <span className="announcement-pulse-dot" style={{ background: meta.color }} />
              {meta.icon}
              <span>{meta.label}</span>
            </div>
            <button className="announcement-close-btn" onClick={handleDismiss} title="Dismiss">
              <X size={18} />
            </button>
          </div>

          {/* Title & Body */}
          <div className="announcement-content">
            <h2 className="announcement-title">{announcement.title}</h2>
            <div className="announcement-message">{announcement.message}</div>
          </div>

          {/* Footer Metadata & Action */}
          <div className="announcement-footer">
            <div className="announcement-meta">
              <span className="announcement-time">BROADCASTED {formattedTime} IST</span>
              {announcement.author && (
                <span className="announcement-author">· {announcement.author}</span>
              )}
            </div>
            <button className="announcement-ack-btn" onClick={handleDismiss}>
              <CheckCircle2 size={16} />
              <span>Acknowledge & Close</span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
