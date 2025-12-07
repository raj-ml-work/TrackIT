import React from 'react';
import { motion } from 'framer-motion';

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  hoverEffect?: boolean;
}

const GlassCard: React.FC<GlassCardProps> = ({ children, className = '', onClick, hoverEffect = false }) => {
  return (
    <motion.div
      whileHover={hoverEffect ? { y: -4, boxShadow: "0 20px 40px -10px rgba(0,0,0,0.1)" } : {}}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      onClick={onClick}
      className={`glass-panel rounded-3xl p-6 shadow-sm transition-all duration-300 ${className}`}
    >
      {children}
    </motion.div>
  );
};

export default GlassCard;
