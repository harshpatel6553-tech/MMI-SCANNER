import { stockService } from './stockService.js';
import { nseScraperService } from './nseScraperService.js';
import { optionChainService } from './optionChainService.js';
import type { StockData } from '../types/index.js';
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

export interface SmartMoneyFlowSummary {
  timestamp: string;
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

    return {
      timestamp: new Date().toISOString(),
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
