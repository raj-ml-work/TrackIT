import { useState, useEffect, useCallback } from 'react';
import { GeminiInsight, GeminiInsightType } from '../types';
import * as geminiService from '../services/geminiService';

interface UseAsyncInsightsOptions {
  autoGenerate?: boolean;
  cacheDuration?: number; // milliseconds
  maxInsights?: number;
}

interface UseAsyncInsightsReturn {
  insights: GeminiInsight[];
  loading: boolean;
  error: string | null;
  generateInsight: (prompt: string, type?: GeminiInsightType) => Promise<void>;
  clearInsights: () => void;
  refreshInsights: () => Promise<void>;
}

/**
 * Hook for managing async AI insights generation
 */
export const useAsyncInsights = (
  options: UseAsyncInsightsOptions = {}
): UseAsyncInsightsReturn => {
  const {
    autoGenerate = true,
    cacheDuration = 10 * 60 * 1000, // 10 minutes
    maxInsights = 10
  } = options;

  const [insights, setInsights] = useState<GeminiInsight[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFetchTime, setLastFetchTime] = useState<number>(0);

  /**
   * Check if insights are cached and valid
   */
  const isCacheValid = useCallback(() => {
    if (insights.length === 0) return false;
    return Date.now() - lastFetchTime < cacheDuration;
  }, [insights.length, lastFetchTime, cacheDuration]);

  /**
   * Load cached insights
   */
  const loadCachedInsights = useCallback(() => {
    const cachedInsights = geminiService.getCachedInsights();
    if (cachedInsights.length > 0) {
      setInsights(cachedInsights);
      setLastFetchTime(Date.now());
    }
  }, []);

  /**
   * Generate new insights
   */
  const generateInsight = useCallback(async (
    prompt: string,
    type: GeminiInsightType = 'general'
  ): Promise<void> => {
    if (!prompt.trim()) {
      setError('Prompt cannot be empty');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const insight = await geminiService.generateInsights(prompt, type);
      
      setInsights(prev => {
        const newInsights = [insight, ...prev];
        // Limit the number of insights
        return newInsights.slice(0, maxInsights);
      });
      
      setLastFetchTime(Date.now());
    } catch (err) {
      console.error('Failed to generate insight:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate insight');
    } finally {
      setLoading(false);
    }
  }, [maxInsights]);

  /**
   * Generate dashboard insights
   */
  const generateDashboardInsights = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      const newInsights = await geminiService.generateDashboardInsights();
      
      setInsights(prev => {
        const existingIds = new Set(prev.map(i => i.id));
        const uniqueInsights = newInsights.filter(i => !existingIds.has(i.id));
        return [...uniqueInsights, ...prev].slice(0, maxInsights);
      });
      
      setLastFetchTime(Date.now());
    } catch (err) {
      console.error('Failed to generate dashboard insights:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate insights');
    } finally {
      setLoading(false);
    }
  }, [maxInsights]);

  /**
   * Clear all insights
   */
  const clearInsights = useCallback(() => {
    setInsights([]);
    setLastFetchTime(0);
    setError(null);
  }, []);

  /**
   * Refresh insights
   */
  const refreshInsights = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      await generateDashboardInsights();
    } catch (err) {
      console.error('Failed to refresh insights:', err);
      setError(err instanceof Error ? err.message : 'Failed to refresh insights');
    } finally {
      setLoading(false);
    }
  }, [generateDashboardInsights]);

  /**
   * Initialize insights on mount
   */
  useEffect(() => {
    if (autoGenerate) {
      if (isCacheValid()) {
        // Use cached insights
        loadCachedInsights();
      } else {
        // Generate new insights
        generateDashboardInsights();
      }
    }
  }, [autoGenerate, isCacheValid, loadCachedInsights, generateDashboardInsights]);

  return {
    insights,
    loading,
    error,
    generateInsight,
    clearInsights,
    refreshInsights
  };
};

/**
 * Hook for managing insights with priority-based loading
 */
export const usePriorityInsights = (): UseAsyncInsightsReturn => {
  const {
    insights,
    loading,
    error,
    generateInsight,
    clearInsights,
    refreshInsights
  } = useAsyncInsights({
    autoGenerate: false, // Manual control for priority loading
    cacheDuration: 15 * 60 * 1000, // 15 minutes
    maxInsights: 20
  });

  /**
   * Load critical insights (dashboard metrics)
   */
  const loadCriticalInsights = useCallback(async () => {
    if (insights.length > 0 && insights.some(i => i.type === 'utilization')) {
      return; // Already loaded
    }

    await generateInsight(
      "Analyze current asset utilization patterns and suggest immediate optimization opportunities.",
      'utilization'
    );
  }, [insights, generateInsight]);

  /**
   * Load high priority insights (warranty and maintenance)
   */
  const loadHighPriorityInsights = useCallback(async () => {
    if (insights.length > 0 && insights.some(i => i.type === 'warranty')) {
      return; // Already loaded
    }

    await generateInsight(
      "Analyze warranty expirations and maintenance schedules to optimize costs.",
      'warranty'
    );
  }, [insights, generateInsight]);

  /**
   * Load medium priority insights (inventory optimization)
   */
  const loadMediumPriorityInsights = useCallback(async () => {
    if (insights.length > 0 && insights.some(i => i.type === 'inventory')) {
      return; // Already loaded
    }

    await generateInsight(
      "Suggest inventory management improvements based on current tracking data.",
      'inventory'
    );
  }, [insights, generateInsight]);

  /**
   * Load all priority insights in sequence
   */
  const loadAllPriorityInsights = useCallback(async () => {
    try {
      await loadCriticalInsights();
      await loadHighPriorityInsights();
      await loadMediumPriorityInsights();
    } catch (error) {
      console.error('Failed to load priority insights:', error);
    }
  }, [loadCriticalInsights, loadHighPriorityInsights, loadMediumPriorityInsights]);

  return {
    insights,
    loading,
    error,
    generateInsight,
    clearInsights,
    refreshInsights: loadAllPriorityInsights
  };
};