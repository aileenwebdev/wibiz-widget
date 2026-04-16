const express = require("express");
const bearerAuth = require("../middleware/bearerAuth");
const { subscriberRateLimiter } = require("../middleware/rateLimiter");
const { findById, toPublicProfile } = require("../data/subscribers");

const router = express.Router();

/**
 * GET /api/wibiz/subscriber/:subscriber_id
 *
 * Webhook endpoint called by the Wibiz.ai assistant during a conversation
 * to fetch the subscriber's current account state in real time.
 *
 * Security:
 *   - Requires Authorization: Bearer <WIBIZ_API_KEY>
 *   - Rate limited to 60 requests/min per subscriber
 *   - Returns only fields safe for the assistant — no passwords or payment tokens
 *
 * Response must arrive within 3 s (Wibiz times out at 5 s).
 */
router.get(
  "/subscriber/:subscriber_id",
  bearerAuth,
  subscriberRateLimiter,
  (req, res) => {
    const { subscriber_id } = req.params;
    const subscriber = findById(subscriber_id);

    if (!subscriber) {
      return res.status(404).json({ error: "Subscriber not found." });
    }

    return res.json(toPublicProfile(subscriber));
  }
);

module.exports = router;
