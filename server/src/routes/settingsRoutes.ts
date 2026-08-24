import { Router, Request, Response } from 'express';
import { configService } from '../services/configService.js';

const router = Router();

router.get('/keys', (req: Request, res: Response) => {
  try {
    const config = configService.getConfig();
    // Only return whether keys exist, do not return actual keys for security
    res.json({
      success: true,
      data: {
        hasRapidApi: !!config.RAPIDAPI_KEY,
        hasGeminiApi: !!config.GEMINI_API_KEY
      }
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

export const settingsRoutes = router;
