import fs from 'node:fs';
const S=JSON.parse(fs.readFileSync(new URL('./audit-session.json',import.meta.url)));
const c=async(k,m,p,b)=>{const r=await fetch('http://localhost:5000/api'+p,{method:m,headers:{'Content-Type':'application/json',Authorization:'Bearer '+S[k].token},body:b?JSON.stringify(b):undefined});let j;try{j=await r.json()}catch{};return {s:r.status,j}};
const sh=(o,n=900)=>String(JSON.stringify(o)).slice(0,n);
const camp=(await c('gym','GET','/campaigns')).j.records[0];
console.log('campaign',sh(camp,1200));
let r=await c('gym','POST',`/campaigns/${camp._id}/validate`,{});console.log('validate',r.s,sh(r.j,600));
r=await c('gym','POST',`/campaigns/${camp._id}/preview`,{});console.log('preview',r.s,sh(r.j,600));
r=await c('gym','GET','/reports/overview?range=30d');console.log('rep',r.s,sh(r.j.kpis),sh(r.j.secondaryMetrics,500));
