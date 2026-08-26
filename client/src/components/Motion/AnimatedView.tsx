import { motion } from 'framer-motion';
import { ReactNode } from 'react';

interface AnimatedViewProps {
  children: ReactNode;
  className?: string;
}

export function AnimatedView({ children, className = '' }: AnimatedViewProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className={`h-full flex flex-col ${className}`}
    >
      {children}
    </motion.div>
  );
}
