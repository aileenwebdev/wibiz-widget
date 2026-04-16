/**
 * POST /api/propfunded/webhook
 *
 * Receives real-time change events from Propfunded when a subscriber's
 * data changes (status update, new account, etc.).
 *
 * Propfunded fires this when:
 *   - A new subscriber signs up
 *   - A subscriber's status changes
 *   - Any tracked field is updated
 *
 * Payload from Propfunded:
 * {
 *   "event": "subscriber.updated" | "subscriber.created",
 *   "subscriber_id": "12345"
 * }
 *
 * Security: shared secret in X-Propfunded-Secret header.
 */

const express = require("express");
const { syncOne } = require("../services/propfundedSync");

const router = express.Router();

function validateSecret(req, res, next) {
  const secret = req.headers["x-propfunded-secret"];
  if (!secret || secret !== process.env.PROPFUNDED_WEBHOOK_SECRET) {
    return res.status(401).json({ error: "Invalid webhook secret." });
  }
  next();
}

router.post("/webhook", validateSecret, async (req, res) => {
  const { event, subscriber_id } = req.body || {};

  if (!subscriber_id) {
    return res.status(400).json({ error: "Missing subscriber_id in payload." });
  }

  const validEvents = ["subscriber.created", "subscriber.updated", "subscriber.deleted"];
  if (event && !validEvents.includes(event)) {
    return res.status(400).json({ error: `Unknown event type: ${event}` });
  }

  // Acknowledge immediately — do the sync async so Propfunded doesn't time out
  res.json({ received: true, subscriber_id, event });

  // Sync in background
  syncOne(subscriber_id).catch((err) =>
    console.error(`[webhook] sync failed for ${subscriber_id}: ${err.message}`)
  );
});

module.exports = router;
