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
  const [serverAlerts, setServerAlerts] = useState<StockAlert[]>(() => {
    try {
      if (typeof window !== 'undefined') {
        const cached = sessionStorage.getItem('mmi_server_alerts_cache');
        if (cached) {
          const list = JSON.parse(cached);
          return Array.isArray(list) ? list.filter((a: any) => a.alertType !== 'SMART_MONEY') : [];
        }
      }
    } catch {}
    return [];
  });
  const [radarAlerts, setRadarAlerts] = useState<Map<string, StockAlert>>(new Map());

  const toastTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const lastSoundPlayedRef = useRef<Record<string, number>>({});
  
  // Tracking symbol alert state to avoid repetitive spam while guaranteeing fresh pop-ups
  const symbolAlertState = useRef<Map<string, {
    lastHighPrice?: number;
    lastLowPrice?: number;
    lastHighTime?: number;
    lastLowTime?: number;
    lastSpikeTime?: number;
  }>>(new Map());

  // Set of keys that already toasted in this session
  const alertedToastKeysRef = useRef<Set<string>>(new Set());

  // Permanent timestamp tracking to persist "Clear All" across 5s poll cycles
  const clearedBeforeTimestampRef = useRef<number>(0);

  // Hydration state: suppresses burst barrage on initial page load, then surfaces top fresh breakouts
  const [isHydrated, setIsHydrated] = useState(false);
  const initialToastedRef = useRef(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsHydrated(true);
    }, 1200);
    return () => clearTimeout(timer);
  }, []);

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
      } else if (alert.alertType === 'NEWS') {
        audioAlerts.playSpikeAlert();
      } else if (alert.alertType === 'FNO_OI') {
        audioAlerts.playBreakoutChime();
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
          : alert.alertType === 'VOLUME_SPIKE'
          ? `⚡ VOLUME SPIKE: ${alert.symbol}`
          : alert.alertType === 'NEWS'
          ? `📰 BREAKING NEWS: ${alert.symbol}`
          : alert.alertType === 'SMART_MONEY'
          ? `💎 SMART MONEY: ${alert.symbol}`
          : `⚡ ${alert.symbol}`;
        const body = alert.details || (
          alert.alertType === 'DAY_HIGH'
            ? `${alert.symbol} cleared Day High at ₹${alert.price.toLocaleString('en-IN')}`
            : alert.alertType === 'DAY_LOW'
            ? `${alert.symbol} touched Day Low at ₹${alert.price.toLocaleString('en-IN')}`
            : alert.alertType === 'VOLUME_SPIKE'
            ? `${alert.symbol} volume surge detected at ₹${alert.price.toLocaleString('en-IN')}`
            : alert.alertType === 'NEWS'
            ? (alert.name || 'Institutional market news wire')
            : alert.alertType === 'SMART_MONEY'
            ? `${alert.symbol} institutional flow activity`
            : `${alert.symbol} alert at ₹${alert.price.toLocaleString('en-IN')}`
        );
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

        // Also fetch recent breaking news alerts to populate the NEWS tab immediately
        try {
          let newsRes = await fetch(`/api/news?_t=${Date.now()}`).catch(() => null);
          if (!newsRes || !newsRes.ok) {
            newsRes = await fetch(`${baseUrl}/api/news?_t=${Date.now()}`).catch(() => null);
          }
          if (newsRes && newsRes.ok) {
            const newsJson = await newsRes.json();
            if (newsJson?.success && Array.isArray(newsJson.data)) {
              const mappedNews: StockAlert[] = newsJson.data
                .filter((item: any) => isAllowedNewsSource(item.source))
                .slice(0, 30)
                .map((n: any) => ({
                  id: `news-${n.id}`,
                  symbol: n.source.startsWith('@') ? n.source : `@${n.source}`,
                  name: n.title,
                  alertType: 'NEWS',
                  price: 0,
                  details: 'Institutional News Wire',
                  createdAt: n.pubDate || new Date().toISOString(),
                }));

              const existingIds = new Set(alertsData.map(a => a.id));
              mappedNews.forEach(nw => {
                if (!existingIds.has(nw.id)) {
                  alertsData.push(nw);
                }
              });
            }
          }
        } catch {
          // Ignore news fetch errors
        }

        if (!isMounted) return;

        // Deduplicate server alerts preserving individual F&O strikes and News items (Strictly Stocks, F&O and News)
        const dedupedMap = new Map<string, StockAlert>();
        alertsData.forEach(a => {
          if (a.alertType === 'SMART_MONEY') return;
          if (clearedBeforeTimestampRef.current && new Date(a.createdAt).getTime() <= clearedBeforeTimestampRef.current) {
            return;
          }
          if (a.alertType === 'NEWS' || a.alertType === 'FNO_OI') {
            dedupedMap.set(a.id, a);
          } else {
            const key = `${a.symbol}_${a.alertType}`;
            const existing = dedupedMap.get(key);
            if (!existing || new Date(a.createdAt).getTime() > new Date(existing.createdAt).getTime()) {
              dedupedMap.set(key, a);
            }
          }
        });

        const freshList = Array.from(dedupedMap.values());
        setServerAlerts(freshList);
        try {
          if (typeof window !== 'undefined' && freshList.length > 0) {
            sessionStorage.setItem('mmi_server_alerts_cache', JSON.stringify(freshList.slice(0, 200)));
          }
        } catch {
          // sessionStorage full or disabled
        }
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
    const pendingToasts: StockAlert[] = [];

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

        // 🚀 DAY HIGH ALERT: Add to Panel
        if (isDayHighHit) {
          const highKey = `${s.symbol}_DAY_HIGH`;
          const existingAlert = prevMap.get(highKey);
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
            createdAt: existingAlert?.createdAt || freshTimestamp,
          };
          nextMap.set(highKey, alertObj);

          // Pop-up Toast Trigger Logic
          const cooldownPassed = !symState.lastHighTime || (nowMs - symState.lastHighTime > 15000);
          const hasPushedPeak = symState.lastHighPrice === undefined || s.price > symState.lastHighPrice;

          if (isHydrated && cooldownPassed && (isBreakoutHigh || hasPushedPeak)) {
            symState.lastHighPrice = s.price;
            symState.lastHighTime = nowMs;
            pendingToasts.push({
              ...alertObj,
              id: `dh-pop-${s.symbol}-${nowMs}`,
            });
          } else if (!symState.lastHighPrice) {
            symState.lastHighPrice = s.price;
            symState.lastHighTime = nowMs;
          }
        }

        // 🔻 DAY LOW ALERT: Add to Panel
        if (isDayLowHit) {
          const lowKey = `${s.symbol}_DAY_LOW`;
          const existingAlert = prevMap.get(lowKey);
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
            createdAt: existingAlert?.createdAt || freshTimestamp,
          };
          nextMap.set(lowKey, alertObj);

          // Pop-up Toast Trigger Logic
          const cooldownPassed = !symState.lastLowTime || (nowMs - symState.lastLowTime > 15000);
          const hasPushedTrough = symState.lastLowPrice === undefined || s.price < symState.lastLowPrice;

          if (isHydrated && cooldownPassed && (isBreakdownLow || hasPushedTrough)) {
            symState.lastLowPrice = s.price;
            symState.lastLowTime = nowMs;
            pendingToasts.push({
              ...alertObj,
              id: `dl-pop-${s.symbol}-${nowMs}`,
            });
          } else if (!symState.lastLowPrice) {
            symState.lastLowPrice = s.price;
            symState.lastLowTime = nowMs;
          }
        }

        // ⚡ VOLUME SURGE ALERT: High velocity flow (Requires >= 1.75x institutional velocity)
        const isTrueSpike = (s.relativeVolume && s.relativeVolume >= 1.75) || (s.volumeSpike && (s.relativeVolume ?? 1) >= 1.5);
        if (isTrueSpike) {
          const spikeKey = `${s.symbol}_VOLUME_SPIKE`;
          const existingAlert = prevMap.get(spikeKey);
          const alertObj: StockAlert = {
            id: `vs-${s.symbol}`,
            symbol: s.symbol,
            name: s.name,
            alertType: 'VOLUME_SPIKE',
            price: s.price,
            change: s.change,
            changePercent: s.changePercent,
            details: `Volume Surge: ${(s.relativeVolume || 2).toFixed(1)}x institutional velocity`,
            createdAt: existingAlert?.createdAt || freshTimestamp,
          };
          nextMap.set(spikeKey, alertObj);

          // Pop-up Toast Trigger Logic for Volume Surges
          const cooldownPassed = !symState.lastSpikeTime || (nowMs - symState.lastSpikeTime > 20000);
          if (isHydrated && cooldownPassed && (s.relativeVolume ?? 0) >= 1.75) {
            symState.lastSpikeTime = nowMs;
            pendingToasts.push({
              ...alertObj,
              id: `vs-pop-${s.symbol}-${nowMs}`,
            });
          } else if (!symState.lastSpikeTime) {
            symState.lastSpikeTime = nowMs;
          }
        }

        symbolAlertState.current.set(s.symbol, symState);
      }

      return nextMap;
    });

    // Execute pop-up toasts cleanly outside state updater
    if (pendingToasts.length > 0) {
      pendingToasts.slice(0, 2).forEach(t => triggerLiveAlert(t));
    }
  }, [stocks, isHydrated, triggerLiveAlert]);

  // Display initial active breakout toasts right after hydration so user gets visual pop-ups immediately
  useEffect(() => {
    if (!isHydrated || initialToastedRef.current) return;

    // Check radarAlerts or serverAlerts for high breakouts
    const alertsList = Array.from(radarAlerts.values());
    const highAlerts = alertsList
      .filter(a => a.alertType === 'DAY_HIGH' && (a.changePercent ?? 0) > 0)
      .sort((a, b) => (b.changePercent ?? 0) - (a.changePercent ?? 0));

    if (highAlerts.length > 0) {
      initialToastedRef.current = true;
      highAlerts.slice(0, 2).forEach((alert, index) => {
        setTimeout(() => {
          triggerLiveAlert({
            ...alert,
            id: `mount-dh-${alert.symbol}-${Date.now()}-${index}`,
          });
        }, index * 400);
      });
    }
  }, [isHydrated, radarAlerts, triggerLiveAlert]);

  // ── 3. Live Socket.IO Alerts Listener (handles Server-Broadcasted Alerts & News) ──
  useEffect(() => {
    if (!socket) return;

    const handleServerAlert = (alert: StockAlert) => {
      if (alert.alertType === 'SMART_MONEY') return;

      if (alert.alertType === 'NEWS') {
        const src = (alert.symbol || '').toLowerCase();
        if (!isAllowedNewsSource(src)) return;
        const titleText = (alert.name || alert.details || '').toLowerCase();
        for (const pat of BLACKLISTED_TITLE_PATTERNS) {
          if (pat.test(titleText)) return;
        }
      }

      // Check if this alert was created recently (within the last 2 minutes)
      const alertTime = new Date(alert.createdAt).getTime();
      const isFresh = !alertTime || (Date.now() - alertTime < 2 * 60 * 1000);

      // Prevent double toast if alerted in the last 20s
      const toastKey = `${alert.symbol}_${alert.alertType}`;
      const nowMs = Date.now();
      const lastAlertTime = lastSoundPlayedRef.current[toastKey] || 0;
      const cooldownPassed = (nowMs - lastAlertTime) > 20000;

      // Only toast if hydrated, fresh, and cooldown passed
      if (isHydrated && isFresh && cooldownPassed) {
        lastSoundPlayedRef.current[toastKey] = nowMs;
        triggerLiveAlert(alert);
      }

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

    // Layer server alerts (Strictly STOCKS, F&O and News — no institutional inflow)
    serverAlerts.forEach(a => {
      if (a.alertType === 'SMART_MONEY') return;
      if (clearedBeforeTimestampRef.current && new Date(a.createdAt).getTime() <= clearedBeforeTimestampRef.current) {
        return;
      }
      const key = (a.alertType === 'NEWS' || a.alertType === 'FNO_OI')
        ? a.id
        : `${a.symbol}_${a.alertType}`;
      combinedMap.set(key, a);
    });

    // Layer active stock & index radar alerts (takes precedence for live Day High / Day Low prices)
    radarAlerts.forEach((a, key) => {
      if (clearedBeforeTimestampRef.current && new Date(a.createdAt).getTime() <= clearedBeforeTimestampRef.current) {
        return;
      }
      const existing = combinedMap.get(key);
      if (existing) {
        combinedMap.set(key, {
          ...a,
          id: existing.id || a.id,
          createdAt: existing.createdAt || a.createdAt,
        });
      } else {
        combinedMap.set(key, a);
      }
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
    clearedBeforeTimestampRef.current = Date.now();
    setServerAlerts([]);
    setRadarAlerts(new Map());
    setToasts([]);
    toastTimersRef.current.forEach(t => clearTimeout(t));
    toastTimersRef.current.clear();
  }, []);

  return { toasts, alertHistory, dismissToast, clearAll };
}
