# RELAY SAAS — PHASE 11: SYSTEM & WORKER OBSERVABILITY

## 1. System Telemetry Architecture

Platform System Health (`/platform-admin/system-health`) monitors real infrastructure performance:

```
+---------------------------------------------------------------------------------+
|                         SYSTEM & WORKER OBSERVABILITY                           |
+---------------------------------------------------------------------------------+
|                                                                                 |
|   1. MongoDB Health:                                                            |
|      • Connection State: readyState === 1 (CONNECTED)                           |
|      • Registered Collections: Workspaces, Subscriptions, Payments, Audit Logs   |
|                                                                                 |
|   2. Durable MongoDB Queue Telemetry:                                           |
|      • Queued Jobs: Real-time count of pending messages waiting for dispatch    |
|      • In-Flight Processing: Count of claimed message leases                     |
|      • Simulated Sent: Verified progression to delivered/read states            |
|      • Failures & Blocked: Rate of suppressed, opted-out, or failed dispatches   |
|                                                                                 |
|   3. Background Worker Daemon:                                                  |
|      • Process ID: msg-worker-<pid>                                             |
|      • Execution Heartbeat: Active timestamp updated on every tick              |
|      • Provider Mode: MOCK (Fail-closed simulated execution)                    |
|      • Lease Recovery: Automatic reconciliation of stale leases                 |
|                                                                                 |
|   4. Fail-Closed Safety State:                                                  |
|      • Meta Cloud API Live Dispatch: DISABLED (LOCKED)                          |
|      • Mock Guard Active: TRUE                                                  |
|                                                                                 |
+---------------------------------------------------------------------------------+
```

---

## 2. API Endpoints

- `GET /api/platform-admin/system-health`
  Returns aggregated database connection state, message queue counts, worker daemon heartbeat, and security policy lock states.
- `GET /api/platform-admin/workers`
  Returns active worker process IDs, workload depth, in-flight job depth, and recent queue error categories without exposing sensitive recipient phone numbers or message bodies.
