import { useEffect, useRef, useState } from 'react';
import './TwitterFeed.css';

interface TwitterFeedProps {
  handle: string;
}

export function TwitterFeed({ handle }: TwitterFeedProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const renderWidget = () => {
      if (!isMounted || !containerRef.current) return;
      if ((window as any).twttr && (window as any).twttr.widgets) {
        // Clear previous widget explicitly
        containerRef.current.innerHTML = '';
        
        (window as any).twttr.widgets.createTimeline(
          {
            sourceType: 'profile',
            screenName: handle
          },
          containerRef.current,
          {
            theme: 'dark',
            chrome: 'noheader nofooter noborders transparent'
          }
        ).then(() => {
          if (isMounted) setIsLoaded(true);
        }).catch((err: any) => {
          console.error("Twitter widget failed to load:", err);
        });
      }
    };

    if (!(window as any).twttr) {
      const script = document.createElement('script');
      script.src = 'https://platform.twitter.com/widgets.js';
      script.async = true;
      script.onload = () => {
        // Small delay to ensure twttr object is fully populated
        setTimeout(renderWidget, 100);
      };
      document.body.appendChild(script);
    } else {
      renderWidget();
    }

    return () => {
      isMounted = false;
    };
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
      <div className="twitter-feed-content" ref={containerRef} style={{ minHeight: '400px' }}>
        {!isLoaded && (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'rgba(255,255,255,0.5)' }}>
            Loading live squawk... (If this spins forever, please disable your adblocker)
          </div>
        )}
      </div>
    </div>
  );
}
