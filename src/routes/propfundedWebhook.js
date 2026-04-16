/**
 * POST /api/propfunded/webhook
 *
 * Receives real-time subscriber events from Propfunded.
 * Propfunded fires this on: new signup, status change, stage change,
 * funded status change, balance update.
 *
 * Two accepted payload shapes:
 *
 * Shape A — full data (preferred, no back-and-forth):
 * {
 *   "event": "subscriber.updated",
 *   "data": {
 *     "subscriber_id": "abc123",
 *     "email": "jane@example.com",
 *     "full_name": "Jane Doe",
 *     "status": "active",
 *     "account_created": "2024-01-15",
 *     "current_stage": "Phase 2",
 *     "is_funded": false,
 *     "balance": 9800.00,
 *     "amount_spent": 299.00
 *   }
 * }
 *
 * Shape B — ID only (fallback: we call Propfunded's API to fetch the data):
 * {
 *   "event": "subscriber.updated",
 *   "subscriber_id": "abc123"
 * }
 *
 * Security: shared secret in X-Propfunded-Secret header.
 */

const express = require("express");
const { upsertSubscriber } = require("../services/ghl");
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
  const { event, data, subscriber_id } = req.body || {};

  const validEvents = ["subscriber.created", "subscriber.updated"];
  if (event && !validEvents.includes(event)) {
    return res.status(400).json({ error: `Unknown event: ${event}` });
  }

  // Shape A — full data included in payload
  if (data && data.subscriber_id) {
    res.json({ received: true, subscriber_id: data.subscriber_id, mode: "full" });

    upsertSubscriber(data).catch((err) =>
      console.error(`[webhook] GHL upsert failed for ${data.subscriber_id}: ${err.message}`)
    );
    return;
  }

  // Shape B — ID only, fetch from Propfunded API then sync
  const id = subscriber_id;
  if (!id) {
    return res.status(400).json({ error: "Payload must include either data.subscriber_id or subscriber_id." });
  }

  res.json({ received: true, subscriber_id: id, mode: "fetch" });

  syncOne(id).catch((err) =>
    console.error(`[webhook] fetch+sync failed for ${id}: ${err.message}`)
  );
});

module.exports = router;
