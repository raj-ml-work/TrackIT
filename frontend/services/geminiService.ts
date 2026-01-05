import { GoogleGenAI } from "@google/genai";
import { Asset } from "../types";

const API_KEY = process.env.API_KEY || '';

// Initialize Gemini
const ai = new GoogleGenAI({ apiKey: API_KEY });

export const generateInventoryInsight = async (assets: Asset[]): Promise<string> => {
  if (!API_KEY) {
    return "AI Insights require a valid API Key. Please configure your environment.";
  }

  try {
    const summary = assets.map(a => {
      let specSummary = '';
      if (a.specs) {
        specSummary = `[${[
          a.specs.brand, 
          a.specs.model, 
          a.specs.cpu, 
          a.specs.ram, 
          a.specs.storage,
          a.specs.printerType
        ].filter(Boolean).join(', ')}]`;
      }
      return `- ${a.type}: ${a.name} ${specSummary}, Cost: $${a.cost}, Warranty: ${a.warrantyExpiry}, Status: ${a.status}`;
    }).join('\n');

    const prompt = `
      Analyze the following corporate inventory list and provide a single, concise executive summary paragraph (max 60 words). 
      Look for specific hardware patterns (e.g. "Most laptops are aging Intel i5 models" or "High monthly spend on ink") or optimization opportunities based on the technical specs and warranty dates.
      Keep the tone professional, minimalist, and direct.
      
      Inventory Data:
      ${summary.substring(0, 15000)}
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    return response.text || "No insights available at this time.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Unable to generate insights due to a connection error.";
  }
};