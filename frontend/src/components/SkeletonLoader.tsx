import React from 'react';

interface SkeletonLoaderProps {
  type?: 'card' | 'table' | 'list' | 'dashboard';
  count?: number;
  className?: string;
}

/**
 * Skeleton loader component for showing loading states
 */
export const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({
  type = 'card',
  count = 1,
  className = ''
}) => {
  const renderSkeleton = () => {
    switch (type) {
      case 'dashboard':
        return (
          <div className={`space-y-4 ${className}`}>
            {/* Metrics cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 animate-pulse">
                  <div className="h-4 bg-gray-200 rounded w-1/3 mb-2"></div>
                  <div className="h-8 bg-gray-200 rounded w-1/2"></div>
                </div>
              ))}
            </div>
            
            {/* Charts and tables */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
                <div className="h-64 bg-gray-100 rounded"></div>
              </div>
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
                <div className="space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="h-4 bg-gray-200 rounded"></div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );

      case 'table':
        return (
          <div className={`space-y-4 ${className}`}>
            {/* Table header */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-1/4"></div>
              </div>
              
              {/* Table rows */}
              <div className="divide-y divide-gray-200">
                {[...Array(count)].map((_, i) => (
                  <div key={i} className="px-6 py-4 animate-pulse">
                    <div className="grid grid-cols-6 gap-4">
                      <div className="h-4 bg-gray-200 rounded col-span-2"></div>
                      <div className="h-4 bg-gray-200 rounded col-span-1"></div>
                      <div className="h-4 bg-gray-200 rounded col-span-1"></div>
                      <div className="h-4 bg-gray-200 rounded col-span-1"></div>
                      <div className="h-4 bg-gray-200 rounded col-span-1"></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );

      case 'list':
        return (
          <div className={`space-y-4 ${className}`}>
            {[...Array(count)].map((_, i) => (
              <div key={i} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 animate-pulse">
                <div className="flex items-center space-x-4">
                  <div className="h-12 w-12 bg-gray-200 rounded-full"></div>
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                    <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                  </div>
                  <div className="h-8 w-24 bg-gray-200 rounded"></div>
                </div>
              </div>
            ))}
          </div>
        );

      case 'card':
      default:
        return (
          <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 ${className}`}>
            {[...Array(count)].map((_, i) => (
              <div key={i} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
                <div className="space-y-3">
                  <div className="h-3 bg-gray-200 rounded"></div>
                  <div className="h-3 bg-gray-200 rounded w-5/6"></div>
                  <div className="h-3 bg-gray-200 rounded w-2/3"></div>
                </div>
                <div className="mt-4 h-8 w-24 bg-gray-200 rounded"></div>
              </div>
            ))}
          </div>
        );
    }
  };

  return <>{renderSkeleton()}</>;
};

/**
 * Simple loading spinner component
 */
export const LoadingSpinner: React.FC<{ className?: string; size?: 'sm' | 'md' | 'lg' }> = ({
  className = '',
  size = 'md'
}) => {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-6 w-6',
    lg: 'h-8 w-8'
  };

  return (
    <div className={`flex items-center justify-center ${className}`}>
      <div className={`animate-spin rounded-full border-2 border-gray-300 border-t-blue-600 ${sizeClasses[size]}`}></div>
    </div>
  );
};

/**
 * Inline loading indicator
 */
export const InlineLoader: React.FC<{ text?: string }> = ({ text = 'Loading...' }) => {
  return (
    <div className="flex items-center space-x-2 text-gray-600">
      <div className="animate-spin rounded-full h-4 w-4 border-2 border-gray-300 border-t-blue-600"></div>
      <span>{text}</span>
    </div>
  );
};