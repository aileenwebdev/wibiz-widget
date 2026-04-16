/**
 * Admin endpoints — trigger manual syncs and check status.
 * Protected by ADMIN_SECRET header.
 */

const express = require("express");
const { fullSync } = require("../services/propfundedSync");

const router = express.Router();

let syncStatus = { running: false, lastRun: null, lastResult: null };

function adminAuth(req, res, next) {
  const key = req.headers["x-admin-secret"];
  if (!key || key !== process.env.ADMIN_SECRET) {
    return res.status(401).json({ error: "Unauthorized." });
  }
  next();
}

// POST /api/admin/sync — trigger a full sync manually
router.post("/sync", adminAuth, async (req, res) => {
  if (syncStatus.running) {
    return res.status(409).json({ error: "Sync already running." });
  }

  res.json({ message: "Full sync started.", startedAt: new Date().toISOString() });

  syncStatus.running = true;
  try {
    const result = await fullSync();
    syncStatus.lastResult = result;
    syncStatus.lastRun = new Date().toISOString();
  } catch (err) {
    console.error("[admin] fullSync error:", err.message);
    syncStatus.lastResult = { error: err.message };
  } finally {
    syncStatus.running = false;
  }
});

// GET /api/admin/sync/status — check last sync result
router.get("/sync/status", adminAuth, (_req, res) => {
  res.json(syncStatus);
});

module.exports = router;
