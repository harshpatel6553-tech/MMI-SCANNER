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

/** Internal state tracking for high/low transitions */
interface HighLowState {
  atHigh: boolean;
  atLow: boolean;
  highValue: number;
  lowValue: number;
  volumeSpiked: boolean;
  lastAlertTime: number;
}

/**
 * Service for detecting day-high/day-low transitions and managing alerts.
 *
 * Maintains an internal state map so that alerts are only generated on
 * the *transition* from not-at-extreme to at-extreme, avoiding spam.
 *
 * @example
 * ```typescript
 * Keeps an in-memory map of the previous state to detect transitions.
 */
class AlertService {
  /** Tracks the previous high/low state per symbol */
  private previousHighLowState: Map<string, HighLowState> = new Map();

  /** In-memory cache of recent alerts (for fallback when Supabase is disabled) */
  private inMemoryAlerts: StockAlert[] = [];

  /**
   * Generate a deterministic UUID based on an input string.
   * This ensures that if 50 users detect the same alert in the same minute,
   * they all generate the exact same UUID, and Supabase automatically rejects duplicates.
   */
  private generateDeterministicUUID(input: string): string {
    const hash = crypto.createHash('sha256').update(input).digest('hex');
    return `${hash.substring(0, 8)}-${hash.substring(8, 12)}-4${hash.substring(13, 16)}-a${hash.substring(17, 20)}-${hash.substring(20, 32)}`;
  }

  /**
   * Compares current stock data against previous state to generate new alerts.
   *
   * @param stocks - Array of current stock data
   * @returns Array of newly generated alerts
   */
  checkAndGenerateAlerts(stocks: StockData[]): StockAlert[] {
    const newAlerts: StockAlert[] = [];
    const now = new Date().toISOString();
    const dayTimestamp = now.substring(0, 10); // e.g., "2023-10-27" (Only one alert ID per stock per day)
    const currentMs = Date.now();
    const COOLDOWN_MS = 0; // No cooldown needed since we upsert!

    for (const stock of stocks) {
      // If we haven't seen this stock before (e.g. server just booted), 
      // silently initialize its state and skip generating alerts.
      if (!this.previousHighLowState.has(stock.symbol)) {
        this.previousHighLowState.set(stock.symbol, {
          atHigh: stock.atDayHigh,
          atLow: stock.atDayLow,
          highValue: stock.dayHigh,
          lowValue: stock.dayLow,
          volumeSpiked: stock.volumeSpike,
          lastAlertTime: 0,
        });
        continue;
      }

      const previousState = this.previousHighLowState.get(stock.symbol)!;

      let triggeredAlert = false;
      const isCooldownOver = true; // Cooldown disabled

      // Detect DAY_HIGH transition or new high value
      const isNewHighValue = previousState.highValue > 0 && stock.dayHigh > previousState.highValue && stock.atDayHigh;
      const transitionedToHigh = stock.atDayHigh && !previousState.atHigh;
      
      if (isNewHighValue || transitionedToHigh) {
        const alertId = this.generateDeterministicUUID(`${stock.symbol}_DAY_HIGH_${dayTimestamp}`);
        const alert: StockAlert = {
          id: alertId,
          symbol: stock.symbol,
          name: stock.name,
          alertType: 'DAY_HIGH',
          price: stock.price, // Use current price instead of dayHigh to be accurate to what the user sees
          createdAt: now,
        };
        newAlerts.push(alert);
        triggeredAlert = true;
        logger.info(
          `🚀 DAY HIGH ALERT: ${stock.symbol} (${stock.name}) hit ₹${stock.price.toFixed(2)}${isNewHighValue ? ' (New High)' : ''}`
        );
      }

      // Detect DAY_LOW transition or new low value
      const isNewLowValue = previousState.lowValue > 0 && stock.dayLow < previousState.lowValue && stock.atDayLow;
      const transitionedToLow = stock.atDayLow && !previousState.atLow;
      
      if ((isNewLowValue || transitionedToLow) && !triggeredAlert) {
        const alertId = this.generateDeterministicUUID(`${stock.symbol}_DAY_LOW_${dayTimestamp}`);
        const alert: StockAlert = {
          id: alertId,
          symbol: stock.symbol,
          name: stock.name,
          alertType: 'DAY_LOW',
          price: stock.price, // Use current price
          createdAt: now,
        };
        newAlerts.push(alert);
        triggeredAlert = true;
        logger.info(
          `🚀 DAY LOW ALERT: ${stock.symbol} (${stock.name}) hit ₹${stock.price.toFixed(2)}${isNewLowValue ? ' (New Low)' : ''}`
        );
      }

      // Detect VOLUME_SPIKE transition
      if (stock.volumeSpike === true && previousState.volumeSpiked === false && isCooldownOver && !triggeredAlert) {
        const alertId = this.generateDeterministicUUID(`${stock.symbol}_VOLUME_SPIKE_${dayTimestamp}`);
        const alert: StockAlert = {
          id: alertId,
          symbol: stock.symbol,
          name: stock.name,
          alertType: 'VOLUME_SPIKE',
          price: stock.price,
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
        volumeSpiked: stock.volumeSpike,
        lastAlertTime: triggeredAlert ? currentMs : previousState.lastAlertTime,
      });
    }

    // Keep in-memory history
    if (newAlerts.length > 0) {
      this.inMemoryAlerts = [...newAlerts, ...this.inMemoryAlerts].slice(0, 200);
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
}

/**
 * Singleton instance of the AlertService.
 * Import this across modules to share the same state.
 */
export const alertService = new AlertService();

export default alertService;
