# Wibiz Webhook Spec — What to Send Us

## Endpoint
```
POST https://wibiz-widget-production.up.railway.app/api/propfunded/webhook
```

## Headers
```
Content-Type: application/json
X-Propfunded-Secret: fdc59d6bb359dd7e34b81e9d6218d28e056233df
```

## Payload

Send the full subscriber data in the `data` object — this way there's no
back-and-forth, we process it directly.

```json
{
  "event": "subscriber.updated",
  "data": {
    "subscriber_id": "abc123",
    "email": "jane@example.com",
    "full_name": "Jane Doe",
    "status": "active",
    "account_created": "2024-01-15",
    "current_stage": "Phase 2",
    "is_funded": false,
    "balance": 9800.00,
    "amount_spent": 299.00
  }
}
```

### `event` values
| Value | When to fire |
|---|---|
| `subscriber.created` | New subscriber signs up |
| `subscriber.updated` | Any field changes (status, stage, balance, funded, etc.) |

### `data` fields
| Field | Type | Required | Notes |
|---|---|---|---|
| `subscriber_id` | string | yes | Your primary key |
| `email` | string | yes | Used to match/create GHL contact |
| `full_name` | string | yes | |
| `status` | string | yes | e.g. `active`, `suspended`, `trial` |
| `account_created` | string | yes | ISO date — `YYYY-MM-DD` |
| `current_stage` | string | no | e.g. `Phase 1`, `Phase 2`, `Funded` |
| `is_funded` | boolean | no | `true` / `false` |
| `balance` | number | no | Current account balance |
| `amount_spent` | number | no | Total amount spent |

## Our response
We acknowledge immediately with HTTP 200 — the GHL sync runs in the background.
```json
{ "received": true, "subscriber_id": "abc123" }
```

## Initial sync of existing subscribers
For the ~6k existing subscribers, you can either:
- **Option A (easiest):** Fire the webhook above for each existing subscriber in
  a batch (no rate limit on our end for the initial load)
- **Option B:** Provide a paginated `GET /api/wibiz/subscribers?page=0&limit=100`
  endpoint and we'll pull them ourselves

Let us know which works better for you.
