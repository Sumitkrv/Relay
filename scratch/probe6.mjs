import fs from 'node:fs';
const S=JSON.parse(fs.readFileSync(new URL('./audit-session.json',import.meta.url)));
const c=async(k,m,p,b)=>{const r=await fetch('http://localhost:5000/api'+p,{method:m,headers:{'Content-Type':'application/json',Authorization:'Bearer '+S[k].token},body:b?JSON.stringify(b):undefined});let j;try{j=await r.json()}catch{};return {s:r.status,j}};
const sh=(o,n=700)=>String(JSON.stringify(o)).slice(0,n);
const camp=(await c('gym','GET','/campaigns')).j.records[0];
let r=await c('gym','POST',`/campaigns/${camp._id}/launch`,{});console.log('launch',r.s,sh(r.j,900));
r=await c('gym','POST',`/campaigns/${camp._id}/executions`,{mode:'MOCK'});console.log('exec',r.s,sh(r.j,900));
