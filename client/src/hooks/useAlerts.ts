import { useState, useEffect, useCallback, useRef } from 'react';
import { useSocketContext } from '../context/SocketContext';
import type { StockAlert } from '../types';

interface Toast extends StockAlert {
  dismissAt: number;
}

export function useAlerts() {
  const { socket } = useSocketContext();
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [alertHistory, setAlertHistory] = useState<StockAlert[]>([]);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // Fetch initial alert history from REST API on mount
  useEffect(() => {
    const fetchAlertHistory = async () => {
      try {
        const socketUrl = import.meta.env.VITE_SOCKET_URL || '';
        const baseUrl = socketUrl.endsWith('/') ? socketUrl.slice(0, -1) : socketUrl;
        const res = await fetch(`${baseUrl}/api/alerts?limit=100`);
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
      const toast: Toast = { ...alert, dismissAt: Date.now() + 5000 };

      setToasts(prev => {
        const index = prev.findIndex(t => t.id === toast.id);
        if (index >= 0) {
          const next = [...prev];
          next[index] = toast;
          return next;
        }
        return [toast, ...prev].slice(0, 5);
      });

      setAlertHistory(prev => {
        const index = prev.findIndex(a => a.id === alert.id);
        if (index >= 0) {
          // If it already exists, replace it and move it to the top so the user sees the updated price
          const next = [...prev];
          next.splice(index, 1);
          return [alert, ...next];
        }
        return [alert, ...prev].slice(0, 200);
      });

      // Auto-dismiss after 5 seconds
      const timer = setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== alert.id));
        timersRef.current.delete(alert.id);
      }, 5000);
      timersRef.current.set(alert.id, timer);
    };

    socket.on('alert:new', handleAlert);

    return () => {
      socket.off('alert:new', handleAlert);
      timersRef.current.forEach(t => clearTimeout(t));
    };
  }, [socket]);

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  const clearAll = useCallback(() => {
    setAlertHistory([]);
  }, []);

  return { toasts, alertHistory, dismissToast, clearAll };
}
