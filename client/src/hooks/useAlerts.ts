import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useSocketContext } from '../context/SocketContext';
import type { StockAlert, StockData } from '../types';
import { audioAlerts } from '../utils/audioAlerts';

interface Toast extends StockAlert {
  dismissAt: number;
}

function isAllowedSource(source?: string): boolean {
  if (!source) return false;
  const s = source.toLowerCase().replace('@', '').trim();
  return s === 'redboxindia' || s === 'yatinmota';
}

const BLACKLISTED_TITLE_PATTERNS = [
  /outlook\s*(&|and)?\s*prediction/i,
  /stock market this week/i,
  /market this week/i,
  /weekly market/i,
  /technical analysis/i,
  /share market (live|news|today)/i,
  /open(s|ed)? flat/i,
  /end(s|ed)? flat/i,
  /amid selling in/i,
  /among \d+ companies/i,
  /nifty (may|could|will|prediction)/i,
  /prediction/i,
  /market watch/i,
  /top stocks to buy/i,
  /stocks in focus/i,
  /trading guide/i,
  /expert advice/i,
  /brokerage radar/i,
];

function isIndexSymbol(symbol: string): boolean {
  const s = (symbol || '').toUpperCase();
  return s.includes('NIFTY') || s.includes('BANKNIFTY') || s.includes('SENSEX') || s.includes('INDIA VIX');
}

