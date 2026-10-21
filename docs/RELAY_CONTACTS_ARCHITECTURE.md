# Relay — Real Estate WhatsApp Automation: Contacts & Audience Architecture

**Document Version:** 1.0.0 (Prompt 3 Implementation)  
**System:** Relay Single-Operator CRM & Audience Management Engine  
**Brand:** M2W Realty Single Operator  
**Design System:** Midnight Slate × Jade  
**Author:** Principal Full-Stack MERN Architect & Enterprise CRM Engineer  

---

## 1. Executive Summary & Operational Scope

The **Contacts and Audience Management System** is the foundational registry for Relay, engineered exclusively for **ONE real estate business owner** operating a single WhatsApp Business number under the **M2W Realty** brand.

The system replaces generic SaaS contact address books with a specialized real estate data model, smart multi-step Excel/CSV import engine, static contact groups, tag taxonomy, structured dynamic segmentation engine, auditable consent records, and hard suppression management.

```
+---------------------------------------------------------------------------------------------------+
|                                  RELAY CONTACTS WORKSPACE                                         |
+---------------------------------------------------------------------------------------------------+
| TAB 1: ALL CONTACTS       | TAB 2: CONTACT GROUPS | TAB 3: SAVED AUDIENCES | TAB 4: IMPORT HISTORY |
+---------------------------------------------------------------------------------------------------+
| 4 COMPACT METRIC CARDS                                                                            |
| [ Total Contacts ]     [ Verified Opted-In ]     [ Opted Out ]            [ Consent Unknown ]     |
| (Excludes soft-deleted) (Affirmative evidence)   (Broadcast suppressed)   (Default zero-policy)   |
+---------------------------------------------------------------------------------------------------+
| WORKSPACE SEARCH & MULTI-PARAMETRIC FILTER DRAWER                                                 |
| Search: Name, Phone, City, Project, Tags | Filters: Property Type, City, Project, Budget, Consent |
+---------------------------------------------------------------------------------------------------+
| CONTACTS REGISTRY TABLE (Interactive Row -> Contact Detail Profile Drawer)                         |
| Real Estate Columns: Contact, WhatsApp Phone, City/Location, Property Interest, Project, Status   |
+---------------------------------------------------------------------------------------------------+
| BULK ACTIONS & EXPORTS                                                                            |
| Bulk Tags | Bulk Groups | Bulk Suppress | Formula-Neutralized CSV/XLSX Exports                    |
+---------------------------------------------------------------------------------------------------+
```

---

## 2. Contact Data Model

The `Contact` model (`backend/src/models/Contact.js`) operates under Mongoose `strict: 'throw'` and schema-level validation to prevent untyped or corrupted data injection.

### Schema Fields Reference

