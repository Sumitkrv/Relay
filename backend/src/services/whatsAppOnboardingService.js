import crypto from 'crypto';
import WhatsAppOnboardingAttempt from '../models/WhatsAppOnboardingAttempt.js';
import WhatsAppConnection from '../models/WhatsAppConnection.js';

/**
 * Normalizes phone numbers to standard E.164 representation.
 * Supports international formats without hardcoding any specific country.
 */
export function normalizePhoneNumber(rawPhone, countryCallingCode = '+91') {
  if (!rawPhone || typeof rawPhone !== 'string') {
    throw new Error('A valid phone number string is required.');
  }

  // Remove whitespace, dashes, parens
  let clean = rawPhone.replace(/[\s\-\(\)\.]/g, '');

  if (clean.startsWith('+')) {
    // Already has international prefix
    if (!/^\+[1-9]\d{7,14}$/.test(clean)) {
      throw new Error(`Invalid international E.164 phone number: "${rawPhone}". Must contain 8 to 15 digits.`);
    }
    return clean;
  }

  // Prepend default calling code if not present
  const prefix = countryCallingCode.startsWith('+') ? countryCallingCode : `+${countryCallingCode}`;
  clean = `${prefix}${clean.replace(/^0+/, '')}`;

  if (!/^\+[1-9]\d{7,14}$/.test(clean)) {
    throw new Error(`Invalid E.164 phone number after normalization: "${clean}".`);
  }

  return clean;
}

/**
 * WhatsApp Onboarding Service
 * 
 * Manages the multi-step onboarding wizard transactions, state security,
 * and deterministic mock scenario simulations.
 */
class WhatsAppOnboardingService {
  /**
   * Initiates a new onboarding transaction.
   */
  async startOnboarding(workspaceId, user, { requestedPhone, countryCode = '+91', connectionMethod = 'EXISTING_APP_COEXISTENCE' }) {
    if (!workspaceId) {
      throw new Error('Workspace ID is required.');
    }
    if (!user || !user._id) {
      throw new Error('User context is required to initiate onboarding.');
    }

    const normalizedRequestedPhone = requestedPhone ? normalizePhoneNumber(requestedPhone, countryCode) : '';

    // Generate secure state reference hash for CSRF and replay protection
    const stateReferenceHash = crypto.randomBytes(32).toString('hex');

    // Cancel any stale in-progress attempts for this workspace
    await WhatsAppOnboardingAttempt.updateMany(
      { workspaceId, attemptStatus: { $in: ['STARTED', 'METHOD_CHOSEN', 'AUTHORIZATION_SIMULATED', 'VERIFICATION_SIMULATED', 'BILLING_REVIEWED', 'READY_CHECKED'] } },
      { $set: { attemptStatus: 'CANCELLED', cancelledAt: new Date(), safeFailureDescription: 'Superseded by new onboarding session.' } }
    );

    const attempt = await WhatsAppOnboardingAttempt.create({
      workspaceId,
      initiatedBy: user._id,
      connectionMethod,
      requestedPhone: requestedPhone || '',
      normalizedRequestedPhone,
      attemptStatus: 'STARTED',
      stateReferenceHash,
      currentStep: 1,
      startedAt: new Date(),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
    });

    // Ensure connection document exists in SETUP_STARTED
    await WhatsAppConnection.findOneAndUpdate(
      { workspaceId },
      {
        $set: {
          connectionStatus: 'SETUP_STARTED',
          connectionType: connectionMethod,
          displayPhoneNumber: requestedPhone || '',
          normalizedPhoneNumber: normalizedRequestedPhone,
          mode: 'MOCK',
          provider: 'MOCK',
          createdBy: user._id,
          lastCheckedAt: new Date(),
        },
      },
      { upsert: true, new: true }
    );

    return attempt;
  }

  /**
   * Retrieves the current active onboarding attempt for a workspace.
   */
  async getCurrentAttempt(workspaceId) {
    return WhatsAppOnboardingAttempt.findOne({
      workspaceId,
      attemptStatus: { $nin: ['COMPLETED', 'CANCELLED', 'EXPIRED', 'FAILED'] },
      expiresAt: { $gt: new Date() },
    }).sort({ createdAt: -1 });
  }

