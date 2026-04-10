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
  const prompt = `Actúa como un analista de mercado experto en e-commerce, especialista en SEO y estratega de publicidad digital. 
  Realiza un análisis competitivo y de palabras clave profundo para el siguiente producto: "${productName}" en la región: "${region}".
  
  Tu análisis DEBE incluir:
  1. **Precios de la Competencia**: Rango de precios en Amazon, AliExpress y tiendas Shopify populares en ${region}.
  2. **Estrategias de Marketing**: Cómo lo están vendiendo los líderes en esta región (ej: anuncios de Facebook, colaboraciones con influencers, SEO).
  3. **Análisis de Palabras Clave (SEO & SEM)**:
     - **Palabras Clave Principales**: Términos de búsqueda con mayor volumen.
     - **Sugerencias de Cola Larga (Long-tail)**: Frases específicas con menor competencia y alta conversión.
     - **Volumen de Búsqueda Estimado**: Clasificación (Bajo, Medio, Alto) y tendencia actual.
     - **Intención del Usuario**: Analiza si la intención es Informativa (buscando qué es), Comparativa (buscando cuál es mejor) o Transaccional (listo para comprar).
  4. **Análisis de Creativos Publicitarios**: Describe el tipo de anuncios que mejor funcionan para este producto (ej: "Videos UGC de 15s en TikTok", "Carruseles de beneficios en Instagram", "Copy enfocado en la resolución de problemas").
  5. **Demografía del Público Objetivo**: Perfil detallado del comprador ideal (Edad, Género, Intereses principales, Comportamiento de compra).
  6. **Sentimiento en Redes Sociales**: Qué dice la gente en TikTok, Instagram y Reddit sobre este tipo de producto en ${region} (puntos positivos y quejas comunes).
  7. **Costos Estimados de Marketing**: Un desglose de los costos potenciales para lanzar una campaña inicial en esta región (CPC promedio, presupuesto diario recomendado, etc.).
  8. **Oportunidad de Diferenciación**: Cómo puede un nuevo vendedor destacar frente a la competencia actual en ${region}.
  
  Responde en un formato Markdown profesional, estructurado y en español. Usa emojis para hacer la lectura amena y tablas si es necesario para comparar palabras clave.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
    });
    return response.text || "Error al generar el análisis competitivo.";
  } catch (error) {
    console.error("Error calling Gemini for competitive analysis:", error);
    return "Error al generar el análisis competitivo.";
  }
}

export async function getSupportChatResponse(userMessage: string, chatHistory: { role: string, text: string }[]) {
  const apiKey = process.env.GEMINI_API_KEY || import.meta.env.VITE_GEMINI_API_KEY;
  
  if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
    return "Lo siento, el servicio de IA no está configurado correctamente.";
  }
  
  const ai = new GoogleGenAI({ apiKey });

  const context = `
    Eres el asistente virtual de DropshipGenius AI, una plataforma avanzada que utiliza IA para encontrar productos ganadores de dropshipping.
    
    Información Clave de la Plataforma (FAQs):
    - ¿Cómo funciona?: Analizamos tendencias globales, redes sociales y marketplaces en tiempo real con Google Gemini para identificar alta demanda y baja competencia.
    - Criterios: Evaluamos margen de beneficio, facilidad de envío, saturación y viralidad (TikTok/FB).
    - Plan PRO: Búsquedas ilimitadas, proveedores VIP, análisis profundo, soporte prioritario, sin anuncios ni esperas.
    - Créditos: Cada búsqueda consume 20 créditos. Bono inicial de 200 gratis. Se pueden comprar packs o suscripción PRO.
    
    Instrucciones:
    - Responde de forma amable, profesional y concisa.
    - Si el usuario pregunta algo sobre dropshipping en general, usa tu conocimiento experto.
    - Si pregunta sobre la plataforma, usa la información de arriba.
    - Mantén las respuestas breves para un chat.
    - Responde siempre en español.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        ...chatHistory.map(msg => ({
          role: msg.role === 'user' ? 'user' : 'model',
          parts: [{ text: msg.text }],
        })),
        { role: 'user', parts: [{ text: `${context}\n\nUsuario: ${userMessage}` }] }
      ],
    });
    return response.text || "Lo siento, tuve un problema al procesar tu mensaje. ¿Puedes intentarlo de nuevo?";
  } catch (error) {
    console.error("Error in support chat:", error);
    return "Lo siento, tuve un problema al procesar tu mensaje. ¿Puedes intentarlo de nuevo?";
  }
}
