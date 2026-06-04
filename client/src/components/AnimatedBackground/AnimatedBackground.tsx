import './AnimatedBackground.css';

export function AnimatedBackground() {
  return (
    <div className="animated-bg">
      <div className="gradient-mesh" />
      <div className="grid-overlay" />
      <div className="particles">
        {Array.from({ length: 30 }).map((_, i) => (
          <div
            key={i}
            className="particle"
            style={{
              '--delay': `${Math.random() * 20}s`,
              '--duration': `${15 + Math.random() * 25}s`,
              '--x': `${Math.random() * 100}%`,
              '--y': `${Math.random() * 100}%`,
              '--float-x': `${(Math.random() - 0.5) * 300}px`,
              '--float-y': `${(Math.random() - 0.5) * 300}px`,
              '--size': `${1 + Math.random() * 3}px`,
            } as React.CSSProperties}
          />
        ))}
      </div>
    </div>
  );
}
