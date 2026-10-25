/**
 * Agency & White-Label Controller
 * Manages client workspaces, delegated permissions, agency staff, branding, and simulated custom domains.
 * Strictly maintains agency tenant boundaries: Agency A can NEVER see or manage Agency B's clients.
 */

import Agency from '../models/Agency.js';
import AgencyMembership from '../models/AgencyMembership.js';
import AgencyClientRelation from '../models/AgencyClientRelation.js';
import Workspace from '../models/Workspace.js';
import User from '../models/User.js';
import Contact from '../models/Contact.js';
import Campaign from '../models/Campaign.js';
import SecurityAuditLog from '../models/SecurityAuditLog.js';
import bcrypt from 'bcryptjs';
import { sendEmail } from '../services/emailService.js';
import { asyncHandler } from '../utils/asyncHandler.js';

/**
 * Helper to authoritatively resolve agency context for the current user.
 */
async function resolveUserAgency(userId) {
  let membership = await AgencyMembership.findOne({ userId, status: 'ACTIVE' }).populate('agencyId');
  if (!membership) {
    const agency = await Agency.findOne({ ownerId: userId, status: 'ACTIVE' });
    if (agency) {
      return { agency, role: 'AGENCY_OWNER' };
    }
    return null;
  }
  return { agency: membership.agencyId, role: membership.role };
}

export const getAgencyContext = asyncHandler(async (req, res) => {
  const context = await resolveUserAgency(req.user._id);
  if (!context || !context.agency) {
    return res.status(404).json({ message: 'No active agency found for this user.' });
  }

  const { agency, role } = context;
  const [clientRelations, staffMemberships] = await Promise.all([
    AgencyClientRelation.find({ agencyId: agency._id, status: { $ne: 'REVOKED' } })
      .populate('clientWorkspaceId', 'name slug industryKey status city businessPhone businessEmail createdAt'),
    AgencyMembership.find({ agencyId: agency._id, status: 'ACTIVE' })
      .populate('userId', 'name email role accountStatus'),
  ]);

  const activeClients = clientRelations.filter((r) => r.status === 'ACTIVE' && r.clientWorkspaceId);

  res.json({
    success: true,
    agency,
    role,
    totalClients: activeClients.length,
    clients: clientRelations.map((r) => ({
      _id: r._id,
      status: r.status,
      delegatedPermissions: r.delegatedPermissions,
      workspace: r.clientWorkspaceId,
      invitedEmail: r.invitedEmail,
      createdAt: r.createdAt,
    })),
    staff: staffMemberships.map((s) => ({
      _id: s._id,
      role: s.role,
      status: s.status,
      user: s.userId ? { _id: s.userId._id, name: s.userId.name, email: s.userId.email } : null,
    })),
  });
});

export const getClients = asyncHandler(async (req, res) => {
  const context = await resolveUserAgency(req.user._id);
  if (!context || !context.agency) {
    return res.status(404).json({ message: 'No agency found.' });
  }

  const { agency } = context;
  const relations = await AgencyClientRelation.find({ agencyId: agency._id })
    .populate('clientWorkspaceId', 'name slug industryKey status city businessPhone businessEmail createdAt');

  const clientWorkspaces = await Promise.all(
    relations.map(async (rel) => {
      const ws = rel.clientWorkspaceId;
      if (!ws) return null;
      const [contactsCount, campaignsCount] = await Promise.all([
        Contact.countDocuments({ workspaceId: ws._id, isDeleted: false }),
        Campaign.countDocuments({ workspaceId: ws._id }),
      ]);
      return {
        relationId: rel._id,
        workspaceId: ws._id,
        name: ws.name,
        slug: ws.slug,
        industryKey: ws.industryKey,
        city: ws.city,
        status: rel.status,
        delegatedPermissions: rel.delegatedPermissions,
        contactsCount,
        campaignsCount,
        createdAt: ws.createdAt,
        workspace: ws,
      };
    })
  );

  res.json({ success: true, clients: clientWorkspaces.filter(Boolean) });
});

export const getClientDetails = asyncHandler(async (req, res) => {
  const context = await resolveUserAgency(req.user._id);
  if (!context || !context.agency) {
    return res.status(404).json({ message: 'No agency found.' });
  }

  const { agency, role } = context;
  const { id } = req.params;

  // Verify relation exists for this specific agency
  const relation = await AgencyClientRelation.findOne({
    agencyId: agency._id,
    $or: [{ clientWorkspaceId: id }, { _id: id }],
  }).populate('clientWorkspaceId');

  if (!relation || !relation.clientWorkspaceId) {
    return res.status(404).json({ message: 'Client workspace not found or not delegated to your agency.' });
  }

  const ws = relation.clientWorkspaceId;
  const [contactsCount, campaignsCount] = await Promise.all([
    Contact.countDocuments({ workspaceId: ws._id, isDeleted: false }),
    Campaign.countDocuments({ workspaceId: ws._id }),
  ]);

  res.json({
    success: true,
    client: {
      relationId: relation._id,
      workspaceId: ws._id,
      name: ws.name,
      slug: ws.slug,
      industryKey: ws.industryKey,
      city: ws.city,
      country: ws.country,
      businessEmail: ws.businessEmail,
      businessPhone: ws.businessPhone,
      relationStatus: relation.status,
      delegatedPermissions: relation.delegatedPermissions,
      contactsCount,
      campaignsCount,
      createdAt: ws.createdAt,
      whatsappStatus: ws.settings?.whatsappConnection?.status || 'MOCK_READY',
    },
    delegatedPermissions: relation.delegatedPermissions,
    userRole: role,
  });
});

