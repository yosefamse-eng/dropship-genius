import { GoogleGenAI } from "@google/genai";

export async function getProductRecommendations(niche: string, budget: string) {
  // Use process.env.GEMINI_API_KEY as primary source (required by AI Studio/Gemini Skill)
  // Fallback to import.meta.env.VITE_GEMINI_API_KEY for production builds on GitHub
  const apiKey = process.env.GEMINI_API_KEY || import.meta.env.VITE_GEMINI_API_KEY;
  
  if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
    console.error("Gemini API Key is missing!");
    return "Error: La clave de la IA no está configurada. Por favor, asegúrate de haber añadido VITE_GEMINI_API_KEY a los secretos de GitHub.";
  }
  
  const ai = new GoogleGenAI({ apiKey });
  const prompt = `Actúa como un experto en Dropshipping y comercio electrónico de alto nivel. 
  El usuario busca recomendaciones de productos ganadores para el nicho: "${niche}" con un presupuesto de marketing de "${budget}".
  
  Por favor, estructura tu respuesta de la siguiente manera para que sea fácil de escanear:
  
  1. **Resumen Ejecutivo**: Un breve párrafo sobre el estado actual de este nicho.
  2. **Tabla Comparativa de Productos**: Una tabla Markdown con las siguientes columnas: Producto, Nivel de Tendencia (1-10), Margen Estimado (%), Canal de Venta Ideal.
  3. **Análisis Detallado por Producto**: Para cada uno de los 3-5 productos recomendados, usa listas con viñetas para:
     - **Por qué es ganador**: (Efecto WOW, resolución de problemas, etc.)
     - **Público Objetivo**: Quién lo compra y por qué.
     - **Estrategia de Marketing**: Pasos específicos (ej: "TikTok Ads con UGC", "Influencers de nicho").
  4. **Consejo Maestro**: Un consejo final sobre cómo escalar este nicho específico.
  
  Responde en un formato Markdown impecable, profesional y en español. Usa negritas para resaltar términos clave.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
    });
    return response.text || "No se pudieron generar recomendaciones.";
  } catch (error) {
    console.error("Error calling Gemini:", error);
    return "Hubo un error al conectar con la IA de Google. Por favor, asegúrate de que la clave API esté configurada correctamente en los Secretos de GitHub y vuelve a intentarlo.";
  }
}
