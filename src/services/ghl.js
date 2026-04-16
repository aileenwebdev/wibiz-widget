/**
 * GoHighLevel API v2 client.
 * Handles contact create / update and tag management for Propfunded subscribers.
 */

const https = require("https");

const GHL_BASE = "https://services.leadconnectorhq.com";
const GHL_VERSION = "2021-07-28";

// Custom field IDs created in the PropFunded AI GHL location (xLDiBULkjcNNk3isq7L4)
const FIELD_IDS = {
  propfunded_subscriber_id: "vDme5bN5feL0TEEN0CLy",
  propfunded_status:        "Obn3YeqDweq6egkvns9v",
  propfunded_account_created: "BfBouzZUpZJ4G5ttqFd5",
  propfunded_last_synced:   "73NvX05Rj1flTpfnGHhv",
};

// ---------------------------------------------------------------------------
// HTTP helper (avoids adding axios as a dependency)
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
        ...(payload ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) } : {}),
      },
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });

    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

// ---------------------------------------------------------------------------
// Build the GHL contact payload from a Propfunded subscriber record
// ---------------------------------------------------------------------------
function buildContactPayload(subscriber) {
  const nameParts = (subscriber.full_name || "").trim().split(/\s+/);
  const firstName = nameParts[0] || "";
  const lastName = nameParts.slice(1).join(" ") || "";

  const now = new Date().toISOString().split("T")[0]; // YYYY-MM-DD

  const customFields = [
    { id: FIELD_IDS.propfunded_subscriber_id, value: String(subscriber.subscriber_id) },
    { id: FIELD_IDS.propfunded_status,        value: subscriber.status || "" },
    { id: FIELD_IDS.propfunded_last_synced,   value: now },
  ];

  if (subscriber.account_created) {
    customFields.push({
      id: FIELD_IDS.propfunded_account_created,
      value: subscriber.account_created.toString().split("T")[0],
    });
  }

  // Tags: status-based (status:active, status:trial, status:suspended …)
  const tags = [];
  if (subscriber.status) tags.push(`status:${subscriber.status.toLowerCase()}`);

  return { firstName, lastName, email: subscriber.email, locationId: process.env.GHL_LOCATION_ID, customFields, tags };
}

// ---------------------------------------------------------------------------
// Find an existing GHL contact by email
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
// Create a new GHL contact
// ---------------------------------------------------------------------------
async function createContact(payload) {
  const res = await ghlRequest("POST", "/contacts/", payload);
  if (res.status !== 200 && res.status !== 201) {
    throw new Error(`GHL create failed (${res.status}): ${JSON.stringify(res.body)}`);
  }
  return res.body.contact;
}

// ---------------------------------------------------------------------------
// Update an existing GHL contact
// ---------------------------------------------------------------------------
async function updateContact(contactId, payload) {
  const res = await ghlRequest("PUT", `/contacts/${contactId}`, payload);
  if (res.status !== 200) {
    throw new Error(`GHL update failed (${res.status}): ${JSON.stringify(res.body)}`);
  }
  return res.body.contact;
}

// ---------------------------------------------------------------------------
// Upsert a single Propfunded subscriber into GHL
// Returns: { action: 'created'|'updated', contactId }
// ---------------------------------------------------------------------------
async function upsertSubscriber(subscriber) {
  const payload = buildContactPayload(subscriber);
  const existing = await findContactByEmail(subscriber.email);

  if (existing) {
    await updateContact(existing.id, payload);
    return { action: "updated", contactId: existing.id };
  } else {
    const created = await createContact(payload);
    return { action: "created", contactId: created.id };
  }
}

module.exports = { upsertSubscriber };
