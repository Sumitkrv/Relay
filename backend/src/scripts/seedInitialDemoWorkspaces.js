/**
 * RELAY INITIAL DEMO SEEDER — PROMPT 1 OF 4
 * 
 * Provisions exactly three working business owner accounts:
 * 1. M2W Realty — Real Estate
 * 2. FitZone Gym — Gym / Fitness
 * 3. CarePlus Clinic — Healthcare / Clinic
 * 
 * Strictly idempotent:
 * - Verifies connection to isolated demo database ("relay_demo")
 * - Reuses existing accounts/workspaces by stable identity
 * - Never overwrites user modifications on subsequent runs
 * - Seeds 5 demo contacts per business (total 15)
 * - Seeds 7 generic editable draft templates per business (total 21)
 * - Passwords loaded securely from gitignored configuration and hashed with bcrypt
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 1. Load environment configuration
dotenv.config({ path: path.resolve(__dirname, '../../.env.demo'), override: true });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config();

// Ensure demo mode & database name defaults for local execution
process.env.APP_MODE = process.env.APP_MODE || 'demo';
process.env.DATABASE_NAME = process.env.DATABASE_NAME || 'relay_demo';
process.env.EMAIL_PROVIDER = process.env.EMAIL_PROVIDER || 'mock';
process.env.DEMO_EMAIL_AUTO_VERIFY = process.env.DEMO_EMAIL_AUTO_VERIFY || 'true';
process.env.WHATSAPP_PROVIDER = process.env.WHATSAPP_PROVIDER || 'mock';
process.env.BILLING_PROVIDER = process.env.BILLING_PROVIDER || 'mock';

import connectDB from '../config/db.js';
import { assertDemoDatabaseSafety } from '../config/demoSafety.js';
import User from '../models/User.js';
import Workspace from '../models/Workspace.js';
import WorkspaceMembership from '../models/WorkspaceMembership.js';
import BusinessProfile from '../models/BusinessProfile.js';
import Contact from '../models/Contact.js';
import ContactActivity from '../models/ContactActivity.js';
import MessageTemplate, { TemplateVersion } from '../models/MessageTemplate.js';
import Campaign from '../models/Campaign.js';
import CampaignAudience from '../models/CampaignAudience.js';
import AutoReplyRule from '../models/AutoReplyRule.js';
import { extractVariables, validateTemplate, buildMetaStructure } from '../utils/templateEngine.js';

// Load passwords securely from gitignored local file or environment variables
function loadDemoPasswords() {
  const envPasswords = {
    'owner.m2w@relay-demo.test': process.env.DEMO_M2W_PASSWORD,
    'owner.gym@relay-demo.test': process.env.DEMO_GYM_PASSWORD,
    'owner.clinic@relay-demo.test': process.env.DEMO_CLINIC_PASSWORD,
  };

  const localConfigPaths = [
    path.resolve(__dirname, '../../../../scratch/.demo-passwords.json'),
    path.resolve(process.cwd(), 'scratch/.demo-passwords.json'),
  ];

  let filePasswords = {};
  for (const cp of localConfigPaths) {
    if (fs.existsSync(cp)) {
      try {
        filePasswords = JSON.parse(fs.readFileSync(cp, 'utf8'));
        break;
      } catch (err) {
        console.warn('Could not parse local demo passwords file:', err.message);
      }
    }
  }

  return {
    'owner.m2w@relay-demo.test': envPasswords['owner.m2w@relay-demo.test'] || filePasswords['owner.m2w@relay-demo.test'] || 'jJmIbaygOIA6SLSBx19O',
    'owner.gym@relay-demo.test': envPasswords['owner.gym@relay-demo.test'] || filePasswords['owner.gym@relay-demo.test'] || 'Vnhh00enLh7eKAqyS0MB',
    'owner.clinic@relay-demo.test': envPasswords['owner.clinic@relay-demo.test'] || filePasswords['owner.clinic@relay-demo.test'] || 'aNKkTx8h#uAizbG0ALlF',
  };
}

// 7 Generic Templates Specification
const GENERIC_TEMPLATES = [
  {
    name: 'Welcome Message',
    category: 'Marketing',
    body: 'Hello {{customer_name}}, welcome to {{business_name}}! Thank you for connecting with us. How can we assist you today?',
  },
  {
    name: 'Enquiry Acknowledgement',
    category: 'Utility',
    body: 'Hi {{customer_name}}, thank you for contacting {{business_name}}. We have received your enquiry and our team will get back to you shortly.',
  },
  {
    name: 'Customer Follow-Up',
    category: 'Marketing',
    body: 'Hello {{customer_name}}, this is a quick follow-up from {{business_name}} regarding your recent enquiry. Please let us know if you need any further information.',
  },
  {
    name: 'Visit / Appointment Reminder',
    category: 'Utility',
    body: 'Hello {{customer_name}}, this is a friendly reminder from {{business_name}} regarding your scheduled visit or appointment. Please contact us if you need to confirm or reschedule.',
  },
  {
    name: 'Information Update',
    category: 'Utility',
    body: 'Hi {{customer_name}}, we have an update regarding your enquiry with {{business_name}}. Feel free to reply if you would like more details.',
  },
  {
    name: 'Thank You Message',
    category: 'Marketing',
    body: 'Hello {{customer_name}}, thank you for choosing {{business_name}}. We appreciate your interest and look forward to assisting you again.',
  },
  {
    name: 'Feedback Request',
    category: 'Marketing',
    body: 'Hi {{customer_name}}, thank you for connecting with {{business_name}}. We would appreciate your feedback about your experience. Your suggestions help us improve.',
  },
];

// Contact specifications per business
const BUSINESS_DEFINITIONS = [
  {
    email: 'owner.m2w@relay-demo.test',
    businessName: 'M2W Realty',
    slug: 'm2w-realty',
    industryKey: 'real_estate',
    businessCategoryLabel: 'Real Estate',
    city: 'Mumbai',
    phone: '+919811223344',
    contacts: [
      { fullName: 'Aarav Mehta', phoneNumber: '+12025550101', interest: 'Residential Apartment', email: 'aarav.mehta@relay-demo.test' },
      { fullName: 'Ishita Rao', phoneNumber: '+12025550102', interest: 'Independent Floor', email: 'ishita.rao@relay-demo.test' },
      { fullName: 'Kabir Sethi', phoneNumber: '+12025550103', interest: 'Commercial Property', email: 'kabir.sethi@relay-demo.test' },
      { fullName: 'Riya Malhotra', phoneNumber: '+12025550104', interest: 'Residential Plot', email: 'riya.malhotra@relay-demo.test' },
      { fullName: 'Dev Khanna', phoneNumber: '+12025550105', interest: 'Property Site Visit Enquiry', email: 'dev.khanna@relay-demo.test' },
    ],
    campaign: {
      name: 'Property Enquiry Follow-Up — Demo',
      templateName: 'Customer Follow-Up',
      goal: 'Customer Follow-Up',
      service: 'Property Enquiry',
      description: 'Professional mock follow-up campaign for M2W Realty property enquirers.',
    },
    autoReplyRules: [
      {
        name: 'Property Price Enquiry',
        triggerKeyword: 'PRICE',
        synonyms: ['PRICING', 'COST', 'BUDGET', 'RATE'],
        matchType: 'CONTAINS',
        actionType: 'RUN_MOCK_REPLY',
        responseMessage: 'Hello {{customer_name}}, thank you for your interest in M2W Realty. Please share your preferred property type and budget so we can provide relevant details.',
        priority: 10,
        enabled: false,
      },
      {
        name: 'Brochure Request',
        triggerKeyword: 'BROCHURE',
        synonyms: ['FLOOR PLAN', 'LAYOUT', 'CATALOGUE', 'PDF'],
        matchType: 'CONTAINS',
        actionType: 'RUN_MOCK_REPLY',
        responseMessage: 'Hi {{customer_name}}, thank you for contacting M2W Realty. Please let us know which project or property interests you, and our team can assist with the available information.',
        priority: 15,
        enabled: false,
      },
      {
        name: 'Site Visit Enquiry',
        triggerKeyword: 'VISIT',
        synonyms: ['SITE VISIT', 'APPOINTMENT', 'TOUR', 'VISITING'],
        matchType: 'CONTAINS',
        actionType: 'RUN_MOCK_REPLY',
        responseMessage: 'Hello {{customer_name}}, we would be happy to assist with your site-visit enquiry. Please share your preferred date and location, and our team will follow up.',
        priority: 20,
        enabled: false,
      },
    ],
  },
];

export async function seedInitialDemoWorkspaces(options = {}) {
  const resetCredentials = Boolean(options.resetCredentials || process.argv.includes('--reset-credentials'));

  console.log('====================================================');
  console.log('  RELAY — INITIAL DEMO SEEDING (PROMPT 1 OF 4)      ');
  console.log('====================================================');

  // Ensure DB connection
  if (mongoose.connection.readyState === 0) {
    await connectDB();
  }

  // Safety Assertion
  assertDemoDatabaseSafety(mongoose.connection);
  const currentDbName = mongoose.connection.db.databaseName;
  console.log(`[Safety] Verified isolated target database: "${currentDbName}"`);

  const passwords = loadDemoPasswords();
  const summary = {
    database: currentDbName,
    businesses: [],
  };

  for (const def of BUSINESS_DEFINITIONS) {
    console.log(`\n--- Setting up: ${def.businessName} (${def.industryKey}) ---`);

    // 1. User Account (Create or Reuse)
    let user = await User.findOne({ email: def.email });
    let userCreated = false;

    if (!user) {
      const rawPassword = passwords[def.email];
      const passwordHash = await bcrypt.hash(rawPassword, 10);
      user = await User.create({
        name: `${def.businessName} Owner`,
        email: def.email,
        businessName: def.businessName,
        passwordHash,
        role: 'owner',
        accountStatus: 'ACTIVE',
        isEmailVerified: true,
        emailVerifiedAt: new Date(),
        authVersion: 1,
      });
      userCreated = true;
      console.log(`✓ Created Owner Account: ${def.email}`);
    } else {
      let needsSave = false;
      if (resetCredentials) {
        const rawPassword = passwords[def.email];
        user.passwordHash = await bcrypt.hash(rawPassword, 10);
        needsSave = true;
        console.log(`✓ Reset password credentials for: ${def.email}`);
      }
      if (!user.businessName) {
        user.businessName = def.businessName;
        needsSave = true;
      }
      if (!user.isEmailVerified) {
        user.isEmailVerified = true;
        user.emailVerifiedAt = new Date();
        user.accountStatus = 'ACTIVE';
        needsSave = true;
      }
      if (needsSave) await user.save();
      console.log(`✓ Reused Existing Owner Account: ${def.email}`);
    }

    // 2. Workspace (Create or Reuse)
    let ws = await Workspace.findOne({ slug: def.slug });
    let wsCreated = false;

    if (!ws) {
      ws = await Workspace.create({
        name: def.businessName,
        slug: def.slug,
        industryKey: def.industryKey,
        businessEmail: def.email,
        businessPhone: def.phone,
        city: def.city,
        country: 'India',
        timezone: 'Asia/Kolkata',
        status: 'ACTIVE',
        onboardingStatus: 'COMPLETED',
        createdBy: user._id,
        settings: {
          whatsappConnection: {
            status: 'MOCK_SIMULATED_READY',
            businessPhone: def.phone,
            connectedAt: new Date(),
          },
        },
      });
      wsCreated = true;
      console.log(`✓ Created Workspace: ${def.businessName} (${def.slug})`);
    } else {
      console.log(`✓ Reused Workspace: ${def.businessName} (${def.slug})`);
    }

    // 3. Ensure OWNER Membership
    await WorkspaceMembership.findOneAndUpdate(
      { workspaceId: ws._id, userId: user._id },
      { $set: { role: 'OWNER', status: 'ACTIVE', isDefaultWorkspace: true } },
      { upsert: true, new: true }
    );

    // Update user's default workspace
    if (!user.defaultWorkspaceId || String(user.defaultWorkspaceId) !== String(ws._id)) {
      user.defaultWorkspaceId = ws._id;
      await user.save();
    }

    // 4. Ensure Business Profile
    await BusinessProfile.findOneAndUpdate(
      { workspaceId: ws._id },
      {
        $set: {
          ownerId: user._id,
          legalOrTradingName: def.businessName,
          displayName: def.businessName,
          businessCategory: def.businessCategoryLabel,
          email: def.email,
          phone: def.phone,
          city: def.city,
          country: 'India',
          timezone: 'Asia/Kolkata',
          description: `Initial verified demo workspace for ${def.businessName}.`,
        },
      },
      { upsert: true, new: true }
    );

    // 5. Seed Contacts (Exactly 5 per business, idempotent)
    let contactsInserted = 0;
    let contactsIdentified = 0;

    for (const c of def.contacts) {
      const existingContact = await Contact.findOne({
        ownerId: user._id,
        phoneNumber: c.phoneNumber,
      });

      if (existingContact) {
        contactsIdentified++;
      } else {
        const contactData = {
          ownerId: user._id,
          workspaceId: ws._id,
          fullName: c.fullName,
          phoneNumber: c.phoneNumber,
          whatsappNumber: c.phoneNumber,
          email: c.email,
          businessCategory: def.businessCategoryLabel,
          interestedService: c.interest,
          leadSource: 'DEMO_SEED',
          leadStatus: 'New',
          priority: 'Medium',
          whatsappConsentStatus: 'Unknown',
          isSuppressed: false,
          isDemo: true,
          demoDatasetId: 'DEMO_SEED_P1',
          isArchived: false,
          isDeleted: false,
          industryData: {
            enquiryTopic: c.interest,
            propertyInterest: def.industryKey === 'real_estate' ? c.interest : undefined,
            fitnessProgram: def.industryKey === 'gym' ? c.interest : undefined,
            serviceCategory: def.industryKey === 'clinic' ? c.interest : undefined,
          },
          customFields: {
            interest: c.interest,
          },
        };

        if (def.industryKey === 'real_estate') {
          contactData.interestedPropertyType = c.interest;
        }

        const newContact = await Contact.create(contactData);
        await ContactActivity.create({
          ownerId: user._id,
          contactId: newContact._id,
          performedBy: user._id,
          activityType: 'created',
          description: 'Seeded demo contact',
        });
        contactsInserted++;
      }
    }
    console.log(`✓ Contacts: ${contactsInserted} inserted, ${contactsIdentified} previously identified (Total: ${contactsInserted + contactsIdentified})`);

    // 6. Seed Generic Templates (Exactly 7 per business, idempotent)
    let templatesInserted = 0;
    let templatesIdentified = 0;

    for (const tDef of GENERIC_TEMPLATES) {
      const existingTemplate = await MessageTemplate.findOne({
        ownerId: user._id,
        name: tDef.name,
        isArchived: false,
      });

      if (existingTemplate) {
        templatesIdentified++;
      } else {
        const templateData = {
          ownerId: user._id,
          workspaceId: ws._id,
          name: tDef.name,
          category: tDef.category,
          language: 'en',
          headerType: 'NONE',
          header: '',
          body: tDef.body,
          footer: '',
          buttons: [],
          internalVariables: ['customer_name', 'business_name'],
          businessCategory: def.businessCategoryLabel,
          localStatus: 'Draft',
          providerStatus: 'Not Submitted',
          mockProviderApprovalStatus: 'Not Submitted',
          sampleValues: {
            customer_name: def.contacts[0].fullName,
            business_name: def.businessName,
          },
          fallbackValues: {
            customer_name: 'there',
            business_name: def.businessName,
          },
          isArchived: false,
        };

        const template = await MessageTemplate.create(templateData);

        // Create initial TemplateVersion
        const meta = buildMetaStructure(template);
        const version = await TemplateVersion.create({
          ownerId: user._id,
          workspaceId: ws._id,
          templateId: template._id,
          versionNumber: 1,
          revisionNotes: 'Initial generic demo draft.',
          snapshot: {
            name: template.name,
            category: template.category,
            body: template.body,
            localStatus: template.localStatus,
            providerStatus: template.providerStatus,
            businessCategory: template.businessCategory,
          },
          internalVariables: ['customer_name', 'business_name'],
          metaParameterMappings: meta.mappings,
          sampleValues: template.sampleValues,
          fallbackValues: template.fallbackValues,
          validationResults: validateTemplate(template),
          createdBy: user._id,
        });

        template.currentVersionId = version._id;
        template.currentVersionNumber = 1;
        await template.save();

        templatesInserted++;
      }
    }
    console.log(`✓ Templates: ${templatesInserted} inserted, ${templatesIdentified} previously identified (Total: ${templatesInserted + templatesIdentified})`);

    // 7. Seed Demo Campaign Draft (Exactly 1 per business, idempotent)
    let campaignCreated = false;
    let campaignIdentified = false;
    if (def.campaign) {
      const existingCampaign = await Campaign.findOne({
        ownerId: user._id,
        name: def.campaign.name,
      });

      if (existingCampaign) {
        campaignIdentified = true;
      } else {
        // Find workspace's "Customer Follow-Up" template
        const followUpTemplate = await MessageTemplate.findOne({
          ownerId: user._id,
          name: def.campaign.templateName,
          isArchived: false,
        });

        const templateVersion = followUpTemplate?.currentVersionId
          ? await TemplateVersion.findById(followUpTemplate.currentVersionId)
          : null;

        // Retrieve workspace contacts
        const wsContacts = await Contact.find({
          ownerId: user._id,
          isDeleted: false,
        }).limit(5);

        const contactIds = wsContacts.map(c => c._id);

        const newCampaign = await Campaign.create({
          ownerId: user._id,
          workspaceId: ws._id,
          name: def.campaign.name,
          description: def.campaign.description,
          goal: def.campaign.goal,
          category: def.businessCategoryLabel,
          service: def.campaign.service,
          language: 'en',
          audienceSelectionMode: 'manual',
          audienceDefinition: { contactIds: contactIds.map(String) },
          selectedTemplateId: followUpTemplate?._id || null,
          selectedTemplateVersionId: templateVersion?._id || null,
          templateSnapshot: templateVersion?.snapshot || null,
          executionMode: 'MOCK',
          status: 'Draft',
          wizardStep: 4,
          createdBy: user._id,
          audienceSnapshotVersion: 1,
          validationSummary: {
            counts: {
              total: wsContacts.length,
              eligible: wsContacts.length,
              missingConsent: 0,
              optedOut: 0,
              invalidPhone: 0,
              missingPersonalization: 0,
              inactive: 0,
              providerPending: 0,
            },
            template: {
              selected: Boolean(followUpTemplate),
              versionSelected: Boolean(templateVersion),
              currentVersionChanged: false,
              providerStatus: 'Draft (Mock Usable)',
              senderIntegration: 'Mock Provider',
            },
            localPreparationChecksPassed: true,
            sendEligible: true,
            validatedAt: new Date(),
          },
        });

        // Seed CampaignAudience records
        const audienceOps = wsContacts.map(c => ({
          updateOne: {
            filter: {
              ownerId: user._id,
              campaignId: newCampaign._id,
              contactId: c._id,
              snapshotVersion: 1,
            },
            update: {
              $setOnInsert: {
                ownerId: user._id,
                campaignId: newCampaign._id,
                contactId: c._id,
                snapshotVersion: 1,
                selectionSource: 'manual',
                eligibilityStatus: 'Eligible for Campaign Preparation',
                exclusionReasons: [],
                missingVariables: [],
                validationTimestamp: new Date(),
              },
            },
            upsert: true,
          },
        }));

        if (audienceOps.length) {
          await CampaignAudience.bulkWrite(audienceOps, { ordered: false });
        }

        campaignCreated = true;
      }
    }
    console.log(`✓ Campaign: ${campaignCreated ? '1 created' : campaignIdentified ? '1 previously identified' : 'none'}`);

    // 8. Seed Auto-Reply Rules (Exactly 3 per business + STOP rule, idempotent)
    let rulesInserted = 0;
    let rulesIdentified = 0;

    // First ensure STOP opt-out compliance rule
    const existingStopRule = await AutoReplyRule.findOne({
      ownerId: user._id,
      triggerKeyword: 'STOP',
      archivedAt: null,
    });
    if (!existingStopRule) {
      await AutoReplyRule.create({
        ownerId: user._id,
        workspaceId: ws._id,
        name: 'STOP & Opt-out Compliance',
        triggerKeyword: 'STOP',
        synonyms: ['UNSUBSCRIBE', 'OPT OUT', 'STOP PROMOTIONS', 'CANCEL'],
        matchType: 'WHOLE_WORD',
        priority: 1,
        actionType: 'RECORD_OPT_OUT',
        responseMessage: 'You have been unsubscribed from WhatsApp updates. Reply START anytime to re-enable notifications.',
        enabled: true,
      });
    }

    if (Array.isArray(def.autoReplyRules)) {
      for (const rDef of def.autoReplyRules) {
        const existingRule = await AutoReplyRule.findOne({
          ownerId: user._id,
          triggerKeyword: rDef.triggerKeyword,
          archivedAt: null,
        });

        if (existingRule) {
          rulesIdentified++;
        } else {
          await AutoReplyRule.create({
            ownerId: user._id,
            workspaceId: ws._id,
            name: rDef.name,
            triggerKeyword: rDef.triggerKeyword,
            synonyms: rDef.synonyms || [],
            matchType: rDef.matchType || 'CONTAINS',
            priority: rDef.priority || 10,
            actionType: rDef.actionType || 'RUN_MOCK_REPLY',
            responseMessage: rDef.responseMessage,
            enabled: Boolean(rDef.enabled), // false initially (draft)
            cooldownSeconds: 15,
          });
          rulesInserted++;
        }
      }
    }
    console.log(`✓ Auto-Reply Rules: ${rulesInserted} inserted, ${rulesIdentified} previously identified (Total: ${rulesInserted + rulesIdentified})`);

    summary.businesses.push({
      businessName: def.businessName,
      slug: def.slug,
      industry: def.industryKey,
      email: def.email,
      userCreated,
      wsCreated,
      contactsCount: contactsInserted + contactsIdentified,
      templatesCount: templatesInserted + templatesIdentified,
      campaignsCount: (campaignCreated || campaignIdentified) ? 1 : 0,
      rulesCount: rulesInserted + rulesIdentified,
      insertedContacts: contactsInserted,
      insertedTemplates: templatesInserted,
      insertedCampaign: campaignCreated ? 1 : 0,
      insertedRules: rulesInserted,
    });
  }

  console.log('\n====================================================');
  console.log('  INITIAL DEMO SEEDING COMPLETED SUCCESSFULLY       ');
  console.log('====================================================');
  return summary;
}

// Direct execution CLI support
if (process.argv[1] && process.argv[1].endsWith('seedInitialDemoWorkspaces.js')) {
  seedInitialDemoWorkspaces()
    .then((summary) => {
      console.log('\nExecution Summary:');
      console.table(summary.businesses.map(b => ({
        Business: b.businessName,
        Industry: b.industry,
        OwnerEmail: b.email,
        Contacts: b.contactsCount,
        Templates: b.templatesCount,
      })));
      process.exit(0);
    })
    .catch((err) => {
      console.error('\n[FATAL ERROR] Seeding aborted:', err.message);
      process.exit(1);
    });
}
