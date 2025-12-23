import { GeminiInsight, GeminiInsightType } from '../types';
import { dbConfig } from './database';

/**
 * Check if Gemini API is configured
 */
const isGeminiConfigured = (): boolean => {
  return !!dbConfig.geminiApiKey;
};

/**
 * Generate insights using Gemini API
 */
export const generateInsights = async (
  prompt: string,
  type: GeminiInsightType = 'general'
): Promise<GeminiInsight> => {
  if (!isGeminiConfigured()) {
    // Mock implementation for development
    return {
      id: `insight-${Date.now()}`,
      type,
      prompt,
      response: `Mock insight for: ${prompt}`,
      createdAt: new Date().toISOString(),
      confidence: 0.85
    };
  }

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent?key=${dbConfig.geminiApiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: prompt
          }]
        }]
      })
    });

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const data = await response.json();
    const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    return {
      id: `insight-${Date.now()}`,
      type,
      prompt,
      response: responseText,
      createdAt: new Date().toISOString(),
      confidence: 0.9
    };
  } catch (error) {
    console.error('Error generating insights:', error);
    throw new Error('Failed to generate insights');
  }
};

/**
 * Generate dashboard insights
 */
export const generateDashboardInsights = async (): Promise<GeminiInsight[]> => {
  const insights: GeminiInsight[] = [];

  // Generate multiple insights for different aspects
  const prompts = [
    {
      type: 'utilization' as GeminiInsightType,
      prompt: "Analyze asset utilization patterns and suggest optimization strategies for an inventory management system."
    },
    {
      type: 'warranty' as GeminiInsightType,
      prompt: "Provide insights on warranty management best practices and cost optimization strategies."
    },
    {
      type: 'inventory' as GeminiInsightType,
      prompt: "Suggest inventory management improvements based on current asset tracking data."
    }
  ];

  for (const { type, prompt } of prompts) {
    try {
      const insight = await generateInsights(prompt, type);
      insights.push(insight);
    } catch (error) {
      console.error(`Failed to generate ${type} insights:`, error);
    }
  }

  return insights;
};

/**
 * Get cached insights (for development)
 */
export const getCachedInsights = (): GeminiInsight[] => {
  if (!isGeminiConfigured()) {
    return [
      {
        id: 'insight-1',
        type: 'utilization',
        prompt: 'Analyze asset utilization patterns',
        response: 'Based on the current data, asset utilization is at 87.5%. Consider implementing a rotation system for underutilized assets.',
        createdAt: new Date().toISOString(),
        confidence: 0.85
      },
      {
        id: 'insight-2',
        type: 'warranty',
        prompt: 'Warranty management insights',
        response: '12 assets have expiring warranties within 30 days. Set up automated alerts for warranty renewals.',
        createdAt: new Date().toISOString(),
        confidence: 0.9
      }
    ];
  }

  return [];
};