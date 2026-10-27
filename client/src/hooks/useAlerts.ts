import { useState, useEffect, useCallback, useRef } from 'react';
import { useSocketContext } from '../context/SocketContext';
import type { StockAlert } from '../types';
import { audioAlerts } from '../utils/audioAlerts';

interface Toast extends StockAlert {
  dismissAt: number;
}

function isIndexSymbol(symbol: string): boolean {
  const s = symbol.toUpperCase();
  return s.includes('NIFTY') || s.includes('BANKNIFTY') || s.includes('SENSEX') || s.includes('INDIA VIX');
}

export function useAlerts() {
  const { socket } = useSocketContext();
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [alertHistory, setAlertHistory] = useState<StockAlert[]>([]);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const lastAudioPlayedRef = useRef<Record<string, number>>({});

  // Request browser desktop notification permission on mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  // Fetch initial alert history from REST API on mount
  useEffect(() => {
    const fetchAlertHistory = async () => {
      try {
        const socketUrl = import.meta.env.VITE_SOCKET_URL || '';
        const baseUrl = socketUrl.endsWith('/') ? socketUrl.slice(0, -1) : socketUrl;
        const res = await fetch(`${baseUrl}/api/stocks/alerts?limit=300`);
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const result = await res.json();
        if (result?.success && Array.isArray(result.data)) {
          setAlertHistory(result.data);
        }
      } catch (err) {
        console.error('Failed to fetch initial alert history:', err);
      }
    };
    fetchAlertHistory();
  }, []);

  useEffect(() => {
    if (!socket) return;

    const handleAlert = (alert: StockAlert) => {
      const nowMs = Date.now();

      // Debounce audio playback (minimum 800ms between identical chimes) to prevent audio clutter
      const lastAudio = lastAudioPlayedRef.current[alert.alertType] || 0;
      if (nowMs - lastAudio > 800) {
        lastAudioPlayedRef.current[alert.alertType] = nowMs;
        if (alert.alertType === 'DAY_HIGH') {
          audioAlerts.playBreakoutChime();
        } else if (alert.alertType === 'DAY_LOW') {
          audioAlerts.playBreakdownTone();
        } else if (alert.alertType === 'VOLUME_SPIKE') {
          audioAlerts.playSpikeAlert();
        }
      }

      const isIdx = isIndexSymbol(alert.symbol) || alert.alertType === 'INDEX_MILESTONE';
      const durationMs = isIdx ? 8000 : 5000;
      const toast: Toast = { ...alert, dismissAt: nowMs + durationMs };
      const toastKey = `${alert.symbol}_${alert.alertType}`;

      // Show native desktop notification if permitted
      if ('Notification' in window && Notification.permission === 'granted') {
        try {
          const title = alert.alertType === 'INDEX_MILESTONE'
            ? `🎯 INDEX MILESTONE: ${alert.symbol}`
            : isIdx
            ? `📊 INDEX ALERT: ${alert.symbol}`
            : `⚡ ALERT: ${alert.symbol}`;
          const body = alert.details 
            ? `${alert.symbol} — ${alert.details} @ ₹${alert.price.toLocaleString('en-IN')}`
            : `${alert.symbol} ${alert.alertType === 'DAY_HIGH' ? 'reached Day High' : 'reached Day Low'} at ₹${alert.price.toLocaleString('en-IN')}`;

          new Notification(title, { body, silent: true });
        } catch {
          // Ignore desktop notification error
        }
      }

      // Deduplicate toast cards: update in-place if already on screen instead of stacking duplicates
      setToasts(prev => {
        const index = prev.findIndex(t => (t.id === toast.id) || (t.symbol === toast.symbol && t.alertType === toast.alertType));
        if (index >= 0) {
          const next = [...prev];
          next[index] = {
            ...toast,
            id: prev[index].id, // preserve key for seamless in-place price update without layout re-trigger
          };
          return next;
        }
        return [toast, ...prev].slice(0, 6);
      });

      // Deduplicate history: merge rapid successive alerts for the same symbol within 30 seconds
      setAlertHistory(prev => {
        const alertTime = new Date(alert.createdAt).getTime();
        const index = prev.findIndex(a =>
          a.id === alert.id ||
          (a.symbol === alert.symbol && a.alertType === alert.alertType && Math.abs(alertTime - new Date(a.createdAt).getTime()) < 30000)
        );
        if (index >= 0) {
          const next = [...prev];
          next[index] = alert;
          return next;
        }
        return [alert, ...prev].slice(0, 500);
      });

      // Reset / start auto-dismiss timer for this stock & alert type
      const existingTimer = timersRef.current.get(toastKey);
      if (existingTimer) {
        clearTimeout(existingTimer);
      }

      const timer = setTimeout(() => {
        setToasts(prev => prev.filter(t => !(t.symbol === alert.symbol && t.alertType === alert.alertType)));
        timersRef.current.delete(toastKey);
      }, durationMs);
      timersRef.current.set(toastKey, timer);
    };

    socket.on('alert:new', handleAlert);

    return () => {
      socket.off('alert:new', handleAlert);
      timersRef.current.forEach(t => clearTimeout(t));
      timersRef.current.clear();
    };
  }, [socket]);

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => {
      const target = prev.find(t => t.id === id);
      if (target) {
        const toastKey = `${target.symbol}_${target.alertType}`;
        const timer = timersRef.current.get(toastKey);
        if (timer) {
          clearTimeout(timer);
          timersRef.current.delete(toastKey);
        }
      }
      return prev.filter(t => t.id !== id);
    });
  }, []);

  const clearAll = useCallback(() => {
    setAlertHistory([]);
    setToasts([]);
    timersRef.current.forEach(t => clearTimeout(t));
    timersRef.current.clear();
  }, []);

  return { toasts, alertHistory, dismissToast, clearAll };
}
