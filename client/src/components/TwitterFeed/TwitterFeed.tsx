import { TwitterTimelineEmbed } from 'react-twitter-embed';
import './TwitterFeed.css';

interface TwitterFeedProps {
  handle: string;
}

export function TwitterFeed({ handle }: TwitterFeedProps) {
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
      <div className="twitter-feed-content">
        <TwitterTimelineEmbed
          sourceType="profile"
          screenName={handle}
          options={{ theme: 'dark', transparent: true, height: 600 }}
          noHeader
          noFooter
          noBorders
        />
      </div>
    </div>
  );
}
