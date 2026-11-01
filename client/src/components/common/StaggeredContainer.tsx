import React from 'react';
import { motion, Variants } from 'framer-motion';

export interface StaggeredContainerProps {
  children: React.ReactNode;
  staggerDelay?: number;
  className?: string;
}

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: (staggerDelay: number = 0.04) => ({
    opacity: 1,
    transition: {
      staggerChildren: staggerDelay,
      delayChildren: 0.02
    }
  })
};

export const itemVariants: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.35,
      ease: [0.32, 0.72, 0, 1] as [number, number, number, number]
    }
  }
};

export function StaggeredContainer({
  children,
  staggerDelay = 0.04,
  className = ''
}: StaggeredContainerProps) {
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      custom={staggerDelay}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function StaggeredItem({
  children,
  className = '',
  onClick
}: {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  return (
    <motion.div variants={itemVariants} className={className} onClick={onClick}>
      {children}
    </motion.div>
  );
}

export default React.memo(StaggeredContainer);
