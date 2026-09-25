import { Router, Request, Response } from 'express';
import { configService } from '../services/configService.js';
import { aiService } from '../services/aiService.js';

const router = Router();

// ── Legacy Key Status ──────────────────────────────────────────
router.get('/keys', (req: Request, res: Response) => {
  try {
    const config = configService.getConfig();
    res.json({
      success: true,
      data: {
        hasRapidApi: !!config.RAPIDAPI_KEY,
        hasGeminiApi: !!config.GEMINI_API_KEY,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to retrieve keys status' });
  }
});

router.post('/keys', (req: Request, res: Response) => {
  try {
    const { RAPIDAPI_KEY, GEMINI_API_KEY } = req.body;

    const updates: any = {};
    if (RAPIDAPI_KEY !== undefined && RAPIDAPI_KEY !== '') updates.RAPIDAPI_KEY = RAPIDAPI_KEY;
    if (GEMINI_API_KEY !== undefined && GEMINI_API_KEY !== '') updates.GEMINI_API_KEY = GEMINI_API_KEY;

    configService.updateConfig(updates);
    res.json({ success: true, message: 'Keys updated successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update keys' });
  }
});

// ── AI Sentiment Configuration ────────────────────────────────
router.get('/ai-sentiment', (req: Request, res: Response) => {
  try {
    const sentimentConfig = configService.getSentimentConfig();
    const rawKey = configService.getKey('GEMINI_API_KEY') || '';
    const maskedKey = rawKey.length > 8
      ? `${rawKey.substring(0, 6)}...${rawKey.substring(rawKey.length - 4)}`
      : rawKey ? '••••••••' : '';

    res.json({
      success: true,
      config: {
        ...sentimentConfig,
        hasKey: Boolean(rawKey),
        maskedKey,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/ai-sentiment', (req: Request, res: Response) => {
  try {
    const {
      model,
      temperature,
      sensitivity,
      companyPerspectivePrompt,
      indiaMacroLensPrompt,
      fallbackHeuristic,
      GEMINI_API_KEY,
    } = req.body;

    const sentimentUpdates: any = {};
    if (typeof model === 'string' && model.trim()) sentimentUpdates.model = model.trim();
    if (typeof temperature === 'number') sentimentUpdates.temperature = Math.max(0, Math.min(1, temperature));
    if (['Aggressive', 'Balanced', 'Conservative'].includes(sensitivity)) sentimentUpdates.sensitivity = sensitivity;
    if (typeof companyPerspectivePrompt === 'string') sentimentUpdates.companyPerspectivePrompt = companyPerspectivePrompt;
    if (typeof indiaMacroLensPrompt === 'string') sentimentUpdates.indiaMacroLensPrompt = indiaMacroLensPrompt;
    if (typeof fallbackHeuristic === 'boolean') sentimentUpdates.fallbackHeuristic = fallbackHeuristic;

    const updated = configService.updateSentimentConfig(sentimentUpdates);

    // If new Gemini API key provided, update root config as well
    if (typeof GEMINI_API_KEY === 'string' && GEMINI_API_KEY.trim()) {
      configService.updateConfig({ GEMINI_API_KEY: GEMINI_API_KEY.trim() });
    }

    res.json({
      success: true,
      message: 'AI sentiment parameters updated successfully.',
      config: updated,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ── Live AI Sentiment Sandbox Test ─────────────────────────────
router.post('/ai-sentiment/test', async (req: Request, res: Response) => {
  try {
    const { headline, config } = req.body;
    if (!headline || typeof headline !== 'string') {
      return res.status(400).json({ success: false, error: 'Headline is required' });
    }

    const testResponse = await aiService.testHeadline(headline.trim(), config);
    res.json(testResponse);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export const settingsRoutes = router;
