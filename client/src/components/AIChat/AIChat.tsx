import React, { useState, useRef, useEffect, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import './AIChat.css';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  error?: boolean;
}

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const QUICK_PROMPTS = [
  '⚡ Volume spikes now',
  '📈 Top gainers today',
  '📉 Top losers today',
  '🌐 Market overview',
  '🔍 Market breadth',
];

function formatMarkdown(text: string): React.ReactNode {
  // Split by newlines, process each line
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];

  lines.forEach((line, lineIdx) => {
    if (!line.trim()) {
      elements.push(<br key={`br-${lineIdx}`} />);
      return;
    }

    // Replace **bold** with <strong>
    const parts = line.split(/(\*\*[^*]+\*\*)/g);
    const formatted = parts.map((part, partIdx) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        const inner = part.slice(2, -2);
        return <strong key={partIdx}>{inner}</strong>;
      }
      // Color Bullish/Bearish/Neutral keywords
      if (part.includes('Bullish') || part.includes('bullish')) {
        return <span key={partIdx} className="aria-bullish">{part}</span>;
      }
      if (part.includes('Bearish') || part.includes('bearish')) {
        return <span key={partIdx} className="aria-bearish">{part}</span>;
      }
      return part;
    });

    // Bullet points
    if (line.startsWith('• ') || line.startsWith('- ')) {
      elements.push(
        <div key={lineIdx} style={{ display: 'flex', gap: 6, marginBottom: 2 }}>
          <span style={{ color: 'var(--cyan)', flexShrink: 0 }}>•</span>
          <span>{formatted.slice(1)}</span>
        </div>
      );
    } else {
      elements.push(<div key={lineIdx}>{formatted}</div>);
    }
  });

  return <>{elements}</>;
}

export function AIChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [liveStocks, setLiveStocks] = useState<number>(0);
  const [hasNewMsg, setHasNewMsg] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Check AI status on mount
  useEffect(() => {
    fetch(`${API_BASE}/api/ai/status`)
      .then(r => r.json())
      .then(d => { if (d.liveStocksInContext) setLiveStocks(d.liveStocksInContext); })
      .catch(() => {});
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoading]);

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight, 80)}px`;
  }, [input]);

  const sendMessage = useCallback(async (msgText?: string) => {
    const text = (msgText || input).trim();
    if (!text || isLoading) return;

    setInput('');
    const userMsg: ChatMessage = { role: 'user', content: text, timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);

    try {
      // Extract potential stock symbols from message (3-15 uppercase chars)
      const symbolMatches = text.match(/\b[A-Z]{3,15}\b/g) || [];

      const response = await fetch(`${API_BASE}/api/ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          history: messages.slice(-6).map(m => ({ role: m.role, content: m.content })),
          symbols: symbolMatches,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Server error');
      }

      const assistantMsg: ChatMessage = {
        role: 'assistant',
        content: data.response,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, assistantMsg]);
      if (!isOpen) setHasNewMsg(true);

    } catch (err: any) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `Error: ${err.message || 'Could not connect to ARIA. Check server connection.'}`,
        timestamp: new Date(),
        error: true,
      }]);
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, messages, isOpen]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleOpen = () => {
    setIsOpen(true);
    setHasNewMsg(false);
  };

  const clearConversation = () => {
    setMessages([]);
  };

  return (
    <>
      {/* ── Floating Trigger ─────────────────────────── */}
      <div
        className={`aria-trigger ${isOpen ? 'open' : ''}`}
        onClick={isOpen ? () => setIsOpen(false) : handleOpen}
        title="ARIA — AI Market Analyst"
      >
        {!isOpen && <div className="aria-trigger-pulse" />}
        {hasNewMsg && !isOpen && <div className="aria-badge" />}
        <div className="aria-trigger-icon">
          {isOpen ? (
            // X icon when open
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(40,207,255,0.9)" strokeWidth="2.5" strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          ) : (
            // Brain/AI icon when closed
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" fill="rgba(40,207,255,0.15)" stroke="rgba(40,207,255,0.8)" strokeWidth="1.5" />
              <path d="M8 10h.01M12 10h.01M16 10h.01M8 14h8" stroke="rgba(40,207,255,0.9)" strokeWidth="1.5" strokeLinecap="round" />
              <circle cx="12" cy="12" r="2.5" fill="rgba(40,207,255,0.25)" />
            </svg>
          )}
        </div>
      </div>

      {/* ── Chat Panel ───────────────────────────────── */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="aria-panel"
            initial={{ opacity: 0, scale: 0.92, y: 16, originX: 1, originY: 1 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 16 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          >
            {/* Header */}
            <div className="aria-header">
              <div className="aria-avatar">🤖</div>
              <div className="aria-header-info">
                <div className="aria-name">ARIA</div>
                <div className="aria-status">
                  <span className="aria-status-dot" />
                  AI MARKET ANALYST · LIVE NSE DATA
                </div>
              </div>
              {liveStocks > 0 && (
                <div className="aria-context-pill">
                  <svg width="8" height="8" viewBox="0 0 8 8"><circle cx="4" cy="4" r="4" fill="currentColor" /></svg>
                  {liveStocks} STOCKS
                </div>
              )}
              {messages.length > 0 && (
                <button className="aria-clear-btn" onClick={clearConversation} title="Clear chat">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6" />
                    <path d="M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                  </svg>
                </button>
              )}
              <button className="aria-close-btn" onClick={() => setIsOpen(false)}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Messages */}
            <div className="aria-messages">
              {messages.length === 0 ? (
                /* Welcome screen */
                <div className="aria-welcome">
                  <div className="aria-welcome-icon">🤖</div>
                  <h3>ARIA — Market Analyst AI</h3>
                  <p>
                    I'm watching <strong style={{ color: 'var(--cyan)' }}>{liveStocks || '500+'} live NSE stocks</strong> in real-time.
                    Ask me anything about the market.
                  </p>
                  <div className="aria-chips">
                    {QUICK_PROMPTS.map((p) => (
                      <button
                        key={p}
                        className="aria-chip"
                        onClick={() => sendMessage(p.replace(/^[^\s]+ /, ''))}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                messages.map((msg, i) => (
                  <div key={i} className={`aria-msg ${msg.role}`}>
                    <div className="aria-msg-avatar">
                      {msg.role === 'assistant' ? '🤖' : '👤'}
                    </div>
                    <div className={`aria-bubble ${msg.error ? 'aria-error-bubble' : ''}`}>
                      {msg.error
                        ? <span>⚠ {msg.content}</span>
                        : msg.role === 'assistant'
                          ? formatMarkdown(msg.content)
                          : msg.content
                      }
                    </div>
                  </div>
                ))
              )}

              {/* Typing indicator */}
              {isLoading && (
                <div className="aria-msg assistant">
                  <div className="aria-msg-avatar">🤖</div>
                  <div className="aria-typing">
                    <span /><span /><span />
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="aria-input-area">
              <div className="aria-input-row">
                <textarea
                  ref={textareaRef}
                  className="aria-input"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask about any stock or market..."
                  rows={1}
                  disabled={isLoading}
                />
                <button
                  className="aria-send-btn"
                  onClick={() => sendMessage()}
                  disabled={!input.trim() || isLoading}
                  title="Send (Enter)"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z" />
                  </svg>
                </button>
              </div>
              <div className="aria-footer-note">⏎ Send · ⇧⏎ New line · Powered by Gemini</div>
            </div>

            <div className="aria-disclaimer">
              Not investment advice. For educational purposes only.
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
