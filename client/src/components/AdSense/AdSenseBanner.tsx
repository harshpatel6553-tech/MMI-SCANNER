import React, { useEffect, useRef } from 'react';

// Extend the Window interface to include adsbygoogle
declare global {
  interface Window {
    adsbygoogle: any[];
  }
}

interface AdSenseBannerProps {
  dataAdSlot: string;
  dataAdFormat?: string;
  dataFullWidthResponsive?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export const AdSenseBanner: React.FC<AdSenseBannerProps> = ({
  dataAdSlot,
  dataAdFormat = 'auto',
  dataFullWidthResponsive = true,
  className = '',
  style = { display: 'block' }
}) => {
  const adClientId = import.meta.env.VITE_ADSENSE_CLIENT_ID;
  const isDevelopment = import.meta.env.DEV;
  const adRef = useRef<HTMLModElement>(null);

  useEffect(() => {
    // Only push the ad if we have a client ID and it hasn't been initialized
    if (adClientId && !isDevelopment && adRef.current && !adRef.current.getAttribute('data-adsbygoogle-status')) {
      try {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
      } catch (err) {
        console.error('AdSense initialization error:', err);
      }
    }
  }, [adClientId, isDevelopment]);

  // If no AdSense ID is provided or we are in development, show a Brutalist placeholder
  if (!adClientId || isDevelopment) {
    return (
      <div 
        className={`bg-[#0a0a0a] border border-gray-800 flex flex-col items-center justify-center p-6 my-4 w-full text-center ${className}`}
        style={{ minHeight: '120px', ...style }}
      >
        <span className="text-[10px] text-gray-600 font-mono uppercase tracking-widest font-bold">
          Advertisement Placeholder
        </span>
        <span className="text-[9px] text-gray-700 font-mono mt-1 uppercase">
          (AdSense will appear here in production once VITE_ADSENSE_CLIENT_ID is set)
        </span>
      </div>
    );
  }

  return (
    <div className={`my-4 ${className}`} style={{ minHeight: '100px', overflow: 'hidden' }}>
      <ins
        ref={adRef}
        className="adsbygoogle"
        style={style}
        data-ad-client={adClientId}
        data-ad-slot={dataAdSlot}
        data-ad-format={dataAdFormat}
        data-full-width-responsive={dataFullWidthResponsive.toString()}
      />
    </div>
  );
};
