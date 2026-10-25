# SaaS 10 — Plan Configuration & Catalog

## 1. Centralized Plan Definitions
All plan pricing, usage quotas, and billing intervals are stored authoritatively in the backend via `backend/src/services/planCatalogService.js` and persisted in the `plans` MongoDB collection.

The browser is never trusted for pricing or quotas.

---

## 2. Standard Plans

### Plan A: Free Exploration (`free_exploration`)
- **Type**: Introductory Mock Mode Sandbox Trial
- **Price**: ₹0 (0 minor units / paise)
- **Duration**: 14 Days
- **Currency**: INR
- **Payment Card Required**: No
- **Included Features**:
  - Full access to all 7 Relay dashboard modules
  - Offline Mock WhatsApp Simulator & 7-step onboarding journey
  - Inbound Simulation & keyword auto-replies
  - Up to 100 sample contacts & audience segmentation
  - Up to 5 mock campaigns per month
  - Up to 500 simulated messages
  - Up to 5 custom templates
  - Zero real WhatsApp messages to real phone numbers

### Plan B: Relay Solo (`relay_solo`)
- **Type**: Single-Operator Paid Subscription
- **Introductory Price**: ₹799 / month (79900 paise)
- **Standard Reference Price**: ₹999 / month
- **Billing Frequency**: Monthly recurring (12 cycles default)
- **Currency**: INR
- **Limits**:
  - 1 Dedicated Business Workspace
  - 1 Primary Business Owner Account
  - 1 Connected WhatsApp Sender Number
  - Up to 10,000 Contacts & Groups
  - Up to 100 Campaigns per Month
  - Up to 50,000 Messages per Month
  - Up to 50 Saved Templates
  - Up to 25 Active Keyword Automation Rules
  - 500 MB Media Storage

---

## 3. Financial Minor Units
All financial values are stored and transmitted in minor currency units (paise for INR):
- `₹799.00` = `79900`
- `₹0.00` = `0`
No floating point arithmetic is used in money calculations.

---

## 4. Tax Treatment
- **Current Mode**: `exclusive`
- Applicable GST is calculated according to verified merchant tax registration settings.
- Relay Solo price of ₹799 is displayed transparently with disclaimers indicating whether taxes apply.
