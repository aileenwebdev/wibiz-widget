/**
 * Admin endpoints — trigger manual syncs and check status.
 * Protected by ADMIN_SECRET header.
 */

const express = require("express");
const { fullSync } = require("../services/propfundedSync");
const { getEntries } = require("../services/webhookLog");
const { findContactByEmail, getContactById } = require("../services/ghl");

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

// GET /api/admin/webhook/log — last 100 webhook events (newest first)
// Shows event name, subscriber, email, whether GHL sync succeeded, and any error.
router.get("/webhook/log", adminAuth, (_req, res) => {
  res.json({ entries: getEntries() });
});

// GET /api/admin/contact?email=... — look up a GHL contact by email
// Returns their current tags and custom fields so you can verify what landed in GHL.
router.get("/contact", adminAuth, async (req, res) => {
  const { email } = req.query;
  if (!email) return res.status(400).json({ error: "Missing email query param." });

  try {
    const contact = await findContactByEmail(email);
    if (!contact) return res.status(404).json({ error: "Contact not found in GHL." });

    const full = await getContactById(contact.id);
    res.json({
      id:           full.id,
      email:        full.email,
      firstName:    full.firstName,
      tags:         full.tags || [],
      customFields: full.customFields || [],
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
