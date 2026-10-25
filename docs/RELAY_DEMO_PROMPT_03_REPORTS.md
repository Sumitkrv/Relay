# RELAY DEMO PROMPT 3: PROFESSIONAL REPORTS & ANALYTICS

## 1. Module Overview
The Relay Reports Module (`/reports`) delivers an enterprise-grade reporting and aggregation suite scoped strictly to the authenticated tenant. It supports 5 major reporting tabs:
1. **Overview:** 4 Primary KPI cards, Secondary Operational Metrics, Campaign Status Distribution, Message Delivery Trend, Failure Breakdown, and Audience Snapshot Breakdown.
2. **Campaign Performance:** Paginated campaign execution history, audience snapshot sizes, eligible vs excluded recipients, and multi-campaign side-by-side comparison (2 to 4 campaigns).
3. **Simulated Messages:** Message lifecycle distribution, failure codes with actionable recommendations, retry attempts, and recipient-level logs.
4. **Consent & Suppression:** WhatsApp opt-in versus opt-out breakdown, unknown consent counts, and inbound keyword auto-reply executions.
5. **Exports:** Secure CSV and XLSX workbook downloads with formula injection sanitization.

## 2. Real Aggregation Services
- **Service File:** [`reportService.js`](file:///Users/sumitthakur/Desktop/Relay/backend/src/services/reportService.js)
- **Controller:** [`reportController.js`](file:///Users/sumitthakur/Desktop/Relay/backend/src/controllers/reportController.js)

### Supported Endpoints:
- `GET /api/reports/overview`: Aggregates campaigns, message lifecycle, retries, and opt-outs.
- `GET /api/reports/campaigns`: Campaign performance table with pagination and search.
- `GET /api/reports/campaigns/compare`: Multi-campaign comparison analytics.
- `GET /api/reports/messages/status`: Message status aggregations (Queued, Sent, Delivered, Read, Failed).
- `GET /api/reports/messages/failures`: Categorized failure codes and diagnostic advice.
- `GET /api/reports/messages/retries`: Automatic retry counts and recovered messages.
- `GET /api/reports/consent`: Verified opt-ins, opt-outs, and DNC suppression counts.
- `GET /api/reports/inbox`: Open conversations, needs attention, and rule execution list.
- `GET /api/reports/auto-replies`: Active auto-reply rule counts, execution counts, and keyword breakdown.
- `POST /api/reports/export`: Secure CSV / XLSX generation with formula injection escaping.

## 3. Date Boundaries & Timezone Policy
- **Configured Timezone:** `Asia/Kolkata` (canonical canonical representation for all 3 demo businesses).
- **Supported Ranges:** `today`, `yesterday`, `7d`, `30d`, `90d`, `this_month`, `previous_month`, `this_year`, `all`, and `custom` (`start` & `end` dates in `YYYY-MM-DD`).
- **Zoned Calculation:** Calculated in [`analyticsService.dateBounds`](file:///Users/sumitthakur/Desktop/Relay/backend/src/services/analyticsService.js) using native `Intl.DateTimeFormat` with offset adjustments to ensure exact date boundary filtering without browser-local time discrepancies.

## 4. Secure Export & Formula Injection Protection
Spreadsheet exports sanitize all cell content via `sanitizeSpreadsheetCell()`:
- Cells beginning with formula triggers (`=`, `+`, `-`, `@`, or leading tabs/newlines) are prefixed with a single quote (`'`), neutralizing CSV/Excel execution attacks while preserving valid phone numbers.
- File downloads are streamed directly to the authenticated client with strict tenant scoping.
