/**
 * Mock subscriber store.
 * In production, replace these lookups with real database queries.
 */

const subscribers = {
  usr_001: {
    subscriber_id: "usr_001",
    email: "jane@example.com",
    full_name: "Jane Dela Cruz",
    plan: "premium",
    status: "active",
    seats_total: 10,
    seats_used: 7,
    renewal_date: "2025-07-01",
    billing_status: "paid",
    account_created: "2023-03-15",
    features_enabled: ["reporting", "api_access", "white_label"],
    custom_tags: ["vip", "migrated"],
    // password_hash is intentionally never exposed via the API
    _password: "password123",
  },
  usr_002: {
    subscriber_id: "usr_002",
    email: "john@demo.com",
    full_name: "John Santos",
    plan: "basic",
    status: "trial",
    seats_total: 3,
    seats_used: 1,
    renewal_date: "2025-05-01",
    billing_status: "paid",
    account_created: "2024-11-20",
    features_enabled: ["reporting"],
    custom_tags: [],
    _password: "password123",
  },
  usr_003: {
    subscriber_id: "usr_003",
    email: "maria@corp.io",
    full_name: "Maria Reyes",
    plan: "enterprise",
    status: "active",
    seats_total: 50,
    seats_used: 34,
    renewal_date: "2026-01-15",
    billing_status: "paid",
    account_created: "2022-06-01",
    features_enabled: ["reporting", "api_access", "white_label", "sso"],
    custom_tags: ["enterprise", "priority_support"],
    _password: "password123",
  },
};

/** Look up a subscriber by email (for login). */
function findByEmail(email) {
  return Object.values(subscribers).find((s) => s.email === email) || null;
}

/** Look up a subscriber by their ID (for the webhook). */
function findById(subscriber_id) {
  return subscribers[subscriber_id] || null;
}

/**
 * Return only the fields that are safe to expose to the Wibiz assistant.
 * Never return _password or other internal fields.
 */
function toPublicProfile(subscriber) {
  const {
    subscriber_id,
    email,
    full_name,
    plan,
    status,
    seats_total,
    seats_used,
    renewal_date,
    billing_status,
    account_created,
    features_enabled,
    custom_tags,
  } = subscriber;

  return {
    subscriber_id,
    email,
    full_name,
    plan,
    status,
    seats_total,
    seats_used,
    renewal_date,
    billing_status,
    account_created,
    features_enabled,
    custom_tags,
  };
}

module.exports = { findByEmail, findById, toPublicProfile };
