import { GoogleGenAI } from "@google/genai";
import { Product, Sale } from "../types";

// NOTE: In a real app, never expose API keys in frontend code.
// This relies on the environment variable injection as per instructions.
// If process.env.API_KEY is not set, this will fail gracefully or require configuration.

let ai: GoogleGenAI | null = null;

try {
  if (process.env.API_KEY) {
    ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  }
} catch (error) {
  console.error("Failed to initialize Gemini:", error);
}

export const generateBusinessInsight = async (
  products: Product[],
  sales: Sale[],
  query: string
): Promise<string> => {
  if (!ai) {
    return "Gemini API Key is missing. Please configure it to use AI features.";
  }

  // Prepare context data (summarized to save tokens)
  const lowStock = products.filter(p => p.stock < p.minStockLevel).map(p => p.name);
  const totalRevenue = sales.reduce((acc, curr) => acc + curr.totalAmount, 0);
  const recentSalesCount = sales.length;

  // Simple product summary
  const inventorySummary = products.map(p => `${p.name} (Qty: ${p.stock}, Price: $${p.price})`).join(', ');
  
  // Simple sales summary (last 5 sales)
  const salesSummary = sales.slice(0, 5).map(s => `Sold items worth $${s.totalAmount} on ${new Date(s.timestamp).toLocaleDateString()}`).join('; ');

  const prompt = `
    You are an expert retail business consultant for a shop.
    
    Context Data:
    - Total Revenue: $${totalRevenue}
    - Total Sales Transactions: ${recentSalesCount}
    - Low Stock Items: ${lowStock.join(', ') || 'None'}
    - Current Inventory Sample: ${inventorySummary.substring(0, 1000)}...
    - Recent Sales Sample: ${salesSummary}

    User Question: "${query}"

    Please provide a concise, actionable, and professional answer. Formulate your response in Markdown.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    return response.text || "I couldn't generate an insight at this time.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "An error occurred while communicating with the AI assistant.";
  }
};
