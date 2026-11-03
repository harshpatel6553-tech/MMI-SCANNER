import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useSocketContext } from '../context/SocketContext';
import type { StockAlert, StockData } from '../types';
import { audioAlerts } from '../utils/audioAlerts';

export interface Toast extends StockAlert {
  dismissAt: number;
}

function isIndexSymbol(symbol: string): boolean {
  const s = (symbol || '').toUpperCase();
  return (
    s.includes('NIFTY') ||
    s.includes('BANKNIFTY') ||
    s.includes('SENSEX') ||
    s.includes('INDIA VIX') ||
    s.includes('INDEX')
  );
}

function isAllowedNewsSource(source?: string): boolean {
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

export function useAlerts(stocks?: StockData[]) {
  const { socket } = useSocketContext();
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [serverAlerts, setServerAlerts] = useState<StockAlert[]>([]);
  const [radarAlerts, setRadarAlerts] = useState<Map<string, StockAlert>>(new Map());

  const toastTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const lastSoundPlayedRef = useRef<Record<string, number>>({});
  
  // Tracking symbol alert state to avoid repetitive spam while guaranteeing fresh pop-ups
  const symbolAlertState = useRef<Map<string, {
    lastHighPrice?: number;
    lastLowPrice?: number;
    lastHighTime?: number;
    lastLowTime?: number;
  }>>(new Map());

  // Set of keys that already toasted in this session
  const alertedToastKeysRef = useRef<Set<string>>(new Set());

  // Request browser desktop notification permission on mount
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  // ── Trigger Toast Pop-up & Audio Chime ────────────────────────
  const triggerLiveAlert = useCallback((alert: StockAlert) => {
    const nowMs = Date.now();

    // 1. Audio Debounce (minimum 500ms between audio alerts)
    const lastAudio = lastSoundPlayedRef.current[alert.alertType] || 0;
    if (nowMs - lastAudio > 500) {
      lastSoundPlayedRef.current[alert.alertType] = nowMs;
      if (alert.alertType === 'DAY_HIGH') {
        audioAlerts.playBreakoutChime();
      } else if (alert.alertType === 'DAY_LOW') {
        audioAlerts.playBreakdownTone();
      } else if (alert.alertType === 'VOLUME_SPIKE') {
        audioAlerts.playSpikeAlert();
      }
    }

    const isIdx = isIndexSymbol(alert.symbol) || alert.alertType === 'INDEX_MILESTONE';
    const durationMs = isIdx ? 7500 : 6000;
    const toast: Toast = { ...alert, dismissAt: nowMs + durationMs };
    const toastKey = `${alert.symbol}_${alert.alertType}`;

    // 2. Desktop Notification
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      try {
        const title = isIdx
          ? `🎯 INDEX ALERT: ${alert.symbol}`
          : alert.alertType === 'DAY_HIGH'
          ? `🚀 DAY HIGH BREAK: ${alert.symbol}`
          : alert.alertType === 'DAY_LOW'
          ? `🔻 DAY LOW BREAK: ${alert.symbol}`
          : `⚡ ${alert.symbol}`;
        const body = alert.details || `${alert.symbol} touched ${alert.alertType === 'DAY_HIGH' ? 'Day High' : 'Day Low'} at ₹${alert.price.toLocaleString('en-IN')}`;
        new Notification(title, { body, silent: true });
      } catch {
        // Desktop notification error ignored
      }
    }

    // 3. Add to Pop-up Toast list (Maximum 3 visible simultaneously)
    setToasts(prev => {
      const idx = prev.findIndex(t => (t.id === toast.id) || (t.symbol === toast.symbol && t.alertType === toast.alertType));
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = { ...toast, id: prev[idx].id };
        return copy;
      }
      return [toast, ...prev].slice(0, 3);
    });

    // 4. Auto-dismiss timer
    const prevTimer = toastTimersRef.current.get(toastKey);
    if (prevTimer) clearTimeout(prevTimer);
    const newTimer = setTimeout(() => {
      setToasts(prev => prev.filter(t => !(t.symbol === alert.symbol && t.alertType === alert.alertType)));
      toastTimersRef.current.delete(toastKey);
    }, durationMs);
    toastTimersRef.current.set(toastKey, newTimer);
  }, []);

  // ── 1. Initial REST fetch and background 5s refresh for server alerts ──
  useEffect(() => {
    let isMounted = true;

    const fetchServerAlerts = async () => {
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
          // relative failed, try baseUrl
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

        // Also fetch live F&O OI alerts
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
          // Ignore F&O fetch errors
        }

        if (!isMounted) return;

        // Deduplicate server alerts
        const dedupedMap = new Map<string, StockAlert>();
        alertsData.forEach(a => {
          if (a.alertType === 'NEWS') {
            if (isAllowedNewsSource(a.symbol)) {
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
      } catch {
        // Fallback silently
      }
    };

    fetchServerAlerts();
    const interval = setInterval(fetchServerAlerts, 5000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // ── 2. Real-Time Radar Scanner: Detects Day High & Day Low as soon as hit ──
  useEffect(() => {
    if (!stocks || stocks.length === 0) return;

    const now = new Date();
    const nowIso = now.toISOString();
    const nowMs = now.getTime();

    setRadarAlerts(prevMap => {
      const nextMap = new Map(prevMap);

      for (const s of stocks) {
        if (!s || s.price <= 0 || s.dayHigh <= 0 || s.dayLow <= 0) continue;
        if (s.dayHigh <= s.dayLow) continue;

        // CRITICAL: Reject stale quotes from previous month/session (e.g. October 30th quotes)
        if (s.lastUpdated && s.lastUpdated.includes('2026-10-')) continue;

        const spread = s.dayHigh - s.dayLow;
        if (spread <= 0.05) continue;

        const distHighPct = Math.max(0, ((s.dayHigh - s.price) / s.dayHigh) * 100);
        const distLowPct = Math.max(0, ((s.price - s.dayLow) / s.dayLow) * 100);

        // ══════════════════════════════════════════════════════════════════════
        // STRICT POSITIVE/NEGATIVE MOMENTUM FILTER:
        // - A Day High alert MUST have positive change (changePercent > 0.05% and change > 0).
        //   Flat stocks like HEG (+0.00%) or down stocks like INFY (-0.21%) are STRICTLY BLOCKED.
        // - A Day Low alert MUST have negative change (changePercent < -0.05% and change < 0).
        // ══════════════════════════════════════════════════════════════════════
        const isGaining = (s.changePercent ?? 0) > 0.05 && (s.change ?? 0) > 0;
        const isDeclining = (s.changePercent ?? 0) < -0.05 && (s.change ?? 0) < 0;

        const isBreakoutHigh = s.price >= s.dayHigh || s.atDayHigh === true;
        const isDayHighHit = isGaining && (isBreakoutHigh || distHighPct <= 0.15);

        const isBreakdownLow = s.price <= s.dayLow || s.atDayLow === true;
        const isDayLowHit = isDeclining && (isBreakdownLow || distLowPct <= 0.15);

        // Timestamp hygiene: if stock timestamp is older than 10 mins, stamp with current time
        const quoteTime = s.lastUpdated ? new Date(s.lastUpdated).getTime() : 0;
        const quoteAgeMs = Math.abs(nowMs - quoteTime);
        const freshTimestamp = (quoteTime > 0 && quoteAgeMs < 10 * 60 * 1000) ? s.lastUpdated! : nowIso;

        const symState = symbolAlertState.current.get(s.symbol) || {};

        // 🚀 DAY HIGH ALERT: Add to Panel & Pop Up Toast
        if (isDayHighHit) {
          const highKey = `${s.symbol}_DAY_HIGH`;
          const alertObj: StockAlert = {
            id: `dh-${s.symbol}`,
            symbol: s.symbol,
            name: s.name,
            alertType: 'DAY_HIGH',
            price: s.price,
            change: s.change,
            changePercent: s.changePercent,
            details: isBreakoutHigh
              ? `Cleared previous Day High · New Session Peak at ₹${s.price.toFixed(2)}`
              : `At Day High Level · Within ${distHighPct.toFixed(2)}% of High (₹${s.dayHigh.toFixed(2)})`,
            createdAt: freshTimestamp,
          };
          nextMap.set(highKey, alertObj);

          // Pop-up Toast Trigger Logic
          const isFirstTime = !alertedToastKeysRef.current.has(highKey);
          const hasPushedPeak = symState.lastHighPrice !== undefined && s.price > symState.lastHighPrice;
          const cooldownPassed = !symState.lastHighTime || (nowMs - symState.lastHighTime > 60000);

          if (isFirstTime || hasPushedPeak || (cooldownPassed && isBreakoutHigh)) {
            alertedToastKeysRef.current.add(highKey);
            symState.lastHighPrice = s.price;
            symState.lastHighTime = nowMs;

            triggerLiveAlert({
              ...alertObj,
              id: `dh-pop-${s.symbol}-${nowMs}`,
            });
          }
        }

        // 🔻 DAY LOW ALERT: Add to Panel & Pop Up Toast
        if (isDayLowHit) {
          const lowKey = `${s.symbol}_DAY_LOW`;
          const alertObj: StockAlert = {
            id: `dl-${s.symbol}`,
            symbol: s.symbol,
            name: s.name,
            alertType: 'DAY_LOW',
            price: s.price,
            change: s.change,
            changePercent: s.changePercent,
            details: isBreakdownLow
              ? `Broke Day Low level · New Session Low at ₹${s.price.toFixed(2)}`
              : `At Day Low Level · Within ${distLowPct.toFixed(2)}% of Low (₹${s.dayLow.toFixed(2)})`,
            createdAt: freshTimestamp,
          };
          nextMap.set(lowKey, alertObj);

          // Pop-up Toast Trigger Logic
          const isFirstTime = !alertedToastKeysRef.current.has(lowKey);
          const hasPushedTrough = symState.lastLowPrice !== undefined && s.price < symState.lastLowPrice;
          const cooldownPassed = !symState.lastLowTime || (nowMs - symState.lastLowTime > 60000);

          if (isFirstTime || hasPushedTrough || (cooldownPassed && isBreakdownLow)) {
            alertedToastKeysRef.current.add(lowKey);
            symState.lastLowPrice = s.price;
            symState.lastLowTime = nowMs;

            triggerLiveAlert({
              ...alertObj,
              id: `dl-pop-${s.symbol}-${nowMs}`,
            });
          }
        }

        // ⚡ VOLUME SURGE ALERT
        if (s.volumeSpike || (s.relativeVolume && s.relativeVolume >= 2.0)) {
          const spikeKey = `${s.symbol}_VOLUME_SPIKE`;
          nextMap.set(spikeKey, {
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

        symbolAlertState.current.set(s.symbol, symState);
      }

      return nextMap;
    });
  }, [stocks, triggerLiveAlert]);

  // ── 3. Live Socket.IO Alerts Listener (handles Server-Broadcasted Alerts & News) ──
  useEffect(() => {
    if (!socket) return;

    const handleServerAlert = (alert: StockAlert) => {
      if (alert.alertType === 'NEWS') {
        const src = (alert.symbol || '').toLowerCase();
        if (!isAllowedNewsSource(src)) return;
        const titleText = (alert.name || alert.details || '').toLowerCase();
        for (const pat of BLACKLISTED_TITLE_PATTERNS) {
          if (pat.test(titleText)) return;
        }
      }

      triggerLiveAlert(alert);

      setServerAlerts(prev => {
        const copy = [...prev];
        const key = alert.alertType === 'NEWS' ? alert.id : `${alert.symbol}_${alert.alertType}`;
        const existingIdx = copy.findIndex(a => (a.alertType === 'NEWS' ? a.id === key : `${a.symbol}_${a.alertType}` === key));
        if (existingIdx >= 0) {
          copy[existingIdx] = alert;
        } else {
          copy.unshift(alert);
        }
        return copy.slice(0, 500);
      });
    };

    socket.on('alert:new', handleServerAlert);

    return () => {
      socket.off('alert:new', handleServerAlert);
    };
  }, [socket, triggerLiveAlert]);

  // ── 4. Unified, deduplicated Alert History for Alert Panel ──
  const alertHistory = useMemo(() => {
    const combinedMap = new Map<string, StockAlert>();

    // Layer server alerts
    serverAlerts.forEach(a => {
      const key = a.alertType === 'NEWS' ? a.id : `${a.symbol}_${a.alertType}`;
      combinedMap.set(key, a);
    });

    // Layer active stock & index radar alerts (takes precedence for live Day High / Day Low prices)
    radarAlerts.forEach((a, key) => {
      combinedMap.set(key, a);
    });

    const list = Array.from(combinedMap.values());

    // Sort: Fresh breakouts and peaks first, then by timestamp descending
    list.sort((a, b) => {
      const timeA = new Date(a.createdAt).getTime() || 0;
      const timeB = new Date(b.createdAt).getTime() || 0;
      return timeB - timeA;
    });

    return list;
  }, [serverAlerts, radarAlerts]);

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => {
      const target = prev.find(t => t.id === id);
      if (target) {
        const toastKey = `${target.symbol}_${target.alertType}`;
        const timer = toastTimersRef.current.get(toastKey);
        if (timer) {
          clearTimeout(timer);
          toastTimersRef.current.delete(toastKey);
        }
      }
      return prev.filter(t => t.id !== id);
    });
  }, []);

  const clearAll = useCallback(() => {
    setServerAlerts([]);
    setRadarAlerts(new Map());
    setToasts([]);
    toastTimersRef.current.forEach(t => clearTimeout(t));
    toastTimersRef.current.clear();
  }, []);

  return { toasts, alertHistory, dismissToast, clearAll };
}
