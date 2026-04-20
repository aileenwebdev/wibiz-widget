/**
 * Wibiz CRM client.
 * Handles contact create / update and tag management for Propfunded subscribers.
 */

const https = require("https");

const GHL_VERSION = "2021-07-28";

// ---------------------------------------------------------------------------
// Custom field IDs in the PropFunded AI Wibiz location (xLDiBULkjcNNk3isq7L4)
// ---------------------------------------------------------------------------
const FIELD_IDS = {
  // Core subscriber fields
  propfunded_subscriber_id:    "vDme5bN5feL0TEEN0CLy",
  propfunded_status:           "Obn3YeqDweq6egkvns9v",
  propfunded_account_created:  "BfBouzZUpZJ4G5ttqFd5",
  propfunded_last_synced:      "73NvX05Rj1flTpfnGHhv",
  propfunded_amount_spent:     "ol2Z5oruK0sOZFAHqjeG",
  propfunded_current_stage:    "l6ICD1zruM098mBHDfjB",
  propfunded_is_funded:        "I1pWigU00DAELdMqTyEN",
  propfunded_balance:          "ZV3HsOfmWJJDvJVv1oql",
  // Event-driven fields
  propfunded_last_event:       "1kPnsv3c50LjI7A5mguK",
  propfunded_challenge_name:   "WWY4vrvIyI6uF3RmLnBr",
  propfunded_account_number:   "3yB1zyrMCF9K0XAhQXuB",
  propfunded_profit:           "VPkTJqf85zYHm9OEEAh5",
  propfunded_equity:           "DKqCzi5pwADl3LQUWYaE",
  propfunded_withdrawal_amount:"wS4TgPccgi4jHopFc1jg",
  propfunded_fail_reason:      "Wv5AFWAyUW13vu3X7ZS3",
};

// ---------------------------------------------------------------------------
// Event map — defines how each Propfunded event maps to Wibiz tags and stage
// Tags are added to the contact so GHL automations can trigger off them
// ---------------------------------------------------------------------------
const EVENT_MAP = {
  "user.welcome":                   { label: "Welcome",                      stage: "Registered",     tags: ["status:active", "stage:registered"] },
  "purchase.confirmed":             { label: "Purchase Confirmed",           stage: "Phase 1",        tags: ["stage:phase1", "purchase:confirmed"] },
  "challenge.free_granted":         { label: "Free Challenge Granted",       stage: "Phase 1",        tags: ["stage:phase1", "challenge:free_granted"] },
  "challenge.phase1.completed":     { label: "Phase 1 Passed",               stage: "Phase 2",        tags: ["stage:phase2", "phase1:passed"] },
  "challenge.phase2.completed":     { label: "Phase 2 Passed — Funded",      stage: "Funded",         tags: ["stage:funded", "phase2:passed", "funded:yes"] },
  "challenge.phase1.failed":        { label: "Phase 1 Failed",               stage: "Phase 1 Failed", tags: ["phase1:failed"] },
  "challenge.phase2.failed":        { label: "Phase 2 Failed",               stage: "Phase 2 Failed", tags: ["phase2:failed"] },
  "challenge.phase3.failed":        { label: "Phase 3 Failed",               stage: "Phase 3 Failed", tags: ["phase3:failed"] },
  "withdrawal.approved":            { label: "Withdrawal Approved",          stage: null,             tags: ["withdrawal:approved"] },
  "withdrawal.rejected":            { label: "Withdrawal Rejected",          stage: null,             tags: ["withdrawal:rejected"] },
  "withdrawal.completed":           { label: "Withdrawal Completed",         stage: null,             tags: ["withdrawal:completed"] },
  "user.password_reset_requested":  { label: "Password Reset Requested",     stage: null,             tags: [] },
};

// ---------------------------------------------------------------------------
// HTTP helper
// ---------------------------------------------------------------------------
function ghlRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const options = {
      hostname: "services.leadconnectorhq.com",
      path,
      method,
      headers: {
        Authorization: `Bearer ${process.env.GHL_API_KEY}`,
        Version: GHL_VERSION,
        Accept: "application/json",
        ...(payload
          ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) }
          : {}),
      },
    };
    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

