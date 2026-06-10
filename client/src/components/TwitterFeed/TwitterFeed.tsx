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
          <svg viewBox="0 0 24 24" aria-hidden="true" width="20" height="20" fill="currentColor">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.008 4.09H5.078z"></path>
          </svg>
          <h3>Live News Feed — @{handle}</h3>
        </div>
      </div>
      <div className="twitter-feed-content">
        <TwitterTimelineEmbed
          sourceType="profile"
          screenName={handle}
          options={{ theme: 'dark', chrome: 'transparent noheader nofooter' }}
          noHeader
          noFooter
          transparent
          theme="dark"
          placeholder={
            <div className="twitter-loading" style={{ flexDirection: 'column', gap: '1rem' }}>
              <div>Connecting to X live feed...</div>
              <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>
                (If this takes too long, your AdBlocker or Browser Shields might be blocking Twitter. Try disabling them for this site.)
              </div>
            </div>
          }
        />
      </div>
    </div>
  );
}
