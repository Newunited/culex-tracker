const {lib}=require('./api.js');
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>'&#'+c.charCodeAt(0)+';');
const ad=(d,n)=>{const t=new Date(d+'T00:00:00Z');t.setUTCDate(t.getUTCDate()+n);return t.toISOString().slice(0,10)};
exports.handler=async()=>{try{
 if(!process.env.RESEND_API_KEY)return{statusCode:200,body:'RESEND_API_KEY not set'};
 const today=new Date().toISOString().slice(0,10),t=new Date(today+'T00:00:00Z');t.setUTCMonth(t.getUTCMonth()+4);const lim=t.toISOString().slice(0,10);
 const roster=await lib.roster(),res=new Set((await lib.load('resign.json',[])).data.map(r=>r.e)),em=i=>roster.find(e=>e[0]===i);
 const fresh=(await lib.load('leave.json',[])).data.filter(l=>!l.n&&(l.a==='Approved'||l.a==='Pending')&&l.s>=today&&l.s<=lim&&em(l.e)&&!res.has(l.e)).sort((a,b)=>a.s.localeCompare(b.s));
 if(!fresh.length)return{statusCode:200,body:'Nothing to send'};
 const rows=fresh.map(l=>`<tr><td>${esc(em(l.e)[1])}</td><td>${esc(lib.BRANCHES[l.b])}</td><td>${esc(em(l.e)[2])}</td><td>${l.s}</td><td>${ad(l.d,1)}</td><td>${l.a}</td></tr>`).join('');
 const html=`<p>Leave starting within 4 months:</p><table border="1" cellpadding="6" style="border-collapse:collapse"><tr><th>Employee</th><th>Branch</th><th>Position</th><th>Leave starts</th><th>Returns on</th><th>Status</th></tr>${rows}</table>`;
 const r=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+process.env.RESEND_API_KEY,'Content-Type':'application/json'},
  body:JSON.stringify({from:'Culex Tracker <onboarding@resend.dev>',to:[process.env.NOTIFY_EMAIL||'paisan@culexhospitality.com'],subject:'Leave reminder: '+fresh.length+' upcoming',html})});
 if(!r.ok)throw new Error('Email error '+r.status);
 const ids=new Set(fresh.map(l=>l.id));await lib.update('leave.json',[],a=>a.map(l=>ids.has(l.id)?{...l,n:1}:l),'Mark reminders sent');
 return{statusCode:200,body:'Sent '+fresh.length}}catch(e){return{statusCode:500,body:e.message}}};
