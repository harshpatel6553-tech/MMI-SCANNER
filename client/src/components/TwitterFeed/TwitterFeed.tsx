import { useEffect, useRef } from 'react';
import './TwitterFeed.css';

interface TwitterFeedProps {
  handle: string;
}

export function TwitterFeed({ handle }: TwitterFeedProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Clear any existing widget to prevent duplicates when component re-renders
    containerRef.current.innerHTML = '';

    // Create the anchor element required by Twitter's widget.js
    const anchor = document.createElement('a');
    anchor.className = 'twitter-timeline';
    anchor.setAttribute('data-theme', 'dark');
    anchor.setAttribute('data-chrome', 'transparent noheader nofooter');
    anchor.href = `https://twitter.com/${handle}?ref_src=twsrc%5Etfw`;
    anchor.innerText = `Tweets by ${handle}`;

    containerRef.current.appendChild(anchor);

    // Load the Twitter Widget script
    const existingScript = document.getElementById('twitter-wjs');
    if (!existingScript) {
      const script = document.createElement('script');
      script.id = 'twitter-wjs';
      script.src = 'https://platform.twitter.com/widgets.js';
      script.async = true;
      script.charset = 'utf-8';
      document.body.appendChild(script);
    } else {
      // If script is already loaded, tell it to parse the new anchor tag
      if ((window as any).twttr && (window as any).twttr.widgets) {
        (window as any).twttr.widgets.load(containerRef.current);
      }
    }
  }, [handle]);

  return (
    <div className="twitter-feed-container glass-card">
      <div className="twitter-feed-header">
        <div className="twitter-feed-title">
          <svg viewBox="0 0 24 24" aria-hidden="true" width="20" height="20" fill="currentColor">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.008 4.09H5.078z"></path>
          </svg>
          <h3>Live News Feed — @{handle}</h3>
        </div>
      </div>
      <div className="twitter-feed-content" ref={containerRef}>
        <div className="twitter-loading">Connecting to X live feed...</div>
      </div>
    </div>
  );
}
