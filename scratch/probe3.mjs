import fs from 'node:fs';
const S=JSON.parse(fs.readFileSync(new URL('./audit-session.json',import.meta.url)));
const c=async(k,m,p,b)=>{const r=await fetch('http://localhost:5000/api'+p,{method:m,headers:{'Content-Type':'application/json',Authorization:'Bearer '+S[k].token},body:b?JSON.stringify(b):undefined});let j;try{j=await r.json()}catch{};return {s:r.status,j}};
const t=(await c('clinic','GET','/templates?limit=50')).j.records.find(x=>x.name==='Welcome Message');
const ct=(await c('clinic','GET','/contacts')).j.records[0];
console.log(JSON.stringify((await c('clinic','POST',`/templates/${t._id}/preview`,{contactId:ct._id})).j).slice(0,700));
console.log(t.body);
