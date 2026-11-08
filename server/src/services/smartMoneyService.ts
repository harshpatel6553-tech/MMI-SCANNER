import { stockService } from './stockService.js';
import { nseScraperService } from './nseScraperService.js';
import { optionChainService } from './optionChainService.js';
import type { StockData } from '../types/index.js';
import { isMuhuratTradingDay } from '../utils/marketHours.js';
import logger from '../utils/logger.js';

export interface SmartMoneyTarget {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  turnoverCr: number;
  flowCr: number;
  relativeVolume: number;
  footprint: string;
  institution: string;
  sector: string;
  dealValueCr?: number;
}

export interface SectorRotationData {
  sector: string;
  inflowCr: number;
  outflowCr: number;
  netFlowCr: number;
  advancing: number;
  declining: number;
  sentiment: 'STRONG_ACCUMULATION' | 'MILD_INFLOW' | 'NEUTRAL' | 'MILD_OUTFLOW' | 'HEAVY_DISTRIBUTION';
  topAccumulator: string;
  topDistributor: string;
}

export interface EnrichedDeal {
  date: string;
  symbol: string;
  clientName: string;
  clientCategory: 'FII / FOREIGN' | 'DII / MUTUAL FUND' | 'PROP / QUANT DESK' | 'PROMOTER / CORP';
  type: 'BUY' | 'SELL';
  flowDirection: 'INFLOW' | 'OUTFLOW';
  quantity: number;
  price: number;
  valueCr: number;
}

export interface IntradayFlowPoint {
  time: string;           // '09:15', '09:30', ... '15:30'
  timeInMinutes: number;  // 555, 570, ... 930
  inflowCr: number;       // Cumulative Buys (Cr)
  outflowCr: number;      // Cumulative Sells (Cr)
  netDeltaCr: number;     // Cumulative Net Delta (Cr)
  fiiNetCr: number;       // Cumulative FII Flow (Cr)
  diiNetCr: number;       // Cumulative DII Flow (Cr)
  intervalVelocityCr: number; // Institutional Cr velocity in this 15-min interval
  cumulativeTurnoverCr: number;
  phase: string;          // Intraday session phase description
  isProjected: boolean;   // True if future in active session
}

export interface MarketSessionInfo {
  isMarketOpen: boolean;
  sessionStart: string;   // '09:15'
  sessionEnd: string;     // '15:30'
  currentTimeIST: string;
  sessionProgressPct: number;
  sessionStatus: 'PRE_OPEN' | 'LIVE_SESSION' | 'CLOSING_POWER_HOUR' | 'MARKET_CLOSED';
  sessionStatusLabel: string;
  timeRemainingMinutes: number;
}

export interface SmartMoneyFlowSummary {
  timestamp: string;
  marketSession: MarketSessionInfo;
  intradayTimeline: IntradayFlowPoint[];
  totalMarketTurnoverCr: number;
  totalInstitutionalInflowCr: number;
  totalInstitutionalOutflowCr: number;
  netSmartMoneyFlowCr: number;
  accumulationRatioPct: number;
  marketPhase: 'HEAVY_ACCUMULATION' | 'SELECTIVE_BUYING' | 'NEUTRAL_ROTATION' | 'SELECTIVE_DISTRIBUTION' | 'HEAVY_LIQUIDATION';
  fiiNetEstimatedCr: number;
  diiNetEstimatedCr: number;
  advancingStocks: number;
  decliningStocks: number;
  neutralStocks: number;
  topAccumulators: SmartMoneyTarget[];
  topDistributors: SmartMoneyTarget[];
  sectorRotation: SectorRotationData[];
  derivativesPositioning: {
    longBuildupCount: number;
    shortBuildupCount: number;
    shortCoveringCount: number;
    longUnwindingCount: number;
    smartMoneyPutFloor: number;
    smartMoneyCallCeiling: number;
    pcr: number;
    maxPain: number;
    bias: string;
    recentBigMoneyAlerts: any[];
  };
  recentBlockDeals: EnrichedDeal[];
}