export const revokeClientAccess = asyncHandler(async (req, res) => {
  const context = await resolveUserAgency(req.user._id);
  if (!context || !context.agency) {
    return res.status(404).json({ message: 'No agency found.' });
  }

  const { agency } = context;
  const { relationId } = req.params;

  const relation = await AgencyClientRelation.findOne({
    _id: relationId,
    agencyId: agency._id,
  }).populate('clientWorkspaceId', 'name');

  if (!relation) {
    return res.status(404).json({ message: 'Client delegation not found.' });
  }

  relation.status = 'REVOKED';
  await relation.save();

  await SecurityAuditLog.create({
    ownerId: req.user._id,
    actorId: req.user._id,
    action: 'agency_client_delegation_revoked',
    metadata: {
      agencyId: agency._id,
      agencyName: agency.name,
      clientWorkspaceId: relation.clientWorkspaceId?._id,
      clientWorkspaceName: relation.clientWorkspaceId?.name,
    },
  }).catch(() => {});

  res.json({ success: true, message: 'Client workspace access revoked successfully.' });
});

export const inviteClient = asyncHandler(async (req, res) => {
  const clientEmail = (req.body.clientEmail || req.body.email || '').trim().toLowerCase();
  const workspaceSlug = (req.body.workspaceSlug || '').trim().toLowerCase();

  const context = await resolveUserAgency(req.user._id);
  if (!context || !context.agency) {
    return res.status(403).json({ message: 'Only authorized agency accounts can invite clients.' });
  }

  const { agency } = context;

  if (!clientEmail) {
    return res.status(400).json({ message: 'Client email is required.' });
  }

  const token = `invite_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const inviteUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/agency/accept-invite?token=${token}`;

  await sendEmail({
    to: clientEmail,
    subject: `Invitation to connect with ${agency.name} on Relay`,
    text: `You have been invited by ${agency.name} to manage your WhatsApp automation workspace. Open the link to accept: ${inviteUrl}`,
    html: `<p>You have been invited by <strong>${agency.name}</strong> to connect your workspace on Relay.</p><p><a href="${inviteUrl}">Accept Agency Delegation</a></p>`,
  });

  // If a workspace slug was provided and exists, create pending relation
  if (workspaceSlug) {
    const ws = await Workspace.findOne({ slug: workspaceSlug });
    if (ws) {
      await AgencyClientRelation.findOneAndUpdate(
        { agencyId: agency._id, clientWorkspaceId: ws._id },
        {
          $set: {
            status: 'PENDING_INVITE',
            invitedEmail: clientEmail,
            inviteToken: token,
          },
        },
        { upsert: true }
      );
    }
  }

  res.json({
    success: true,
    message: `Client invitation dispatched to ${clientEmail} (intercepted in local dev mailbox).`,
    inviteToken: token,
  });
});

export const getStaff = asyncHandler(async (req, res) => {
  const context = await resolveUserAgency(req.user._id);
  if (!context || !context.agency) {
    return res.status(404).json({ message: 'Agency not found.' });
  }

  const staff = await AgencyMembership.find({ agencyId: context.agency._id })
    .populate('userId', 'name email role accountStatus createdAt');

  res.json({
    success: true,
    staff: staff.map((s) => ({
      _id: s._id,
      role: s.role,
      status: s.status,
      user: s.userId ? {
        _id: s.userId._id,
        name: s.userId.name,
        email: s.userId.email,
        accountStatus: s.userId.accountStatus,
        createdAt: s.userId.createdAt,
      } : null,
    })),
  });
});

