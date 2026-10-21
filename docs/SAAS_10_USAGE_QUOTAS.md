# SaaS 10 — Usage Quotas & Atomic Enforcement

## 1. Overview
Relay tracks and enforces monthly resource consumption using server-side ledger documents in the `usagecounters` collection. Usage counters are indexed by `{ workspaceId: 1, periodKey: 1 }` (e.g. `2026-10`).

---

## 2. Tracked Categories & Plan Limits
| Category | Free Exploration (14-Day Trial) | Relay Solo (₹799/mo) |
|---|---|---|
| Contacts Stored | 100 | 10,000 |
| Campaigns Executed | 5 | 100 |
| Simulated Messages | 500 | 50,000 |
| Saved Templates | 5 | 50 |
| Active Automation Rules | 3 | 25 |
| Media Storage | 50 MB | 500 MB |

---

## 3. Atomic Increments & Concurrency Safety
Usage increments use MongoDB `$inc` operations in `usageQuotaService.js`:
```javascript
const updated = await UsageCounter.findOneAndUpdate(
  { workspaceId, periodKey },
  { $inc: { [field]: incrementBy } },
  { upsert: true, new: true }
);
```
This guarantees concurrency safety under rapid parallel simulation or batch campaign launches.

---

## 4. Quota Exceeded Behavior
- When a resource limit is exceeded (e.g., trying to import 12,000 contacts on Relay Solo), the operation is rejected with HTTP 403 `QUOTA_EXCEEDED` and a clear explanation.
- **Historical Data Safety**: Exceeding a quota never deletes or alters pre-existing customer records.
- Counters automatically roll over to a fresh ledger at each monthly period boundary (`periodKey`).
