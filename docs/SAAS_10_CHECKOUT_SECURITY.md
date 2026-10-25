# SaaS 10 — Checkout Security & Signature Verification

## 1. Threat Model & Prevention
The billing checkout integrates stringent cryptographic verification to prevent tampering:
- **Price Manipulation**: Customer cannot modify the amount or currency; plan pricing is loaded strictly from the authoritative database model.
- **Provider ID Forgery**: The client cannot supply an arbitrary subscription ID to mark an account paid. The backend cross-references `providerSubscriptionId` against the persisted database record for that specific `workspaceId`.
- **Cross-Tenant Theft**: User A cannot reuse a payment response from Workspace B to activate Workspace A.

---

## 2. Subscription Signature Verification Method
Razorpay Subscriptions checkout returns three critical fields:
- `razorpay_payment_id`
- `razorpay_subscription_id`
- `razorpay_signature`

Unlike one-time Orders (`order_id + '|' + payment_id`), Subscription signatures are generated as:
$$\text{HMAC-SHA256}(\text{razorpay\_payment\_id} + '|' + \text{razorpay\_subscription\_id}, \text{key\_secret})$$

### Constant-Time Verification
In `razorpayClientService.js`:
```javascript
const payload = `${paymentId}|${subscriptionId}`;
const hmac = crypto.createHmac('sha256', this.keySecret);
hmac.update(payload);
const expected = hmac.digest('hex');

const expectedBuf = Buffer.from(expected, 'hex');
const signatureBuf = Buffer.from(signature, 'hex');
if (expectedBuf.length !== signatureBuf.length) {
  return false;
}
return crypto.timingSafeEqual(expectedBuf, signatureBuf);
```
Using `crypto.timingSafeEqual` eliminates timing attacks that could reveal secret bytes.

---

## 3. Post-Verification State Reconciliation
Upon valid signature verification:
1. `Subscription.internalStatus` is promoted to `ACTIVE`.
2. `BillingPayment` transaction record is upserted with status `captured`.
3. An email receipt notification is dispatched to the verified business owner.
4. If the signature is invalid or tampered, the backend responds with HTTP 400 `INVALID_CHECKOUT_SIGNATURE` and records a security audit log.
