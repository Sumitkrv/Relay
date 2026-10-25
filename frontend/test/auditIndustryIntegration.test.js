import test from 'node:test';
import assert from 'node:assert/strict';
import { fieldOptions, readContactField, industryFieldPayload } from '../src/utils/contactFields.js';
import { getPublicIndustrySummaries, getStrictIndustryConfig } from '../../backend/src/config/industries/industryRegistry.js';

test('dynamic contact fields preserve saved legacy values and do not invent defaults', () => {
  for (const { key } of getPublicIndustrySummaries()) {
    for (const field of getStrictIndustryConfig(key).contactFields) {
      assert.deepEqual(readContactField(null, field), field.type === 'multiselect' ? [] : '');
      assert.equal(fieldOptions(field).length, field.options?.length || 0);
    }
  }
  const field = { key: 'interestedPropertyType', isCanonical: true, type: 'select', options: ['Apartment'] };
  const contact = { interestedPropertyType: 'Existing custom value', industryData: { interestedPropertyType: 'Old value' } };
  assert.equal(readContactField(contact, field), 'Existing custom value');
  assert.deepEqual(industryFieldPayload([field], { interestedPropertyType: 'Existing custom value' }, contact), { industryData: {} });
  assert.deepEqual(industryFieldPayload([field], { interestedPropertyType: 'Apartment' }, contact), { interestedPropertyType: 'Apartment', industryData: {} });
});

test('dynamic contact payload retains numbers, explicit blanks, dates and multiselect choices', () => {
  const fields = [{ key: 'guestCount', type: 'number' }, { key: 'checkInDate', type: 'date' }, { key: 'services', type: 'multiselect' }];
  assert.deepEqual(industryFieldPayload(fields, { guestCount: '0', checkInDate: '', services: ['Repair'] }), { industryData: { guestCount: 0, checkInDate: null, services: ['Repair'] } });
});

test('operational drafts resolve saved industry data and retain missing tokens without samples', async () => {
  const { resolveContactVariables } = await import('../src/utils/crmVariables.js');
  const text = '{{technician_name}} {{guest_count}} {{business_name}} {{business_hours}}';
  assert.equal(resolveContactVariables(text, { industryData: { technicianName: 'QA Technician', guestCount: 0 } }, { name: 'QA Workspace' }), 'QA Technician 0 QA Workspace {{business_hours}}');
});
