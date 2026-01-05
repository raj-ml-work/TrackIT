import { useCallback, useRef } from 'react';

interface PerformanceMetrics {
  pageLoadTime: number;
  apiResponseTime: number;
  renderTime: number;
  memoryUsage: number;
  userInteractions: string[];
}

interface PerformanceContext {
  page: string;
  component?: string;
  action?: string;
}

/**
 * Hook for performance monitoring and tracking
 */
export const usePerformanceMonitoring = () => {
  const metricsRef = useRef<PerformanceMetrics>({
    pageLoadTime: 0,
    apiResponseTime: 0,
    renderTime: 0,
    memoryUsage: 0,
    userInteractions: []
  });

  /**
   * Track page view with performance metrics
   */
  const trackPageView = useCallback((page: string) => {
    const startTime = performance.now();
    
    // Track page load time
    window.addEventListener('load', () => {
      const loadTime = performance.now() - startTime;
      metricsRef.current.pageLoadTime = loadTime;
      
      // Log performance metrics
      console.log(`Page ${page} loaded in ${loadTime.toFixed(2)}ms`);
      
      // Send to analytics service (in production)
      // analytics.track('page_view', { page, loadTime });
    });

    // Track memory usage
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      metricsRef.current.memoryUsage = memory.usedJSHeapSize;
    }
  }, []);

  /**
   * Track user actions with timing
   */
  const trackUserAction = useCallback((action: string, context?: PerformanceContext) => {
    const startTime = performance.now();
    
    // Add to interaction history
    metricsRef.current.userInteractions.push(`${action} at ${new Date().toISOString()}`);
    
    // Log action
    console.log(`User action: ${action}`, context);
    
    // Send to analytics service (in production)
    // analytics.track('user_action', { action, context, timestamp: Date.now() });
    
    return {
      end: () => {
        const duration = performance.now() - startTime;
        console.log(`Action ${action} completed in ${duration.toFixed(2)}ms`);
        return duration;
      }
    };
  }, []);

  /**
   * Track API response time
   */
  const trackApiCall = useCallback(async <T>(
    apiCall: () => Promise<T>,
    endpoint: string
  ): Promise<T> => {
    const startTime = performance.now();
    
    try {
      const result = await apiCall();
      const duration = performance.now() - startTime;
      
      metricsRef.current.apiResponseTime = duration;
      console.log(`API call to ${endpoint} completed in ${duration.toFixed(2)}ms`);
      
      return result;
    } catch (error) {
      const duration = performance.now() - startTime;
      console.error(`API call to ${endpoint} failed after ${duration.toFixed(2)}ms`, error);
      throw error;
    }
  }, []);

  /**
   * Track component render time
   */
  const trackRender = useCallback((componentName: string, renderFn: () => void) => {
    const startTime = performance.now();
    
    renderFn();
    
    const duration = performance.now() - startTime;
    metricsRef.current.renderTime = duration;
    
    console.log(`Component ${componentName} rendered in ${duration.toFixed(2)}ms`);
  }, []);

  /**
   * Get current performance metrics
   */
  const getMetrics = useCallback(() => {
    return { ...metricsRef.current };
  }, []);

  /**
   * Clear performance metrics
   */
  const clearMetrics = useCallback(() => {
    metricsRef.current = {
      pageLoadTime: 0,
      apiResponseTime: 0,
      renderTime: 0,
      memoryUsage: 0,
      userInteractions: []
    };
  }, []);

  return {
    trackPageView,
    trackUserAction,
    trackApiCall,
    trackRender,
    getMetrics,
    clearMetrics
  };
};