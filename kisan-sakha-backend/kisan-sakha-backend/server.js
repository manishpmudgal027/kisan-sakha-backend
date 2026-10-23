import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const AI_MODEL = process.env.AI_MODEL || "claude-sonnet-4-6";
const MAX_TOKENS_CAP = 1500; // no request can ask for more than this
// Comma-separated list of sites allowed to call this API, e.g.
// ALLOWED_ORIGINS=https://kisan-sakha.netlify.app
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

if (!ANTHROPIC_API_KEY) {
  console.error("ERROR: ANTHROPIC_API_KEY is not set. Add it in the host's environment variables.");
  process.exit(1);
}

const app = express();
app.set("trust proxy", 1); // behind Render's proxy, so rate limits see the real client IP

app.use(
  cors({
    origin(origin, cb) {
      // No Origin header = curl / server-to-server (health checks). Browsers always send one.
      if (!origin) return cb(null, true);
      if (ALLOWED_ORIGINS.length === 0 || ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
      return cb(new Error("Origin not allowed"));
    },
  })
);
app.use(express.json({ limit: "6mb" })); // room for one compressed plant photo

// The API key pays for every request, so cap how fast one phone/IP can call it.
const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please wait a minute." },
});

// The app sends the same body shape as Anthropic's Messages API:
// { model, max_tokens, messages: [{ role: "user", content }] }
// The server ignores the client's model and enforces its own limits.
app.post("/api/ai", aiLimiter, async (req, res) => {
  try {
    const { messages, max_tokens } = req.body || {};
    const valid =
      Array.isArray(messages) &&
      messages.length >= 1 &&
      messages.length <= 10 &&
      messages.every((m) => m && (m.role === "user" || m.role === "assistant") && m.content);
    if (!valid) return res.status(400).json({ error: "Invalid request" });

    const maxTokens = Math.min(Number(max_tokens) || 1000, MAX_TOKENS_CAP);

    const upstream = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({ model: AI_MODEL, max_tokens: maxTokens, messages }),
    });

    if (!upstream.ok) {
      console.error("Anthropic API error:", upstream.status, await upstream.text());
      return res.status(502).json({ error: "AI service error" });
    }
    res.json(await upstream.json());
  } catch (err) {
    console.error("Server error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/api/health", (req, res) => res.json({ status: "ok" }));

// Turn CORS rejections into a clean 403 instead of a stack trace.
app.use((err, req, res, next) => {
  if (err && err.message === "Origin not allowed") return res.status(403).json({ error: "Origin not allowed" });
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Kisan Sakha backend listening on ${PORT}`));
