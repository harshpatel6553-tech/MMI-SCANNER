import { motion, useReducedMotion } from 'framer-motion';
import { ReactNode } from 'react';

interface StaggerListProps {
  children: ReactNode;
  className?: string;
  staggerDelay?: number;
}

export function StaggerList({ children, className = '', staggerDelay = 0.05 }: StaggerListProps) {
  const prefersReducedMotion = useReducedMotion();

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: staggerDelay,
        delayChildren: 0.1
      }
    }
  };

  const item = {
    hidden: { opacity: 0, y: 10, filter: 'blur(2px)' },
    show: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { ease: [0.16, 1, 0.3, 1] as const } }
  };

  if (prefersReducedMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className={className}
    >
      {/* We assume children will be mapped inside and wrapped in motion.div variants={item} 
          Actually, a better pattern is to just let this wrapper apply staggering, but 
          children must be motion components. For simplicity, we just provide the variants.
          Wait, if we map over children, we can wrap them in motion.div here. */}
      {Array.isArray(children) ? children.map((child, i) => (
        <motion.div key={i} variants={item}>
          {child}
        </motion.div>
      )) : (
        <motion.div variants={item}>{children}</motion.div>
      )}
    </motion.div>
  );
}
