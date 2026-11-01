import React from 'react';
import { motion } from 'framer-motion';

export interface AnimatedTextProps {
  children: React.ReactNode;
  delay?: number;
  duration?: number;
  className?: string;
  as?: 'div' | 'span' | 'h1' | 'h2' | 'h3' | 'p';
}

export function AnimatedText({
  children,
  delay = 0,
  duration = 0.35,
  className = '',
  as = 'div'
}: AnimatedTextProps) {
  const MotionTag = motion[as] as typeof motion.div;

  return (
    <MotionTag
      initial={{ opacity: 0, y: 8, filter: 'blur(3px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      transition={{
        duration,
        delay,
        ease: [0.32, 0.72, 0, 1]
      }}
      className={className}
    >
      {children}
    </MotionTag>
  );
}

export default React.memo(AnimatedText);
