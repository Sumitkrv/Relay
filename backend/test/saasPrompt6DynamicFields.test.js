import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateContactIndustryData } from '../src/services/industry/industryValidationService.js';
import {
  extractContactIndustryFields,
  adaptContactPayloadForSave,
  REAL_ESTATE_CANONICAL_KEYS,
} from '../src/services/industry/industryCompatibilityAdapter.js';

test('SaaS Prompt 6 — Dynamic Contact Fields & Compatibility Tests', async (t) => {
  // Test 21: Real Estate fields validate
  await t.test('21. Real Estate fields validate correctly', () => {
    const data = {
      interestedPropertyType: 'Apartment',
      interestedProject: 'Sobha City',
      budgetRange: '₹1 Cr - ₹2 Cr',
      preferredLocation: 'Dwarka Expressway',
      siteVisitInterest: 'Yes - Scheduled',
      preferredVisitDate: '2026-11-20',
    };
    const res = validateContactIndustryData(data, 'real_estate');
    assert.equal(res.isValid, true);
    assert.equal(res.sanitized.interestedPropertyType, 'Apartment');
    assert.equal(res.sanitized.interestedProject, 'Sobha City');
  });

  // Test 22: Gym fields validate
  await t.test('22. Gym & Fitness fields validate correctly', () => {
    const data = {
      membershipInterest: 'Quarterly',
      fitnessProgram: 'Strength Training',
      branch: 'Indiranagar Club',
      trialSessionInterest: 'Scheduled',
      preferredTiming: 'Early Morning (6 AM - 9 AM)',
      membershipDuration: '3 Months',
    };
    const res = validateContactIndustryData(data, 'gym');
    assert.equal(res.isValid, true);
    assert.equal(res.sanitized.membershipInterest, 'Quarterly');
    assert.equal(res.sanitized.fitnessProgram, 'Strength Training');
  });

  // Test 23: Clinic fields validate
  await t.test('23. Clinic & Healthcare fields validate without collecting sensitive records', () => {
    const data = {
      serviceInterest: 'General Consultation',
      serviceCategory: 'OPD Consultation',
      branch: 'Central Medical Center',
      preferredEnquiryTime: 'Morning (9 AM - 1 PM)',
      followUpPreference: 'WhatsApp Message',
    };
    const res = validateContactIndustryData(data, 'clinic');
    assert.equal(res.isValid, true);
    assert.equal(res.sanitized.serviceInterest, 'General Consultation');
  });

  // Test 24: Education fields validate
  await t.test('24. Education fields validate without minor sensitive data collection', () => {
    const data = {
      courseInterest: 'Full-Stack JavaScript Engineering',
      batchPreference: 'Weekend Only',
      learningMode: 'Live Online',
      campus: 'Virtual Academy',
      admissionEnquiryStatus: 'Counselling Scheduled',
      preferredContactTime: 'Evening (4 PM - 7 PM)',
    };
    const res = validateContactIndustryData(data, 'education');
    assert.equal(res.isValid, true);
    assert.equal(res.sanitized.batchPreference, 'Weekend Only');
  });

  // Test 25: Salon fields validate
  await t.test('25. Salon & Beauty fields validate correctly', () => {
    const data = {
      serviceInterest: 'Hair Care & Styling',
      packageInterest: 'Monthly Care Package',
      preferredBranch: 'Studio Galleria',
      preferredAppointmentTime: 'Morning (10 AM - 1 PM)',
      generalEnquiryStatus: 'Slot Requested',
    };
    const res = validateContactIndustryData(data, 'salon');
    assert.equal(res.isValid, true);
    assert.equal(res.sanitized.serviceInterest, 'Hair Care & Styling');
  });

  // Test 26: Automobile fields validate
  await t.test('26. Automobile fields validate correctly', () => {
    const data = {
      vehicleModelInterest: 'Thar Roxx 4x4',
      vehicleCategory: 'Mid-Size SUV',
      preferredDealership: 'Ring Road Showroom',
      testDriveInterest: 'Scheduled',
      purchaseTimeframe: 'This Month',
      budgetRange: '₹15L - ₹25 Lacs',
    };
    const res = validateContactIndustryData(data, 'automobile');
    assert.equal(res.isValid, true);
    assert.equal(res.sanitized.vehicleCategory, 'Mid-Size SUV');
  });

  // Test 27: Other business fields validate
  await t.test('27. Other businesses generic fields validate correctly', () => {
    const data = {
      serviceInterest: 'Architectural Design Consultation',
      enquiryType: 'Quote Request',
      preferredLocation: 'Bengaluru',
      preferredContactTime: 'Afternoon (12 PM - 4 PM)',
      businessCategory: 'Design & Architecture',
    };
    const res = validateContactIndustryData(data, 'other');
    assert.equal(res.isValid, true);
    assert.equal(res.sanitized.enquiryType, 'Quote Request');
  });

  // Test 28: Invalid enum values are rejected
  await t.test('28. Invalid enum values are rejected with clear feedback', () => {
    const res = validateContactIndustryData({ membershipInterest: 'LifetimeFreePass' }, 'gym');
    assert.equal(res.isValid, false);
    assert.match(res.errors[0], /Invalid option "LifetimeFreePass" for field "Membership Tier"/);
  });

  // Test 29: Oversized input string is rejected
  await t.test('29. Oversized string input exceeding bounds is rejected', () => {
    const longString = 'A'.repeat(200); // Exceeds maxLength: 160
    const res = validateContactIndustryData({ interestedProject: longString }, 'real_estate');
    assert.equal(res.isValid, false);
    assert.match(res.errors[0], /cannot exceed 160 characters/);
  });

  // Test 30: Old M2W property values remain unchanged via adapter
  await t.test('30. Old M2W property values are preserved via compatibility adapter', () => {
    const legacyM2WContact = {
      _id: '67b7e8d12345678901234567',
      fullName: 'Vikram Malhotra',
      phoneNumber: '+919811223344',
      interestedPropertyType: '3 BHK Apartment',
      interestedProject: 'DLF The Arbour',
      budgetRange: '₹2 Cr - ₹5 Cr',
      preferredLocation: 'Sector 63, Gurugram',
      preferredContactTime: 'Evening 6 PM',
      enquiryDate: new Date('2026-01-15T10:00:00Z'),
      industryData: {}, // Empty industryData on old records
    };

    const extracted = extractContactIndustryFields(legacyM2WContact, 'real_estate');
    assert.equal(extracted.interestedPropertyType, '3 BHK Apartment');
    assert.equal(extracted.interestedProject, 'DLF The Arbour');
    assert.equal(extracted.budgetRange, '₹2 Cr - ₹5 Cr');
    assert.equal(extracted.preferredLocation, 'Sector 63, Gurugram');
    assert.equal(extracted.preferredContactTime, 'Evening 6 PM');
    assert.ok(extracted.enquiryDate);
  });

  // Test 31: Saving Real Estate contact mirrors canonical top-level fields
  await t.test('31. Saving Real Estate contact mirrors canonical top-level fields', () => {
    const payload = { fullName: 'Ananya Sharma' };
    const validatedData = {
      interestedPropertyType: 'Villa',
      interestedProject: 'Sobha Palm Glades',
      budgetRange: 'Above ₹5 Cr',
      preferredLocation: 'Whitefield',
    };

    const adapted = adaptContactPayloadForSave(payload, validatedData, 'real_estate');
    // Verifies top-level canonical fields are set for M2W backwards compatibility
    assert.equal(adapted.interestedPropertyType, 'Villa');
    assert.equal(adapted.interestedProject, 'Sobha Palm Glades');
    assert.equal(adapted.budgetRange, 'Above ₹5 Cr');
    assert.equal(adapted.preferredLocation, 'Whitefield');
    // Verifies industryData is also populated
    assert.equal(adapted.industryData.interestedPropertyType, 'Villa');
    assert.equal(adapted.industryData.interestedProject, 'Sobha Palm Glades');
  });

  // Test 32: Non-real-estate vertical preserves clean industryData without leaking top-level fields
  await t.test('32. Non-real-estate vertical stores cleanly in industryData without polluting top-level', () => {
    const payload = { fullName: 'Rohan Mehra' };
    const validatedData = {
      membershipInterest: 'Annual',
      fitnessProgram: 'CrossFit',
    };

    const adapted = adaptContactPayloadForSave(payload, validatedData, 'gym');
    assert.equal(adapted.industryData.membershipInterest, 'Annual');
    assert.equal(adapted.industryData.fitnessProgram, 'CrossFit');
    assert.equal(adapted.interestedPropertyType, undefined);
  });
});
