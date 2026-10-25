/**
 * WhatsApp Billing Readiness Service
 * 
 * Enforces customer-direct Meta messaging fee responsibility.
 * 
 * CRITICAL POLICY:
 * 1. Customer pays Meta messaging fees directly under the approved supported arrangement.
 * 2. Relay charges separate SaaS subscription fees.
 * 3. NEVER attach Relay's line of credit or payment card.
 * 4. Partner credit-sharing endpoints must NEVER be invoked.
 * 5. If customer-direct billing cannot be confirmed, LIVE activation is strictly BLOCKED.
 */

class WhatsAppBillingReadinessService {
  /**
   * Evaluates the billing readiness of a WhatsApp connection or onboarding attempt.
   * 
   * @param {Object} connection - WhatsAppConnection document
   * @returns {Object} Readiness report with verified flag and safety assertions
   */
  evaluateBillingReadiness(connection) {
    if (!connection) {
      return {
        billingResponsibility: 'CUSTOMER',
        intendedBillingModel: 'CUSTOMER_DIRECT',
        status: 'UNVERIFIED',
        isVerified: false,
        canActivateLive: false,
        safetyViolations: ['NO_CONNECTION_RECORD'],
        partnerCreditAttached: false,
        message: 'No WhatsApp connection found for this workspace.',
      };
    }

    const { billingStatus, mode } = connection;
    const isVerified = billingStatus === 'CUSTOMER_DIRECT_VERIFIED';

    // Strict safety assertions: Relay never provides credit line
    const partnerCreditAttached = false;
    const safetyViolations = [];

    if (billingStatus === 'INELIGIBLE') {
      safetyViolations.push('BILLING_INELIGIBLE');
    }

    // In MOCK mode, billing is acknowledged as simulated
    if (mode === 'MOCK') {
      return {
        billingResponsibility: 'CUSTOMER',
        intendedBillingModel: 'CUSTOMER_DIRECT',
        status: billingStatus || 'UNVERIFIED',
        isVerified,
        canActivateLive: false, // Live is always false in mock mode
        mode: 'MOCK',
        partnerCreditAttached: false,
        safetyViolations,
        message: isVerified
          ? 'Customer-direct billing simulated as verified for mock testing.'
          : 'Customer-direct billing is not verified. Setup required before any live activation.',
      };
    }

    // For LIVE mode (future phases)
    return {
      billingResponsibility: 'CUSTOMER',
      intendedBillingModel: 'CUSTOMER_DIRECT',
      status: billingStatus,
      isVerified,
      canActivateLive: isVerified && safetyViolations.length === 0,
      mode: 'LIVE',
      partnerCreditAttached,
      safetyViolations,
      message: isVerified
        ? 'Customer-direct billing confirmed.'
        : 'LIVE messaging blocked: Customer-direct Meta billing is unverified. Relay never assumes messaging liability.',
    };
  }

  /**
   * Asserts that Relay's partner credit line is never invoked or shared.
   * Throws an error if any system attempt tries to attach partner credit.
   */
  assertZeroPartnerCreditSharing(requestPayload) {
    if (requestPayload && (requestPayload.creditLineId || requestPayload.partnerCredit || requestPayload.sharedCredit)) {
      const err = new Error('FINANCIAL SECURITY VIOLATION: Relay strictly forbids sharing partner credit lines with tenant workspaces.');
      err.code = 'PARTNER_CREDIT_FORBIDDEN';
      err.status = 403;
      throw err;
    }
    return true;
  }
}

export default new WhatsAppBillingReadinessService();
