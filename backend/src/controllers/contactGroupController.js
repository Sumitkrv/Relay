import { tenantScope } from '../utils/tenantScope.js';
import { legacyWorkspaceScope } from '../utils/legacyWorkspaceScope.js';
import mongoose from 'mongoose';
import ContactGroup from '../models/ContactGroup.js';
import Contact from '../models/Contact.js';
import ContactActivity from '../models/ContactActivity.js';

const fail = (message, status = 400) => Object.assign(new Error(message), { status });
const validId = (id) => mongoose.isObjectIdOrHexString(id);

function parseId(id) {
  if (!validId(id)) throw fail('Group ID is invalid.');
  return id;
}

export async function listGroups(req, res) {
  const ownerId = req.user._id;
  const search = typeof req.query.search === 'string' ? req.query.search.trim().slice(0, 100) : '';
  const query = { ...await legacyWorkspaceScope(req), isArchived: false };
  if (search) {
    const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    query.name = new RegExp(escaped, 'i');
  }

  const groups = await ContactGroup.find(query).sort({ updatedAt: -1 }).lean();
  
  // Update and synchronize live member counts accurately
  const counts = await Contact.aggregate([
    { $match: { ...tenantScope(req), isDeleted: false } },
    { $unwind: '$groups' },
    { $group: { _id: '$groups', count: { $sum: 1 } } }
  ]);
  const countMap = new Map(counts.map((c) => [String(c._id), c.count]));

  const records = groups.map((g) => ({
    ...g,
    contactCount: countMap.get(String(g._id)) ?? 0
  }));

  res.json({ records, total: records.length });
}

export async function getGroup(req, res) {
  const id = parseId(req.params.id);
  const group = await ContactGroup.findOne({ _id: id, ...await legacyWorkspaceScope(req), isArchived: false }).lean();
  if (!group) return res.status(404).json({ message: 'Contact group not found.' });

  const contactCount = await Contact.countDocuments({
    ...tenantScope(req),
    groups: id,
    isDeleted: false
  });

  res.json({ group: { ...group, contactCount } });
}

export async function createGroup(req, res) {
  const name = String(req.body?.name || '').trim();
  if (name.length < 2 || name.length > 100) {
    throw fail('Group name must be between 2 and 100 characters.');
  }

  const normalizedName = name.toLowerCase();
  const duplicate = await ContactGroup.findOne({
    ...await legacyWorkspaceScope(req),
    normalizedName,
    isArchived: false
  });
  if (duplicate) throw fail('A group with this name already exists in your account.', 409);

  const description = String(req.body?.description || '').trim().slice(0, 500);
  const color = String(req.body?.color || '#2563EB').trim().slice(0, 20);

  const group = await ContactGroup.create({
    ...tenantScope(req),
    name,
    normalizedName,
    description,
    color,
    contactCount: 0
  });

  // If initial contact IDs provided, attach them
  if (Array.isArray(req.body?.contactIds) && req.body.contactIds.length > 0) {
    const validIds = req.body.contactIds.filter(validId);
    if (validIds.length > 0) {
      await Contact.updateMany(
        { _id: { $in: validIds }, ...tenantScope(req), isDeleted: false },
        { $addToSet: { groups: group._id } }
      );
      group.contactCount = await Contact.countDocuments({
        ...tenantScope(req),
        groups: group._id,
        isDeleted: false
      });
      await group.save();
    }
  }

  res.status(201).json({ group });
}

export async function updateGroup(req, res) {
  const id = parseId(req.params.id);
  const group = await ContactGroup.findOne({ _id: id, ...await legacyWorkspaceScope(req), isArchived: false });
  if (!group) return res.status(404).json({ message: 'Contact group not found.' });

  if (req.body?.name !== undefined) {
    const name = String(req.body.name || '').trim();
    if (name.length < 2 || name.length > 100) {
      throw fail('Group name must be between 2 and 100 characters.');
    }
    const normalizedName = name.toLowerCase();
    const duplicate = await ContactGroup.findOne({
      _id: { $ne: id },
      ...await legacyWorkspaceScope(req),
      normalizedName,
      isArchived: false
    });
    if (duplicate) throw fail('A group with this name already exists in your account.', 409);
    group.name = name;
    group.normalizedName = normalizedName;
  }

  if (req.body?.description !== undefined) {
    group.description = String(req.body.description || '').trim().slice(0, 500);
  }

  if (req.body?.color !== undefined) {
    group.color = String(req.body.color || '#2563EB').trim().slice(0, 20);
  }

  await group.save();
  const contactCount = await Contact.countDocuments({
    ...tenantScope(req),
    groups: group._id,
    isDeleted: false
  });
  group.contactCount = contactCount;

  res.json({ group });
}

export async function deleteGroup(req, res) {
  const id = parseId(req.params.id);
  const group = await ContactGroup.findOneAndDelete({ _id: id, ...await legacyWorkspaceScope(req) });
  if (!group) return res.status(404).json({ message: 'Contact group not found.' });

  // Disassociate group from member contacts without deleting the contacts!
  await Contact.updateMany(
    { ...tenantScope(req), groups: id },
    { $pull: { groups: id } }
  );

  res.json({ message: `Group "${group.name}" deleted. Member contacts were preserved.` });
}

export async function manageMembers(req, res) {
  const id = parseId(req.params.id);
  const group = await ContactGroup.findOne({ _id: id, ...await legacyWorkspaceScope(req), isArchived: false });
  if (!group) return res.status(404).json({ message: 'Contact group not found.' });

  const { action, contactIds } = req.body || {};
  if (!['add', 'remove'].includes(action)) throw fail('Action must be "add" or "remove".');
  if (!Array.isArray(contactIds) || !contactIds.length || contactIds.some((cid) => !validId(cid))) {
    throw fail('Provide an array of valid contact IDs.');
  }

  const uniqueIds = [...new Set(contactIds)];

  if (action === 'add') {
    await Contact.updateMany(
      { _id: { $in: uniqueIds }, ...tenantScope(req), isDeleted: false },
      { $addToSet: { groups: group._id } }
    );
  } else {
    await Contact.updateMany(
      { _id: { $in: uniqueIds }, ...tenantScope(req), isDeleted: false },
      { $pull: { groups: group._id } }
    );
  }

  const newCount = await Contact.countDocuments({
    ...tenantScope(req),
    groups: group._id,
    isDeleted: false
  });
  group.contactCount = newCount;
  await group.save();

  res.json({
    groupId: group._id,
    contactCount: newCount,
    action,
    affectedCount: uniqueIds.length
  });
}

export async function getGroupMembers(req, res) {
  const id = parseId(req.params.id);
  const group = await ContactGroup.findOne({ _id: id, ...await legacyWorkspaceScope(req), isArchived: false }).lean();
  if (!group) return res.status(404).json({ message: 'Contact group not found.' });

  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 25));
  const skip = (page - 1) * limit;

  const [members, total] = await Promise.all([
    Contact.find({ ...tenantScope(req), groups: id, isDeleted: false })
      .sort({ fullName: 1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Contact.countDocuments({ ...tenantScope(req), groups: id, isDeleted: false })
  ]);

  res.json({
    group,
    records: members,
    total,
    page,
    pageSize: limit,
    totalPages: Math.ceil(total / limit)
  });
}
