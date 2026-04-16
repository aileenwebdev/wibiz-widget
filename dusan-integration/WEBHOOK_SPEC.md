# Wibiz Webhook Spec

## Endpoint
```
POST https://wibiz-widget-production.up.railway.app/api/propfunded/webhook
```

## Headers
```
Content-Type: application/json
X-Propfunded-Secret: fdc59d6bb359dd7e34b81e9d6218d28e056233df
```

---

## Supported events

Send your existing event payloads as-is — no changes to your format needed.

### user.welcome
```json
{ "event": "user.welcome", "subscriber_id": "user_id", "email": "string", "first_name": "string" }
```

### user.password_reset_requested
```json
{ "event": "user.password_reset_requested", "subscriber_id": "user_id", "email": "string", "first_name": "string", "reset_link": "string" }
```

### purchase.confirmed
```json
{ "event": "purchase.confirmed", "subscriber_id": "user_id", "email": "string", "first_name": "string", "challenge_name": "string", "amount": "number", "currency": "string", "tx_hash": "string" }
```

### challenge.free_granted
```json
{ "event": "challenge.free_granted", "subscriber_id": "user_id", "email": "string", "first_name": "string", "challenge_name": "string", "reason": "string" }
```

### challenge.phase1.completed
```json
{ "event": "challenge.phase1.completed", "subscriber_id": "user_id", "email": "string", "first_name": "string", "challenge_name": "string", "account_number": "string", "profit": "number", "equity": "number" }
```

### challenge.phase2.completed
```json
{ "event": "challenge.phase2.completed", "subscriber_id": "user_id", "email": "string", "first_name": "string", "challenge_name": "string", "account_number": "string", "profit": "number", "equity": "number" }
```

### challenge.phase1.failed
```json
{ "event": "challenge.phase1.failed", "subscriber_id": "user_id", "email": "string", "first_name": "string", "challenge_name": "string", "account_number": "string", "reason": "string" }
```

### challenge.phase2.failed
```json
{ "event": "challenge.phase2.failed", "subscriber_id": "user_id", "email": "string", "first_name": "string", "challenge_name": "string", "account_number": "string", "reason": "string" }
```

### challenge.phase3.failed
```json
{ "event": "challenge.phase3.failed", "subscriber_id": "user_id", "email": "string", "first_name": "string", "challenge_name": "string", "account_number": "string", "reason": "string" }
```

### withdrawal.approved
```json
{ "event": "withdrawal.approved", "subscriber_id": "user_id", "email": "string", "first_name": "string", "amount": "number", "currency": "string" }
```

### withdrawal.rejected
```json
{ "event": "withdrawal.rejected", "subscriber_id": "user_id", "email": "string", "first_name": "string", "amount": "number", "currency": "string", "reason": "string" }
```

### withdrawal.completed
```json
{ "event": "withdrawal.completed", "subscriber_id": "user_id", "email": "string", "first_name": "string", "amount": "number", "currency": "string", "tx_hash": "string" }
```

---

## Response
We always respond immediately with HTTP 200. The sync runs in the background.
```json
{ "received": true, "event": "challenge.phase1.completed", "subscriber_id": "abc123" }
```

---

## What happens on our end per event

| Event | Wibiz stage set | Tags added |
|---|---|---|
| user.welcome | Registered | status:active, stage:registered |
| purchase.confirmed | Phase 1 | stage:phase1, purchase:confirmed |
| challenge.free_granted | Phase 1 | stage:phase1, challenge:free_granted |
| challenge.phase1.completed | Phase 2 | stage:phase2, phase1:passed |
| challenge.phase2.completed | Funded | stage:funded, phase2:passed, funded:yes |
| challenge.phase1.failed | Phase 1 Failed | phase1:failed |
| challenge.phase2.failed | Phase 2 Failed | phase2:failed |
| challenge.phase3.failed | Phase 3 Failed | phase3:failed |
| withdrawal.approved | — | withdrawal:approved |
| withdrawal.rejected | — | withdrawal:rejected |
| withdrawal.completed | — | withdrawal:completed |
| user.password_reset_requested | — | — |
