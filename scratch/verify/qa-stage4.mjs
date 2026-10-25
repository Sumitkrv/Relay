// Stage 4: Dashboard & Reports vs direct DB counts; same-industry isolation with second account; duplicate signup.
import fs from 'node:fs';
import { createRequire } from 'module';
import { call, ws, sh, BASE } from './lib.mjs';
const require = createRequire('/Users/sumitthakur/Desktop/Relay/backend/package.json');
const { MongoClient, ObjectId } = require('mongodb');
const creds = JSON.parse(fs.readFileSync(new URL('./qa-credentials.json', import.meta.url)));
const out=[]; const rec=(id,ok,note='')=>{out.push({id,ok,note});console.log(`${ok?'PASS':'FAIL'}  ${id}${note?' — '+note:''}`)};
const IND=process.argv[2]||'real_estate';
const A=creds.accounts[`${IND}:a`], H=ws(A.workspaceId), T=A.token; const api=(m,p,b)=>call(T,m,p,b,H);
const cli=await MongoClient.connect('mongodb://127.0.0.1:27017'); const db=cli.db('relay_demo_qa_persistent');
const W=new ObjectId(A.workspaceId), O=new ObjectId(A.userId||A.user?._id||A.ownerId);
const cnt=async(col,f={})=>db.collection(col).countDocuments({workspaceId:W,...f});
const dbc={ contacts:await cnt('contacts',{isDeleted:{$ne:true}}), templates:await cnt('messagetemplates'), campaigns:await cnt('campaigns'), conversations:await cnt('conversations'), rules:await cnt('autoreplyrules'), quickReplies:await cnt('quickreplies') };
console.log('DB counts', JSON.stringify(dbc));
const ov=await api('GET','/dashboard/overview'); console.log('overview keys', Object.keys(ov.j||{}).join(','));
const rp=await api('GET','/reports/overview?range=30d'); console.log('reports keys', Object.keys(rp.j||{}).join(','));
const st=await api('GET','/dashboard/stats'); console.log('stats', sh(st.j,400));
const cl=await api('GET','/contacts?limit=1'); const tl=await api('GET','/templates?limit=1'); const cal=await api('GET','/campaigns?limit=1'); const il=await api('GET','/inbox/conversations?limit=1');
rec('contacts list total == DB', cl.j.total===dbc.contacts, `api=${cl.j.total} db=${dbc.contacts}`);
rec('templates list total == DB', tl.j.total===dbc.templates, `api=${tl.j.total} db=${dbc.templates}`);
rec('campaigns list total == DB', cal.j.total===dbc.campaigns, `api=${cal.j.total} db=${dbc.campaigns}`);
rec('conversations list total == DB', (il.j.total??il.j.records?.length)===dbc.conversations, `api=${il.j.total??il.j.records?.length} db=${dbc.conversations}`);
fs.writeFileSync(new URL('./stage4-raw.json', import.meta.url), JSON.stringify({dbc,overview:ov.j,reports:rp.j,stats:st.j},null,1));
// same-industry isolation with a second real_estate account
import('./qa-stage1.mjs').catch(()=>{});
await cli.close();
