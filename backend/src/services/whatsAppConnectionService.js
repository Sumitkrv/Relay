import WhatsAppConnection from '../models/WhatsAppConnection.js';
import Workspace from '../models/Workspace.js';
import whatsAppBillingReadinessService from './whatsAppBillingReadinessService.js';
import mockWhatsAppProvider from './mockWhatsAppProvider.js';

/**
 * WhatsApp Connection Service
 * 
 * Manages the lifecycle, independent readiness checks, diagnostics,
 * and safe disconnection/reconnection of workspace WhatsApp connections.
 */
class WhatsAppConnectionService {
  /**
   * Retrieves the WhatsApp connection for a workspace.
   */
  async getConnection(workspaceId) {
    if (!workspaceId) {
      throw new Error('Workspace ID is required.');
    }

    const connection = await WhatsAppConnection.findOne({ workspaceId }).lean();
    if (!connection) {
      return {
        exists: false,
        connectionStatus: 'NOT_CONNECTED',
        mode: 'MOCK',
        provider: 'MOCK',
        message: 'No WhatsApp connection found for this workspace.',
      };
    }

    return {
      exists: true,
      ...connection,
    };
  }

  /**
   * Evaluates independent readiness criteria.
   * Crucial: a single boolean is never sufficient; each requirement is checked independently.
   */
  async getReadiness(workspaceId) {
    const connection = await WhatsAppConnection.findOne({ workspaceId }).lean();
    const workspace = await Workspace.findById(workspaceId).lean();

    const billingReadiness = whatsAppBillingReadinessService.evaluateBillingReadiness(connection);

    if (!connection) {
      return {
        overallStatus: 'NOT_CONNECTED',
        mode: 'MOCK',
        canActivateLive: false,
        checks: {
          providerAuthorization: { status: 'NOT_CHECKED', verified: false, label: 'Meta Provider Authorization' },
          customerBusinessIdentity: { status: 'NOT_CHECKED', verified: false, label: 'Business Portfolio & Verification' },
          senderIdentity: { status: 'NOT_CHECKED', verified: false, label: 'Sender Phone Number ID' },
          phoneVerification: { status: 'NOT_CHECKED', verified: false, label: 'Two-Step / OTP Phone Verification' },
          registration: { status: 'NOT_CHECKED', verified: false, label: 'WhatsApp Cloud API Registration' },
          permissions: { status: 'NOT_CHECKED', verified: false, label: 'WhatsApp Business Management Permissions' },
          webhookReadiness: { status: 'NOT_CHECKED', verified: false, label: 'Webhook Subscription & Delivery' },
          billingResponsibility: { status: 'UNVERIFIED', verified: false, label: 'Customer-Direct Meta Messaging Billing' },
          workspaceActive: { status: workspace?.status === 'ACTIVE' ? 'VERIFIED' : 'FAILED', verified: workspace?.status === 'ACTIVE', label: 'Relay Workspace Operational Status' },
          relaySubscription: { status: 'INTEGRATION_PENDING', verified: false, label: 'Relay Software Subscription (Prompt 10)' },
        },
        message: 'WhatsApp connection has not been initiated for this workspace.',
      };
    }

    const isMock = connection.mode === 'MOCK';
    const isMockReady = connection.connectionStatus === 'MOCK_SIMULATED_READY';

    // Independent checks breakdown
    const checks = {
      providerAuthorization: {
        status: connection.authorizationStatus,
        verified: connection.authorizationStatus === 'AUTHORIZED',
        label: 'Meta Provider Authorization',
        isSimulated: isMock,
      },
      customerBusinessIdentity: {
        status: connection.businessPortfolioId ? 'VERIFIED' : 'UNVERIFIED',
        verified: Boolean(connection.businessPortfolioId),
        label: 'Business Portfolio & Verification',
        isSimulated: isMock,
      },
      senderIdentity: {
        status: connection.phoneNumberId ? 'VERIFIED' : 'UNVERIFIED',
        verified: Boolean(connection.phoneNumberId),
        label: 'Sender Phone Number ID',
        isSimulated: isMock,
      },
      phoneVerification: {
        status: connection.phoneVerificationStatus,
        verified: connection.phoneVerificationStatus === 'VERIFIED',
        label: 'Two-Step / OTP Phone Verification',
        isSimulated: isMock,
      },
      registration: {
        status: connection.registrationStatus,
        verified: connection.registrationStatus === 'REGISTERED',
        label: 'WhatsApp Cloud API Registration',
        isSimulated: isMock,
      },
      permissions: {
        status: connection.permissionsStatus,
        verified: connection.permissionsStatus === 'GRANTED',
        label: 'WhatsApp Business Management Permissions',
        isSimulated: isMock,
      },
      webhookReadiness: {
        status: connection.webhookStatus,
        verified: connection.webhookStatus === 'VERIFIED',
        label: 'Webhook Subscription & Delivery',
        isSimulated: isMock,
      },
      billingResponsibility: {
        status: billingReadiness.status,
        verified: billingReadiness.isVerified,
        label: 'Customer-Direct Meta Messaging Billing',
        responsibility: billingReadiness.billingResponsibility,
        isSimulated: isMock,
      },
      workspaceActive: {
        status: workspace?.status === 'ACTIVE' ? 'VERIFIED' : 'FAILED',
        verified: workspace?.status === 'ACTIVE',
        label: 'Relay Workspace Operational Status',
      },
      relaySubscription: {
        status: 'INTEGRATION_PENDING',
        verified: false,
        label: 'Relay Software Subscription (Prompt 10 Handoff)',
      },
    };

    // Strict Live Activation Rule: ALL independent checks must be genuinely verified
    // AND mode must be authorized for live, which is permanently false in Phase 9.
    const allChecksVerified = Object.values(checks).every((c) => c.verified);
    const canActivateLive = false; // Strictly blocked in Phase 9

    return {
      connectionId: connection._id,
      overallStatus: connection.connectionStatus,
      mode: connection.mode,
      connectionType: connection.connectionType,
      isSimulated: isMock,
      isMockReady,
      canActivateLive,
      liveActivationBlockedReason: isMock
        ? 'Workspace is operating in MOCK simulation mode. LIVE Meta connection is reserved for future rollout.'
        : !allChecksVerified
        ? 'Independent readiness criteria are incomplete.'
        : null,
      checks,
    };
  }

