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

export async function getCompetitiveAnalysis(productName: string, region: string) {
  const apiKey = process.env.GEMINI_API_KEY || import.meta.env.VITE_GEMINI_API_KEY;
  
  if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
    return "Error: API Key missing.";
  }
  
  const ai = new GoogleGenAI({ apiKey });
  const prompt = `Actúa como un analista de mercado experto en e-commerce y estratega de publicidad digital. 
  Realiza un análisis competitivo profundo para el siguiente producto: "${productName}" en la región: "${region}".
  
  Tu análisis DEBE incluir:
  1. **Precios de la Competencia**: Rango de precios en Amazon, AliExpress y tiendas Shopify populares en ${region}.
  2. **Estrategias de Marketing**: Cómo lo están vendiendo los líderes en esta región (ej: anuncios de Facebook, colaboraciones con influencers, SEO).
  3. **Análisis de Creativos Publicitarios**: Describe el tipo de anuncios que mejor funcionan para este producto (ej: "Videos UGC de 15s en TikTok", "Carruseles de beneficios en Instagram", "Copy enfocado en la resolución de problemas").
  4. **Demografía del Público Objetivo**: Perfil detallado del comprador ideal (Edad, Género, Intereses principales, Comportamiento de compra).
  5. **Sentimiento en Redes Sociales**: Qué dice la gente en TikTok, Instagram y Reddit sobre este tipo de producto en ${region} (puntos positivos y quejas comunes).
  6. **Costos Estimados de Marketing**: Un desglose de los costos potenciales para lanzar una campaña inicial en esta región (CPC promedio, presupuesto diario recomendado, etc.).
  7. **Oportunidad de Diferenciación**: Cómo puede un nuevo vendedor destacar frente a la competencia actual en ${region}.
  
  Responde en un formato Markdown profesional, estructurado y en español. Usa emojis para hacer la lectura amena.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
    });
    return response.text || "No se pudo generar el análisis competitivo.";
  } catch (error) {
    console.error("Error calling Gemini for competitive analysis:", error);
    return "Error al generar el análisis competitivo.";
  }
}
