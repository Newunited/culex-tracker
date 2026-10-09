const {lib}=require('./api.js');
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>'&#'+c.charCodeAt(0)+';');
const ad=(d,n)=>{const t=new Date(d+'T00:00:00Z');t.setUTCDate(t.getUTCDate()+n);return t.toISOString().slice(0,10)};
const am=(d,n)=>{const t=new Date(d+'T00:00:00Z');t.setUTCMonth(t.getUTCMonth()+n);return t.toISOString().slice(0,10)};
const send=async(to,subject,html)=>{const r=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+process.env.RESEND_API_KEY,'Content-Type':'application/json'},body:JSON.stringify({from:process.env.MAIL_FROM||'Culex Tracker <onboarding@resend.dev>',to,subject,html})});if(!r.ok)throw new Error('Email error '+r.status+' to '+to)};
const tbl=(h,rows)=>`<table border="1" cellpadding="6" style="border-collapse:collapse"><tr>${h.map(v=>'<th>'+v+'</th>').join('')}</tr>${rows.map(r=>'<tr>'+r.map(v=>'<td>'+esc(v)+'</td>').join('')+'</tr>').join('')}</table>`;
exports.handler=async()=>{try{
 if(!process.env.RESEND_API_KEY)return{statusCode:200,body:'RESEND_API_KEY not set'};
 const today=new Date().toISOString().slice(0,10),roster=await lib.roster(),S=await lib.sett(),res=new Set((await lib.load('resign.json',[])).data.map(r=>r.e)),em=i=>roster.find(e=>e[0]===i);
 const master=(process.env.NOTIFY_EMAIL||'paisan@culexhospitality.com').split(',').map(s=>s.trim()).filter(Boolean),sentC=S.sentC||{};
 const L=(await lib.load('leave.json',[])).data.filter(l=>!l.n&&(l.a==='Approved'||l.a==='Pending')&&l.s>=today&&l.s<=am(today,4)&&em(l.e)&&!res.has(l.e)).sort((a,b)=>a.s.localeCompare(b.s));
 const C=roster.filter(e=>e[5]&&e[5]>=today&&e[5]<=am(today,2)&&!res.has(e[0])&&sentC[e[0]]!==e[5]).sort((a,b)=>a[5].localeCompare(b[5]));
 if(!L.length&&!C.length)return{statusCode:200,body:'Nothing to send'};
 const body=(l,c,br)=>(l.length?`<p>Leave starting within 4 months:</p>`+tbl(['Employee',...(br?['Branch']:[]),'Position','Leave starts','Returns on','Status'],l.map(x=>[em(x.e)[1],...(br?[lib.BRANCHES[x.b]]:[]),em(x.e)[2],x.s,x.rd||ad(x.d,1),x.a])):'')+(c.length?`<p>Contracts ending within 2 months:</p>`+tbl(['Employee',...(br?['Branch']:[]),'Position','Contract ends'],c.map(e=>[e[1],...(br?[lib.BRANCHES[e[3]]]:[]),e[2],e[5]])):'');
 const errs=[];
 for(let b=0;b<lib.BRANCHES.length;b++){const l=L.filter(x=>x.b===b),c=C.filter(e=>e[3]===b),to=(S.mail||{})[b];if(to&&(l.length||c.length)){try{await send([to],lib.BRANCHES[b]+': leave and contract reminders',body(l,c,false))}catch(e){errs.push(e.message)}}}
 await send(master,'Culex: leave and contract reminders ('+(L.length+C.length)+')',body(L,C,true));
 const ids=new Set(L.map(l=>l.id));if(L.length)await lib.update('leave.json',[],a=>a.map(l=>ids.has(l.id)?{...l,n:1}:l),'Mark reminders sent');
 if(C.length)await lib.update('settings.json',{full:{},mail:{}},s=>({...s,sentC:{...(s.sentC||{}),...Object.fromEntries(C.map(e=>[e[0],e[5]]))}}),'Mark contract reminders');
 return{statusCode:200,body:'Sent '+(L.length+C.length)+(errs.length?'; branch errors: '+errs.join(' | '):'')}}catch(e){return{statusCode:500,body:e.message}}};