  /**
   * Step 2: Select Connection Method (Option A vs Option B).
   */
  async selectMethod(attemptId, workspaceId, connectionMethod) {
    const attempt = await WhatsAppOnboardingAttempt.findOne({ _id: attemptId, workspaceId });
    if (!attempt) {
      const err = new Error('Onboarding attempt not found or unauthorized.');
      err.status = 404;
      throw err;
    }

    if (attempt.expiresAt < new Date()) {
      attempt.attemptStatus = 'EXPIRED';
      await attempt.save();
      const err = new Error('Onboarding attempt has expired. Please restart.');
      err.status = 410;
      throw err;
    }

    attempt.connectionMethod = connectionMethod;
    attempt.currentStep = 2;
    attempt.attemptStatus = 'METHOD_CHOSEN';
    await attempt.save();

    await WhatsAppConnection.updateOne(
      { workspaceId },
      { $set: { connectionType: connectionMethod, connectionStatus: 'METHOD_SELECTED' } }
    );

    return attempt;
  }

  /**
   * Advances a mock onboarding step deterministically based on requested scenario.
   */
  async advanceMockStep(attemptId, workspaceId, { step, scenario = 'SCENARIO_A_APP_ELIGIBLE', payload = {} }) {
    const attempt = await WhatsAppOnboardingAttempt.findOne({ _id: attemptId, workspaceId });
    if (!attempt) {
      const err = new Error('Onboarding attempt not found.');
      err.status = 404;
      throw err;
    }

    if (attempt.expiresAt < new Date()) {
      attempt.attemptStatus = 'EXPIRED';
      await attempt.save();
      const err = new Error('Onboarding attempt has expired. Please restart.');
      err.status = 410;
      throw err;
    }

    attempt.simulatedScenario = scenario;

    // STEP 3: Meta Official Authorization Simulation
    if (step === 3) {
      if (scenario === 'SCENARIO_D_AUTH_CANCELLED') {
        attempt.attemptStatus = 'CANCELLED';
        attempt.cancelledAt = new Date();
        attempt.safeFailureDescription = 'User cancelled authorization during simulated Meta dialog.';
        await attempt.save();

        await WhatsAppConnection.updateOne(
          { workspaceId },
          { $set: { connectionStatus: 'FAILED', lastErrorCode: 'AUTH_CANCELLED_BY_USER' } }
        );
        return { success: false, attempt, reason: 'AUTH_CANCELLED' };
      }

      if (scenario === 'SCENARIO_B_APP_INELIGIBLE') {
        attempt.eligibilityAssessment = {
          status: 'INELIGIBLE_VERIFIED',
          notes: 'Phone number currently does not support WhatsApp Business App coexistence under Meta current criteria.',
          evaluatedAt: new Date(),
        };
        attempt.attemptStatus = 'AUTHORIZATION_SIMULATED';
        attempt.currentStep = 3;
        await attempt.save();

        await WhatsAppConnection.updateOne(
          { workspaceId },
          { $set: { authorizationStatus: 'FAILED', lastErrorCode: 'COEXISTENCE_INELIGIBLE' } }
        );
        return { success: false, attempt, reason: 'COEXISTENCE_INELIGIBLE' };
      }

      // Success authorization scenario
      attempt.eligibilityAssessment = {
        status: 'ELIGIBLE_VERIFIED',
        notes: 'Simulated Meta authorization confirmed business asset access and coexistence eligibility.',
        evaluatedAt: new Date(),
      };
      attempt.attemptStatus = 'AUTHORIZATION_SIMULATED';
      attempt.currentStep = 4;
      await attempt.save();

      await WhatsAppConnection.updateOne(
        { workspaceId },
        {
          $set: {
            authorizationStatus: 'AUTHORIZED',
            permissionsStatus: 'GRANTED',
            connectionStatus: 'PHONE_VERIFICATION_PENDING',
          },
        }
      );
      return { success: true, attempt };
    }

    // STEP 4: Number Verification & Registration Simulation
    if (step === 4) {
      if (scenario === 'SCENARIO_E_VERIFICATION_FAILED') {
        attempt.verificationAttempts += 1;
        attempt.attemptStatus = 'FAILED';
        attempt.failureCode = 'INVALID_OTP';
        attempt.safeFailureDescription = 'Simulated phone verification failed: incorrect OTP code entered.';
        await attempt.save();

        await WhatsAppConnection.updateOne(
          { workspaceId },
          { $set: { phoneVerificationStatus: 'FAILED', registrationStatus: 'FAILED', lastErrorCode: 'VERIFICATION_FAILED' } }
        );
        return { success: false, attempt, reason: 'VERIFICATION_FAILED' };
      }

      // Verification success
      attempt.attemptStatus = 'VERIFICATION_SIMULATED';
      attempt.currentStep = 5;
      await attempt.save();

      await WhatsAppConnection.updateOne(
        { workspaceId },
        {
          $set: {
            phoneVerificationStatus: 'VERIFIED',
            registrationStatus: 'REGISTERED',
            connectionStatus: 'BILLING_UNVERIFIED',
          },
        }
      );
      return { success: true, attempt };
    }

    // STEP 5: Customer Meta Messaging Billing Review
    if (step === 5) {
      const isBillingVerified = scenario !== 'SCENARIO_F_BILLING_UNVERIFIED';

      attempt.billingReadiness = {
        intendedBillingModel: 'CUSTOMER_DIRECT',
        billingResponsibility: 'CUSTOMER',
        verificationStatus: isBillingVerified ? 'CUSTOMER_DIRECT_VERIFIED' : 'UNVERIFIED',
        notes: isBillingVerified
          ? 'Customer-direct messaging payment confirmed (simulated).'
          : 'Customer-direct billing has not been completed on Meta Business Manager.',
      };
      attempt.attemptStatus = 'BILLING_REVIEWED';
      attempt.currentStep = 6;
      await attempt.save();

      await WhatsAppConnection.updateOne(
        { workspaceId },
        {
          $set: {
            billingStatus: isBillingVerified ? 'CUSTOMER_DIRECT_VERIFIED' : 'UNVERIFIED',
            connectionStatus: isBillingVerified ? 'WEBHOOK_UNVERIFIED' : 'BILLING_UNVERIFIED',
          },
        }
      );
      return { success: true, attempt, isBillingVerified };
    }

    // STEP 6: Relay Software Subscription Review (Handoff to Prompt 10)
    if (step === 6) {
      attempt.currentStep = 7;
      attempt.attemptStatus = 'READY_CHECKED';
      await attempt.save();

      await WhatsAppConnection.updateOne(
        { workspaceId },
        { $set: { connectionStatus: 'READY_TO_ACTIVATE' } }
      );
      return { success: true, attempt };
    }

    // STEP 7: Final Mock Activation as MOCK_SIMULATED_READY
    if (step === 7) {
      attempt.attemptStatus = 'COMPLETED';
      attempt.completedAt = new Date();
      await attempt.save();

      const syntheticSender = `mock_sender_${workspaceId}`;
      const syntheticWaba = `mock_waba_${workspaceId}`;
      const syntheticPhoneId = `mock_phone_id_${workspaceId}`;

      const updatedConnection = await WhatsAppConnection.findOneAndUpdate(
        { workspaceId },
        {
          $set: {
            connectionStatus: 'MOCK_SIMULATED_READY',
            mode: 'MOCK',
            provider: 'MOCK',
            isSimulated: true,
            wabaId: syntheticWaba,
            phoneNumberId: syntheticPhoneId,
            displayPhoneNumber: attempt.requestedPhone || '+1 (555) 019-2831',
            normalizedPhoneNumber: attempt.normalizedRequestedPhone || '+15550192831',
            authorizationStatus: 'AUTHORIZED',
            phoneVerificationStatus: 'VERIFIED',
            registrationStatus: 'REGISTERED',
            billingStatus: attempt.billingReadiness?.verificationStatus || 'CUSTOMER_DIRECT_VERIFIED',
            webhookStatus: scenario === 'SCENARIO_G_WEBHOOK_UNVERIFIED' ? 'UNVERIFIED' : 'VERIFIED',
            permissionsStatus: 'GRANTED',
            connectedAt: new Date(),
            mockScenario: scenario,
            lastCheckedAt: new Date(),
          },
        },
        { new: true }
      );

      return {
        success: true,
        attempt,
        connection: updatedConnection,
        message: 'Mock WhatsApp connection successfully activated. Ready for safe internal simulation.',
      };
    }

    throw new Error(`Unsupported wizard step: ${step}`);
  }

  /**
   * Cancels an ongoing onboarding transaction safely.
   */
  async cancelOnboarding(attemptId, workspaceId) {
    const attempt = await WhatsAppOnboardingAttempt.findOne({ _id: attemptId, workspaceId });
    if (!attempt) {
      const err = new Error('Onboarding attempt not found.');
      err.status = 404;
      throw err;
    }

    attempt.attemptStatus = 'CANCELLED';
    attempt.cancelledAt = new Date();
    await attempt.save();

    await WhatsAppConnection.updateOne(
      { workspaceId, connectionStatus: { $in: ['SETUP_STARTED', 'METHOD_SELECTED'] } },
      { $set: { connectionStatus: 'NOT_CONNECTED' } }
    );

    return { success: true, message: 'Onboarding attempt cancelled.' };
  }
}

export default new WhatsAppOnboardingService();
