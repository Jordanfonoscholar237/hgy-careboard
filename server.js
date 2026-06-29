
require('dotenv').config();
const express = require('express');
const nodemailer = require('nodemailer');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 8080;
const DATA_PATH = path.join(__dirname, 'data', 'db.json');

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(morgan('dev'));
app.use(express.static(path.join(__dirname, 'public')));

function readDb(){ try { return JSON.parse(fs.readFileSync(DATA_PATH, 'utf8')); } catch(e){ return {users:[],patients:[],notes:[],orders:[],labs:[],imaging:[],alerts:[],services:[],audit:[],deviceReadings:[],aiHistory:[]}; } }
function writeDb(db){ fs.mkdirSync(path.dirname(DATA_PATH), {recursive:true}); fs.writeFileSync(DATA_PATH, JSON.stringify(db, null, 2), 'utf8'); }
function normalize(s){ return String(s||'').trim(); }
function now(){ return new Date().toISOString(); }
function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')){ const hash = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256').toString('hex'); return `${salt}:${hash}`; }
function verifyPassword(password, stored){ if(!stored || !stored.includes(':')) return false; const [salt, hash] = stored.split(':'); const candidate = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256').toString('hex'); try{return crypto.timingSafeEqual(Buffer.from(hash,'hex'), Buffer.from(candidate,'hex'));}catch(e){return false;} }
function token(){ return crypto.randomBytes(24).toString('hex'); }
function otp(){ return String(Math.floor(100000 + Math.random()*900000)); }
function publicUser(u){ return { id:u.id, username:u.username, fullName:u.fullName, email:u.email, department:u.department, verified:!!u.verified, role:u.role||'doctor' }; }
function audit(user, action, target, detail){ const db=readDb(); db.audit=db.audit||[]; db.audit.unshift({ts:now(), user:user?user.username:'system', action, target, detail}); db.audit=db.audit.slice(0,500); writeDb(db); }
function requireAuth(req,res,next){ const header=req.headers.authorization||''; const t=header.startsWith('Bearer ')?header.slice(7):''; const db=readDb(); const user=db.users.find(u=>u.sessionToken===t && u.sessionExp && u.sessionExp>Date.now()); if(!user) return res.status(401).json({ok:false,error:'Unauthorized'}); req.user=user; next(); }
function requirePatientAuth(req,res,next){
  const header=req.headers.authorization||'';
  const t=header.startsWith('Bearer ')?header.slice(7):'';
  const db=readDb();
  const account=(db.patientAccess||[]).find(a=>a.sessionToken===t && a.sessionExp && a.sessionExp>Date.now());
  if(!account) return res.status(401).json({ok:false,error:'Unauthorized patient access'});
  const patient=(db.patients||[]).find(p=>p.id===account.patientId);
  if(!patient) return res.status(404).json({ok:false,error:'Patient profile not found'});
  req.patientAccount=account;
  req.patient=patient;
  next();
}
function publicPatientAccount(account, patient){
  return {
    id: account.id,
    patientId: account.patientId,
    mrn: patient.mrn,
    name: patient.name,
    unit: patient.unit,
    room: patient.room,
    bed: patient.bed,
    verified: !!account.verified
  };
}
function ensureDemoPatientAccess(){
  const db=readDb();
  db.patientAccess=db.patientAccess||[];
  const patient=(db.patients||[]).find(p=>p.mrn==='MRN-001') || (db.patients||[])[0];
  if(patient && !db.patientAccess.find(a=>a.patientId===patient.id)){
    db.patientAccess.push({
      id:'pa-demo-1',
      patientId:patient.id,
      codeHash:hashPassword('PATIENT123'),
      verified:true,
      createdAt:now()
    });
    writeDb(db);
  }
}

async function sendVerificationEmail(user, code){
  if(String(process.env.EMAIL_DEV_MODE||'true').toLowerCase()==='true'){ console.log(`[DEV EMAIL] OTP for ${user.email}: ${code}`); return {dev:true}; }
  const transporter=nodemailer.createTransport({host:process.env.SMTP_HOST,port:Number(process.env.SMTP_PORT||587),secure:String(process.env.SMTP_SECURE||'false').toLowerCase()==='true',auth:{user:process.env.SMTP_USER,pass:process.env.SMTP_PASS}});
  await transporter.sendMail({from:process.env.MAIL_FROM||process.env.SMTP_USER,to:user.email,subject:'Your LifeView Central verification code',text:`Hello ${user.fullName},\n\nYour LifeView Central verification code is: ${code}\n\nThis code expires in 10 minutes.\n\nYAOUNDE GENERAL HOSPITAL`,html:`<h2>LifeView Central</h2><p>Your code is:</p><div style="font-size:30px;font-weight:bold;letter-spacing:4px">${code}</div><p>YAOUNDE GENERAL HOSPITAL</p>`});
  return {dev:false};
}
function ensureDemoUser(){ const db=readDb(); if(!db.users.find(u=>u.username==='dr.alvarez')){ db.users.push({id:'u-demo-1',username:'dr.alvarez',fullName:'Dr. Sofia Alvarez',email:'demo@lifeview.local',department:'ICU',role:'doctor',verified:true,passwordHash:hashPassword('Password!123'),createdAt:now()}); writeDb(db); } }
function ensureDemoPatientData(){
  const db=readDb();
  db.patients=db.patients||[];
  if(db.patients.length) return;
  db.patients.push({
    id:'p1',
    mrn:'MRN-001',
    name:'Jane Demo',
    unit:'ICU',
    bed:'ICU-1',
    room:'ICU Wing A',
    age:'46',
    sex:'F',
    bloodType:'O+',
    tag:'High Risk',
    status:'critical',
    diagnosis:'Severe pneumonia',
    allergies:'Penicillin',
    notes:'Ventilated patient; continuous monitoring required.',
    admittedAt:'2026-04-20T08:30:00Z',
    attending:'Dr. Sofia Alvarez',
    primaryNurse:'Nurse Mballa',
    deviceMap:{'Bedside Monitor':'Mindray BeneVision / demo','Ventilator':'Vent-07'}
  });
  db.notes=db.notes||[];
  db.orders=db.orders||[];
  db.labs=db.labs||[];
  db.imaging=db.imaging||[];
  db.notes.push({id:'n-demo-1',patientId:'p1',ts:now(),author:'Care Team',text:'Patient is under continuous monitoring. Family updates should be confirmed with the attending physician.'});
  db.orders.push({id:'o-demo-1',patientId:'p1',ts:now(),author:'Dr. Sofia Alvarez',status:'Active',text:'Continue oxygenation monitoring and scheduled care plan.'});
  db.labs.push({id:'l-demo-1',patientId:'p1',ts:now(),type:'CBC',text:'Demo lab update available for review with care team.'});
  db.imaging.push({id:'i-demo-1',patientId:'p1',ts:now(),type:'Chest Imaging',text:'Demo imaging update. Final interpretation should be confirmed by clinician.'});
  writeDb(db);
}

ensureDemoUser();
ensureDemoPatientData();
ensureDemoPatientAccess();

function generateVitals(patientId){ const base=Math.abs([...String(patientId)].reduce((a,c)=>a+c.charCodeAt(0),0))%20; const nowMs=Date.now(); const make=(n,min,amp,speed,decimals=0)=>Array.from({length:n},(_,i)=>({t:nowMs-(n-i)*1000,v:Math.round((min+amp+Math.sin((nowMs/1000+i)/speed)*amp+Math.random()*3)*(decimals?10:1))/(decimals?10:1)})); return {HR:make(100,70+base,9,4),SPO2:make(100,95,2,5),RR:make(100,14,3,6),TEMP:make(100,36.6,.35,7,1),BP_SYS:make(100,110+base,12,8),BP_DIA:make(100,70,6,9),PEEP:make(100,5,2,12),VT:make(100,400,50,10),ETCO2:make(100,34,4,8)}; }
function calculateRisk(patient, vitals){ const latest={}; for(const [k,arr] of Object.entries(vitals)){ latest[k]=arr[arr.length-1].v; } let score=0; if(latest.HR>110||latest.HR<50)score+=2; if(latest.SPO2<92)score+=3; if(latest.RR>24||latest.RR<8)score+=2; if(latest.TEMP>38.5||latest.TEMP<35)score+=1; if(latest.BP_SYS<90||latest.BP_SYS>160)score+=2; if(patient.status==='critical')score+=3; if(patient.tag==='High Risk')score+=2; const level=score>=7?'high':score>=4?'medium':'low'; return {score,level,latest}; }
function localAiAnalysis(patient,vitals){ const risk=calculateRisk(patient,vitals); const latest=risk.latest; const recommendations=[]; if(latest.SPO2<94)recommendations.push('Review oxygenation, probe position, oxygen delivery, and ventilator settings if applicable.'); if(latest.HR>105)recommendations.push('Review pain, fever, anxiety, hypovolemia, or rhythm issues.'); if(latest.BP_SYS<100)recommendations.push('Review perfusion, fluid balance, and vasopressor needs according to clinician judgment.'); if(patient.tag==='Isolation')recommendations.push('Maintain PPE and isolation workflow.'); if(recommendations.length===0)recommendations.push('Continue routine monitoring and reassess trends.'); return {mode:'mock',generatedAt:now(),patient:{name:patient.name,mrn:patient.mrn,unit:patient.unit,bed:patient.bed},risk,summary:`${patient.name} is currently classified as ${risk.level.toUpperCase()} risk based on simulated vitals, status, and tags.`,recommendations,disclaimer:'Demo decision-support only. Not for clinical diagnosis or treatment.'}; }
async function externalAiAnalysis(patient,vitals){ const key=process.env.OPENAI_API_KEY; if(!key)return localAiAnalysis(patient,vitals); const prompt=`Summarize patient for doctor without diagnosis. Patient: ${JSON.stringify(patient)} Risk: ${JSON.stringify(calculateRisk(patient,vitals))}. Return concise clinical dashboard recommendations.`; const response=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${key}`},body:JSON.stringify({model:process.env.OPENAI_MODEL||'gpt-4.1-mini',input:prompt})}); if(!response.ok)return localAiAnalysis(patient,vitals); const data=await response.json(); return {mode:'ai',generatedAt:now(),raw:data,fallback:localAiAnalysis(patient,vitals)}; }


// Device integration demo architecture:
// authorized medical devices / automated machines -> secure gateway/API -> backend -> demo JSON storage -> dashboards/mobile -> decision-support review.
// Real hospital integration must be authorized, secure, validated, audited, and implemented through vendor-supported interfaces,
// HL7/FHIR, DICOM/PACS, gateway APIs, or approved protocols. Never connect real devices to this prototype without clinical engineering approval.
const DEVICE_EXAMPLES = {
  bedsideMonitor:{deviceType:'bedside_monitor',patientId:'p1',deviceId:'MON-ICU-01',timestamp:now(),values:{HR:102,SPO2:93,BP_SYS:118,BP_DIA:76,RR:21,TEMP:37.8,ETCO2:36}},
  ventilator:{deviceType:'ventilator',patientId:'p1',deviceId:'VENT-07',timestamp:now(),values:{mode:'AC/VC',FiO2:0.45,PEEP:6,VT:420,RR_SET:16,ETCO2:37}},
  infusionPump:{deviceType:'infusion_pump',patientId:'p1',deviceId:'PUMP-12',timestamp:now(),values:{channel:'A',medication:'Demo medication',rateMlHr:12.5,volumeRemainingMl:86,alarm:'none'}},
  labMachine:{deviceType:'lab_analyzer',patientId:'p1',deviceId:'LAB-CBC-02',timestamp:now(),values:{test:'Hemoglobin',value:11.8,unit:'g/dL',flag:'normal'}},
  imagingSystem:{deviceType:'imaging_system',patientId:'p1',deviceId:'PACS-DEMO',timestamp:now(),values:{modality:'X-Ray',study:'Chest X-Ray',status:'reported',summary:'Demo imaging summary for clinician review.'}}
};
function latestDeviceValues(db, patientId){
  const readings=(db.deviceReadings||[]).filter(r=>r.patientId===patientId).sort((a,b)=>String(b.timestamp||'').localeCompare(String(a.timestamp||'')));
  const latest={}; readings.forEach(r=>{ if(!latest[r.deviceType]) latest[r.deviceType]=r; }); return {latest,readings:readings.slice(0,25)};
}
function mergeLatestIntoVitals(vitals, latest){
  const reading=latest.bedside_monitor||latest.ventilator; if(!reading||!reading.values)return vitals;
  for(const [k,v] of Object.entries(reading.values)){ if(vitals[k]&&typeof v==='number') vitals[k][vitals[k].length-1].v=v; }
  return vitals;
}

app.post('/api/signup', async (req,res)=>{ const b=req.body||{}; const fullName=normalize(b.fullName), username=normalize(b.username).toLowerCase(), email=normalize(b.email).toLowerCase(), department=normalize(b.department)||'ICU', password=String(b.password||''); if(!fullName||!username||!email||!password)return res.status(400).json({ok:false,error:'Missing required fields'}); if(password.length<8||!/\d/.test(password))return res.status(400).json({ok:false,error:'Password must be at least 8 characters and include a number'}); if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))return res.status(400).json({ok:false,error:'Invalid email'}); const db=readDb(); if(db.users.find(u=>u.username===username))return res.status(409).json({ok:false,error:'Username already exists'}); if(db.users.find(u=>u.email===email))return res.status(409).json({ok:false,error:'Email already exists'}); const code=otp(); const role=['doctor','nurse','biomedical engineer','admin'].includes(normalize(b.role).toLowerCase())?normalize(b.role).toLowerCase():'doctor'; const user={id:'u-'+Date.now(),username,fullName,email,department,role,verified:false,passwordHash:hashPassword(password),otpHash:hashPassword(code),otpExp:Date.now()+10*60*1000,createdAt:now()}; db.users.push(user); writeDb(db); try{const sent=await sendVerificationEmail(user,code); res.json({ok:true,username,message:'Verification code sent to email',devOtp:sent.dev?code:undefined});}catch(e){res.status(500).json({ok:false,error:'Could not send verification email. Check SMTP settings.'});} });
app.post('/api/resend-code', async (req,res)=>{ const username=normalize(req.body.username).toLowerCase(); const db=readDb(); const user=db.users.find(u=>u.username===username); if(!user)return res.status(404).json({ok:false,error:'User not found'}); if(user.verified)return res.json({ok:true,message:'Already verified'}); const code=otp(); user.otpHash=hashPassword(code); user.otpExp=Date.now()+10*60*1000; writeDb(db); const sent=await sendVerificationEmail(user,code); res.json({ok:true,devOtp:sent.dev?code:undefined}); });
app.post('/api/verify',(req,res)=>{ const username=normalize(req.body.username).toLowerCase(), code=normalize(req.body.code); const db=readDb(); const user=db.users.find(u=>u.username===username); if(!user)return res.status(404).json({ok:false,error:'User not found'}); if(user.verified)return res.json({ok:true,message:'Already verified'}); if(!user.otpHash||!user.otpExp||user.otpExp<Date.now())return res.status(400).json({ok:false,error:'Code expired'}); if(!verifyPassword(code,user.otpHash))return res.status(400).json({ok:false,error:'Invalid code'}); user.verified=true; delete user.otpHash; delete user.otpExp; writeDb(db); res.json({ok:true}); });
app.post('/api/login',(req,res)=>{ const username=normalize(req.body.username).toLowerCase(), password=String(req.body.password||''); const db=readDb(); const user=db.users.find(u=>u.username===username); if(!user||!verifyPassword(password,user.passwordHash))return res.status(401).json({ok:false,error:'Invalid credentials'}); if(!user.verified)return res.status(403).json({ok:false,error:'Account not verified',needsVerification:true}); user.sessionToken=token(); user.sessionExp=Date.now()+8*60*60*1000; writeDb(db); audit(user,'login','user',user.username); res.json({ok:true,token:user.sessionToken,user:publicUser(user)}); });
app.post('/api/logout',requireAuth,(req,res)=>{ const db=readDb(); const user=db.users.find(u=>u.id===req.user.id); if(user){delete user.sessionToken;delete user.sessionExp;writeDb(db);} res.json({ok:true}); });
app.get('/api/me',requireAuth,(req,res)=>res.json({ok:true,user:publicUser(req.user)}));

app.post('/api/patient/login',(req,res)=>{
  const mrn=normalize(req.body.mrn).toUpperCase();
  const accessCode=String(req.body.accessCode||'');
  const db=readDb();
  const patient=(db.patients||[]).find(p=>String(p.mrn||'').toUpperCase()===mrn);
  if(!patient) return res.status(401).json({ok:false,error:'Invalid patient credentials'});
  const account=(db.patientAccess||[]).find(a=>a.patientId===patient.id);
  if(!account || !verifyPassword(accessCode, account.codeHash)) return res.status(401).json({ok:false,error:'Invalid patient credentials'});
  account.sessionToken=token();
  account.sessionExp=Date.now()+4*60*60*1000;
  account.lastLogin=now();
  writeDb(db);
  audit({username:`patient:${patient.mrn}`},'patient_login','patient',patient.mrn);
  res.json({ok:true,token:account.sessionToken,patient:publicPatientAccount(account,patient)});
});
app.post('/api/patient/logout',requirePatientAuth,(req,res)=>{
  const db=readDb();
  const account=(db.patientAccess||[]).find(a=>a.id===req.patientAccount.id);
  if(account){ delete account.sessionToken; delete account.sessionExp; writeDb(db); }
  res.json({ok:true});
});
app.get('/api/patient/me',requirePatientAuth,(req,res)=>{
  res.json({ok:true,patient:publicPatientAccount(req.patientAccount,req.patient)});
});
app.get('/api/patient/detail',requirePatientAuth,(req,res)=>{
  const db=readDb();
  const patient=req.patient;
  const related=key=>(db[key]||[]).filter(x=>x.patientId===patient.id);
  const vitals=generateVitals(patient.id);
  const safePatient={
    mrn:patient.mrn,
    name:patient.name,
    unit:patient.unit,
    room:patient.room,
    bed:patient.bed,
    age:patient.age,
    sex:patient.sex,
    bloodType:patient.bloodType,
    allergies:patient.allergies,
    diagnosis:patient.diagnosis,
    status:patient.status,
    admittedAt:patient.admittedAt,
    attending:patient.attending,
    primaryNurse:patient.primaryNurse,
    notes:patient.notes
  };
  res.json({ok:true,detail:{patient:safePatient,notes:related('notes'),orders:related('orders'),labs:related('labs'),imaging:related('imaging'),vitals,risk:calculateRisk(patient,vitals)}});
});

app.get('/api/departments',requireAuth,(req,res)=>res.json({ok:true,departments:['ICU','Emergency','Surgery','Radiology','Maternity','Pediatrics','Laboratory','Pharmacy','Biomedical','Administration','Internal Med','Ambulance']}));
app.get('/api/services',requireAuth,(req,res)=>res.json({ok:true,services:readDb().services||[]}));
app.get('/api/patients',requireAuth,(req,res)=>{ const {unit,q,status}=req.query; let patients=readDb().patients||[]; if(unit)patients=patients.filter(p=>p.unit===unit); if(status)patients=patients.filter(p=>p.status===status); if(q){const s=String(q).toLowerCase(); patients=patients.filter(p=>[p.name,p.mrn,p.bed,p.unit,p.tag,p.diagnosis].some(v=>String(v||'').toLowerCase().includes(s)));} res.json({ok:true,patients}); });
app.post('/api/patients',requireAuth,(req,res)=>{ const p=req.body||{}; if(!p.name||!p.mrn||!p.unit||!p.bed)return res.status(400).json({ok:false,error:'Missing patient fields'}); const db=readDb(); const patient={id:'p-'+Date.now(),mrn:normalize(p.mrn),name:normalize(p.name),unit:normalize(p.unit),bed:normalize(p.bed),room:normalize(p.room)||normalize(p.bed),age:normalize(p.age),sex:normalize(p.sex),tag:normalize(p.tag),notes:normalize(p.notes),diagnosis:normalize(p.diagnosis),allergies:normalize(p.allergies),bloodType:normalize(p.bloodType),attending:normalize(p.attending),primaryNurse:normalize(p.primaryNurse),status:normalize(p.status)||'stable',admittedAt:normalize(p.admittedAt)||now(),deviceMap:p.deviceMap||{}}; db.patients.unshift(patient); writeDb(db); audit(req.user,'create','patient',patient.mrn); res.json({ok:true,patient}); });
app.put('/api/patients/:id',requireAuth,(req,res)=>{ const db=readDb(); const i=db.patients.findIndex(p=>p.id===req.params.id); if(i<0)return res.status(404).json({ok:false,error:'Patient not found'}); db.patients[i]={...db.patients[i],...req.body,id:req.params.id}; writeDb(db); audit(req.user,'update','patient',db.patients[i].mrn); res.json({ok:true,patient:db.patients[i]}); });
app.delete('/api/patients/:id',requireAuth,(req,res)=>{ const db=readDb(); const old=db.patients.find(p=>p.id===req.params.id); db.patients=db.patients.filter(p=>p.id!==req.params.id); writeDb(db); audit(req.user,'delete','patient',old?old.mrn:req.params.id); res.json({ok:true}); });
app.get('/api/patients/:id/detail',requireAuth,(req,res)=>{ const db=readDb(); const patient=(db.patients||[]).find(p=>p.id===req.params.id); if(!patient)return res.status(404).json({ok:false,error:'Patient not found'}); const related=key=>(db[key]||[]).filter(x=>x.patientId===patient.id); res.json({ok:true,detail:{patient,notes:related('notes'),orders:related('orders'),labs:related('labs'),imaging:related('imaging'),alerts:related('alerts')}}); });
app.post('/api/patients/:id/notes',requireAuth,(req,res)=>{ const db=readDb(); const patient=(db.patients||[]).find(p=>p.id===req.params.id); if(!patient)return res.status(404).json({ok:false,error:'Patient not found'}); db.notes=db.notes||[]; const item={id:'n-'+Date.now(),patientId:patient.id,ts:now(),author:req.user.fullName||req.user.username,text:normalize(req.body.text)}; db.notes.unshift(item); writeDb(db); audit(req.user,'create','note',patient.mrn); res.json({ok:true,note:item}); });
app.post('/api/patients/:id/orders',requireAuth,(req,res)=>{ const db=readDb(); const patient=(db.patients||[]).find(p=>p.id===req.params.id); if(!patient)return res.status(404).json({ok:false,error:'Patient not found'}); db.orders=db.orders||[]; const item={id:'o-'+Date.now(),patientId:patient.id,ts:now(),author:req.user.fullName||req.user.username,status:'Active',text:normalize(req.body.text)}; db.orders.unshift(item); writeDb(db); audit(req.user,'create','order',patient.mrn); res.json({ok:true,order:item}); });
app.post('/api/patients/:id/alerts',requireAuth,(req,res)=>{ const db=readDb(); const patient=(db.patients||[]).find(p=>p.id===req.params.id); if(!patient)return res.status(404).json({ok:false,error:'Patient not found'}); db.alerts=db.alerts||[]; const item={id:'a-'+Date.now(),patientId:patient.id,ts:now(),severity:normalize(req.body.severity)||'Medium',text:normalize(req.body.text)}; db.alerts.unshift(item); writeDb(db); audit(req.user,'create','alert',patient.mrn); res.json({ok:true,alert:item}); });
app.get('/api/vitals/:id',requireAuth,(req,res)=>{ const db=readDb(); const patient=db.patients.find(p=>p.id===req.params.id)||db.patients[0]; let vitals=generateVitals(req.params.id); const devices=latestDeviceValues(db, patient.id); vitals=mergeLatestIntoVitals(vitals,devices.latest); res.json({ok:true,patient,vitals,risk:calculateRisk(patient,vitals),devices}); });
app.get('/api/central',requireAuth,(req,res)=>{ const db=readDb(); const unit=req.query.unit; let patients=db.patients||[]; if(unit)patients=patients.filter(p=>p.unit===unit); const cards=patients.map(p=>{let vitals=generateVitals(p.id); const devices=latestDeviceValues(db,p.id); vitals=mergeLatestIntoVitals(vitals,devices.latest); return {patient:p,risk:calculateRisk(p,vitals),devices};}); res.json({ok:true,cards}); });
app.get('/api/ai/analyze/:id',requireAuth,async(req,res)=>{ const db=readDb(); const patient=db.patients.find(p=>p.id===req.params.id); if(!patient)return res.status(404).json({ok:false,error:'Patient not found'}); const vitals=generateVitals(patient.id); const result=process.env.AI_MODE==='openai'?await externalAiAnalysis(patient,vitals):localAiAnalysis(patient,vitals); db.aiHistory=db.aiHistory||[]; db.aiHistory.unshift({id:'ai-'+Date.now(),patientId:patient.id,ts:now(),user:req.user.username,result}); db.aiHistory=db.aiHistory.slice(0,100); writeDb(db); audit(req.user,'ai_analyze','patient',patient.mrn); res.json({ok:true,analysis:result}); });
app.get('/api/ai/hospital',requireAuth,(req,res)=>{ const db=readDb(); const ranked=(db.patients||[]).map(p=>({patient:p,risk:calculateRisk(p,generateVitals(p.id))})).sort((a,b)=>b.risk.score-a.risk.score); res.json({ok:true,ranked}); });

app.get('/api/device/examples',(req,res)=>res.json({ok:true,architecture:'medical devices / automated machines -> device gateway/API -> backend server -> database -> dashboards/mobile app -> AI-assisted analysis',examples:DEVICE_EXAMPLES,disclaimer:'Prototype examples only. Real integrations require hospital authorization, validation, cybersecurity review, and vendor-supported interfaces such as HL7/FHIR, DICOM, gateway APIs, or approved protocols.'}));
app.get('/api/device/readings',requireAuth,(req,res)=>{ const db=readDb(); const patientId=req.query.patientId; let readings=db.deviceReadings||[]; if(patientId) readings=readings.filter(r=>r.patientId===patientId); res.json({ok:true,readings:readings.slice(0,100)}); });
app.post('/api/device/ingest',(req,res)=>{ const payload=req.body||{}; if(!payload.patientId||!payload.deviceType||!payload.deviceId||!payload.values) return res.status(400).json({ok:false,error:'patientId, deviceType, deviceId, and values are required'}); const db=readDb(); const patient=(db.patients||[]).find(p=>p.id===payload.patientId||p.mrn===payload.patientId); if(!patient)return res.status(404).json({ok:false,error:'Patient not found'}); const reading={id:'dev-'+Date.now(),patientId:patient.id,deviceType:normalize(payload.deviceType),deviceId:normalize(payload.deviceId),timestamp:payload.timestamp||now(),values:payload.values,source:normalize(payload.source)||'demo-gateway'}; db.deviceReadings=db.deviceReadings||[]; db.deviceReadings.unshift(reading); db.deviceReadings=db.deviceReadings.slice(0,1000); writeDb(db); audit({username:'device-gateway'},'device_ingest','patient',patient.mrn); res.json({ok:true,reading}); });

app.get('/api/reports/summary',requireAuth,(req,res)=>{ const db=readDb(); const patients=db.patients||[]; res.json({ok:true,summary:{total:patients.length,critical:patients.filter(p=>p.status==='critical').length,watch:patients.filter(p=>p.status==='watch').length,stable:patients.filter(p=>p.status==='stable').length,byUnit:patients.reduce((a,p)=>{a[p.unit]=(a[p.unit]||0)+1;return a;},{})}}); });
app.get('/api/audit',requireAuth,(req,res)=>res.json({ok:true,audit:readDb().audit||[]}));
app.listen(PORT,()=>console.log(`LifeView Central MVP running at http://localhost:${PORT}`));
