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
