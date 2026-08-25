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
}

/**
 * Service for detecting day-high/day-low transitions and managing alerts.
 *
 * Maintains an internal state map so that alerts are only generated on
 * the *transition* from not-at-extreme to at-extreme, avoiding spam.
 *
 * @example
 * ```typescript
 * import { alertService } from './alertService.js';
 *
 * const newAlerts = alertService.checkAndGenerateAlerts(latestStocks);
 * if (newAlerts.length > 0) {
 *   logger.info(`${newAlerts.length} new alerts generated`);
 * }
 * ```
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
    const hash = crypto.createHash('md5').update(input).digest('hex');
    return [
      hash.substring(0, 8),
      hash.substring(8, 12),
      hash.substring(12, 16),
      hash.substring(16, 20),
      hash.substring(20, 32)
    ].join('-');
  }

  /**
   * Check stock data for day-high/low transitions and generate alerts.
   */
  checkAndGenerateAlerts(stocks: StockData[]): StockAlert[] {
    const newAlerts: StockAlert[] = [];
    const now = new Date().toISOString();
    const minuteTimestamp = now.substring(0, 16); // e.g., "2023-10-27T10:15"

    for (const stock of stocks) {
      const previousState = this.previousHighLowState.get(stock.symbol) || {
        atHigh: false,
        atLow: false,
        highValue: 0,
        lowValue: 0,
        volumeSpiked: false,
      };

      // Detect DAY_HIGH transition or new high value
      const isNewHighValue = previousState.highValue > 0 && stock.dayHigh > previousState.highValue;
      const transitionedToHigh = stock.atDayHigh && !previousState.atHigh;
      
      if (isNewHighValue || transitionedToHigh) {
        const alertId = this.generateDeterministicUUID(`${stock.symbol}_DAY_HIGH_${minuteTimestamp}`);
        const alert: StockAlert = {
          id: alertId,
          symbol: stock.symbol,
          name: stock.name,
          alertType: 'DAY_HIGH',
          price: stock.dayHigh,
          createdAt: now,
        };
        newAlerts.push(alert);
        logger.info(
          `🔔 DAY HIGH ALERT: ${stock.symbol} (${stock.name}) hit ₹${stock.dayHigh.toFixed(2)}${isNewHighValue ? ' (New High)' : ''}`
        );
      }

      // Detect DAY_LOW transition or new low value
      const isNewLowValue = previousState.lowValue > 0 && stock.dayLow < previousState.lowValue;
      const transitionedToLow = stock.atDayLow && !previousState.atLow;
      
      if (isNewLowValue || transitionedToLow) {
        const alertId = this.generateDeterministicUUID(`${stock.symbol}_DAY_LOW_${minuteTimestamp}`);
        const alert: StockAlert = {
          id: alertId,
          symbol: stock.symbol,
          name: stock.name,
          alertType: 'DAY_LOW',
          price: stock.dayLow,
          createdAt: now,
        };
        newAlerts.push(alert);
        logger.info(
          `🔔 DAY LOW ALERT: ${stock.symbol} (${stock.name}) hit ₹${stock.dayLow.toFixed(2)}${isNewLowValue ? ' (New Low)' : ''}`
        );
      }

      // Detect VOLUME_SPIKE transition
      if (stock.volumeSpike === true && previousState.volumeSpiked === false) {
        const alertId = this.generateDeterministicUUID(`${stock.symbol}_VOLUME_SPIKE_${minuteTimestamp}`);
        const alert: StockAlert = {
          id: alertId,
          symbol: stock.symbol,
          name: stock.name,
          alertType: 'VOLUME_SPIKE',
          price: stock.price,
          createdAt: now,
        };
        newAlerts.push(alert);
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
    if (!isSupabaseConfigured) {
      logger.debug(
        `Supabase not configured — returning ${Math.min(this.inMemoryAlerts.length, limit)} alerts from in-memory cache`
      );
      return this.inMemoryAlerts.slice(0, limit);
    }

    try {
      const { data, error } = await supabase
        .from('alerts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        logger.error(`Failed to fetch alerts from Supabase: ${error.message}`);
        return [];
      }

      if (!data) {
        return [];
      }

      return data.map(
        (row: Record<string, unknown>) =>
          ({
            id: row.id as string,
            symbol: row.symbol as string,
            name: row.name as string,
            alertType: row.alert_type as 'DAY_HIGH' | 'DAY_LOW' | 'VOLUME_SPIKE',
            price: row.price as number,
            createdAt: row.created_at as string,
          }) satisfies StockAlert
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error(`Error fetching alerts: ${message}`);
      return [];
    }
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
