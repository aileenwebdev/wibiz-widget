# Wibiz Integration — Setup for Propfunded

## What this adds
Two read-only endpoints on your existing Express app. No new service, no writes
to your database.

---

## Step 1 — Add to your `.env`
```
WIBIZ_API_KEY=<key we agree on — send via secure channel>
```

## Step 2 — Copy the route file
Put `wibizIntegration.js` in your `routes/` folder.

Then open it and check the lines marked `/* confirm: ... */` — there are 6 of
them. They're our best guess based on common naming conventions; just correct
any that don't match your schema.

| What we guessed | What to confirm |
|---|---|
| `users` | Your subscribers table name |
| `challenges` | Your challenges / evaluations table name |
| `payments` | Your payments / orders / transactions table name |
| `subscriber_id` | The foreign key column in challenges pointing to the subscriber |
| `subscriber_id` | The foreign key column in payments pointing to the subscriber |
| `../db` | The path to your pg Pool export |

## Step 3 — Mount the route in your app
In `app.js` or `server.js`:
```js
const wibiz = require('./routes/wibizIntegration');
app.use('/api/wibiz', wibiz);
```

## Step 4 — Share with Wibiz
- Your dev server base URL (e.g. `https://dev.propfunded.ai`)
- The agreed API key via secure channel

---

## Endpoints Wibiz will call

### Single subscriber (chatbot, real-time)
```
GET /api/wibiz/subscriber/:id
Authorization: Bearer <WIBIZ_API_KEY>
```

### All subscribers, paginated (background sync every 15 min)
```
GET /api/wibiz/subscribers?page=0&limit=100
Authorization: Bearer <WIBIZ_API_KEY>
```

### Expected response shape
```json
{
  "subscriber_id": "abc123",
  "full_name": "Jane Doe",
  "status": "active",
  "account_created": "2024-01-15",
  "current_stage": "Phase 2",
  "is_funded": false,
  "balance": 9800.00,
  "amount_spent": 299.00
}
```

---

## Optional — real-time webhook
If you want changes to reflect in Wibiz immediately (instead of waiting up to
15 min), fire a POST to us when a subscriber's data changes:

```
POST https://wibiz-widget-production.up.railway.app/api/propfunded/webhook
Content-Type: application/json
X-Propfunded-Secret: <secret Wibiz will share with you>

{
  "event": "subscriber.updated",
  "subscriber_id": "abc123"
}
```
