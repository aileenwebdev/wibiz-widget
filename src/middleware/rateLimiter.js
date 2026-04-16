const rateLimit = require("express-rate-limit");

/**
 * Rate limiter for the subscriber webhook: 60 requests per minute per subscriber.
 * The key is the subscriber_id from the URL param, not the IP, so each subscriber
 * gets its own independent bucket as required by the Wibiz integration spec.
 */
const subscriberRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60,
  keyGenerator: (req) => req.params.subscriber_id || req.ip,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Rate limit exceeded. Max 60 requests per minute per subscriber." },
});

module.exports = { subscriberRateLimiter };
