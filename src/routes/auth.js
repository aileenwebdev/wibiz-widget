const express = require("express");
const jwt = require("jsonwebtoken");
const { body, validationResult } = require("express-validator");
const { findByEmail, toPublicProfile } = require("../data/subscribers");

const router = express.Router();

/**
 * POST /api/auth/login
 *
 * Authenticates a subscriber and returns a signed JWT that the frontend
 * will expose as window.WibizSubscriberToken before loading the widget.
 *
 * Body: { email, password }
 * Response: { token, subscriber }
 */
router.post(
  "/login",
  [
    body("email").isEmail().withMessage("Valid email required."),
    body("password").notEmpty().withMessage("Password required."),
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;
    const subscriber = findByEmail(email);

    // In production, use bcrypt.compare or your auth provider here.
    if (!subscriber || subscriber._password !== password) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    const now = Math.floor(Date.now() / 1000);
    const expiresIn = 3600; // 1 hour

    const payload = {
      subscriber_id: subscriber.subscriber_id,
      email: subscriber.email,
      full_name: subscriber.full_name,
      plan: subscriber.plan,
      status: subscriber.status,
      subscription_renewal_date: subscriber.renewal_date,
      billing_status: subscriber.billing_status,
      seats_total: subscriber.seats_total,
      seats_used: subscriber.seats_used,
      account_created: subscriber.account_created,
      features_enabled: subscriber.features_enabled,
      custom_tags: subscriber.custom_tags,
      issued_at: now,
      expires_at: now + expiresIn,
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET, {
      algorithm: "HS256",
      expiresIn,
    });

    return res.json({
      token,
      subscriber: toPublicProfile(subscriber),
    });
  }
);

module.exports = router;
