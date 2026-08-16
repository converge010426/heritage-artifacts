import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { Resend } from 'resend';
import dotenv from 'dotenv';

import { HERITAGE_BUSINESS } from './src/config/heritageBusiness';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API routes
  app.post("/api/send-email", async (req, res) => {
    const { to, subject, html } = req.body;
    
    if (!process.env.RESEND_API_KEY) {
      console.error("RESEND_API_KEY is missing");
      return res.status(500).json({ error: "RESEND_API_KEY is missing" });
    }

    const resend = new Resend(process.env.RESEND_API_KEY);

    try {
      const data = await resend.emails.send({
        from: 'Heritage Artifacts <onboarding@resend.dev>',
        to: [to],
        cc: [HERITAGE_BUSINESS.owner.email],
        subject: subject,
        html: html,
      });

      console.log("Email sent successfully:", data);
      res.status(200).json(data);
    } catch (error) {
      console.error("Error sending email:", error);
      res.status(500).json({ error });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
