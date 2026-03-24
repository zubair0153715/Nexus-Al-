import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export interface OptimizationResult {
  optimizedContent: string;
  seoScore: number;
  engagementTips: string[];
  reasoning: string;
}

export const generatePost = async (prompt: string, platform: string): Promise<string> => {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Generate a high-engagement social media post for ${platform} based on this prompt: "${prompt}". 
    Focus on business growth and professional appeal. Do not include meta-commentary, just the post content.`,
  });
  return response.text || "Failed to generate post.";
};

export const optimizeForBusiness = async (content: string, platform: string): Promise<OptimizationResult> => {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Analyze and optimize this social media post for a business account on ${platform}:
    
    "${content}"
    
    Improve it for maximum ranking, SEO, and engagement. Return the result in JSON format.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          optimizedContent: { type: Type.STRING, description: "The improved post content" },
          seoScore: { type: Type.NUMBER, description: "Ranking potential score from 0-100" },
          engagementTips: { 
            type: Type.ARRAY, 
            items: { type: Type.STRING },
            description: "Specific tips to increase business engagement"
          },
          reasoning: { type: Type.STRING, description: "Why these changes were made" }
        },
        required: ["optimizedContent", "seoScore", "engagementTips", "reasoning"]
      }
    }
  });

  try {
    return JSON.parse(response.text || "{}") as OptimizationResult;
  } catch (err) {
    console.error("Failed to parse optimization result:", err);
    throw new Error("Failed to optimize content.");
  }
};