| Category | Field Name | Type | Constraints / Defaults | Description |
| :--- | :--- | :--- | :--- | :--- |
| **Identity** | `ownerId` | `ObjectId` | Ref: `User`, Required, Indexed | Single-operator tenant isolation key. |
| | `fullName` | `String` | Required, Trim, Max 120 | Primary buyer / prospect name. |
| | `phoneNumber` | `String` | Required, Normalized E.164 | Stored normalized format (e.g. `+919810123456`). |
| | `rawPhoneNumber` | `String` | Optional, Trim | Raw unformatted string as typed/imported. |
| | `countryCode` | `String` | Default: `'IN'`, Max 4 | ISO 2-letter country code or prefix. |
| | `alternatePhone` | `String` | Optional, Trim | Secondary telephone or landline. |
| | `email` | `String` | Optional, Lowercase, Regex | Validated RFC email address. |
| **Real Estate** | `city` | `String` | Required, Trim, Indexed | Target property market (e.g. Gurugram, Delhi). |
| | `state` | `String` | Optional, Trim | State / Province / Territory (e.g. Haryana). |
| | `country` | `String` | Default: `'India'`, Trim | Country of enquiry. |
| | `interestedPropertyType`| `String` | Enum, Indexed | `Residential Plots`, `Apartments`, `Farmhouses`, `Villas`, `Commercial Property`, `Residential Houses`, `Land`, `Other`. |
| | `customPropertyType` | `String` | Optional, Max 100 | Specific custom type when type is `'Other'`. |
| | `preferredLocation` | `String` | Optional, Trim | Micro-market (e.g. Golf Course Extension Road). |
| | `interestedProject` | `String` | Optional, Trim | Real estate community or project name. |
| | `budgetRange` | `String` | Optional, Trim | Formatted budget span (e.g. `₹4 Cr - ₹7 Cr`). |
| | `estimatedDealValue`| `Number` | Min 0, Optional | Numeric value for pipeline forecasting. |
| | `currency` | `String` | Default: `'INR'`, Enum | `INR`, `USD`, `AED`, `EUR`, `GBP`. |
| **Organization** | `tags` | `[String]` | Lowercase, Indexed, Max 50 | Taxonomic classification labels. |
| | `groups` | `[ObjectId]` | Ref: `ContactGroup`, Indexed | Static list membership references. |
| | `leadSource` | `String` | Enum | `Website Enquiry`, `Property Portal`, `Referral`, `Walk-in / Site Visit`, `Exhibition / Event`, `Social Media Ad`, `Cold Call / Outreach`, `WhatsApp Inbound`, `CSV / Excel Import`, `Other`. |
| | `leadStatus` | `String` | Enum | `New`, `Contacted`, `Site Visit Scheduled`, `Site Visit Completed`, `Negotiation`, `Closed Won`, `Closed Lost`, `Inactive`. |
| | `priority` | `String` | Enum, Default: `'Medium'` | `Urgent`, `High`, `Medium`, `Low`. |
| | `notes` | `String` | Max 10000, Trim | Internal operator CRM notes. |
| **WhatsApp Compliance** | `whatsappConsentStatus` | `String` | Enum, Default: `'UNKNOWN'` | `'OPTED_IN'`, `'OPTED_OUT'`, `'UNKNOWN'`, `'REVOKED'`, `'SUPPRESSED'`. |
| | `isSuppressed` | `Boolean` | Default: `false`, Indexed | Hard broadcast exclusion flag. |
| | `suppressionReason` | `String` | Optional, Trim | `'Operator Do Not Contact'`, `'Customer STOP command'`, etc. |
| | `suppressedAt` | `Date` | Optional | Timestamp when suppression was applied. |
| | `lastContactedAt` | `Date` | Optional | Timestamp of last outbound broadcast. |
| | `lastInboundAt` | `Date` | Optional | Timestamp of last verified inbound message. |
| **Lifecycle & Audit**| `isArchived` | `Boolean` | Default: `false`, Indexed | Soft-archive flag. |
| | `archivedAt` | `Date` | Optional | Timestamp when archived. |
| | `isDemo` | `Boolean` | Default: `false`, Indexed | Synthetic test dataset isolation flag. |
| | `demoDatasetId` | `String` | Optional | Fixture bundle tracker. |

---

## 3. Phone Normalization Strategy

Telephone number parsing is executed via `libphonenumber-js` with strict fallback sanitization.

1. **Country Priority**: Default country is India (`IN`, country code `+91`) unless an international `+` prefix is detected.
2. **E.164 Standard**:
   - Strips spaces, hyphens, brackets, and leading zero trunk prefixes (`098101...` -> `+9198101...`).
   - If input starts with `91` without `+` and is 12 digits, it is normalized to `+91...`.
   - If input is 10 digits, it is treated as local national format and normalized to `+91...`.
   - International numbers starting with `+` preserve their genuine international country code (e.g., `+1`, `+971`, `+44`).
3. **Invalid Rejection**: Values failing parsing or with invalid digit lengths (< 8 or > 15 digits) are rejected with human-readable error messages.

---

## 4. Smart Excel/CSV Import Engine

The import system operates inside the Contacts module and processes `.xlsx` and `.csv` files up to 10 MB.

### Processing Pipeline