export const inviteStaff = asyncHandler(async (req, res) => {
  const email = (req.body.email || req.body.staffEmail || '').trim().toLowerCase();
  const role = req.body.role || 'AGENCY_MANAGER';

  const context = await resolveUserAgency(req.user._id);
  if (!context || !context.agency) {
    return res.status(404).json({ message: 'Agency not found.' });
  }

  if (context.role !== 'AGENCY_OWNER') {
    return res.status(403).json({ message: 'Only agency owners can invite team members.' });
  }

  if (!email) {
    return res.status(400).json({ message: 'Staff email is required.' });
  }

  // Find or create synthetic placeholder user
  let user = await User.findOne({ email });
  if (!user) {
    const passwordHash = await bcrypt.hash('DemoPass123!', 10);
    user = await User.create({
      name: email.split('@')[0],
      email,
      passwordHash,
      role: 'member',
      accountStatus: 'ACTIVE',
      isEmailVerified: true,
      authVersion: 1,
    });
  }

  const membership = await AgencyMembership.findOneAndUpdate(
    { agencyId: context.agency._id, userId: user._id },
    { $set: { role, status: 'ACTIVE' } },
    { upsert: true, new: true }
  );

  const inviteUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/agency`;
  await sendEmail({
    to: email,
    subject: `You have been added to ${context.agency.name} on Relay`,
    text: `You have been granted ${role} access to ${context.agency.name}. Access your dashboard here: ${inviteUrl}`,
    html: `<p>You have been granted <strong>${role}</strong> access to <strong>${context.agency.name}</strong> on Relay.</p><p><a href="${inviteUrl}">Open Agency Portal</a></p>`,
  });

  res.json({
    success: true,
    message: `Staff member ${email} added as ${role}. Invitation email intercepted in local dev mailbox.`,
    membership,
  });
});

export const removeStaff = asyncHandler(async (req, res) => {
  const context = await resolveUserAgency(req.user._id);
  if (!context || !context.agency) {
    return res.status(404).json({ message: 'Agency not found.' });
  }

  if (context.role !== 'AGENCY_OWNER') {
    return res.status(403).json({ message: 'Only agency owners can manage staff.' });
  }

  const { membershipId } = req.params;
  const membership = await AgencyMembership.findById(membershipId);

  if (!membership || membership.agencyId.toString() !== context.agency._id.toString()) {
    return res.status(404).json({ message: 'Membership not found.' });
  }

  if (membership.userId.toString() === req.user._id.toString()) {
    return res.status(400).json({ message: 'Cannot remove yourself as agency owner.' });
  }

  membership.status = 'REVOKED';
  await membership.save();

  res.json({ success: true, message: 'Staff member removed successfully.' });
});

export const updateBranding = asyncHandler(async (req, res) => {
  const context = await resolveUserAgency(req.user._id);
  if (!context || !context.agency) {
    return res.status(404).json({ message: 'Agency not found.' });
  }

  const agency = context.agency;
  const {
    companyName,
    brandColor,
    portalTitle,
    supportEmail,
    supportPhone,
    logoUrl,
    customDomain,
  } = req.body;

  if (companyName) agency.branding.companyName = companyName.trim();
  if (brandColor && /^#[0-9A-Fa-f]{6}$/.test(brandColor)) agency.branding.brandColor = brandColor;
  if (portalTitle) agency.branding.portalTitle = portalTitle.trim();
  if (supportEmail) agency.branding.supportEmail = supportEmail.trim();
  if (supportPhone) agency.branding.supportPhone = supportPhone.trim();
  if (logoUrl !== undefined) agency.branding.logoUrl = logoUrl.trim();

  if (customDomain) {
    const cleaned = customDomain.trim().toLowerCase().replace(/https?:\/\//, '').replace(/\/.*$/, '');
    agency.branding.customDomain = cleaned;
    agency.branding.domainStatus = 'DNS_PENDING';
    agency.branding.dnsTxtRecord = `_relay-verification.${cleaned} IN TXT "relay-site-verification=mock-token-${agency.slug}-${Date.now().toString(36)}"`;
  }

  await agency.save();

  res.json({
    success: true,
    message: 'Agency white-label branding updated.',
    branding: agency.branding,
  });
});

export const verifyDomain = asyncHandler(async (req, res) => {
  const context = await resolveUserAgency(req.user._id);
  if (!context || !context.agency) {
    return res.status(404).json({ message: 'Agency not found.' });
  }

  const agency = context.agency;

  // Realistic mock state machine: DNS_PENDING -> VERIFIED -> ACTIVE
  if (agency.branding.domainStatus === 'DNS_PENDING') {
    agency.branding.domainStatus = 'VERIFIED';
  } else if (agency.branding.domainStatus === 'VERIFIED') {
    agency.branding.domainStatus = 'ACTIVE';
  } else if (!agency.branding.domainStatus || agency.branding.domainStatus === 'NOT_CONFIGURED') {
    agency.branding.domainStatus = 'DNS_PENDING';
  } else {
    agency.branding.domainStatus = 'ACTIVE';
  }

  await agency.save();

  res.json({
    success: true,
    domainStatus: agency.branding.domainStatus,
    branding: agency.branding,
    message: `Domain simulated verification updated to: ${agency.branding.domainStatus}`,
  });
});

export default {
  getAgencyContext,
  getClients,
  getClientDetails,
  revokeClientAccess,
  inviteClient,
  getStaff,
  inviteStaff,
  removeStaff,
  updateBranding,
  verifyDomain,
};
