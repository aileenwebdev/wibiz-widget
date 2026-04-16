# Wibiz Integration — Setup Instructions for Propfunded

## What this does
Adds two read-only API endpoints to your existing Express app so Wibiz can sync
your subscriber data into their marketing and chatbot systems.

- No new service to deploy
- No writes to your database — read-only queries only
- Two endpoints, one route file, two .env lines

---

## Step 1 — Add to your .env

```
WIBIZ_API_KEY=<the key you agreed with Wibiz — keep this secret>
```

---

## Step 2 — Fill in your column names

Open `wibizIntegration.js` and replace every `<TODO: ...>` with your actual
table and column names.

The TODO markers follow this pattern:
- `<TODO: subscribers table>` → e.g. `users`
- `<TODO: email column>` → e.g. `email_address`
- `<TODO: challenges table>` → e.g. `evaluations`
- etc.

---

## Step 3 — Mount the route

In your main `app.js` or `server.js`, add these two lines:

```js
const wibiz = require('./routes/wibizIntegration');
app.use('/api/wibiz', wibiz);
```

---

## Step 4 — Share with Wibiz

Send Wibiz:
1. Your **dev server base URL** (e.g. `https://dev.propfunded.ai`)
2. The **agreed API key** via a secure channel (not email)

---

## Endpoints Wibiz will call

### Single subscriber (called by chatbot mid-conversation)
```
GET /api/wibiz/subscriber/:id
Authorization: Bearer <WIBIZ_API_KEY>
```

### All subscribers, paginated (called by sync job every 15 min)
```
GET /api/wibiz/subscribers?page=0&limit=100
Authorization: Bearer <WIBIZ_API_KEY>
```

---

## Webhook (optional but recommended)

If you want changes to appear in Wibiz instantly (rather than waiting up to
15 minutes for the next sync), fire a POST to Wibiz when a subscriber's data
changes:

```
POST https://wibiz-widget-production.up.railway.app/api/propfunded/webhook
Content-Type: application/json
X-Propfunded-Secret: <secret Wibiz will share with you>

{
  "event": "subscriber.updated",
  "subscriber_id": "12345"
}
```

Supported event values: `subscriber.created`, `subscriber.updated`

Wibiz will acknowledge with `{ "received": true }` immediately.
You don't need to wait for the sync to finish.