  /**
   * Safely disconnects a connection while preserving 100% of historical records.
   */
  async disconnectConnection(workspaceId, user, { reason = 'USER_INITIATED' } = {}) {
    const connection = await WhatsAppConnection.findOne({ workspaceId });
    if (!connection) {
      const err = new Error('No active WhatsApp connection to disconnect.');
      err.status = 404;
      throw err;
    }

    connection.connectionStatus = 'DISCONNECTED';
    connection.disconnectedAt = new Date();
    connection.disconnectionReason = reason;
    await connection.save();

    return {
      success: true,
      message: 'WhatsApp connection disconnected safely. Historical messages, campaigns, and reports remain intact.',
      connection,
    };
  }

  /**
   * Reconnects a previously disconnected connection into setup mode.
   */
  async reconnectConnection(workspaceId, user) {
    let connection = await WhatsAppConnection.findOne({ workspaceId });
    if (!connection) {
      const err = new Error('No WhatsApp connection found to reconnect.');
      err.status = 404;
      throw err;
    }

    connection.connectionStatus = 'SETUP_STARTED';
    connection.disconnectedAt = null;
    connection.disconnectionReason = null;
    connection.lastCheckedAt = new Date();
    await connection.save();

    return {
      success: true,
      message: 'WhatsApp connection reset for reconnection.',
      connection,
    };
  }

  /**
   * Returns expandable diagnostic technical metadata for platform operators or advanced debugging.
   */
  async getConnectionDiagnostics(workspaceId) {
    const connection = await WhatsAppConnection.findOne({ workspaceId }).lean();
    const readiness = await this.getReadiness(workspaceId);

    return {
      workspaceId,
      connectionExists: Boolean(connection),
      connectionId: connection?._id || null,
      mode: connection?.mode || 'MOCK',
      provider: connection?.provider || 'MOCK',
      syntheticSenderId: `mock_sender_${workspaceId}`,
      connectionStatus: connection?.connectionStatus || 'NOT_CONNECTED',
      displayPhoneNumber: connection?.displayPhoneNumber || 'Not Configured',
      normalizedPhoneNumber: connection?.normalizedPhoneNumber || 'Not Configured',
      wabaId: connection?.wabaId || 'synthetic_waba_' + workspaceId,
      phoneNumberId: connection?.phoneNumberId || 'synthetic_phone_id_' + workspaceId,
      credentialStorageType: 'AES_256_GCM_ENCRYPTED',
      webhookRouteReady: true,
      providerVersion: mockWhatsAppProvider.version || '1.0.0',
      lastCheckedAt: connection?.lastCheckedAt || new Date(),
      readinessSummary: readiness.checks,
      canActivateLive: false,
    };
  }
}

export default new WhatsAppConnectionService();
