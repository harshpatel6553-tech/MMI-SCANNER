import { Request, Response } from 'express';
import { supabase } from '../config/supabase.js';
import logger from '../utils/logger.js';

export const getPortfolio = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    const [portfolioRes, positionsRes, tradesRes] = await Promise.all([
      supabase.from('paper_portfolios').select('*').eq('user_id', userId).single(),
      supabase.from('paper_positions').select('*').eq('user_id', userId),
      supabase.from('paper_trades').select('*').eq('user_id', userId).order('timestamp', { ascending: false }).limit(50)
    ]);

    res.json({
      success: true,
      portfolio: portfolioRes.data || { balance: 1000000 },
      positions: positionsRes.data || [],
      recentTrades: tradesRes.data || []
    });
  } catch (error: any) {
    logger.error(`Error fetching portfolio: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
};

export const executeTrade = async (req: Request, res: Response) => {
  try {
    const { userId, symbol, side, quantity, price } = req.body;

    if (!userId || !symbol || !side || !quantity || !price) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    const totalCost = quantity * price;

    // 1. Fetch current portfolio
    const { data: portfolio, error: portError } = await supabase
      .from('paper_portfolios')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (portError) throw portError;

    // 2. Fetch current position
    const { data: position, error: posError } = await supabase
      .from('paper_positions')
      .select('*')
      .eq('user_id', userId)
      .eq('symbol', symbol)
      .single();

    let newBalance = Number(portfolio.balance);
    let newQuantity = position ? position.quantity : 0;
    let newAveragePrice = position ? Number(position.average_price) : 0;

    // Calculate Buying Power
    const { data: allPositions } = await supabase
      .from('paper_positions')
      .select('*')
      .eq('user_id', userId);

    let shortLiability = 0;
    if (allPositions) {
      allPositions.forEach(p => {
        if (p.quantity < 0) {
          shortLiability += Math.abs(p.quantity * p.average_price);
        }
      });
    }
    
    // Buying power is cash minus the margin required to hold short positions
    const buyingPower = newBalance - shortLiability;

    if (side === 'BUY') {
      // Only enforce buying power limits if opening a new long position or adding to one
      if (newQuantity >= 0 && buyingPower < totalCost) {
        return res.status(400).json({ success: false, error: 'Insufficient buying power (Margin Used by Short Positions)' });
      }
      newBalance -= totalCost;
      
      if (newQuantity < 0) {
        newQuantity += quantity;
        if (newQuantity > 0) {
          newAveragePrice = price; // Flipped to long
        } else if (newQuantity === 0) {
          newAveragePrice = 0;
        }
      } else {
        const totalValue = (newQuantity * newAveragePrice) + totalCost;
        newQuantity += quantity;
        newAveragePrice = totalValue / newQuantity;
      }

    } else if (side === 'SELL') {
      newBalance += totalCost;
      
      if (newQuantity > 0) {
        newQuantity -= quantity;
        if (newQuantity < 0) {
          newAveragePrice = price; // Flipped to short
        } else if (newQuantity === 0) {
          newAveragePrice = 0;
        }
      } else {
        const currentCost = Math.abs(newQuantity) * newAveragePrice;
        const additionalCost = quantity * price;
        newQuantity -= quantity;
        newAveragePrice = (currentCost + additionalCost) / Math.abs(newQuantity);
      }
    }

    // 3. Update Database
    
    // Update Portfolio
    await supabase.from('paper_portfolios').update({ balance: newBalance }).eq('user_id', userId);

    // Update Position
    if (newQuantity !== 0) {
      if (position) {
        await supabase.from('paper_positions').update({ 
          quantity: newQuantity, 
          average_price: newAveragePrice 
        }).eq('id', position.id);
      } else {
        await supabase.from('paper_positions').insert({
          user_id: userId,
          symbol,
          quantity: newQuantity,
          average_price: newAveragePrice
        });
      }
    } else if (position && newQuantity === 0) {
      await supabase.from('paper_positions').delete().eq('id', position.id);
    }

    // Log Trade
    const { data: tradeData, error: tradeErr } = await supabase.from('paper_trades').insert({
      user_id: userId,
      symbol,
      side,
      quantity,
      price
    }).select().single();

    if (tradeErr) {
      logger.error('Failed to insert trade record', tradeErr);
    }

    res.json({
      success: true,
      message: `Successfully ${side === 'BUY' ? 'bought' : 'sold'} ${quantity} shares of ${symbol}`,
      newBalance
    });

  } catch (error: any) {
    logger.error(`Trade execution error: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
};

import { stockService } from '../services/stockService.js';

export const getLeaderboard = async (req: Request, res: Response) => {
  try {
    // 1. Fetch all portfolios
    const { data: portfolios, error: portError } = await supabase
      .from('paper_portfolios')
      .select('user_id, balance, profiles(email)');

    if (portError) throw portError;

    // 2. Fetch all positions
    const { data: allPositions, error: posError } = await supabase
      .from('paper_positions')
      .select('user_id, symbol, quantity, average_price');

    if (posError) throw posError;

    // 3. Get live prices
    const liveStocks = stockService.getCachedStocks();
    const livePrices = new Map<string, number>();
    liveStocks.forEach(s => livePrices.set(s.symbol, s.price));

    // 4. Calculate total portfolio value for each user
    const userValues = portfolios.map((port: any) => {
      let totalPositionValue = 0;
      
      const userPositions = allPositions.filter(p => p.user_id === port.user_id);
      
      userPositions.forEach(pos => {
        const currentPrice = livePrices.get(pos.symbol) || pos.average_price;
        totalPositionValue += (pos.quantity * currentPrice);
      });

      const totalPortfolioValue = Number(port.balance) + totalPositionValue;
      
      const profile = Array.isArray(port.profiles) ? port.profiles[0] : port.profiles;

      return {
        email: profile?.email || 'Unknown',
        balance: totalPortfolioValue // We send the total portfolio value back as "balance" so frontend renders it
      };
    });

    // 5. Sort by Total Portfolio Value and take top 10
    userValues.sort((a, b) => b.balance - a.balance);
    const top10 = userValues.slice(0, 10);

    res.json({ success: true, leaderboard: top10 });
  } catch (error: any) {
    logger.error(`Leaderboard error: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
};