// ---------------------------------------------------------------------------
// Build Wibiz contact payload from a Propfunded event
// ---------------------------------------------------------------------------
function buildContactFromEvent(event, payload) {
  const {
    subscriber_id, email, first_name,
    challenge_name, account_number,
    profit, equity, amount, reason,
  } = payload;

  const config = EVENT_MAP[event] || { label: event, stage: null, tags: [] };
  const now    = new Date().toISOString().split("T")[0];

  const customFields = [
    { id: FIELD_IDS.propfunded_subscriber_id, value: String(subscriber_id) },
    { id: FIELD_IDS.propfunded_last_synced,   value: now },
    { id: FIELD_IDS.propfunded_last_event,    value: config.label },
  ];

  if (config.stage) {
    customFields.push({ id: FIELD_IDS.propfunded_current_stage, value: config.stage });
  }
  if (event === "challenge.phase2.completed") {
    customFields.push({ id: FIELD_IDS.propfunded_is_funded, value: "yes" });
  }
  if (challenge_name)  customFields.push({ id: FIELD_IDS.propfunded_challenge_name,    value: challenge_name });
  if (account_number)  customFields.push({ id: FIELD_IDS.propfunded_account_number,    value: account_number });
  if (profit  != null) customFields.push({ id: FIELD_IDS.propfunded_profit,            value: String(profit) });
  if (equity  != null) customFields.push({ id: FIELD_IDS.propfunded_equity,            value: String(equity) });
  if (amount  != null && event.startsWith("withdrawal")) {
    customFields.push({ id: FIELD_IDS.propfunded_withdrawal_amount, value: String(amount) });
  }
  if (amount  != null && event === "purchase.confirmed") {
    customFields.push({ id: FIELD_IDS.propfunded_amount_spent, value: String(amount) });
  }
  if (reason) customFields.push({ id: FIELD_IDS.propfunded_fail_reason, value: reason });

  return {
    firstName:  first_name || "",
    email,
    locationId: process.env.GHL_LOCATION_ID,
    customFields,
    tags: config.tags,
  };
}

// ---------------------------------------------------------------------------
// Find an existing Wibiz contact by email
// ---------------------------------------------------------------------------
async function findContactByEmail(email) {
  const res = await ghlRequest(
    "GET",
    `/contacts/?locationId=${process.env.GHL_LOCATION_ID}&query=${encodeURIComponent(email)}`
  );
  const contacts = res.body?.contacts || [];
  return contacts.find((c) => c.email?.toLowerCase() === email.toLowerCase()) || null;
}

// ---------------------------------------------------------------------------
// Create a new Wibiz contact
// ---------------------------------------------------------------------------
async function createContact(payload) {
  const res = await ghlRequest("POST", "/contacts/", payload);
  if (res.status !== 200 && res.status !== 201) {
    throw new Error(`Wibiz contact create failed (${res.status}): ${JSON.stringify(res.body)}`);
  }
  return res.body.contact;
}

// ---------------------------------------------------------------------------
// Update an existing Wibiz contact
// ---------------------------------------------------------------------------
async function updateContact(contactId, payload) {
  const { locationId: _removed, ...updatePayload } = payload;
  const res = await ghlRequest("PUT", `/contacts/${contactId}`, updatePayload);
  if (res.status !== 200) {
    throw new Error(`Wibiz contact update failed (${res.status}): ${JSON.stringify(res.body)}`);
  }
  return res.body.contact;
}

// ---------------------------------------------------------------------------
// Upsert a single Propfunded subscriber into Wibiz (used by bulk sync)
// ---------------------------------------------------------------------------
async function upsertSubscriber(subscriber) {
  const nameParts = (subscriber.full_name || subscriber.first_name || "").trim().split(/\s+/);
  const now = new Date().toISOString().split("T")[0];

  const customFields = [
    { id: FIELD_IDS.propfunded_subscriber_id, value: String(subscriber.subscriber_id) },
    { id: FIELD_IDS.propfunded_last_synced,   value: now },
  ];
  if (subscriber.status)          customFields.push({ id: FIELD_IDS.propfunded_status,          value: subscriber.status });
  if (subscriber.account_created) customFields.push({ id: FIELD_IDS.propfunded_account_created, value: subscriber.account_created.toString().split("T")[0] });
  if (subscriber.current_stage)   customFields.push({ id: FIELD_IDS.propfunded_current_stage,   value: subscriber.current_stage });
  if (subscriber.is_funded != null) customFields.push({ id: FIELD_IDS.propfunded_is_funded,     value: subscriber.is_funded ? "yes" : "no" });
  if (subscriber.balance   != null) customFields.push({ id: FIELD_IDS.propfunded_balance,       value: String(subscriber.balance) });
  if (subscriber.amount_spent != null) customFields.push({ id: FIELD_IDS.propfunded_amount_spent, value: String(subscriber.amount_spent) });

  const tags = [];
  if (subscriber.status)     tags.push(`status:${subscriber.status.toLowerCase()}`);
  if (subscriber.is_funded === true)  tags.push("funded:yes");
  if (subscriber.is_funded === false) tags.push("funded:no");

  const payload = {
    firstName:  nameParts[0] || "",
    lastName:   nameParts.slice(1).join(" ") || "",
    email:      subscriber.email,
    locationId: process.env.GHL_LOCATION_ID,
    customFields,
    tags,
  };

  const existing = await findContactByEmail(subscriber.email);
  if (existing) {
    await updateContact(existing.id, payload);
    return { action: "updated", contactId: existing.id };
  }
  const created = await createContact(payload);
  return { action: "created", contactId: created.id };
}

// ---------------------------------------------------------------------------
// Upsert a Propfunded subscriber from an event payload
// ---------------------------------------------------------------------------
async function upsertFromEvent(event, payload) {
  const contactPayload = buildContactFromEvent(event, payload);
  const existing = await findContactByEmail(payload.email);
  if (existing) {
    await updateContact(existing.id, contactPayload);
    return { action: "updated", contactId: existing.id };
  }
  const created = await createContact(contactPayload);
  return { action: "created", contactId: created.id };
}

module.exports = { upsertSubscriber, upsertFromEvent, EVENT_MAP };
