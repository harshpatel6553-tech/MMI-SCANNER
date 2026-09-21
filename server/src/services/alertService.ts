/**
 * @module alertService
 * @description Service for detecting and managing stock price alerts.
 * Monitors day-high/low transitions and persists alerts to Supabase.
 *
 * The service tracks the previous high/low state for each stock and only
 * generates an alert when a stock *transitions* to a new extreme (i.e.,
 * false → true), preventing duplicate alerts for the same event.
 */

import crypto from 'node:crypto';
import type { StockData, StockAlert } from '../types/index.js';
import { supabase, isSupabaseConfigured } from '../config/supabase.js';
import logger from '../utils/logger.js';

/** Internal state tracking for high/low transitions and milestones */
interface HighLowState {
  atHigh: boolean;
  atLow: boolean;
  highValue: number;
  lowValue: number;
  maxPriceSeenToday: number;
  minPriceSeenToday: number;
  volumeSpiked: boolean;
  lastAlertTime: number;
  lastPrice: number;
  crossedLevels: Set<number>;
  crossedPercentMilestones: Set<number>;
}

class AlertService {
  /** Tracks the previous high/low state per symbol */
  private previousHighLowState: Map<string, HighLowState> = new Map();

  /** In-memory cache of recent alerts (for fallback when Supabase is disabled) */
  private inMemoryAlerts: StockAlert[] = [];

  private generateDeterministicUUID(input: string): string {
    const hash = crypto.createHash('sha256').update(input).digest('hex');
    return `${hash.substring(0, 8)}-${hash.substring(8, 12)}-4${hash.substring(13, 16)}-a${hash.substring(17, 20)}-${hash.substring(20, 32)}`;
  }

  /** Cooldown in ms before the same symbol can re-alert (90 sec for indices, 5 min for stocks) */
  private readonly INDEX_ALERT_COOLDOWN_MS = 90 * 1000;       // 90 seconds
  private readonly STOCK_ALERT_COOLDOWN_MS = 5 * 60 * 1000;   // 5 minutes

  /** Helper to determine the round-number milestone interval for an index */
  private getIndexLevelStep(symbol: string): number {
    switch (symbol) {
      case 'NIFTY 50':
        return 50; // Every 50 points (e.g. 23,450, 23,500)
      case 'BANKNIFTY':
        return 250; // Every 250 points (e.g. 56,250, 56,500)
      case 'NIFTY REALTY':
        return 10; // Around 850 (e.g. 850, 860)
      case 'NIFTY PSE':
      case 'NIFTY INFRA':
      case 'NIFTY PSU BANK':
        return 50;
      default:
        return 100;
    }
  }

