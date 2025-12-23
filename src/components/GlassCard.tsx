import React from 'react';

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

/**
 * Glass Card component with frosted glass effect
 */
export const GlassCard: React.FC<GlassCardProps> = ({ 
  children, 
  className = '', 
  onClick 
}) => {
  const baseClasses = `
    bg-white/80 backdrop-blur-lg 
    border border-white/20 
    shadow-lg shadow-black/5
    rounded-xl
    transition-all duration-300
    hover:shadow-xl hover:shadow-black/10
    hover:scale-105
    hover:border-white/40
  `;

  const interactiveClasses = onClick 
    ? 'cursor-pointer hover:bg-white/90' 
    : '';

  return (
    <div 
      className={`${baseClasses} ${interactiveClasses} ${className}`}
      onClick={onClick}
    >
      {children}
    </div>
  );
};