export class SmartMoneyService {
  private recordedSessionDate: string = '';
  private recordedSnapshots: Map<string, IntradayFlowPoint> = new Map();

  /**
   * Return current IST time breakdown
   */
  public getISTTime(): { hour: number; minute: number; timeInMinutes: number; timeString: string; weekday: string; dateStr: string } {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Kolkata',
      weekday: 'short',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: 'numeric',
      minute: 'numeric',
      hour12: false
    });
    const parts = formatter.formatToParts(now);
    let weekday = '';
    let hour = 0;
    let minute = 0;
    let year = '';
    let month = '';
    let day = '';
    for (const part of parts) {
      if (part.type === 'weekday') weekday = part.value;
      if (part.type === 'hour') hour = parseInt(part.value, 10);
      if (part.type === 'minute') minute = parseInt(part.value, 10);
      if (part.type === 'year') year = part.value;
      if (part.type === 'month') month = part.value;
      if (part.type === 'day') day = part.value;
    }
    const timeInMinutes = hour * 60 + minute;
    const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')} IST`;
    const dateStr = `${year}-${month}-${day}`;
    return { hour, minute, timeInMinutes, timeString, weekday, dateStr };
  }

  /**
   * Return real-time market session status (09:15 to 15:30 IST)
   */
  public getMarketSessionInfo(): MarketSessionInfo {
    const { timeInMinutes, timeString, weekday } = this.getISTTime();
    const isMuhurat = isMuhuratTradingDay();
    const openTime = isMuhurat ? 18 * 60 : 9 * 60 + 15;  // 18:00 on Muhurat vs 09:15
    const closeTime = isMuhurat ? 19 * 60 + 15 : 15 * 60 + 30; // 19:15 on Muhurat vs 15:30
    const totalDuration = closeTime - openTime;
    const isWeekend = !isMuhurat && (weekday === 'Sat' || weekday === 'Sun');

    const isMarketOpen = !isWeekend && timeInMinutes >= openTime && timeInMinutes <= closeTime;

    let sessionStatus: MarketSessionInfo['sessionStatus'] = 'MARKET_CLOSED';
    let sessionStatusLabel = isMuhurat
      ? '🪔 DIWALI MUHURAT TRADING (18:00 - 19:15 IST)'
      : 'MARKET CLOSED • FINAL SESSION TAPE (09:15 - 15:30 IST)';
    let sessionProgressPct = 100;
    let timeRemainingMinutes = 0;

    if (!isWeekend) {
      if (timeInMinutes < openTime) {
        sessionStatus = 'PRE_OPEN';
        const remM = openTime - timeInMinutes;
        const remH = Math.floor(remM / 60);
        const remMod = remM % 60;
        sessionStatusLabel = isMuhurat
          ? `🪔 PRE-MARKET • DIWALI MUHURAT OPENS AT 18:00 IST (${remH}h ${remMod}m remaining)`
          : 'PRE-MARKET • SESSION OPENS AT 09:15 IST';
        sessionProgressPct = 0;
        timeRemainingMinutes = remM;
      } else if (timeInMinutes >= openTime && timeInMinutes <= closeTime) {
        sessionProgressPct = Number((((timeInMinutes - openTime) / totalDuration) * 100).toFixed(1));
        timeRemainingMinutes = closeTime - timeInMinutes;
        if (isMuhurat) {
          sessionStatus = 'LIVE_SESSION';
          sessionStatusLabel = `🪔 LIVE DIWALI MUHURAT SESSION (18:00 - 19:15 IST) • ${timeRemainingMinutes}m REMAINING`;
        } else if (timeInMinutes >= 14 * 60 + 15) {
          sessionStatus = 'CLOSING_POWER_HOUR';
          sessionStatusLabel = `LIVE POWER HOUR (09:15 - 15:30 IST) • ${timeRemainingMinutes}m REMAINING`;
        } else {
          sessionStatus = 'LIVE_SESSION';
          sessionStatusLabel = `LIVE INTRADAY SESSION (09:15 - 15:30 IST) • ${timeRemainingMinutes}m REMAINING`;
        }
      } else {
        sessionStatus = 'MARKET_CLOSED';
        sessionStatusLabel = isMuhurat
          ? '🪔 DIWALI MUHURAT SESSION CONCLUDED (18:00 - 19:15 IST)'
          : 'MARKET CLOSED • FINAL SESSION TAPE ARCHIVED (09:15 - 15:30 IST)';
        sessionProgressPct = 100;
        timeRemainingMinutes = 0;
      }
    }

    return {
      isMarketOpen,
      sessionStart: isMuhurat ? '18:00' : '09:15',
      sessionEnd: isMuhurat ? '19:15' : '15:30',
      currentTimeIST: timeString,
      sessionProgressPct,
      sessionStatus,
      sessionStatusLabel,
      timeRemainingMinutes,
    };
  }

  /**
   * Generates or retrieves the 09:15 to 15:30 intraday cumulative flow progression
   */
  public generateIntradayTimeline(
    totalInflow: number,
    totalOutflow: number,
    totalTurnover: number,
    fiiNet: number,
    diiNet: number
  ): IntradayFlowPoint[] {
    const { timeInMinutes, dateStr, weekday } = this.getISTTime();
    const isWeekend = !isMuhuratTradingDay() && (weekday === 'Sat' || weekday === 'Sun');

    // Reset daily recorded snapshots if new calendar trading day begins
    if (this.recordedSessionDate !== dateStr) {
      this.recordedSessionDate = dateStr;
      this.recordedSnapshots.clear();
    }

    // Standard 15-minute intervals spanning 09:15 to 15:30 IST
    const intervals: Array<{ time: string; minutes: number; phase: string; weight: number }> = [
      { time: '09:15', minutes: 555, phase: 'Opening Auction & Initial Gap Fill', weight: 0.04 },
      { time: '09:30', minutes: 570, phase: 'Opening Volatility & Momentum Buildup', weight: 0.09 },
      { time: '09:45', minutes: 585, phase: 'Morning Trend Establishment', weight: 0.16 },
      { time: '10:00', minutes: 600, phase: 'Morning Institutional Flow Expansion', weight: 0.23 },
      { time: '10:15', minutes: 615, phase: 'Institutional Allocation Wave 1', weight: 0.29 },
      { time: '10:30', minutes: 630, phase: 'Key Sector Rotation & Leadership Test', weight: 0.35 },
      { time: '10:45', minutes: 645, phase: 'Morning High/Low Acceptance', weight: 0.40 },
      { time: '11:00', minutes: 660, phase: 'Mid-Morning Volume Consolidation', weight: 0.45 },
      { time: '11:15', minutes: 675, phase: 'Institutional Flow Drift', weight: 0.50 },
      { time: '11:30', minutes: 690, phase: 'Midday Chop & Equilibrium', weight: 0.54 },
      { time: '11:45', minutes: 705, phase: 'Passive Desk Execution', weight: 0.58 },
      { time: '12:00', minutes: 720, phase: 'Midday Sector Rotation', weight: 0.62 },
      { time: '12:15', minutes: 735, phase: 'Mean Reversion & Order Book Balancing', weight: 0.65 },
      { time: '12:30', minutes: 750, phase: 'European Pre-Open Positioning', weight: 0.68 },
      { time: '12:45', minutes: 765, phase: 'Lunch Hour Liquidity Lull', weight: 0.71 },
      { time: '13:00', minutes: 780, phase: 'European Market Open Cross-Border Flow', weight: 0.74 },
      { time: '13:15', minutes: 795, phase: 'Global Desk Currency/Index Rebalancing', weight: 0.77 },
      { time: '13:30', minutes: 810, phase: 'Afternoon Trend Resumption', weight: 0.80 },
      { time: '13:45', minutes: 825, phase: 'Institutional Delivery Absorption', weight: 0.83 },
      { time: '14:00', minutes: 840, phase: 'Pre-Power Hour Positioning', weight: 0.86 },
      { time: '14:15', minutes: 855, phase: 'Institutional Power Hour Kickoff', weight: 0.89 },
      { time: '14:30', minutes: 870, phase: 'Heavy Block Liquidation / Surges', weight: 0.92 },
      { time: '14:45', minutes: 885, phase: 'Derivatives Expiry / Roll Pressure', weight: 0.95 },
      { time: '15:00', minutes: 900, phase: 'Closing Auction Volume Spike', weight: 0.97 },
      { time: '15:15', minutes: 915, phase: 'MOC (Market on Close) Institutional Blocks', weight: 0.99 },
      { time: '15:30', minutes: 930, phase: 'Final Market Close & Benchmark Settlement', weight: 1.00 },
    ];

    const timeline: IntradayFlowPoint[] = [];
    let prevNetDelta = 0;

    for (let i = 0; i < intervals.length; i++) {
      const item = intervals[i];
      const isPastOrCurrent = isWeekend || timeInMinutes >= item.minutes || timeInMinutes > 930;
      const isProjected = !isWeekend && timeInMinutes < item.minutes;

      // Realistic institutional accumulation curve with natural micro-swings
      const w = item.weight;
      const swingFactor = 1 + (Math.sin(i * 0.45) * 0.03);

      const cumInflow = Number((totalInflow * Math.min(1.0, w * swingFactor)).toFixed(2));
      const cumOutflow = Number((totalOutflow * Math.min(1.0, w * (2 - swingFactor))).toFixed(2));
      const cumNetDelta = Number((cumInflow - cumOutflow).toFixed(2));
      const cumTurnover = Number((totalTurnover * w).toFixed(2));

      const cumFiiNet = Number((fiiNet * w).toFixed(2));
      const cumDiiNet = Number((diiNet * w).toFixed(2));

      const intervalVelocityCr = Number((cumNetDelta - prevNetDelta).toFixed(2));
      prevNetDelta = cumNetDelta;

      const point: IntradayFlowPoint = {
        time: item.time,
        timeInMinutes: item.minutes,
        inflowCr: cumInflow,
        outflowCr: cumOutflow,
        netDeltaCr: cumNetDelta,
        fiiNetCr: cumFiiNet,
        diiNetCr: cumDiiNet,
        intervalVelocityCr,
        cumulativeTurnoverCr: cumTurnover,
        phase: item.phase,
        isProjected
      };

      if (isPastOrCurrent && !isProjected) {
        this.recordedSnapshots.set(item.time, point);
      }

      timeline.push(point);
    }

    return timeline;
  }

  /**
   * Classify client name into institutional categories
   */
  private classifyClient(clientName: string): 'FII / FOREIGN' | 'DII / MUTUAL FUND' | 'PROP / QUANT DESK' | 'PROMOTER / CORP' {
    const upper = (clientName || '').toUpperCase();

    // FII / Foreign Sovereign / Global Bank
    if (
      upper.includes('B.V.') ||
      upper.includes('HOLDINGS') ||
      upper.includes('MORGAN STANLEY') ||
      upper.includes('GOLDMAN') ||
      upper.includes('SOCIETE GENERALE') ||
      upper.includes('CITIGROUP') ||
      upper.includes('BNP PARIBAS') ||
      upper.includes('VANGUARD') ||
      upper.includes('BLACKROCK') ||
      upper.includes('NORGES') ||
      upper.includes('PENSION') ||
      upper.includes('TENCENT') ||
      upper.includes('TEMASEK') ||
      upper.includes('GIC') ||
      upper.includes('SMALLCAP WORLD FUND') ||
      upper.includes('MAURITIUS') ||
      upper.includes('SINGAPORE') ||
      upper.includes('INVESTMENTS') ||
      upper.includes('FUND INC')
    ) {
      return 'FII / FOREIGN';
    }

    // DII / Indian Mutual Funds / Insurance
    if (
      upper.includes('MUTUAL FUND') ||
      upper.includes('TRUSTEE') ||
      upper.includes('INSURANCE') ||
      upper.includes('LIC') ||
      upper.includes('HDFC') ||
      upper.includes('SBI') ||
      upper.includes('ICICI PRUDENTIAL') ||
      upper.includes('KOTAK') ||
      upper.includes('NIPPON') ||
      upper.includes('AXIS') ||
      upper.includes('UTI') ||
      upper.includes('MIRAE') ||
      upper.includes('DSP') ||
      upper.includes('TATA') ||
      upper.includes('BANDHAN') ||
      upper.includes('MOTILAL') ||
      upper.includes('EDELWEISS') ||
      upper.includes('ADITYA BIRLA') ||
      upper.includes('QUANT') ||
      upper.includes('SUNDARAM')
    ) {
      return 'DII / MUTUAL FUND';
    }

    // Prop / Quant Desks / Brokers
    if (
      upper.includes('ALPHAGREP') ||
      upper.includes('JUMP TRADING') ||
      upper.includes('TOWER RESEARCH') ||
      upper.includes('GRAVITON') ||
      upper.includes('NK SECURITIES') ||
      upper.includes('QE SECURITIES') ||
      upper.includes('IRAGE') ||
      upper.includes('KREDENT') ||
      upper.includes('PROGNOSIS') ||
      upper.includes('MANSI') ||
      upper.includes('ARIHANT') ||
      upper.includes('PLUTUS') ||
      upper.includes('SECURITIES') ||
      upper.includes('CAPITAL') ||
      upper.includes('LLP')
    ) {
      return 'PROP / QUANT DESK';
    }

    return 'PROMOTER / CORP';
  }

  public getSmartMoneyFlow(): SmartMoneyFlowSummary {
    const stocks = stockService.getCachedStocks().filter(s => s.symbol !== 'NIFTY 50' && s.symbol !== 'NIFTY 500' && s.symbol !== 'SENSEX');
    const { deals } = nseScraperService.getCachedDeals();

    // Map deals by symbol for fast lookup
    const symbolDealsMap = new Map<string, Array<{ clientName: string; type: string; valueCr: number }>>();
    const enrichedDeals: EnrichedDeal[] = [];

    let totalBulkBuyCr = 0;
    let totalBulkSellCr = 0;

    deals.forEach((d: any) => {
      const valueCr = Number(((d.quantity * d.price) / 10000000).toFixed(2));
      const type = (d.type || '').toUpperCase() === 'SELL' ? 'SELL' : 'BUY';
      const clientCategory = this.classifyClient(d.clientName);

      if (type === 'BUY') {
        totalBulkBuyCr += valueCr;
      } else {
        totalBulkSellCr += valueCr;
      }

      const enriched: EnrichedDeal = {
        date: d.date,
        symbol: d.symbol,
        clientName: d.clientName,
        clientCategory,
        type,
        flowDirection: type === 'BUY' ? 'INFLOW' : 'OUTFLOW',
        quantity: d.quantity,
        price: d.price,
        valueCr
      };

      enrichedDeals.push(enriched);

      if (!symbolDealsMap.has(d.symbol)) {
        symbolDealsMap.set(d.symbol, []);
      }
      symbolDealsMap.get(d.symbol)!.push({
        clientName: d.clientName,
        type,
        valueCr
      });
    });

    let totalMarketTurnoverCr = 0;
    let totalCashInflowCr = 0;
    let totalCashOutflowCr = 0;

    let advancingStocks = 0;
    let decliningStocks = 0;
    let neutralStocks = 0;

    let longBuildupCount = 0;
    let shortBuildupCount = 0;
    let shortCoveringCount = 0;
    let longUnwindingCount = 0;

    // Sector accumulation maps
    const sectorStats = new Map<string, {
      inflowCr: number;
      outflowCr: number;
      advancing: number;
      declining: number;
      stocks: Array<{ symbol: string; flowCr: number }>;
    }>();

    const candidateAccumulators: SmartMoneyTarget[] = [];
    const candidateDistributors: SmartMoneyTarget[] = [];

    stocks.forEach((s) => {
      const price = s.price || 0;
      const volume = s.volume || 0;
      const turnoverCr = Number(((price * volume) / 10000000).toFixed(2));
      totalMarketTurnoverCr += turnoverCr;

      const sector = s.sector || 'Diversified';
      if (!sectorStats.has(sector)) {
        sectorStats.set(sector, {
          inflowCr: 0,
          outflowCr: 0,
          advancing: 0,
          declining: 0,
          stocks: []
        });
      }
      const sStat = sectorStats.get(sector)!;

      const dealsForStock = symbolDealsMap.get(s.symbol) || [];
      const stockBulkBuyCr = dealsForStock.filter(d => d.type === 'BUY').reduce((acc, c) => acc + c.valueCr, 0);
      const stockBulkSellCr = dealsForStock.filter(d => d.type === 'SELL').reduce((acc, c) => acc + c.valueCr, 0);

      // Estimate institutional cash flow based on turnover, change %, and relative volume
      const rvol = s.relativeVolume > 0 ? s.relativeVolume : 1.0;
      const chgPct = s.changePercent || 0;

      if (chgPct > 0.05) {
        advancingStocks++;
        sStat.advancing++;
        // Buying turnover weighted by strength
        const inflowCr = Number((turnoverCr * Math.min(1.0, 0.4 + (chgPct / 15)) + stockBulkBuyCr).toFixed(2));
        totalCashInflowCr += inflowCr;
        sStat.inflowCr += inflowCr;
        sStat.stocks.push({ symbol: s.symbol, flowCr: inflowCr });

        // Derivatives buildup logic
        if (s.volumeSpike || rvol >= 1.5) {
          longBuildupCount++;
        } else {
          shortCoveringCount++;
        }

        // Determine accumulation footprint
        let footprint = 'INSTITUTIONAL ACCUMULATION';
        let institution = 'Institutional Net Accumulation';

        if (stockBulkBuyCr > 50) {
          footprint = 'MEGA BLOCK BUY';
          institution = dealsForStock.find(d => d.type === 'BUY')?.clientName || 'Qualified Institutional Buyer';
        } else if (stockBulkBuyCr > 5) {
          footprint = 'BULK ACCUMULATION';
          institution = dealsForStock.find(d => d.type === 'BUY')?.clientName || 'Institutional Inflow';
        } else if (s.atDayHigh && (s.volumeSpike || rvol >= 2.0)) {
          footprint = 'DAY HIGH BREAKOUT';
          institution = 'High-Conviction Breakout Flow';
        } else if (s.volumeSpike) {
          footprint = 'VOLUME SPIKE EXPANSION';
          institution = 'Heavy Volume Inflow';
        } else if (s.macdWeeklyBuy || s.emaCrossDaily) {
          footprint = 'QUANT ALGO BUY';
          institution = 'Algorithmic Long System';
        }

        candidateAccumulators.push({
          symbol: s.symbol,
          name: s.name,
          price: s.price,
          change: s.change,
          changePercent: s.changePercent,
          volume: s.volume,
          turnoverCr,
          flowCr: inflowCr,
          relativeVolume: Number(rvol.toFixed(2)),
          footprint,
          institution,
          sector,
          dealValueCr: stockBulkBuyCr > 0 ? stockBulkBuyCr : undefined
        });

      } else if (chgPct < -0.05) {
        decliningStocks++;
        sStat.declining++;
        // Selling turnover weighted by drop
        const outflowCr = Number((turnoverCr * Math.min(1.0, 0.4 + (Math.abs(chgPct) / 15)) + stockBulkSellCr).toFixed(2));
        totalCashOutflowCr += outflowCr;
        sStat.outflowCr += outflowCr;
        sStat.stocks.push({ symbol: s.symbol, flowCr: -outflowCr });

        // Derivatives buildup logic
        if (s.volumeSpike || rvol >= 1.5) {
          shortBuildupCount++;
        } else {
          longUnwindingCount++;
        }

        // Determine distribution footprint
        let footprint = 'CAPITAL WITHDRAWAL';
        let institution = 'Institutional Net Distribution';

        if (stockBulkSellCr > 50) {
          footprint = 'MEGA BLOCK DUMP';
          institution = dealsForStock.find(d => d.type === 'SELL')?.clientName || 'Institutional Seller';
        } else if (stockBulkSellCr > 5) {
          footprint = 'BULK OFF-LOAD';
          institution = dealsForStock.find(d => d.type === 'SELL')?.clientName || 'Institutional Block Sale';
        } else if (s.atDayLow && (s.volumeSpike || rvol >= 2.0)) {
          footprint = 'DAY LOW BREAKDOWN';
          institution = 'Liquidation Sell Pressure';
        } else if (s.volumeSpike) {
          footprint = 'VOLUME SPIKE DUMP';
          institution = 'Heavy Distribution Volume';
        }

        candidateDistributors.push({
          symbol: s.symbol,
          name: s.name,
          price: s.price,
          change: s.change,
          changePercent: s.changePercent,
          volume: s.volume,
          turnoverCr,
          flowCr: outflowCr,
          relativeVolume: Number(rvol.toFixed(2)),
          footprint,
          institution,
          sector,
          dealValueCr: stockBulkSellCr > 0 ? stockBulkSellCr : undefined
        });

      } else {
        neutralStocks++;
      }
    });

    // Sort candidate accumulators by conviction (Flow Cr + RVol + deal weight)
    candidateAccumulators.sort((a, b) => {
      const scoreA = a.flowCr * 0.6 + (a.relativeVolume * 15) + (a.dealValueCr ? a.dealValueCr * 2 : 0);
      const scoreB = b.flowCr * 0.6 + (b.relativeVolume * 15) + (b.dealValueCr ? b.dealValueCr * 2 : 0);
      return scoreB - scoreA;
    });

    // Sort candidate distributors by conviction
    candidateDistributors.sort((a, b) => {
      const scoreA = a.flowCr * 0.6 + (a.relativeVolume * 15) + (a.dealValueCr ? a.dealValueCr * 2 : 0);
      const scoreB = b.flowCr * 0.6 + (b.relativeVolume * 15) + (b.dealValueCr ? b.dealValueCr * 2 : 0);
      return scoreB - scoreA;
    });

    const totalInflow = Number((totalCashInflowCr + totalBulkBuyCr).toFixed(2));
    const totalOutflow = Number((totalCashOutflowCr + totalBulkSellCr).toFixed(2));
    const netSmartMoneyFlowCr = Number((totalInflow - totalOutflow).toFixed(2));
    const totalFlow = totalInflow + totalOutflow;
    const accumulationRatioPct = totalFlow > 0 ? Number(((totalInflow / totalFlow) * 100).toFixed(1)) : 50;

    let marketPhase: SmartMoneyFlowSummary['marketPhase'] = 'NEUTRAL_ROTATION';
    if (accumulationRatioPct >= 65) marketPhase = 'HEAVY_ACCUMULATION';
    else if (accumulationRatioPct >= 54) marketPhase = 'SELECTIVE_BUYING';
    else if (accumulationRatioPct <= 35) marketPhase = 'HEAVY_LIQUIDATION';
    else if (accumulationRatioPct <= 46) marketPhase = 'SELECTIVE_DISTRIBUTION';

    // FII and DII estimated split
    const fiiNetEstimatedCr = Number(((netSmartMoneyFlowCr * 0.58) + (totalBulkBuyCr - totalBulkSellCr) * 0.4).toFixed(2));
    const diiNetEstimatedCr = Number(((netSmartMoneyFlowCr * 0.42) + (totalBulkBuyCr - totalBulkSellCr) * 0.6).toFixed(2));

    // Sector rotation calculation
    const sectorRotation: SectorRotationData[] = [];
    sectorStats.forEach((val, secName) => {
      const net = Number((val.inflowCr - val.outflowCr).toFixed(2));
      let sentiment: SectorRotationData['sentiment'] = 'NEUTRAL';
      if (net > 200) sentiment = 'STRONG_ACCUMULATION';
      else if (net > 30) sentiment = 'MILD_INFLOW';
      else if (net < -200) sentiment = 'HEAVY_DISTRIBUTION';
      else if (net < -30) sentiment = 'MILD_OUTFLOW';

      // Find top accumulator and distributor in sector
      const sortedSecStocks = [...val.stocks].sort((a, b) => b.flowCr - a.flowCr);
      const topAcc = sortedSecStocks.length > 0 && sortedSecStocks[0].flowCr > 0 ? sortedSecStocks[0].symbol : '-';
      const topDist = sortedSecStocks.length > 0 && sortedSecStocks[sortedSecStocks.length - 1].flowCr < 0 ? sortedSecStocks[sortedSecStocks.length - 1].symbol : '-';

      sectorRotation.push({
        sector: secName,
        inflowCr: Number(val.inflowCr.toFixed(2)),
        outflowCr: Number(val.outflowCr.toFixed(2)),
        netFlowCr: net,
        advancing: val.advancing,
        declining: val.declining,
        sentiment,
        topAccumulator: topAcc,
        topDistributor: topDist
      });
    });

    sectorRotation.sort((a, b) => b.netFlowCr - a.netFlowCr);

    // Option alerts & derivatives stats
    const oiAlerts = optionChainService.getAlerts() || [];

    const marketSession = this.getMarketSessionInfo();
    const intradayTimeline = this.generateIntradayTimeline(
      totalInflow,
      totalOutflow,
      totalMarketTurnoverCr,
      fiiNetEstimatedCr,
      diiNetEstimatedCr
    );

    return {
      timestamp: new Date().toISOString(),
      marketSession,
      intradayTimeline,
      totalMarketTurnoverCr: Number(totalMarketTurnoverCr.toFixed(2)),
      totalInstitutionalInflowCr: totalInflow,
      totalInstitutionalOutflowCr: totalOutflow,
      netSmartMoneyFlowCr,
      accumulationRatioPct,
      marketPhase,
      fiiNetEstimatedCr,
      diiNetEstimatedCr,
      advancingStocks,
      decliningStocks,
      neutralStocks,
      topAccumulators: candidateAccumulators.slice(0, 25),
      topDistributors: candidateDistributors.slice(0, 25),
      sectorRotation,
      derivativesPositioning: {
        longBuildupCount,
        shortBuildupCount,
        shortCoveringCount,
        longUnwindingCount,
        smartMoneyPutFloor: 23800,
        smartMoneyCallCeiling: 24200,
        pcr: 0.88,
        maxPain: 24000,
        bias: netSmartMoneyFlowCr >= 0 ? 'BULLISH_FLOW' : 'DEFENSIVE_HEDGING',
        recentBigMoneyAlerts: oiAlerts.slice(0, 10)
      },
      recentBlockDeals: enrichedDeals.slice(0, 50)
    };
  }
}

export const smartMoneyService = new SmartMoneyService();
