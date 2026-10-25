# RELAY SAAS — SAAS 06: INDUSTRY CONFIGURATION VERSIONING

## 1. Version Semantics & Lifecycle

Every industry definition ships with a defined configuration version:

```javascript
export default {
  key: 'real_estate',
  name: 'Real Estate',
  configVersion: '1.0.0',
  // ...
}
```

The active versions across all 7 verticals are:
- `real_estate`: `1.0.0`
- `gym`: `1.0.0`
- `clinic`: `1.0.0`
- `education`: `1.0.0`
- `salon`: `1.0.0`
- `automobile`: `1.0.0`
- `other`: `1.0.0`

---

## 2. Version Evolution Rules

1. **New Optional Fields (Minor Update e.g., 1.1.0)**:
   - Appended to `contactFields` array with `required: false`.
   - Existing contact records without this field evaluate to `defaultValue` (or `null`) when hydrated.
   - Zero migration scripts required.

2. **Renamed Display Labels (Patch Update e.g., 1.0.1)**:
   - Modifies `label`, `placeholder`, or `helpText` in registry definition.
   - Field `key` remains immutable.
   - UI reflects the updated label instantly without modifying stored contact documents.

3. **Field Deprecation**:
   - Fields marked with `deprecated: true` are hidden from `showInForm: false`.
   - Contact detail drawers and export services continue reading historical values preserved in `industryData`.
   - Never deletes data from MongoDB.

4. **Removed Select Options**:
   - Removed options are retained in historical contact documents.
   - The validation engine only enforces active options on newly submitted or edited contacts.

---

## 3. Workspace Industry Mutation Policy (Section 42)

Changing a business's industry key after contacts exist is a significant data reinterpretation:

1. **Empty Workspaces (0 Contacts)**:
   - Permitted to update `industryKey` with valid validation via administrative or onboarding APIs.
2. **Workspaces with Existing Contacts**:
   - Blocked by default.
   - Future data migration tools (scheduled for post-Prompt 7) will provide mapped conversions.
   - Historical fields are never silently deleted or overwritten.
