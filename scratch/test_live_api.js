import 'dotenv/config';
import jwt from 'jsonwebtoken';
import User from '../backend/src/models/User.js';
import Workspace from '../backend/src/models/Workspace.js';
import connectDB from '../backend/src/config/db.js';

async function main() {
  await connectDB();
  const vidhi = await User.findOne({ email: 'vidhi@example.com' });
  const vidhiWs = await Workspace.findById('6adb867e321e7c433689a93a');
  console.log('Vidhi Workspace:', vidhiWs?.name, 'Industry:', vidhiWs?.industryKey);

  const m2w = await User.findOne({ email: 'owner.m2w@relay-demo.test' });
  const m2wWs = await Workspace.findById('6adaf2ccbaacf0587d451ae6');
  console.log('M2W Workspace:', m2wWs?.name, 'Industry:', m2wWs?.industryKey);

  const vidhiToken = jwt.sign({ sub: String(vidhi._id) }, process.env.JWT_SECRET);
  const m2wToken = jwt.sign({ sub: String(m2w._id) }, process.env.JWT_SECRET);

  // 1. Vidhi Templates Library
  const vidhiTplRes = await fetch('http://localhost:5000/api/templates/library', {
    headers: { Authorization: `Bearer ${vidhiToken}`, 'x-workspace-id': String(vidhiWs._id) }
  });
  const vidhiTpl = await vidhiTplRes.json();
  console.log('\n--- VIDHI CLINIC TEMPLATES ---');
  console.log('Status:', vidhiTplRes.status, 'IndustryKey:', vidhiTpl.industryKey, 'Count:', vidhiTpl.records?.length);
  console.log('First 3 template names:', vidhiTpl.records?.slice(0, 3).map(r => r.name));
  const hasRealEstateInClinicTpl = JSON.stringify(vidhiTpl).toLowerCase().includes('golf course') || JSON.stringify(vidhiTpl).toLowerCase().includes('property brochure');
  console.log('Has Real Estate in Clinic templates?', hasRealEstateInClinicTpl);

  // 2. Vidhi Quick Replies
  const vidhiQrRes = await fetch('http://localhost:5000/api/inbox/quick-replies', {
    headers: { Authorization: `Bearer ${vidhiToken}`, 'x-workspace-id': String(vidhiWs._id) }
  });
  const vidhiQr = await vidhiQrRes.json();
  console.log('\n--- VIDHI CLINIC QUICK REPLIES ---');
  console.log('Status:', vidhiQrRes.status, 'Saved count:', vidhiQr.records?.length, 'Presets count:', vidhiQr.presets?.length);
  console.log('Presets titles:', vidhiQr.presets?.map(p => p.title));
  const hasRealEstateInClinicQr = JSON.stringify(vidhiQr).toLowerCase().includes('golf course') || JSON.stringify(vidhiQr).toLowerCase().includes('master plan');
  console.log('Has Real Estate in Clinic quick replies?', hasRealEstateInClinicQr);

  // 3. Vidhi Auto-Reply Rules
  const vidhiRulesRes = await fetch('http://localhost:5000/api/inbox/auto-reply-rules', {
    headers: { Authorization: `Bearer ${vidhiToken}`, 'x-workspace-id': String(vidhiWs._id) }
  });
  const vidhiRules = await vidhiRulesRes.json();
  console.log('\n--- VIDHI CLINIC AUTO-REPLY RULES ---');
  console.log('Status:', vidhiRulesRes.status, 'Saved count:', vidhiRules.records?.length, 'Presets count:', vidhiRules.presets?.length);
  console.log('Presets names:', vidhiRules.presets?.map(p => p.displayName));
  console.log('Protected STOP rule text:', vidhiRules.records?.[0]?.responseMessage);
  const stopMentionsProperty = vidhiRules.records?.[0]?.responseMessage?.includes('property');
  console.log('STOP rule mentions property?', stopMentionsProperty);

  // 4. M2W Realty Templates Library
  const m2wTplRes = await fetch('http://localhost:5000/api/templates/library', {
    headers: { Authorization: `Bearer ${m2wToken}`, 'x-workspace-id': String(m2wWs._id) }
  });
  const m2wTpl = await m2wTplRes.json();
  console.log('\n--- M2W REAL ESTATE TEMPLATES ---');
  console.log('Status:', m2wTplRes.status, 'IndustryKey:', m2wTpl.industryKey, 'Count:', m2wTpl.records?.length);
  console.log('First 3 template names:', m2wTpl.records?.slice(0, 3).map(r => r.name));

  // 5. M2W Quick Replies
  const m2wQrRes = await fetch('http://localhost:5000/api/inbox/quick-replies', {
    headers: { Authorization: `Bearer ${m2wToken}`, 'x-workspace-id': String(m2wWs._id) }
  });
  const m2wQr = await m2wQrRes.json();
  console.log('\n--- M2W REAL ESTATE QUICK REPLIES ---');
  console.log('Status:', m2wQrRes.status, 'Saved count:', m2wQr.records?.length, 'Presets count:', m2wQr.presets?.length);
  console.log('Saved titles (first 3):', m2wQr.records?.slice(0, 3).map(r => r.name));

  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
