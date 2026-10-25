import { createRequire } from 'module'; import fs from 'fs';
const require = createRequire('/Users/sumitthakur/Desktop/Relay/backend/package.json');
const mongoose = require('mongoose'); const bcrypt = require('bcryptjs');
const pw = JSON.parse(fs.readFileSync('/Users/sumitthakur/Desktop/Relay/scratch/.demo-passwords.json'));
await mongoose.connect('mongodb://127.0.0.1:27017');
const db = mongoose.connection.client.db('relay_demo');
for (const [e,p] of Object.entries(pw)) { const u = await db.collection('users').findOne({email:e}); console.log(e, 'file-password matches DB hash:', !!(u && await bcrypt.compare(p,u.passwordHash)), 'pwlen', p.length, 'lastLoginAt', u?.lastLoginAt, 'authVersion', u?.authVersion, 'accountStatus', u?.accountStatus); }
await mongoose.disconnect();
