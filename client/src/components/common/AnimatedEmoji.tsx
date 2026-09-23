import React from 'react';

export type EmojiName =
  | 'overview'
  | 'table'
  | 'heatmap'
  | 'sectors'
  | 'charts'
  | 'technical'
  | 'watchlist'
  | 'livenews'
  | 'results'
  | 'promoter'
  | 'papertrading'
  | 'admin'
  | 'rocket'
  | 'blood'
  | 'bull'
  | 'bear'
  | 'swords'
  | 'crown'
  | 'scale'
  | 'trophy'
  | 'bullseye'
  | 'gem'
  | 'money'
  | 'search'
  | 'newspaper'
  | 'scroll'
  | 'laptop'
  | 'pencil'
  | 'warning'
  | 'chart_down'
  | 'floppy'
  | 'pine'
  | 'cross'
  | 'star';

interface AnimatedEmojiProps {
  name: EmojiName;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
  glow?: boolean;
}

export const AnimatedEmoji: React.FC<AnimatedEmojiProps> = ({
  name,
  size = 20,
  className = '',
  style = {},
  glow = false,
}) => {
  const src = `/emojis/${name}.png`;

  return (
    <img
      src={src}
      alt={name}
      width={size}
      height={size}
      loading="lazy"
      className={`animated-3d-emoji ${glow ? 'has-glow' : ''} ${className}`}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        objectFit: 'contain',
        display: 'inline-block',
        verticalAlign: 'middle',
        flexShrink: 0,
        ...style,
      }}
    />
  );
};
