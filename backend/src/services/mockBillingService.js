/**
 * Mock Billing Service
 * Simulates subscription lifecycle, checkouts, trial expirations, and invoices
 * in a local sandbox without any live Razorpay API calls.
 */

import WorkspaceSubscription, { PLANS } from '../models/WorkspaceSubscription.js';
import BillingInvoice from '../models/BillingInvoice.js';
import Workspace from '../models/Workspace.js';

export { PLANS };

export async function getSubscription(workspaceId) {
  let sub = await WorkspaceSubscription.findOne({ workspaceId });
  if (!sub) {
    // Auto-create initial trialing subscription
    sub = await WorkspaceSubscription.create({
      workspaceId,
      planId: 'solo_799',
      planName: 'Solo Growth Plan',
      amount: 799,
      status: 'TRIALING',
      trialStartsAt: new Date(),
      trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      currentPeriodStartsAt: new Date(),
      currentPeriodEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    });
  }

  // Recalculate status based on virtual test clock
  const effectiveNow = new Date(Date.now() + (sub.testClockOffsetMs || 0));
  if (sub.status === 'TRIALING' && effectiveNow > sub.trialEndsAt) {
    sub.status = 'EXPIRED';
    await sub.save();
  } else if (sub.status === 'ACTIVE' && effectiveNow > sub.currentPeriodEndsAt) {
    if (sub.cancelAtPeriodEnd) {
      sub.status = 'CANCELED';
    } else {
      sub.status = 'PAST_DUE';
    }
    await sub.save();
  }

  return sub;
}

export async function simulateCheckout(workspaceId, { planId = 'solo_799', failSimulation = false } = {}) {
  const plan = PLANS.find((p) => p.id === planId) || PLANS[0];
  let sub = await WorkspaceSubscription.findOne({ workspaceId });

  if (!sub) {
    sub = new WorkspaceSubscription({ workspaceId });
  }

  const effectiveNow = new Date(Date.now() + (sub.testClockOffsetMs || 0));

  if (failSimulation) {
    sub.status = 'PAST_DUE';
    await sub.save();

    await BillingInvoice.create({
      workspaceId,
      invoiceNumber: `MOCK-FAIL-${Date.now()}`,
      planId: plan.id,
      amount: plan.amount,
      status: 'FAILED',
      description: `Simulated Payment Failure for ${plan.name}`,
    });

    return { success: false, status: 'PAST_DUE', message: 'Payment authorization failed in mock simulation.' };
  }

  sub.planId = plan.id;
  sub.planName = plan.name;
  sub.amount = plan.amount;
  sub.status = 'ACTIVE';
  sub.currentPeriodStartsAt = effectiveNow;
  sub.currentPeriodEndsAt = new Date(effectiveNow.getTime() + 30 * 24 * 60 * 60 * 1000);
  sub.cancelAtPeriodEnd = false;
  sub.canceledAt = null;
  await sub.save();

  const invoice = await BillingInvoice.create({
    workspaceId,
    invoiceNumber: `MOCK-INV-${Date.now()}`,
    planId: plan.id,
    amount: plan.amount,
    currency: 'INR',
    status: 'PAID',
    paidAt: effectiveNow,
    description: `Relay ${plan.name} - Monthly (Simulated Test Record)`,
    paymentMethod: 'Mock UPI / Card (Test Mode)',
    isMock: true,
  });

  return { success: true, subscription: sub, invoice };
}

export async function advanceTestClock(workspaceId, days = 15) {
  const sub = await getSubscription(workspaceId);
  const additionalMs = Number(days) * 24 * 60 * 60 * 1000;
  sub.testClockOffsetMs = (sub.testClockOffsetMs || 0) + additionalMs;

  const effectiveNow = new Date(Date.now() + sub.testClockOffsetMs);
  if (sub.status === 'TRIALING' && effectiveNow > sub.trialEndsAt) {
    sub.status = 'EXPIRED';
  } else if (sub.status === 'ACTIVE' && effectiveNow > sub.currentPeriodEndsAt) {
    sub.status = 'PAST_DUE';
  }

  await sub.save();
  return sub;
}

export async function cancelSubscription(workspaceId) {
  const sub = await getSubscription(workspaceId);
  sub.cancelAtPeriodEnd = true;
  sub.status = 'CANCELED';
  sub.canceledAt = new Date(Date.now() + (sub.testClockOffsetMs || 0));
  await sub.save();
  return sub;
}

export async function getInvoices(workspaceId) {
  return BillingInvoice.find({ workspaceId }).sort({ createdAt: -1 });
}

export default {
  PLANS,
  getSubscription,
  simulateCheckout,
  advanceTestClock,
  cancelSubscription,
  getInvoices,
};
