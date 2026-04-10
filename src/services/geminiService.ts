import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || (import.meta as any).env.VITE_GEMINI_API_KEY });

export async function getProductRecommendations(niche: string, budget: string, salesChannel: string = 'General') {
  try {
    const prompt = `Actúa como un experto en Dropshipping y comercio electrónico de alto nivel. 
    El usuario busca recomendaciones de productos ganadores para el nicho: "${niche}" con un presupuesto de marketing de "${budget}" y enfocado principalmente en el canal de venta: "${salesChannel}".
    
    CRÍTICO: Prioriza productos que estén optimizados y tengan mayor potencial de éxito específicamente para el canal "${salesChannel}". 
    
    Debes devolver un objeto JSON con la siguiente estructura EXACTA:
    {
      "executiveSummary": "Un breve párrafo sobre el estado actual de este nicho y por qué el canal ${salesChannel} es ideal.",
      "products": [
        {
          "name": "Nombre del producto",
          "summary": "Breve resumen de por qué es ganador (máximo 150 caracteres).",
          "trendLevel": 8,
          "estimatedMargin": "30-40%",
          "channelFit": 9,
          "whyWinner": "Explicación detallada de por qué triunfa en ${salesChannel}.",
          "targetAudience": "Descripción del público objetivo.",
          "marketingStrategy": "Estrategia específica para ${salesChannel}."
        }
      ],
      "masterTip": "Un consejo maestro final sobre cómo escalar este nicho."
    }
    
    Devuelve SOLO el JSON, sin bloques de código ni texto adicional. Asegúrate de que el JSON sea válido.`;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
    });
    
    if (!response.text) {
      throw new Error("La IA no devolvió contenido.");
    }
    
    // Clean potential markdown blocks if AI includes them
    const cleanJson = response.text.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleanJson);
  } catch (error: any) {
    console.error("Error calling AI recommendations:", error);
    throw error;
  }
}

export async function getCompetitiveAnalysis(productName: string, region: string) {
  try {
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

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
    });
    
    if (!response.text) {
      throw new Error("Error al generar el análisis competitivo.");
    }
    
    return response.text;
  } catch (error: any) {
    console.error("Error calling AI analysis:", error);
    throw error;
  }
}

export async function getSupportChatResponse(userMessage: string, chatHistory: { role: string, text: string }[]) {
  try {
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

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        ...chatHistory.map((msg: any) => ({
          role: msg.role === 'user' ? 'user' : 'model',
          parts: [{ text: msg.text }],
        })),
        { role: 'user', parts: [{ text: `${context}\n\nUsuario: ${userMessage}` }] }
      ],
    });
    
    return response.text || "Lo siento, tuve un problema al procesar tu mensaje.";
  } catch (error: any) {
    console.error("Error in support chat:", error);
    return "Lo siento, tuve un problema al procesar tu mensaje.";
  }
}
