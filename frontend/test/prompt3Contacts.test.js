import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');

test('Prompt 3 Contacts: ContactsPage defines professional tabs and action buttons', () => {
  const file = fs.readFileSync(path.join(root, 'src/pages/ContactsPage.jsx'), 'utf-8');
  assert.ok(file.includes("'contacts'"), 'All Contacts tab defined');
  assert.ok(file.includes("'groups'"), 'Groups tab defined');
  assert.ok(file.includes("'audiences'"), 'Saved Audiences tab defined');
  assert.ok(file.includes("'imports'"), 'Import History tab defined');
  assert.ok(file.includes('Add Contact'), 'Add Contact action present');
  assert.ok(file.includes('Import Excel'), 'Import Excel action present');
  assert.ok(file.includes('doExport') || file.includes('Export All Contacts'), 'Export Contacts action present');
  assert.ok(file.includes('ContactProfile'), 'Contact drawer profile present');
  assert.ok(file.includes('Open Inbox'), 'Open Inbox link present in drawer');
  assert.ok(file.includes('Campaigns'), 'Campaigns link present in drawer');
});

test('Prompt 3 Import Wizard: Smart import wizard supports 5 steps, presets, and duplicate policies', () => {
  const file = fs.readFileSync(path.join(root, 'src/components/ImportWizardModal.jsx'), 'utf-8');
  assert.ok(file.includes('Upload File'), 'Upload step present');
  assert.ok(file.includes('Map Columns'), 'Map columns step present');
  assert.ok(file.includes('Duplicates & Rules'), 'Duplicate policy step present');
  assert.ok(file.includes('Validate & Preview'), 'Validation summary step present');
  assert.ok(file.includes('Import Results'), 'Results step present');
  assert.ok(file.includes('Mapping Preset'), 'Mapping preset UI present');
  assert.ok(file.includes('handleApplyPreset'), 'Preset loading supported');
  assert.ok(file.includes('handleSavePreset'), 'Preset saving supported');
  assert.ok(file.includes('handleProceedToDuplicates'), 'Step 2 to Step 3 transition handler');
  assert.ok(file.includes('handleValidateAndPreview'), 'Step 3 to Step 4 validation handler');
});

test('Prompt 3 Campaigns Integration: CampaignBuilder supports Contact Groups alongside Segments and Imports', () => {
  const file = fs.readFileSync(path.join(root, 'src/pages/CampaignsPage.jsx'), 'utf-8');
  assert.ok(file.includes("'group'") && file.includes('Contact group'), 'Group mode in audience mode row');
  assert.ok(file.includes('listContactGroups'), 'listContactGroups imported');
  assert.ok(file.includes('selectedGroup'), 'selectedGroup state present');
  assert.ok(file.includes('groupId:selectedGroup') || file.includes('groupId: selectedGroup'), 'groupId passed in definition');
});

test('Prompt 3 Contact Groups & Tag Services: Complete API functions exported', () => {
  const groupService = fs.readFileSync(path.join(root, 'src/services/contactGroups.js'), 'utf-8');
  assert.ok(groupService.includes('listContactGroups'), 'listContactGroups exported');
  assert.ok(groupService.includes('createContactGroup'), 'createContactGroup exported');
  assert.ok(groupService.includes('updateContactGroup'), 'updateContactGroup exported');
  assert.ok(groupService.includes('deleteContactGroup'), 'deleteContactGroup exported');
  assert.ok(groupService.includes('manageGroupMembers'), 'manageGroupMembers exported');

  const contactService = fs.readFileSync(path.join(root, 'src/services/contacts.js'), 'utf-8');
  assert.ok(contactService.includes('listContacts'), 'listContacts exported');
  assert.ok(contactService.includes('createContact'), 'createContact exported');
  assert.ok(contactService.includes('updateContact'), 'updateContact exported');
  assert.ok(contactService.includes('getContactStats'), 'getContactStats exported');
  assert.ok(contactService.includes('bulkContacts'), 'bulkContacts exported');
  assert.ok(contactService.includes('downloadContacts'), 'downloadContacts exported');
});
