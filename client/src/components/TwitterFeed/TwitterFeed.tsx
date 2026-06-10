import { useEffect, useRef } from 'react';
import './TwitterFeed.css';

interface TwitterFeedProps {
  handle: string;
}

export function TwitterFeed({ handle }: TwitterFeedProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Clear existing content to prevent duplicates in strict mode
    if (containerRef.current) {
      containerRef.current.innerHTML = '';
      
      const anchor = document.createElement('a');
      anchor.setAttribute('class', 'twitter-timeline');
      anchor.setAttribute('data-theme', 'dark');
      anchor.setAttribute('data-chrome', 'noheader nofooter noborders transparent');
      anchor.setAttribute('href', `https://twitter.com/${handle}?ref_src=twsrc%5Etfw`);
      anchor.innerText = `Tweets by ${handle}`;
      containerRef.current.appendChild(anchor);

      const loadTwitterWidget = () => {
        if ((window as any).twttr && (window as any).twttr.widgets) {
          (window as any).twttr.widgets.load(containerRef.current);
        }
      };

      // Load Twitter script
      if (!(window as any).twttr) {
        const script = document.createElement('script');
        script.setAttribute('src', 'https://platform.twitter.com/widgets.js');
        script.setAttribute('charset', 'utf-8');
        script.setAttribute('async', 'true');
        script.onload = loadTwitterWidget;
        document.body.appendChild(script);
      } else {
        loadTwitterWidget();
      }
    }
  }, [handle]);

  return (
    <div className="twitter-feed-container glass-card">
      <div className="twitter-feed-header">
        <div className="twitter-feed-title">
          <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.005 4.053H5.059z"/>
          </svg>
          <h3>@{handle} Live Squawk</h3>
        </div>
        <div className="twitter-feed-source">REAL-TIME</div>
      </div>
      <div className="twitter-feed-content" ref={containerRef}>
        {/* Twitter widget injects here */}
      </div>
    </div>
  );
}
