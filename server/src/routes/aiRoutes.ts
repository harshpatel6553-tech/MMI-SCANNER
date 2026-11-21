/**
 * @module aiRoutes
 * @description AI Market Analyst chat endpoint - powered by Google Gemini
 */

import { Router, type Request, type Response } from 'express';
import { stockService } from '../services/stockService.js';
import { configService } from '../services/configService.js';
import logger from '../utils/logger.js';

const router = Router();

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatRequest {
  message: string;
  history?: ChatMessage[];
  symbols?: string[]; // optional: specific stocks user is asking about
}

/**
 * POST /api/ai/chat
 * AI market analyst powered by Gemini.
 * Body: { message: string, history?: ChatMessage[], symbols?: string[] }
 */
router.post('/chat', async (req: Request, res: Response): Promise<void> => {
  try {
    const { message, history = [], symbols = [] }: ChatRequest = req.body;

    if (!message?.trim()) {
      res.status(400).json({ success: false, error: 'Message is required' });
      return;
    }

    const geminiKey = process.env.GEMINI_API_KEY?.trim() || configService.getKey('GEMINI_API_KEY')?.trim();

    // Build live market context from cached stocks
    const allStocks = stockService.getCachedStocks();
    const topVolSpike = allStocks
      .filter(s => (s.relativeVolume ?? 0) >= 2.0 && Math.abs(s.changePercent ?? 0) >= 1.0)
      .sort((a, b) => (b.relativeVolume ?? 0) - (a.relativeVolume ?? 0))
      .slice(0, 8);

    const topGainers = allStocks
      .filter(s => s.indexName !== 'INDEX')
      .sort((a, b) => (b.changePercent ?? 0) - (a.changePercent ?? 0))
      .slice(0, 5);

    const topLosers = allStocks
      .filter(s => s.indexName !== 'INDEX')
      .sort((a, b) => (a.changePercent ?? 0) - (b.changePercent ?? 0))
      .slice(0, 5);

    const indices = allStocks.filter(s => s.indexName === 'INDEX');

    // Specific stocks mentioned by user
    const mentionedStocks = symbols.length > 0
      ? symbols.map(sym => stockService.getCachedStock(sym.toUpperCase())).filter(Boolean)
      : [];

    // Build context string
    const now = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
    let marketContext = `=== LIVE NSE MARKET DATA (as of ${now} IST) ===\n\n`;

    if (indices.length > 0) {
      marketContext += `INDICES:\n`;
      indices.forEach(idx => {
        const sign = (idx.changePercent ?? 0) >= 0 ? '+' : '';
        marketContext += `  ${idx.name || idx.symbol}: ₹${idx.price?.toFixed(2)} (${sign}${(idx.changePercent ?? 0).toFixed(2)}%)\n`;
      });
      marketContext += '\n';
    }

    if (topVolSpike.length > 0) {
      marketContext += `VOLUME SPIKE ALERTS (Relative Volume ≥2x with price move):\n`;
      topVolSpike.forEach(s => {
        const sign = (s.changePercent ?? 0) >= 0 ? '+' : '';
        marketContext += `  ${s.symbol} (${s.name}): ₹${s.price?.toFixed(2)} ${sign}${(s.changePercent ?? 0).toFixed(2)}% | RelVol: ${(s.relativeVolume ?? 0).toFixed(1)}x\n`;
      });
      marketContext += '\n';
    }

    marketContext += `TOP GAINERS:\n`;
    topGainers.forEach(s => {
      marketContext += `  ${s.symbol}: ₹${s.price?.toFixed(2)} (+${(s.changePercent ?? 0).toFixed(2)}%)\n`;
    });

    marketContext += `\nTOP LOSERS:\n`;
    topLosers.forEach(s => {
      marketContext += `  ${s.symbol}: ₹${s.price?.toFixed(2)} (${(s.changePercent ?? 0).toFixed(2)}%)\n`;
    });

    if (mentionedStocks.length > 0) {
      marketContext += `\nSPECIFIC STOCKS REQUESTED:\n`;
      mentionedStocks.forEach(s => {
        if (!s) return;
        const sign = (s.changePercent ?? 0) >= 0 ? '+' : '';
        marketContext += `  ${s.symbol} (${s.name}): ₹${s.price?.toFixed(2)} | Change: ${sign}${(s.changePercent ?? 0).toFixed(2)}% | Day High: ₹${s.dayHigh?.toFixed(2)} | Day Low: ₹${s.dayLow?.toFixed(2)} | Volume: ${s.volume?.toLocaleString('en-IN')} | RelVol: ${(s.relativeVolume ?? 0).toFixed(2)}x\n`;
      });
    }

    const systemPrompt = `You are ARIA (Algorithmic Research & Intelligence Analyst), the AI market analyst for Market Minds India (MMI) Terminal — an elite real-time NSE stock market intelligence platform for Indian traders and investors.

PERSONA:
- Precise, confident, institutional-grade analyst
- Speak in concise, actionable terms like a professional trading desk analyst
- Use Indian market context: NSE, BSE, Nifty 50, Bank Nifty, FII/DII flows, SEBI, RBI
- Always reference live data when available
- Format responses with clear sections using **bold** headers when appropriate
- Keep responses focused and under 300 words unless deep analysis is requested
- Use ₹ for Indian Rupee amounts
- When discussing volume spikes, emphasize the significance for intraday momentum

CAPABILITIES:
- Real-time stock analysis using live NSE data
- Volume spike interpretation (institutional footprint detection)
- Technical level identification (Day High/Low breakouts)
- Sector rotation and market breadth analysis
- Risk/reward trade setup suggestions
- Market regime analysis (bullish/bearish/neutral)

CONSTRAINTS:
- Always add: "This is not investment advice. Trade at your own risk."
- Do not make specific price targets beyond ±5% unless asked
- For tax/regulatory questions, refer to SEBI/CBDT guidelines

${marketContext}`;

    if (!geminiKey) {
      // Fallback: rule-based response
      const lowerMsg = message.toLowerCase();
      let fallbackResponse = '';

      if (lowerMsg.includes('volume') || lowerMsg.includes('spike')) {
        if (topVolSpike.length > 0) {
          fallbackResponse = `**Volume Spike Alert** ⚡\n\nCurrent high-volume movers on NSE:\n\n${topVolSpike.map(s => `• **${s.symbol}** — ₹${s.price?.toFixed(2)} (${(s.changePercent ?? 0) >= 0 ? '+' : ''}${(s.changePercent ?? 0).toFixed(2)}%) | ${(s.relativeVolume ?? 0).toFixed(1)}x relative volume`).join('\n')}\n\n*AI analysis unavailable — GEMINI_API_KEY not configured. This is not investment advice.*`;
        } else {
          fallbackResponse = `No significant volume spikes detected at this time. Market appears to be in a low-activity phase.\n\n*AI analysis unavailable — GEMINI_API_KEY not configured.*`;
        }
      } else if (lowerMsg.includes('gainer') || lowerMsg.includes('top mover')) {
        fallbackResponse = `**Top Gainers Today** 📈\n\n${topGainers.map(s => `• **${s.symbol}** — +${(s.changePercent ?? 0).toFixed(2)}% @ ₹${s.price?.toFixed(2)}`).join('\n')}\n\n*AI analysis unavailable — GEMINI_API_KEY not configured. This is not investment advice.*`;
      } else {
        fallbackResponse = `I'm ARIA, your MMI AI Market Analyst. I need a **GEMINI_API_KEY** configured to provide full AI analysis.\n\nI can see **${allStocks.filter(s => s.indexName !== 'INDEX').length} NSE stocks** in live feed. For now, try asking:\n• "Show volume spikes"\n• "Top gainers today"\n• "Market overview"\n\n*Configure GEMINI_API_KEY in Admin → Settings for full AI capabilities.*`;
      }

      res.json({ success: true, response: fallbackResponse, model: 'local-fallback' });
      return;
    }

    // Build conversation for Gemini
    try {
      const { GoogleGenAI } = await import('@google/genai');
      const ai = new GoogleGenAI({ apiKey: geminiKey });

      // Build the full prompt with history
      let fullPrompt = systemPrompt + '\n\n=== CONVERSATION ===\n';
      
      // Add history (last 6 exchanges max to avoid token bloat)
      const recentHistory = history.slice(-6);
      for (const msg of recentHistory) {
        fullPrompt += `\n${msg.role === 'user' ? 'User' : 'ARIA'}: ${msg.content}`;
      }
      fullPrompt += `\nUser: ${message}\nARIA:`;

      const response = await ai.models.generateContent({
        model: process.env.AI_CHAT_MODEL?.trim() || 'gemini-2.0-flash',
        contents: fullPrompt,
        config: {
          temperature: 0.7,
          maxOutputTokens: 600,
        },
      });

      const aiResponse = response.text?.trim() || 'I could not generate a response. Please try again.';

      res.json({
        success: true,
        response: aiResponse,
        model: process.env.AI_CHAT_MODEL?.trim() || 'gemini-2.0-flash',
        contextStocks: allStocks.filter(s => s.indexName !== 'INDEX').length,
      });

    } catch (aiErr: any) {
      logger.error(`[AI Chat] Gemini error: ${aiErr.message}`);
      res.status(500).json({ success: false, error: `AI service error: ${aiErr.message}` });
    }

  } catch (err: any) {
    logger.error(`[AI Chat] Route error: ${err.message}`);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * GET /api/ai/status
 * Check if AI is configured and ready.
 */
router.get('/status', (req: Request, res: Response): void => {
  const geminiKey = process.env.GEMINI_API_KEY?.trim() || configService.getKey('GEMINI_API_KEY')?.trim();
  const stockCount = stockService.getCachedStocks().filter(s => s.indexName !== 'INDEX').length;
  
  res.json({
    success: true,
    aiEnabled: Boolean(geminiKey),
    model: process.env.AI_CHAT_MODEL?.trim() || 'gemini-2.0-flash',
    liveStocksInContext: stockCount,
  });
});

export default router;
