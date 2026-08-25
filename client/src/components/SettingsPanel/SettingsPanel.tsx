import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';

export function SettingsPanel() {
  const { user } = useAuth();
  const [rapidApiKey, setRapidApiKey] = useState('');
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [status, setStatus] = useState<{ type: 'idle' | 'success' | 'error', message: string }>({ type: 'idle', message: '' });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Fetch initial status to show placeholders if keys exist
    fetch('/api/settings/keys')
      .then(res => res.json())
      .then(data => {
        if (data.success && data.data) {
          if (data.data.hasRapidApi) setRapidApiKey('••••••••••••••••••••••••••••••');
          if (data.data.hasGeminiApi) setGeminiApiKey('••••••••••••••••••••••••••••••');
        }
      })
      .catch(err => console.error('Failed to load key status', err));
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setStatus({ type: 'idle', message: '' });

    try {
      const payload: any = {};
      // Only send keys if they were actually changed (ignore bullets)
      if (rapidApiKey && !rapidApiKey.includes('•••••')) payload.RAPIDAPI_KEY = rapidApiKey;
      if (geminiApiKey && !geminiApiKey.includes('•••••')) payload.GEMINI_API_KEY = geminiApiKey;

      const res = await fetch('/api/settings/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      const data = await res.json();
      if (data.success) {
        setStatus({ type: 'success', message: 'API Keys updated successfully. They are now securely stored on your local machine.' });
        if (payload.RAPIDAPI_KEY) setRapidApiKey('••••••••••••••••••••••••••••••');
        if (payload.GEMINI_API_KEY) setGeminiApiKey('••••••••••••••••••••••••••••••');
      } else {
        setStatus({ type: 'error', message: data.error || 'Failed to update keys' });
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setStatus({ type: 'error', message: `Network error while saving keys: ${errorMessage}` });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="card" style={{ padding: '32px', maxWidth: '800px', margin: '20px auto', borderRadius: '16px' }}>
      <div style={{ marginBottom: '32px', paddingBottom: '24px', borderBottom: '1px solid var(--border)' }}>
        <h2 style={{ fontSize: '24px', marginBottom: '8px', color: 'var(--text-1)' }}>Platform Settings</h2>
        <p style={{ color: 'var(--text-2)', fontSize: '15px' }}>
          Configure your external API connections. Keys are saved securely on your local hard drive and are never sent to our servers.
        </p>
      </div>

      <form onSubmit={handleSave}>
        {/* RapidAPI Key */}
        <div style={{ marginBottom: '32px' }}>
          <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, color: 'var(--text-1)', marginBottom: '12px' }}>
            RapidAPI Key (Twitter Live News)
          </label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <input 
              type="password"
              value={rapidApiKey}
              onChange={(e) => setRapidApiKey(e.target.value)}
              placeholder="Enter your RapidAPI Key for twitter154..."
              style={{
                width: '100%',
                padding: '16px',
                background: 'var(--bg-app)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                color: 'var(--text-1)',
                fontSize: '15px',
                fontFamily: 'monospace'
              }}
            />
            <span style={{ fontSize: '13px', color: 'var(--text-3)' }}>
              Required to fetch real-time tweets for the Live News feed. Get this from RapidAPI (twitter154).
            </span>
          </div>
        </div>

        {/* Gemini API Key */}
        <div style={{ marginBottom: '40px' }}>
          <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, color: 'var(--text-1)', marginBottom: '12px' }}>
            Google Gemini API Key (AI Sentiment)
          </label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <input 
              type="password"
              value={geminiApiKey}
              onChange={(e) => setGeminiApiKey(e.target.value)}
              placeholder="Enter your Gemini API Key..."
              style={{
                width: '100%',
                padding: '16px',
                background: 'var(--bg-app)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                color: 'var(--text-1)',
                fontSize: '15px',
                fontFamily: 'monospace'
              }}
            />
            <span style={{ fontSize: '13px', color: 'var(--text-3)' }}>
              Required to automatically classify news as Bullish/Bearish and detect affected stock tickers.
            </span>
          </div>
        </div>

        {status.message && (
          <div style={{
            padding: '16px',
            marginBottom: '24px',
            borderRadius: '8px',
            background: status.type === 'success' ? 'rgba(6, 214, 160, 0.1)' : 'rgba(255, 71, 126, 0.1)',
            border: `1px solid ${status.type === 'success' ? 'rgba(6, 214, 160, 0.3)' : 'rgba(255, 71, 126, 0.3)'}`,
            color: status.type === 'success' ? 'var(--up)' : 'var(--down)',
            fontSize: '14px'
          }}>
            {status.message}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '24px', borderTop: '1px solid var(--border)' }}>
          <button 
            type="submit" 
            disabled={isLoading}
            style={{
              padding: '14px 32px',
              background: 'var(--accent)',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              fontSize: '15px',
              fontWeight: 600,
              cursor: isLoading ? 'not-allowed' : 'pointer',
              opacity: isLoading ? 0.7 : 1,
              transition: 'all 0.2s'
            }}
          >
            {isLoading ? 'Saving...' : 'Save Configuration'}
          </button>
        </div>
      </form>
    </div>
  );
}