```
  [ Upload File ]
         │
         ▼
  [ Sheet Detection ] (Auto-selects active worksheet)
         │
         ▼
  [ Header Recognition ] (Fuzzy matches real estate synonyms)
         │
         ▼
  [ Column Mapping ] (Allows Manual Overrides & Reusable Presets)
         │
         ▼
  [ Validation & Deduplication ] (Checks in-file & MongoDB duplicates)
         │
         ▼
  [ Batch Execution ] (Bounded chunked bulk writes)
         │
         ▼
  [ Results & Error CSV ] (Downloadable error rows with formula protection)
```

### Smart Header Aliases

| Canonical CRM Field | Recognized Spreadsheet Header Variations |
| :--- | :--- |
| `fullName` | Name, Full Name, Contact Name, Customer Name, Buyer Name, Client Name, Lead Name |
| `phoneNumber` | Phone, WhatsApp, WhatsApp Number, Mobile, Mobile Number, Contact Number, Phone Number |
| `city` | City, Location, Customer City, Market |
| `interestedPropertyType` | Property Type, Interested Property, Property Interest, Looking For, Requirement |
| `interestedProject` | Project, Project Name, Interested Project, Society, Township |
| `budgetRange` | Budget, Budget Range, Expected Budget, Price Range |
| `email` | Email, Email ID, Email Address |
| `leadSource` | Lead Source, Enquiry Source, Source, Origin |
| `tags` | Tags, Keywords, Categories, Labels |

### Duplicate Prevention Modes

- **`skip` (Default)**: If a normalized phone already exists in the owner's database, the row is skipped and counted as `skippedCount`.
- **`update`**: If existing, updates only safe selected CRM fields (property interest, budget, notes). **Never overwrites consent, opt-out status, historical messages, or audit records.**
- **`ignore`**: Drops duplicate rows silently without halting batch execution.

---

## 5. Contact Groups vs Dynamic Segments

Relay clearly differentiates between **Static Groups** and **Dynamic Segments**:

| Attribute | Static Contact Group (`ContactGroup`) | Dynamic Segment (`Segment`) |
| :--- | :--- | :--- |
| **Nature** | Fixed list membership stored as `ObjectId` refs in `contact.groups`. | Dynamic rule evaluation at query execution time. |
| **Membership** | Added or removed manually by the operator or bulk actions. | Changes automatically as contact records are created or updated. |
| **Deletion Impact** | Deleting a group **never** deletes contacts (safely pulls references). | Deleting a segment deletes only the filter rule. |
| **Use in Campaigns** | Supported directly via `group` audience mode. | Supported via `segment` rule-evaluated audience mode. |

### Dynamic Segment Condition Engine

Conditions use allowlisted fields and operators to prevent arbitrary NoSQL injection:

- **Allowed Fields**: `city`, `interestedPropertyType`, `interestedProject`, `budgetRange`, `leadSource`, `leadStatus`, `priority`, `tags`, `whatsappConsentStatus`, `isSuppressed`, `isDemo`, `createdAt`.
- **Allowed Operators**:
  - `equals`: Exact string match.
  - `notEquals`: Non-matching value.
  - `contains`: Substring match via escaped regex.
  - `inList`: In comma-separated list.
  - `isEmpty` / `isNotEmpty`: Checks field existence and nullness.
  - `greaterThan` / `lessThan`: Numeric comparison for deal values or dates.
- **Conjunctions**: `AND` (`$and`) or `OR` (`$or`).

---

## 6. WhatsApp Consent Zero-Policy Management

Relay enforces a **zero-trust messaging compliance standard**:

1. **Default State is UNKNOWN**: Every newly created or imported contact begins with `whatsappConsentStatus: 'UNKNOWN'`.
2. **Spreadsheet Claims are Ignored**: An Excel column marked `"Yes"` or `"Opted In"` is **never** accepted as verified permission.
3. **Affirmative Consent Requirements**: A contact only transitions to `OPTED_IN` through an auditable `ConsentRecord` event requiring:
   - `consentPurpose` (e.g. Property brochures and updates)
   - `consentChannel` (e.g. Web form, WhatsApp inbound message, Signed agreement)
   - `consentSource` (Specific origin)
   - `consentCapturedAt` (Genuine capture timestamp)
   - `evidenceReference` (Audit ID or document reference)
