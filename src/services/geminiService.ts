import { GoogleGenAI } from "@google/genai";

export async function getProductRecommendations(niche: string, budget: string) {
  try {
    const response = await fetch("/api/ai/recommendations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ niche, budget }),
    });
    
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Error en la IA");
    return data.text;
  } catch (error: any) {
    console.error("Error calling AI recommendations:", error);
    return error.message || "Hubo un error al conectar con la IA.";
  }
}

export async function getCompetitiveAnalysis(productName: string, region: string) {
  try {
    const response = await fetch("/api/ai/analysis", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productName, region }),
    });
    
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Error en el análisis");
    return data.text;
  } catch (error: any) {
    console.error("Error calling AI analysis:", error);
    return error.message || "Error al generar el análisis competitivo.";
  }
}

export async function getSupportChatResponse(userMessage: string, chatHistory: { role: string, text: string }[]) {
  try {
    const response = await fetch("/api/ai/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userMessage, chatHistory }),
    });
    
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Error en el chat");
    return data.text;
  } catch (error: any) {
    console.error("Error in support chat:", error);
    return "Lo siento, tuve un problema al procesar tu mensaje.";
  }
}