  checkAndGenerateAlerts(stocks: StockData[]): StockAlert[] {
    const newAlerts: StockAlert[] = [];
    const now = new Date().toISOString();
    const dayTimestamp = now.substring(0, 10);
    const currentMs = Date.now();

    for (const stock of stocks) {
      const isIndex = stock.indexName === 'INDEX';
      const cooldownMs = isIndex ? this.INDEX_ALERT_COOLDOWN_MS : this.STOCK_ALERT_COOLDOWN_MS;

      if (!this.previousHighLowState.has(stock.symbol)) {
        const crossedLevels = new Set<number>();
        const crossedPercentMilestones = new Set<number>();

        // Pre-record current round level
        if (isIndex) {
          const step = this.getIndexLevelStep(stock.symbol);
          const currentLevel = Math.floor(stock.price / step) * step;
          crossedLevels.add(currentLevel);

          // Pre-record current percentage milestones
          const pctMilestones = [0.5, 1.0, 1.5, 2.0, 2.5, 3.0, -0.5, -1.0, -1.5, -2.0, -2.5, -3.0];
          for (const m of pctMilestones) {
            if ((m > 0 && stock.changePercent >= m) || (m < 0 && stock.changePercent <= m)) {
              crossedPercentMilestones.add(m);
            }
          }
        }

        const state: HighLowState = {
          atHigh: stock.atDayHigh,
          atLow: stock.atDayLow,
          highValue: stock.dayHigh,
          lowValue: stock.dayLow,
          maxPriceSeenToday: stock.price,
          minPriceSeenToday: stock.price,
          volumeSpiked: stock.volumeSpike,
          lastAlertTime: 0,
          lastPrice: stock.price,
          crossedLevels,
          crossedPercentMilestones,
        };
        this.previousHighLowState.set(stock.symbol, state);

        // For indices: fire initial alert immediately if already at day high/low or major % milestone
        if (isIndex) {
          if (stock.atDayHigh) {
            const alertId = this.generateDeterministicUUID(`${stock.symbol}_DAY_HIGH_${dayTimestamp}_INIT_${currentMs}`);
            const alert: StockAlert = {
              id: alertId,
              symbol: stock.symbol,
              name: stock.name,
              alertType: 'DAY_HIGH',
              price: stock.price,
              change: stock.change,
              changePercent: stock.changePercent,
              details: `Trading in Day High Resistance Zone (Day High: ₹${stock.dayHigh.toFixed(2)})`,
              createdAt: now,
            };
            newAlerts.push(alert);
            state.lastAlertTime = currentMs;
            logger.info(`🚀 INDEX DAY HIGH ALERT: ${stock.symbol} at ₹${stock.price.toFixed(2)} (day high: ₹${stock.dayHigh.toFixed(2)})`);
          } else if (stock.atDayLow) {
            const alertId = this.generateDeterministicUUID(`${stock.symbol}_DAY_LOW_${dayTimestamp}_INIT_${currentMs}`);
            const alert: StockAlert = {
              id: alertId,
              symbol: stock.symbol,
              name: stock.name,
              alertType: 'DAY_LOW',
              price: stock.price,
              change: stock.change,
              changePercent: stock.changePercent,
              details: `Trading in Day Low Support Zone (Day Low: ₹${stock.dayLow.toFixed(2)})`,
              createdAt: now,
            };
            newAlerts.push(alert);
            state.lastAlertTime = currentMs;
            logger.info(`📉 INDEX DAY LOW ALERT: ${stock.symbol} at ₹${stock.price.toFixed(2)} (day low: ₹${stock.dayLow.toFixed(2)})`);
          } else if (Math.abs(stock.changePercent) >= 0.5) {
            // Milestone alert for initial active indices
            const highestMilestone = Array.from(crossedPercentMilestones).sort((a, b) => Math.abs(b) - Math.abs(a))[0];
            if (highestMilestone !== undefined) {
              const sign = highestMilestone > 0 ? '+' : '';
              const alertId = this.generateDeterministicUUID(`${stock.symbol}_MILESTONE_${highestMilestone}_${dayTimestamp}_INIT_${currentMs}`);
              const alert: StockAlert = {
                id: alertId,
                symbol: stock.symbol,
                name: stock.name,
                alertType: 'INDEX_MILESTONE',
                price: stock.price,
                change: stock.change,
                changePercent: stock.changePercent,
                details: `Trending strongly: ${sign}${highestMilestone.toFixed(1)}% session move`,
                createdAt: now,
              };
              newAlerts.push(alert);
              state.lastAlertTime = currentMs;
              logger.info(`🎯 INDEX MILESTONE ALERT: ${stock.symbol} at ₹${stock.price.toFixed(2)} (${sign}${stock.changePercent.toFixed(2)}%)`);
            }
          }
        }
        continue;
      }

      const previousState = this.previousHighLowState.get(stock.symbol)!;
      const timeSinceLastAlert = currentMs - previousState.lastAlertTime;
      const cooldownExpired = timeSinceLastAlert >= cooldownMs;

      let triggeredAlert = false;

      // ── 1. DAY HIGH DETECTION ─────────────────────────────────────
      // Fires on:
      // - Transition into Day High zone (!previousState.atHigh)
      // - New intraday highest price seen today (breakout tick!)
      // - Cooldown expired while still in Day High zone
      const isNewHighValue = stock.atDayHigh && (
        isIndex
          ? (!previousState.atHigh || stock.price > previousState.maxPriceSeenToday || cooldownExpired)
          : (!previousState.atHigh || stock.price > previousState.maxPriceSeenToday)
      );
      
      if (isNewHighValue) {
        const isBreakout = stock.price > previousState.maxPriceSeenToday;
        const alertId = this.generateDeterministicUUID(`${stock.symbol}_DAY_HIGH_${dayTimestamp}_${currentMs}`);
        const alert: StockAlert = {
          id: alertId,
          symbol: stock.symbol,
          name: stock.name,
          alertType: 'DAY_HIGH',
          price: stock.price,
          change: stock.change,
          changePercent: stock.changePercent,
          details: isIndex
            ? (isBreakout ? `New Intraday Peak Breakout @ ₹${stock.price.toFixed(2)}` : `Holding Day High Zone (Peak: ₹${stock.dayHigh.toFixed(2)})`)
            : undefined,
          createdAt: now,
        };
        newAlerts.push(alert);
        triggeredAlert = true;
        if (isIndex) {
          logger.info(`🚀 INDEX DAY HIGH ALERT: ${stock.symbol} at ₹${stock.price.toFixed(2)} (day high: ₹${stock.dayHigh.toFixed(2)})`);
        } else {
          logger.info(`🚀 DAY HIGH ALERT: ${stock.symbol} (${stock.name}) hit day high of ₹${stock.price.toFixed(2)}`);
        }
      }

      // ── 2. DAY LOW DETECTION ──────────────────────────────────────
      const isNewLowValue = stock.atDayLow && (
        isIndex
          ? (!previousState.atLow || stock.price < previousState.minPriceSeenToday || cooldownExpired)
          : (!previousState.atLow || stock.price < previousState.minPriceSeenToday)
      );
      
      if (isNewLowValue && !triggeredAlert) {
        const isBreakdown = stock.price < previousState.minPriceSeenToday;
        const alertId = this.generateDeterministicUUID(`${stock.symbol}_DAY_LOW_${dayTimestamp}_${currentMs}`);
        const alert: StockAlert = {
          id: alertId,
          symbol: stock.symbol,
          name: stock.name,
          alertType: 'DAY_LOW',
          price: stock.price,
          change: stock.change,
          changePercent: stock.changePercent,
          details: isIndex
            ? (isBreakdown ? `New Intraday Low Breakdown @ ₹${stock.price.toFixed(2)}` : `Trading at Day Low Support (Low: ₹${stock.dayLow.toFixed(2)})`)
            : undefined,
          createdAt: now,
        };
        newAlerts.push(alert);
        triggeredAlert = true;
        if (isIndex) {
          logger.info(`📉 INDEX DAY LOW ALERT: ${stock.symbol} at ₹${stock.price.toFixed(2)} (day low: ₹${stock.dayLow.toFixed(2)})`);
        } else {
          logger.info(`🚀 DAY LOW ALERT: ${stock.symbol} (${stock.name}) broke down to new low of ₹${stock.price.toFixed(2)}`);
        }
      }

      // ── 3. INDEX ROUND NUMBER & PERCENTAGE MILESTONES ─────────────
      if (isIndex && !triggeredAlert) {
        const step = this.getIndexLevelStep(stock.symbol);
        const prevLevel = Math.floor(previousState.lastPrice / step) * step;
        const currentLevel = Math.floor(stock.price / step) * step;

        // Check if price crossed a round level
        if (prevLevel !== currentLevel && !previousState.crossedLevels.has(currentLevel)) {
          previousState.crossedLevels.add(currentLevel);
          const direction = stock.price > previousState.lastPrice ? '▲' : '▼';
          const alertId = this.generateDeterministicUUID(`${stock.symbol}_LEVEL_${currentLevel}_${dayTimestamp}_${currentMs}`);
          const alert: StockAlert = {
            id: alertId,
            symbol: stock.symbol,
            name: stock.name,
            alertType: 'INDEX_MILESTONE',
            price: stock.price,
            change: stock.change,
            changePercent: stock.changePercent,
            details: `Crossed ${currentLevel.toLocaleString('en-IN')} level ${direction}`,
            createdAt: now,
          };
          newAlerts.push(alert);
          triggeredAlert = true;
          logger.info(`🎯 INDEX LEVEL ALERT: ${stock.symbol} crossed ${currentLevel} ${direction} at ₹${stock.price.toFixed(2)}`);
        }

        // Check if price crossed percentage thresholds (±0.5%, ±1.0%, ±1.5%, ±2.0%, etc.)
        if (!triggeredAlert) {
          const pctMilestones = [0.5, 1.0, 1.5, 2.0, 2.5, 3.0, -0.5, -1.0, -1.5, -2.0, -2.5, -3.0];
          for (const m of pctMilestones) {
            const hasPassed = (m > 0 && stock.changePercent >= m) || (m < 0 && stock.changePercent <= m);
            if (hasPassed && !previousState.crossedPercentMilestones.has(m)) {
              previousState.crossedPercentMilestones.add(m);
              const sign = m > 0 ? '+' : '';
              const icon = m > 0 ? '🚀' : '📉';
              const alertId = this.generateDeterministicUUID(`${stock.symbol}_PCT_${m}_${dayTimestamp}_${currentMs}`);
              const alert: StockAlert = {
                id: alertId,
                symbol: stock.symbol,
                name: stock.name,
                alertType: 'INDEX_MILESTONE',
                price: stock.price,
                change: stock.change,
                changePercent: stock.changePercent,
                details: `Crossed ${sign}${m.toFixed(1)}% session move (${stock.changePercent >= 0 ? '+' : ''}${stock.changePercent.toFixed(2)}%)`,
                createdAt: now,
              };
              newAlerts.push(alert);
              triggeredAlert = true;
              logger.info(`${icon} INDEX PERCENT ALERT: ${stock.symbol} crossed ${sign}${m.toFixed(1)}% at ₹${stock.price.toFixed(2)}`);
              break; // One milestone per cycle
            }
          }
        }
      }

      // ── 4. VOLUME SPIKE DETECTION (stocks only) ───────────────────
      if (!isIndex && stock.volumeSpike === true && previousState.volumeSpiked === false && !triggeredAlert) {
        const alertId = this.generateDeterministicUUID(`${stock.symbol}_VOLUME_SPIKE_${dayTimestamp}_${currentMs}`);
        const alert: StockAlert = {
          id: alertId,
          symbol: stock.symbol,
          name: stock.name,
          alertType: 'VOLUME_SPIKE',
          price: stock.price,
          change: stock.change,
          changePercent: stock.changePercent,
          createdAt: now,
        };
        newAlerts.push(alert);
        triggeredAlert = true;
        logger.info(
          `⚡ VOLUME SPIKE ALERT: ${stock.symbol} (${stock.name}) volume ${stock.relativeVolume.toFixed(1)}x average`
        );
      }

      // Update state map
      this.previousHighLowState.set(stock.symbol, {
        atHigh: stock.atDayHigh,
        atLow: stock.atDayLow,
        highValue: stock.dayHigh,
        lowValue: stock.dayLow,
        maxPriceSeenToday: Math.max(previousState.maxPriceSeenToday, stock.price),
        minPriceSeenToday: Math.min(previousState.minPriceSeenToday, stock.price),
        volumeSpiked: stock.volumeSpike,
        lastAlertTime: triggeredAlert ? currentMs : previousState.lastAlertTime,
        lastPrice: stock.price,
        crossedLevels: previousState.crossedLevels,
        crossedPercentMilestones: previousState.crossedPercentMilestones,
      });
    }

    // Keep in-memory history
    if (newAlerts.length > 0) {
      this.inMemoryAlerts = [...newAlerts, ...this.inMemoryAlerts].slice(0, 300);
      this.saveAlerts(newAlerts);
    }

    return newAlerts;
  }

