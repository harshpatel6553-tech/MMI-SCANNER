import { EventEmitter } from 'node:events';
import logger from '../utils/logger.js';
import { nseSessionManager } from './nseSessionManager.js';
import { alertService } from './alertService.js';
import { NIFTY_50_STOCKS } from '../data/nifty50.js';
import { NIFTY_500_STOCKS } from '../data/nifty500.js';

interface OptionContract {
  strikePrice: number;
  openInterest: number;
  volume: number;
  lastPrice: number;
}

interface OptionChainSnapshot {
  timestamp: number;
  calls: Record<string, OptionContract>; // Keyed by strike price
  puts: Record<string, OptionContract>;
}

class NseOptionService extends EventEmitter {
  private snapshots: Map<string, OptionChainSnapshot> = new Map();
  private watchlist: string[] = [];
  private isRunning: boolean = false;

  constructor() {
    super();
    // Combine top F&O stocks. We will attempt them all.
    // NIFTY and BANKNIFTY use a different endpoint so we will add them manually.
    const allSymbols = new Set([
      ...NIFTY_50_STOCKS.map(s => s.symbol.replace('.NS', '')),
      ...NIFTY_500_STOCKS.map(s => s.symbol.replace('.NS', ''))
    ]);
    this.watchlist = Array.from(allSymbols);
  }

  /**
   * Polls the Option Chain for a given symbol and checks for sudden spikes.
   */
  async checkOptionSpikes(symbol: string, isIndex = false) {
    logger.debug(`Fetching NSE Option Chain for ${symbol}...`);
    try {
      const endpoint = isIndex 
        ? `https://www.nseindia.com/api/option-chain-indices?symbol=${symbol}`
        : `https://www.nseindia.com/api/option-chain-equities?symbol=${encodeURIComponent(symbol)}`;
        
      const chainData = await nseSessionManager.fetch(endpoint);
      
      if (!chainData || !chainData.records || !chainData.records.data) {
        return; // Not an F&O stock or no data
      }

      const currentSnapshot = this.parseOptionChain(chainData.records.data);
      const previousSnapshot = this.snapshots.get(symbol);
      
      if (previousSnapshot) {
        this.detectSpikes(symbol, previousSnapshot, currentSnapshot);
      }

      this.snapshots.set(symbol, currentSnapshot);
    } catch (err: any) {
      logger.debug(`Skipping ${symbol} options check (Not F&O or Rate Limited).`);
    }
  }

  private parseOptionChain(data: any[]): OptionChainSnapshot {
    const snapshot: OptionChainSnapshot = {
      timestamp: Date.now(),
      calls: {},
      puts: {}
    };

    data.forEach((item: any) => {
      const strike = item.strikePrice;
      
      if (item.CE) {
        snapshot.calls[strike] = {
          strikePrice: strike,
          openInterest: item.CE.openInterest || 0,
          volume: item.CE.totalTradedVolume || 0,
          lastPrice: item.CE.lastPrice || 0
        };
      }
      
      if (item.PE) {
        snapshot.puts[strike] = {
          strikePrice: strike,
          openInterest: item.PE.openInterest || 0,
          volume: item.PE.totalTradedVolume || 0,
          lastPrice: item.PE.lastPrice || 0
        };
      }
    });

    return snapshot;
  }

  private detectSpikes(symbol: string, oldSnap: OptionChainSnapshot, newSnap: OptionChainSnapshot) {
    // For testing and high sensitivity, look for a 1% jump
    const OI_SPIKE_THRESHOLD = 0.01;

    for (const strike in newSnap.calls) {
      const oldCall = oldSnap.calls[strike];
      const newCall = newSnap.calls[strike];
      
      if (oldCall && newCall && oldCall.openInterest > 500) { // Ignore illiquid strikes
        const oiIncrease = (newCall.openInterest - oldCall.openInterest) / oldCall.openInterest;
        if (oiIncrease >= OI_SPIKE_THRESHOLD) {
          logger.info(`🚨 CALL WRITING SPIKE: ${symbol} at ${strike} CE (+${(oiIncrease * 100).toFixed(1)}% OI)`);
          
          this.emit('option:alert', {
            symbol: symbol,
            name: `${symbol} ${strike} CE`,
            price: newCall.lastPrice,
            alertType: 'OPTIONS_CALL_SPIKE',
          });
        }
      }
    }

    for (const strike in newSnap.puts) {
      const oldPut = oldSnap.puts[strike];
      const newPut = newSnap.puts[strike];
      
      if (oldPut && newPut && oldPut.openInterest > 500) { // Ignore illiquid strikes
        const oiIncrease = (newPut.openInterest - oldPut.openInterest) / oldPut.openInterest;
        if (oiIncrease >= OI_SPIKE_THRESHOLD) {
          logger.info(`🚨 PUT WRITING SPIKE: ${symbol} at ${strike} PE (+${(oiIncrease * 100).toFixed(1)}% OI)`);
          
          this.emit('option:alert', {
            symbol: symbol,
            name: `${symbol} ${strike} PE`,
            price: newPut.lastPrice,
            alertType: 'OPTIONS_PUT_SPIKE',
          });
        }
      }
    }
  }

  /**
   * Main loop to poll option chains for all stocks sequentially (1 stock every 2 seconds).
   */
  async startPolling() {
    if (this.isRunning) return;
    this.isRunning = true;
    
    logger.info(`Started NSE Option Chain Scanner (7-Minute Cycle) for ${this.watchlist.length} stocks.`);
    
    // Refresh cookies once before starting the massive loop
    await nseSessionManager.refreshCookies();

    while (this.isRunning) {
      // Always check NIFTY and BANKNIFTY first in the cycle
      await this.checkOptionSpikes('NIFTY', true);
      await new Promise(res => setTimeout(res, 2000));
      
      await this.checkOptionSpikes('BANKNIFTY', true);
      await new Promise(res => setTimeout(res, 2000));

      for (const symbol of this.watchlist) {
        if (!this.isRunning) break;
        
        await this.checkOptionSpikes(symbol, false);
        
        // Wait 2 seconds between each request to avoid IP ban from NSE
        await new Promise(res => setTimeout(res, 2000));
      }
      
      logger.info('🔄 Completed one full F&O Option Chain scan cycle. Restarting...');
    }
  }

  stopPolling() {
    this.isRunning = false;
  }
}

export const nseOptionService = new NseOptionService();
export default nseOptionService;
