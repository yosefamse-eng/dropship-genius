import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import admin from "firebase-admin";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Firebase Admin
// In a real environment, you'd use a service account JSON
// For this environment, we'll try to initialize with default credentials
try {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    // You might need to specify the databaseURL if using Realtime Database
  });
} catch (error) {
  console.warn("Firebase Admin could not be initialized with default credentials. Push notifications might not work until a service account is configured.");
  // Fallback or placeholder initialization if needed for the app to start
  if (!admin.apps.length) {
    admin.initializeApp();
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Gemini AI Endpoints
  app.post("/api/ai/recommendations", async (req, res) => {
    const { niche, budget } = req.body;
    const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;

    if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
      return res.status(500).json({ 
        error: "La clave de la IA no está configurada. Por favor, ve a Configuración > Secretos y añade tu GEMINI_API_KEY." 
      });
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
      res.json({ text: response.text || "No se pudieron generar recomendaciones." });
    } catch (error) {
      console.error("Error calling Gemini:", error);
      res.status(500).json({ error: "Error al conectar con la IA de Google." });
    }
  });

  app.post("/api/ai/analysis", async (req, res) => {
    const { productName, region } = req.body;
    const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;

    if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
      return res.status(500).json({ error: "API Key missing." });
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
      res.json({ text: response.text || "Error al generar el análisis competitivo." });
    } catch (error) {
      console.error("Error calling Gemini for competitive analysis:", error);
      res.status(500).json({ error: "Error al generar el análisis competitivo." });
    }
  });

  app.post("/api/ai/chat", async (req, res) => {
    const { userMessage, chatHistory } = req.body;
    const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;

    if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
      return res.status(500).json({ error: "IA no configurada." });
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
          ...chatHistory.map((msg: any) => ({
            role: msg.role === 'user' ? 'user' : 'model',
            parts: [{ text: msg.text }],
          })),
          { role: 'user', parts: [{ text: `${context}\n\nUsuario: ${userMessage}` }] }
        ],
      });
      res.json({ text: response.text || "Lo siento, tuve un problema al procesar tu mensaje." });
    } catch (error) {
      console.error("Error in support chat:", error);
      res.status(500).json({ error: "Error en el chat de IA." });
    }
  });

  // API Route to send notifications
  app.post("/api/notifications/send", async (req, res) => {
    const { token, title, body } = req.body;

    if (!token) {
      return res.status(400).json({ error: "Token is required" });
    }

    try {
      const response = await admin.messaging().send({
        token,
        notification: {
          title,
          body,
        },
        webpush: {
          notification: {
            icon: "/favicon.ico", // Adjust as needed
          },
        },
      });
      res.json({ success: true, messageId: response });
    } catch (error) {
      console.error("Error sending message:", error);
      res.status(500).json({ error: "Failed to send notification" });
    }
  });

  // API Route to check credits and notify (example)
  app.post("/api/notifications/check-credits", async (req, res) => {
    const { userId, credits, token } = req.body;
    
    if (credits < 50 && token) {
      try {
        await admin.messaging().send({
          token,
          notification: {
            title: "¡Créditos Bajos!",
            body: `Te quedan solo ${credits} créditos. ¡Recarga ahora para seguir analizando!`,
          },
        });
        return res.json({ notified: true });
      } catch (error) {
        console.error("Error sending low credit notification:", error);
      }
    }
    res.json({ notified: false });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
