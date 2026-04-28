/**
 * POST /api/propfunded/webhook
 *
 * Receives business events from Propfunded and syncs the subscriber
 * into Wibiz with the appropriate fields and tags.
 *
 * Supported events (as confirmed by Propfunded):
 *   user.welcome
 *   user.password_reset_requested
 *   purchase.confirmed
 *   challenge.free_granted
 *   challenge.phase1.completed
 *   challenge.phase2.completed
 *   challenge.phase1.failed
 *   challenge.phase2.failed
 *   challenge.phase3.failed
 *   withdrawal.approved
 *   withdrawal.rejected
 *   withdrawal.completed
 *   challenge.soft_breach
 *
 * Payload format (flat — no wrapper):
 * {
 *   "event": "challenge.phase1.completed",
 *   "subscriber_id": "abc123",
 *   "email": "jane@propfunded.com",
 *   "first_name": "Jane",
 *   ...event-specific fields
 * }
 *
 * Security: shared secret in X-Propfunded-Secret header.
 */

const express = require("express");
const { upsertFromEvent, EVENT_MAP } = require("../services/ghl");
const { record } = require("../services/webhookLog");

const router = express.Router();

const VALID_EVENTS = new Set(Object.keys(EVENT_MAP));

function validateSecret(req, res, next) {
  const secret = req.headers["x-propfunded-secret"];
  if (!secret || secret !== process.env.PROPFUNDED_WEBHOOK_SECRET) {
    return res.status(401).json({ error: "Invalid webhook secret." });
  }
  next();
}

router.post("/webhook", validateSecret, (req, res) => {
  const { event, subscriber_id, email } = req.body || {};

  if (!event)         return res.status(400).json({ error: "Missing event." });
  if (!subscriber_id) return res.status(400).json({ error: "Missing subscriber_id." });
  if (!email)         return res.status(400).json({ error: "Missing email." });

  if (!VALID_EVENTS.has(event)) {
    return res.status(400).json({ error: `Unknown event: ${event}` });
  }

  // Acknowledge immediately — Wibiz sync runs in the background
  res.json({ received: true, event, subscriber_id });

  upsertFromEvent(event, req.body)
    .then((result) => {
      console.log(`[webhook] OK — event: ${event}, subscriber: ${subscriber_id}, email: ${email}, action: ${result.action}`);
      record({ event, subscriber_id, email, status: "ok", action: result.action });
    })
    .catch((err) => {
      console.error(`[webhook] FAILED — event: ${event}, subscriber: ${subscriber_id}, email: ${email}: ${err.message}`);
      record({ event, subscriber_id, email, status: "failed", error: err.message });
    });
});

module.exports = router;
