# RELAY SAAS 05 — LOGO UPLOAD & FILE SECURITY

## 1. Overview

Relay provides visual branding customization during business onboarding. Step 4 allows tenants to upload their business logo. Because untrusted file uploads are one of the most critical web application attack vectors, Relay implements defense-in-depth security spanning format whitelisting, file size limits, magic bytes signature inspection, filename sanitization, traversal defense, and safe serving headers.

---

## 2. Multi-Layer File Security Defense

```mermaid
flowchart TD
    A[Client Submits Multipart Form with Logo] --> B[Multer Middleware Filter]
    B --> C{File Size <= 2 MB?}
    C -- No --> D[Reject with 413 Payload Too Large]
    C -- Yes --> E{Extension in [.png, .jpg, .jpeg, .webp]?}
    E -- No --> F[Reject with 415 Unsupported Media Type]
    E -- Yes --> G[Disk Storage in Sandboxed Temp Dir]
    G --> H[Read First 12 Bytes of File Buffer]
    H --> I{Magic Bytes Signature Matches Genuine Image?}
    I -- No --> J[Unlink File & Reject with 400 Spoofed Image]
    I -- Yes --> K[Generate Random Cryptographic Filename]
    K --> L[Persist to Storage with 0644 Permissions]
    L --> M[Update Draft Branding in MongoDB]
    M --> N[Return 200 with Public Logo Reference URL]
```

---

## 3. Allowed Formats & Vector SVG Exclusion

- **Permitted**: `image/png` (`.png`), `image/jpeg` (`.jpg`, `.jpeg`), `image/webp` (`.webp`).
- **Prohibited**: Vector SVGs (`.svg`). SVGs are XML documents capable of executing arbitrary JavaScript via `<script>` tags, inline event handlers (`onload`, `onerror`), and external XML entity (XXE) expansion. Unsanitized SVGs are strictly forbidden.

---

## 4. Magic Bytes Binary Signature Verification

File extensions and HTTP `Content-Type` headers are user-controlled and trivially spoofed. Relay reads the authoritative magic bytes directly from disk:

```javascript
export function verifyImageMagicBytes(filePath) {
  const fd = fs.openSync(filePath, 'r');
  const buffer = Buffer.alloc(12);
  fs.readSync(fd, buffer, 0, 12, 0);
  fs.closeSync(fd);

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return 'image/png';
  }

  // JPEG / JPG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }

  // WEBP: RIFF....WEBP
  if (
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return 'image/webp';
  }

  return null;
}
```

If an attacker renames a malicious script or text payload to `logo.png`, `verifyImageMagicBytes` detects the mismatch, unlinks the temporary file immediately, and returns an HTTP `400` error:
`"File signature does not match a valid PNG, JPEG, or WEBP image. Upload rejected."`

---

## 5. Path Traversal & Filename Sanitization

1. **Storage Sandboxing**:
   Files are stored with cryptographically random identifiers:
   `logo-${userId}-${Date.now()}-${randomBytes}${ext}`.
2. **Path Traversal Defense in Logo Serving (`GET /api/onboarding/logo/:filename`)**:
   ```javascript
   const { filename } = req.params;
   if (!filename || filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
     return res.status(400).json({ code: 'INVALID_FILENAME', message: 'Invalid logo filename.' });
   }
   ```
   Attempts to pass `../../etc/passwd` or encoded `%2e%2e%2f` are trapped and rejected before disk access occurs.

---

## 6. Secure Image Delivery Headers

When logos are served to the browser:
- `X-Content-Type-Options: nosniff`: Prevents MIME-type sniffing attacks.
- `Cache-Control: public, max-age=86400`: Enables performant caching of immutable tenant assets.
- `Content-Disposition: inline`: Serves image directly without triggering arbitrary downloads.

---

## 7. Storage Lifecycle & Cleanup

- **Draft Replacement**: Uploading a replacement logo automatically unlinks the previous draft logo from disk.
- **Draft Deletion (`DELETE /api/onboarding/logo`)**: Removes the physical file from disk and clears `draft.branding.logoUrl`.
- **Provisioning Handoff**: On successful workspace creation, the draft logo reference is promoted to `businessProfile.logoUrl` and associated with the newly created tenant workspace.
