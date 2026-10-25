/**
 * Billing Notification Service
 * 
 * Dispatches transactional notifications for payment success, payment failures,
 * grace period warnings, and trial milestones.
 */

class BillingNotificationService {
  constructor() {
    this.notificationsLog = [];
  }

  async sendPaymentSuccessNotification({ email, businessName, amountMinor, planName, invoiceId }) {
    const amountInRupees = (amountMinor / 100).toFixed(2);
    const notification = {
      type: 'PAYMENT_SUCCESS',
      to: email,
      subject: `Payment Receipt: ${planName} for ${businessName}`,
      body: `Thank you! Your payment of ₹${amountInRupees} for ${planName} was successful. Invoice Ref: ${invoiceId || 'N/A'}.`,
      sentAt: new Date(),
    };
    this.notificationsLog.push(notification);
    return notification;
  }

  async sendPaymentFailedNotification({ email, businessName, amountMinor, planName, gracePeriodEndsAt }) {
    const amountInRupees = (amountMinor / 100).toFixed(2);
    const notification = {
      type: 'PAYMENT_FAILED',
      to: email,
      subject: `Action Required: Payment failed for ${businessName}`,
      body: `We were unable to process your recurring charge of ₹${amountInRupees} for ${planName}. Please update your payment method by ${new Date(gracePeriodEndsAt).toLocaleDateString()} to avoid service interruption.`,
      sentAt: new Date(),
    };
    this.notificationsLog.push(notification);
    return notification;
  }

  async sendCancellationConfirmedNotification({ email, businessName, accessEndsAt }) {
    const notification = {
      type: 'SUBSCRIPTION_CANCELLED',
      to: email,
      subject: `Subscription Cancellation Confirmed: ${businessName}`,
      body: `Your subscription has been scheduled for cancellation. You will retain full access until ${new Date(accessEndsAt).toLocaleDateString()}. Your data will remain completely intact.`,
      sentAt: new Date(),
    };
    this.notificationsLog.push(notification);
    return notification;
  }

  async sendTrialExpiringNotification({ email, businessName, trialEndsAt }) {
    const notification = {
      type: 'TRIAL_EXPIRING',
      to: email,
      subject: `Your 14-day Free Exploration trial ends soon`,
      body: `Your trial for ${businessName} ends on ${new Date(trialEndsAt).toLocaleDateString()}. Upgrade to Relay Solo to keep automated campaigns and auto-replies active.`,
      sentAt: new Date(),
    };
    this.notificationsLog.push(notification);
    return notification;
  }

  getRecentNotifications(limit = 10) {
    return this.notificationsLog.slice(-limit);
  }
}

export default new BillingNotificationService();
