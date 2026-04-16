/**
 * Propfunded → GHL sync service.
 *
 * Two modes:
 *   fullSync()   – pages through ALL subscribers from Propfunded's bulk endpoint
 *                  and upserts each one into GHL. Run once at startup and on demand.
 *   syncOne(id)  – fetches a single subscriber by ID and upserts into GHL.
 *                  Called from the webhook receiver when Propfunded sends a change event.
 */

const https = require("https");
const { upsertSubscriber } = require("./ghl");

const PAGE_SIZE = 100;
const BATCH_CONCURRENCY = 5; // upsert N contacts in parallel at a time

// ---------------------------------------------------------------------------
// HTTP helper — calls Propfunded's API
// ---------------------------------------------------------------------------
function propfundedRequest(path) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, process.env.PROPFUNDED_API_URL);
    const mod = url.protocol === "https:" ? https : require("http");

    const options = {
      hostname: url.hostname,
      port: url.port || (url.protocol === "https:" ? 443 : 80),
      path: url.pathname + url.search,
      method: "GET",
      headers: {
        Authorization: `Bearer ${process.env.PROPFUNDED_API_KEY}`,
        Accept: "application/json",
      },
    };

    const req = mod.request(options, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });

    req.on("error", reject);
    req.end();
  });
}

// ---------------------------------------------------------------------------
// Process a batch of subscribers in parallel (capped at BATCH_CONCURRENCY)
// ---------------------------------------------------------------------------
async function processBatch(subscribers) {
  const results = { created: 0, updated: 0, errors: 0 };

  // Chunk into groups of BATCH_CONCURRENCY
  for (let i = 0; i < subscribers.length; i += BATCH_CONCURRENCY) {
    const chunk = subscribers.slice(i, i + BATCH_CONCURRENCY);
    await Promise.all(
      chunk.map(async (sub) => {
        try {
          const { action } = await upsertSubscriber(sub);
          results[action]++;
        } catch (err) {
          results.errors++;
          console.error(`[sync] failed for ${sub.subscriber_id}: ${err.message}`);
        }
      })
    );
  }
  return results;
}

// ---------------------------------------------------------------------------
// Full bulk sync — pages through all subscribers
// ---------------------------------------------------------------------------
async function fullSync() {
  console.log("[sync] Starting full Propfunded → GHL sync…");
  const totals = { created: 0, updated: 0, errors: 0, pages: 0 };
  let page = 0;
  let hasMore = true;

  while (hasMore) {
    const res = await propfundedRequest(
      `/api/wibiz/subscribers?page=${page}&limit=${PAGE_SIZE}`
    );

    if (res.status !== 200) {
      console.error(`[sync] Propfunded API error on page ${page}: ${res.status}`);
      break;
    }

    const { data, total } = res.body;
    if (!data || data.length === 0) break;

    const batch = await processBatch(data);
    totals.created += batch.created;
    totals.updated += batch.updated;
    totals.errors  += batch.errors;
    totals.pages++;

    console.log(
      `[sync] Page ${page}: +${batch.created} created, ~${batch.updated} updated, ${batch.errors} errors`
    );

    page++;
    hasMore = page * PAGE_SIZE < total;
  }

  console.log(
    `[sync] Full sync done — ${totals.created} created, ${totals.updated} updated, ${totals.errors} errors across ${totals.pages} pages`
  );
  return totals;
}

// ---------------------------------------------------------------------------
// Single subscriber sync — used by the webhook receiver
// ---------------------------------------------------------------------------
async function syncOne(subscriberId) {
  const res = await propfundedRequest(`/api/wibiz/subscriber/${subscriberId}`);

  if (res.status === 404) {
    console.warn(`[sync] Subscriber ${subscriberId} not found on Propfunded API`);
    return null;
  }
  if (res.status !== 200) {
    throw new Error(`Propfunded API returned ${res.status} for subscriber ${subscriberId}`);
  }

  const result = await upsertSubscriber(res.body);
  console.log(`[sync] ${result.action} GHL contact ${result.contactId} for subscriber ${subscriberId}`);
  return result;
}

module.exports = { fullSync, syncOne };
