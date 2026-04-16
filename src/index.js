require("dotenv").config();

const express = require("express");
const helmet = require("helmet");
const cors = require("cors");

const authRouter            = require("./routes/auth");
const wibizRouter           = require("./routes/wibiz");
const propfundedWebhookRouter = require("./routes/propfundedWebhook");
const adminRouter           = require("./routes/admin");

// ---------------------------------------------------------------------------
// Validate required environment variables at startup
// ---------------------------------------------------------------------------
const required = [
  "JWT_SECRET",
  "WIBIZ_API_KEY",
  "GHL_API_KEY",
  "GHL_LOCATION_ID",
  "PROPFUNDED_WEBHOOK_SECRET",
  "ADMIN_SECRET",
];
// PROPFUNDED_API_URL and PROPFUNDED_API_KEY are only required when sync runs,
// not at boot — Dusan's URL is still coming.
const missing = required.filter((k) => !process.env[k]);
if (missing.length) {
  console.error(`Missing required environment variables: ${missing.join(", ")}`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// App setup
// ---------------------------------------------------------------------------
const app = express();

app.use(helmet());
app.use(express.json());

// CORS: Wibiz.ai widget domains
const allowedOrigins = [
  "https://widget.wibiz.ai",
  "https://app.wibiz.ai",
  "https://staging.wibiz.ai",
];
if (process.env.NODE_ENV !== "production") {
  allowedOrigins.push("http://localhost:3000", "http://localhost:5173");
}

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS: origin ${origin} not allowed.`));
      }
    },
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Accept", "X-Propfunded-Secret", "X-Admin-Secret"],
    credentials: true,
  })
);

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------
app.use("/api/auth",        authRouter);
app.use("/api/wibiz",       wibizRouter);
app.use("/api/propfunded",  propfundedWebhookRouter);
app.use("/api/admin",       adminRouter);

// Health check
app.get("/health", (_req, res) => res.json({ status: "ok" }));

// 404 fallback
app.use((_req, res) => res.status(404).json({ error: "Not found." }));

// ---------------------------------------------------------------------------
// Scheduled sync — runs every 15 minutes as a safety net
// Requires PROPFUNDED_API_URL to be set; skips silently if not yet configured.
// ---------------------------------------------------------------------------
const SYNC_INTERVAL_MS = 15 * 60 * 1000;

function scheduledSync() {
  if (!process.env.PROPFUNDED_API_URL || !process.env.PROPFUNDED_API_KEY) {
    console.log("[cron] PROPFUNDED_API_URL not set yet — skipping scheduled sync");
    return;
  }
  const { fullSync } = require("./services/propfundedSync");
  fullSync().catch((err) => console.error("[cron] sync error:", err.message));
}

// ---------------------------------------------------------------------------
// Start server
// ---------------------------------------------------------------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Wibiz widget API running on port ${PORT}`);

  // Kick off first sync 30 s after boot, then every 15 min
  setTimeout(() => {
    scheduledSync();
    setInterval(scheduledSync, SYNC_INTERVAL_MS);
  }, 30_000);
});
