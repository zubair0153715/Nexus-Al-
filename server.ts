import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // OAuth URL Construction
  app.get("/api/auth/url", (req, res) => {
    const { platform } = req.query;
    const redirectUri = `${process.env.APP_URL}/auth/callback`;

    if (platform === 'twitter') {
      if (!process.env.TWITTER_CLIENT_ID) {
        return res.status(500).json({ error: 'Twitter Client ID not configured in environment' });
      }
      const params = new URLSearchParams({
        client_id: process.env.TWITTER_CLIENT_ID!,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: 'tweet.read tweet.write users.read offline.access',
        state: 'twitter_state',
        code_challenge: 'challenge',
        code_challenge_method: 'plain'
      });
      return res.json({ url: `https://twitter.com/i/oauth2/authorize?${params}` });
    }

    // Add other platforms here...
    res.status(400).json({ error: 'Unsupported platform' });
  });

  // OAuth Callback Handler
  app.get("/auth/callback", async (req, res) => {
    const { code, state } = req.query;
    
    // In a real app, you'd exchange the code for tokens here
    // and store them in Firestore associated with the user.
    // For this demo, we'll just send a success message.

    res.send(`
      <html>
        <body style="font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; background: #F9FAFB;">
          <div style="text-align: center; background: white; padding: 2rem; rounded: 1rem; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);">
            <h2 style="color: #141414;">Connection Successful!</h2>
            <p style="color: #4B5563;">Your account has been linked to Nexus AI.</p>
            <script>
              if (window.opener) {
                window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS', platform: '${state?.toString().split('_')[0]}' }, '*');
                window.close();
              } else {
                window.location.href = '/';
              }
            </script>
          </div>
        </body>
      </html>
    `);
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