4. **Hard Suppression (Do Not Contact)**:
   - Contacts marked as `isSuppressed: true` are excluded from all campaign dispatches and broadcasts.
   - Suppression status is preserved permanently and **never** overwritten by subsequent Excel imports or tag updates.
5. **Demo Fixture Isolation**:
   - All demo fixtures (`isDemo: true`) have `whatsappConsentStatus: 'UNKNOWN'` and `eligibleWhatsAppContacts: 0`.

---

## 7. Spreadsheet Formula Injection Protection

All CSV and Excel exports run through the `safeCell` sanitizer (`backend/src/utils/exportSanitizer.js`):
- Any cell value beginning with `=`, `+`, `-`, `@`, `\t`, or `\r` is automatically prefixed with a single quote (`'`).
- Prevents remote command execution or DDE exploits in Microsoft Excel, LibreOffice, and Google Sheets.

---

## 8. Dashboard KPI Synchronization

Contact management actions update the four primary KPI cards on the Overview dashboard:

| Dashboard Card | Backend Query | Truthfulness Rule |
| :--- | :--- | :--- |
| **Total Contacts** | `Contact.countDocuments({ ownerId, isDeleted: false, isArchived: false })` | Counts only active property records. |
| **Verified Opted-In** | Aggregation on `ConsentRecord` + `Contact` | Strictly requires affirmative consent evidence. |
| **Opted Out** | `Contact.countDocuments({ ownerId, $or: [{ whatsappConsentStatus: 'OPTED_OUT' }, { isSuppressed: true }] })` | Counts suppressed recipients. |
| **Consent Unknown** | `Contact.countDocuments({ ownerId, whatsappConsentStatus: 'UNKNOWN' })` | Standard zero-policy default. |

---

## 9. Verification & Automated Test Matrix

The Contacts module is verified with **52 backend unit tests**, **21 frontend unit tests**, and full browser execution:

| Test Suite | File | Tests | Status |
| :--- | :--- | :--- | :--- |
| Contact CRUD & E.164 Normalization | `backend/test/prompt3Contacts.test.js` | 1 | **PASS** |
| Duplicate Phone Scoped Validation | `backend/test/prompt3Contacts.test.js` | 1 | **PASS** |
| Contact Groups CRUD & Detachment | `backend/test/prompt3Contacts.test.js` | 1 | **PASS** |
| Tag Taxonomy Management | `backend/test/prompt3Contacts.test.js` | 1 | **PASS** |
| Dynamic Segment Condition Engine | `backend/test/prompt3Contacts.test.js` | 1 | **PASS** |
| WhatsApp Consent Zero-Policy | `backend/test/prompt3Contacts.test.js` | 1 | **PASS** |
| Safe CSV Formula Neutralization | `backend/test/prompt3Contacts.test.js` | 1 | **PASS** |
| Bulk Operations & Suppression | `backend/test/prompt3Contacts.test.js` | 1 | **PASS** |
| All Backend Regressions & Core Suites | `backend/test/*.test.js` | 44 | **PASS** |
| Navigation, Layout & Scope | `frontend/test/navigationScope.test.js` | 5 | **PASS** |
| Design Tokens & Shared Components | `frontend/test/prompt05DesignSystem.test.js` | 6 | **PASS** |
| Settings & Single-Owner Auth | `frontend/test/prompt1SettingsNav.test.js` | 4 | **PASS** |
| Template Import Regression | `frontend/test/templateImportRegression.test.js` | 2 | **PASS** |
| Prompt 3 Contacts, Groups, Import & Campaigns | `frontend/test/prompt3Contacts.test.js` | 4 | **PASS** |
| Full End-to-End Browser Journey | `contacts_journey_demo.webp` | 12 Steps | **PASS** |

---

## 10. Known Operational Limitations

1. **Meta WhatsApp Cloud API**: Real message transmission is deliberately offline in accordance with Prompt 3 constraints. All broadcast simulations operate under mock mode.
2. **File Size Limit**: Excel/CSV files are bounded to 10 MB per upload batch to prevent Node.js memory exhaustion.
3. **Segment Nesting**: Dynamic segments support bounded conjunctions (`ALL / AND` or `ANY / OR`) up to 10 conditions per segment to maintain database index utilization.
