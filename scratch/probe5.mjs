import fs from 'node:fs';
const S=JSON.parse(fs.readFileSync(new URL('./audit-session.json',import.meta.url)));
const c=async(k,m,p,b)=>{const r=await fetch('http://localhost:5000/api'+p,{method:m,headers:{'Content-Type':'application/json',Authorization:'Bearer '+S[k].token},body:b?JSON.stringify(b):undefined});let j;try{j=await r.json()}catch{};return {s:r.status,j}};
for (const k of ['m2w','gym','clinic']){const cs=(await c(k,'GET','/campaigns')).j.records;const d=(await c(k,'GET','/dashboard/overview')).j;console.log(k,cs.map(x=>x.status+'|'+x.mockSchedule?.status),'dash',JSON.stringify(d.campaigns).slice(0,200));}
