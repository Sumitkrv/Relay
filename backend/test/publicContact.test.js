import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';

import app from '../src/app.js';
import PublicEnquiry from '../src/models/PublicEnquiry.js';

let mongod;

describe('SaaS Prompt 3 — Public Contact & Enquiry API Tests', () => {
  before(async () => {
    process.env.NODE_ENV = 'test';
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
  });

  after(async () => {
    await mongoose.disconnect();
    await mongod.stop();
  });

  test('1. Valid submission creates PublicEnquiry and returns 201', async () => {
    const payload = {
      fullName: 'Rahul Sharma',
      businessEmail: 'rahul@apexfitness.example',
      businessName: 'Apex Fitness Club',
      industry: 'gym',
      contactReason: 'pricing',
      phone: '+919876543210',
      message: 'Interested in Relay Solo for our fitness studio chain in Pune.',
    };

    const res = await request(app).post('/api/public/contact').send(payload);

    assert.equal(res.status, 201);
    assert.equal(res.body.success, true);
    assert.equal(res.body.code, 'ENQUIRY_SUBMITTED');
    assert.ok(res.body.enquiryId);

    const doc = await PublicEnquiry.findById(res.body.enquiryId);
    assert.ok(doc);
    assert.equal(doc.businessEmail, 'rahul@apexfitness.example');
    assert.equal(doc.industry, 'gym');
    assert.equal(doc.contactReason, 'pricing');
    assert.equal(doc.status, 'new');
  });

  test('2. Rejects submission with invalid email format (400)', async () => {
    const payload = {
      fullName: 'Anita Roy',
      businessEmail: 'not-an-email',
      businessName: 'Roy Dental Care',
      message: 'Looking for clinic appointment enquiry automation.',
    };

    const res = await request(app).post('/api/public/contact').send(payload);
    assert.equal(res.status, 400);
    assert.equal(res.body.code, 'INVALID_EMAIL');
  });

  test('3. Rejects submission with missing name or business name (400)', async () => {
    const payload = {
      fullName: 'A',
      businessEmail: 'anita@roydental.example',
      businessName: '',
      message: 'Enquiry message here.',
    };

    const res = await request(app).post('/api/public/contact').send(payload);
    assert.equal(res.status, 400);
  });

  test('4. Safely defaults unknown industry to "other"', async () => {
    const payload = {
      fullName: 'Sunil Verma',
      businessEmail: 'sunil@custombiz.example',
      businessName: 'Custom Logistic Works',
      industry: 'aerospace_unsupported_slug',
      message: 'Need WhatsApp notifications for shipments.',
    };

    const res = await request(app).post('/api/public/contact').send(payload);
    assert.equal(res.status, 201);

    const doc = await PublicEnquiry.findById(res.body.enquiryId);
    assert.equal(doc.industry, 'other');
  });
});