  /**
   * Save alerts to the Supabase `alerts` table.
   * This is fire-and-forget — errors are logged but do not propagate.
   *
   * @param alerts - Array of alerts to persist
   */
  private saveAlerts(alerts: StockAlert[]): void {
    // Supabase syncing disabled for web deployment
  }

  /**
   * Fetch recent alerts from the Supabase `alerts` table.
   *
   * @param limit - Maximum number of alerts to return (default: 100, max: 500)
   * @returns Array of recent alerts, newest first. Returns empty array
   *          if Supabase is not configured or the query fails.
   */
  async getRecentAlerts(limit: number = 100): Promise<StockAlert[]> {
    // Supabase syncing is disabled for web deployment, always serve from memory cache
    return this.inMemoryAlerts.slice(0, limit);
  }

  /**
   * Get the number of symbols currently being tracked for transitions.
   * @returns Count of tracked symbols
   */
  getTrackedSymbolCount(): number {
    return this.previousHighLowState.size;
  }

  /**
   * Dumps the entire internal memory of the agent for diagnostics.
   * This proves exactly which stocks the agent is actively tracking.
   */
  getAgentDiagnostics() {
    return Array.from(this.previousHighLowState.entries()).map(([symbol, state]) => ({
      symbol,
      isCurrentlyAtHigh: state.atHigh,
      isCurrentlyAtLow: state.atLow,
      highestPriceAgentHasSeenToday: state.maxPriceSeenToday,
      lowestPriceAgentHasSeenToday: state.minPriceSeenToday,
      lastAlertTime: state.lastAlertTime
    }));
  }
}

/**
 * Singleton instance of the AlertService.
 * Import this across modules to share the same state.
 */
export const alertService = new AlertService();

export default alertService;