export function useAlerts(stocks?: StockData[]) {
  const { socket } = useSocketContext();
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [serverAlerts, setServerAlerts] = useState<StockAlert[]>([]);
  const [stockRadarAlerts, setStockRadarAlerts] = useState<Map<string, StockAlert>>(new Map());
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const lastAudioPlayedRef = useRef<Record<string, number>>({});
  const lastStockPrices = useRef<Map<string, number>>(new Map());

  // Request browser desktop notification permission on mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  // 1. Initial & Perpetual Background Fetch from REST API (Runs every 5s, no hard refresh needed)
  useEffect(() => {
    let isMounted = true;

    const fetchAlertHistory = async () => {
      try {
        let alertsData: StockAlert[] = [];
        const socketUrl = import.meta.env.VITE_SOCKET_URL || 'https://35.226.242.164.sslip.io';
        const baseUrl = socketUrl.endsWith('/') ? socketUrl.slice(0, -1) : socketUrl;

        let fetched = false;
        try {
          const res = await fetch('/api/stocks/alerts?limit=300');
          if (res.ok) {
            const result = await res.json();
            if (result?.success && Array.isArray(result.data)) {
              alertsData = result.data;
              fetched = true;
            }
          }
        } catch {
          // relative failed, will try baseUrl
        }

        if (!fetched && baseUrl) {
          try {
            const res = await fetch(`${baseUrl}/api/stocks/alerts?limit=300`);
            if (res.ok) {
              const result = await res.json();
              if (result?.success && Array.isArray(result.data)) {
                alertsData = result.data;
                fetched = true;
              }
            }
          } catch {
            // remote fetch failed
          }
        }

        // Also fetch live F&O OI alerts directly
        try {
          let fnoRes = await fetch('/api/fno/oi-alerts').catch(() => null);
          if (!fnoRes || !fnoRes.ok) {
            fnoRes = await fetch(`${baseUrl}/api/fno/oi-alerts`).catch(() => null);
          }
          if (fnoRes && fnoRes.ok) {
            const fnoJson = await fnoRes.json();
            if (fnoJson?.success && Array.isArray(fnoJson.alerts)) {
              const mappedFno: StockAlert[] = fnoJson.alerts.map((a: any) => ({
                id: a.id,
                symbol: a.symbol || 'NIFTY',
                name: `${a.action === 'pulled' ? 'Pulled' : 'Placed'} ${a.contracts} (${a.side})`,
                alertType: 'FNO_OI',
                price: a.strike,
                details: a.message,
                createdAt: a.timestamp,
                strike: a.strike,
                side: a.side,
                action: a.action,
                contracts: a.contracts,
              }));

              const existingIds = new Set(alertsData.map(a => a.id));
              mappedFno.forEach(f => {
                if (!existingIds.has(f.id)) {
                  alertsData.push(f);
                }
              });
            }
          }
        } catch {
          // Ignore F&O alert fetch errors
        }

        if (!isMounted) return;

        // Deduplicate server alerts by symbol + alertType
        const dedupedMap = new Map<string, StockAlert>();
        alertsData.forEach(a => {
          if (a.alertType === 'NEWS') {
            if (isAllowedSource(a.symbol)) {
              dedupedMap.set(a.id, a);
            }
          } else {
            const key = `${a.symbol}_${a.alertType}`;
            const existing = dedupedMap.get(key);
            if (!existing || new Date(a.createdAt).getTime() > new Date(existing.createdAt).getTime()) {
              dedupedMap.set(key, a);
            }
          }
        });

        setServerAlerts(Array.from(dedupedMap.values()));
      } catch (err) {
        console.error('Failed to fetch initial alert history:', err);
      }
    };

    fetchAlertHistory();
    const pollTimer = setInterval(fetchAlertHistory, 5000);

    return () => {
      isMounted = false;
      clearInterval(pollTimer);
    };
  }, []);

  // Trigger audio, toasts, and desktop notifications
  const triggerLiveAlert = useCallback((alert: StockAlert) => {
    const nowMs = Date.now();

    // Audio Debounce (minimum 800ms)
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

    // Desktop Notification
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        const title = alert.alertType === 'NEWS'
          ? `⚡ BREAKING NEWS: ${alert.symbol}`
          : alert.alertType === 'INDEX_MILESTONE'
          ? `🎯 INDEX MILESTONE: ${alert.symbol}`
          : isIdx
          ? `📊 INDEX ALERT: ${alert.symbol}`
          : `⚡ ALERT: ${alert.symbol}`;
        const body = alert.details || `${alert.symbol} ${alert.alertType === 'DAY_HIGH' ? 'reached Day High' : 'reached Day Low'} at ₹${alert.price.toLocaleString('en-IN')}`;
        new Notification(title, { body, silent: true });
      } catch {
        // Ignore desktop notification error
      }
    }

    // Deduplicate toast cards
    setToasts(prev => {
      const index = prev.findIndex(t => (t.id === toast.id) || (t.symbol === toast.symbol && t.alertType === toast.alertType));
      if (index >= 0) {
        const next = [...prev];
        next[index] = { ...toast, id: prev[index].id };
        return next;
      }
      return [toast, ...prev].slice(0, 6);
    });

    // Reset auto-dismiss timer
    const existingTimer = timersRef.current.get(toastKey);
    if (existingTimer) clearTimeout(existingTimer);
    const timer = setTimeout(() => {
      setToasts(prev => prev.filter(t => !(t.symbol === alert.symbol && t.alertType === alert.alertType)));
      timersRef.current.delete(toastKey);
    }, durationMs);
    timersRef.current.set(toastKey, timer);
  }, []);

  // 2. Real-Time Stock Radar Scanner:
  // Detects Day Highs, Day Lows, and Volume Surges across the active 523 securities
  useEffect(() => {
    if (!stocks || stocks.length === 0) return;

    const now = new Date();
    const nowIso = now.toISOString();

    setStockRadarAlerts(prevMap => {
      const nextMap = new Map(prevMap);

      for (const s of stocks) {
        if (!s || s.price <= 0 || s.dayHigh <= 0 || s.dayLow <= 0) continue;
        if (s.dayHigh < s.dayLow || s.dayHigh === s.dayLow) continue;

        const spread = s.dayHigh - s.dayLow;
        if (spread <= 0.05) continue;

        const distHighPct = Math.max(0, ((s.dayHigh - s.price) / s.dayHigh) * 100);
        const distLowPct = Math.max(0, ((s.price - s.dayLow) / s.dayLow) * 100);

        const isBreakoutHigh = s.price >= s.dayHigh || s.atDayHigh;
        const isNearHigh = distHighPct <= 0.35;
        const isBreakdownLow = s.price <= s.dayLow || s.atDayLow;
        const isNearLow = distLowPct <= 0.35;

        // Check timestamp age: if stock quote is older than 15 mins, stamp with current time
        const quoteTime = s.lastUpdated ? new Date(s.lastUpdated).getTime() : 0;
        const quoteAgeMs = Math.abs(now.getTime() - quoteTime);
        const freshTimestamp = (quoteTime > 0 && quoteAgeMs < 15 * 60 * 1000) ? s.lastUpdated! : nowIso;

        // Check if price ticked up to a new peak
        const prevPrice = lastStockPrices.current.get(s.symbol);
        if (prevPrice !== undefined && s.price > prevPrice && isBreakoutHigh) {
          triggerLiveAlert({
            id: `dh-live-${s.symbol}-${Date.now()}`,
            symbol: s.symbol,
            name: s.name,
            alertType: 'DAY_HIGH',
            price: s.price,
            change: s.change,
            changePercent: s.changePercent,
            details: `Cleared session high at ₹${s.price.toFixed(2)} (+${s.changePercent.toFixed(2)}%)`,
            createdAt: freshTimestamp,
          });
        } else if (prevPrice !== undefined && s.price < prevPrice && isBreakdownLow) {
          triggerLiveAlert({
            id: `dl-live-${s.symbol}-${Date.now()}`,
            symbol: s.symbol,
            name: s.name,
            alertType: 'DAY_LOW',
            price: s.price,
            change: s.change,
            changePercent: s.changePercent,
            details: `Broke session low at ₹${s.price.toFixed(2)} (${s.changePercent.toFixed(2)}%)`,
            createdAt: freshTimestamp,
          });
        }
        lastStockPrices.current.set(s.symbol, s.price);

        // ── Day High Alert ──
        if (isBreakoutHigh || isNearHigh) {
          const key = `${s.symbol}_DAY_HIGH`;
          nextMap.set(key, {
            id: `dh-${s.symbol}`,
            symbol: s.symbol,
            name: s.name,
            alertType: 'DAY_HIGH',
            price: s.price,
            change: s.change,
            changePercent: s.changePercent,
            details: isBreakoutHigh
              ? `Cleared previous Day High · New Session Peak at ₹${s.price.toFixed(2)}`
              : `Testing Day High · Within ${distHighPct.toFixed(2)}% of High (₹${s.dayHigh.toFixed(2)})`,
            createdAt: freshTimestamp,
          });
        }

        // ── Day Low Alert ──
        if (isBreakdownLow || isNearLow) {
          const key = `${s.symbol}_DAY_LOW`;
          nextMap.set(key, {
            id: `dl-${s.symbol}`,
            symbol: s.symbol,
            name: s.name,
            alertType: 'DAY_LOW',
            price: s.price,
            change: s.change,
            changePercent: s.changePercent,
            details: isBreakdownLow
              ? `Broke Day Low level · New Session Low at ₹${s.price.toFixed(2)}`
              : `Testing Day Low · Within ${distLowPct.toFixed(2)}% of Low (₹${s.dayLow.toFixed(2)})`,
            createdAt: freshTimestamp,
          });
        }

        // ── Volume Surge Alert ──
        if (s.volumeSpike || (s.relativeVolume && s.relativeVolume >= 2.0)) {
          const key = `${s.symbol}_VOLUME_SPIKE`;
          nextMap.set(key, {
            id: `vs-${s.symbol}`,
            symbol: s.symbol,
            name: s.name,
            alertType: 'VOLUME_SPIKE',
            price: s.price,
            change: s.change,
            changePercent: s.changePercent,
            details: `Volume Surge: ${(s.relativeVolume || 2).toFixed(1)}x institutional velocity`,
            createdAt: freshTimestamp,
          });
        }
      }

      return nextMap;
    });
  }, [stocks, triggerLiveAlert]);

  // 3. Live Socket.IO Alerts Listener (handles News Alerts & Server-Broadcasted Alerts)
  useEffect(() => {
    if (!socket) return;

    const handleAlert = (alert: StockAlert) => {
      // Discard useless blog and non-whitelisted news alerts
      if (alert.alertType === 'NEWS') {
        const src = (alert.symbol || '').toLowerCase();
        if (!isAllowedSource(src)) {
          return;
        }
        const titleText = (alert.name || alert.details || '').toLowerCase();
        for (const pat of BLACKLISTED_TITLE_PATTERNS) {
          if (pat.test(titleText)) return;
        }
      }

      triggerLiveAlert(alert);

      // Merge into server alerts list
      setServerAlerts(prev => {
        const next = [...prev];
        const key = alert.alertType === 'NEWS' ? alert.id : `${alert.symbol}_${alert.alertType}`;
        const existingIdx = next.findIndex(a => (a.alertType === 'NEWS' ? a.id === key : `${a.symbol}_${a.alertType}` === key));
        if (existingIdx >= 0) {
          next[existingIdx] = alert;
        } else {
          next.unshift(alert);
        }
        return next.slice(0, 500);
      });
    };

    socket.on('alert:new', handleAlert);

    return () => {
      socket.off('alert:new', handleAlert);
    };
  }, [socket, triggerLiveAlert]);

  // 4. Combined, perfectly unified Alert History with Stock Alerts
  const alertHistory = useMemo(() => {
    const combinedMap = new Map<string, StockAlert>();

    // Add server alerts (including News and F&O)
    serverAlerts.forEach(a => {
      const key = a.alertType === 'NEWS' ? a.id : `${a.symbol}_${a.alertType}`;
      combinedMap.set(key, a);
    });

    // Layer active stock radar alerts (takes precedence for live prices)
    stockRadarAlerts.forEach((a, key) => {
      combinedMap.set(key, a);
    });

    const list = Array.from(combinedMap.values());

    // Sort: Fresh breakouts first, then by timestamp descending
    list.sort((a, b) => {
      const timeA = new Date(a.createdAt).getTime() || 0;
      const timeB = new Date(b.createdAt).getTime() || 0;
      return timeB - timeA;
    });

    return list;
  }, [serverAlerts, stockRadarAlerts]);

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
    setServerAlerts([]);
    setStockRadarAlerts(new Map());
    setToasts([]);
    timersRef.current.forEach(t => clearTimeout(t));
    timersRef.current.clear();
  }, []);

  return { toasts, alertHistory, dismissToast, clearAll };
}
