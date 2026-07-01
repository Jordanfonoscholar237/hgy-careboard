import seed from '../../../data/db.json';

const DB = seed;
const sessions = new Map();
const patientSessions = new Map();

function json(data, status = 200){
  return new Response(JSON.stringify(data), {
    status,
    headers: {'content-type': 'application/json; charset=utf-8'}
  });
}

function now(){ return new Date().toISOString(); }
function normalize(v){ return String(v || '').trim(); }
function clone(v){ return JSON.parse(JSON.stringify(v)); }
function publicUser(u){ return {id:u.id, username:u.username, fullName:u.fullName, email:u.email, department:u.department, verified:!!u.verified, role:u.role || 'doctor'}; }
async function body(req){ return await req.json().catch(() => ({})); }

function issueToken(prefix, id){
  return `${prefix}-${id}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function auth(req){
  const header = req.headers.get('authorization') || '';
  const value = header.startsWith('Bearer ') ? header.slice(7) : '';
  const username = sessions.get(value);
  return DB.users.find(u => u.username === username) || null;
}

function patientAuth(req){
  const header = req.headers.get('authorization') || '';
  const value = header.startsWith('Bearer ') ? header.slice(7) : '';
  const patientId = patientSessions.get(value);
  return DB.patients.find(p => p.id === patientId) || null;
}

function requireAuth(req){
  const user = auth(req);
  if(!user) return {error: json({ok:false,error:'Unauthorized'}, 401)};
  return {user};
}

function requirePatientAuth(req){
  const patient = patientAuth(req);
  if(!patient) return {error: json({ok:false,error:'Unauthorized'}, 401)};
  return {patient};
}

function filteredPatients(url){
  let patients = clone(DB.patients || []);
  const unit = url.searchParams.get('unit');
  const q = (url.searchParams.get('q') || '').toLowerCase();
  const status = url.searchParams.get('status');
  if(unit) patients = patients.filter(p => p.unit === unit);
  if(status) patients = patients.filter(p => p.status === status);
  if(q) patients = patients.filter(p => [p.name,p.mrn,p.bed,p.unit,p.tag,p.diagnosis].some(v => String(v || '').toLowerCase().includes(q)));
  return patients;
}

function series(base, spread, seedValue, n = 30){
  return Array.from({length:n}, (_, i) => ({
    t: new Date(Date.now() - (n - i) * 30000).toISOString(),
    v: Math.round(base + Math.sin((i + seedValue) / 3) * spread + ((i + seedValue) % 5 - 2))
  }));
}

function vitals(id){
  const seedValue = [...String(id || 'p1')].reduce((a, c) => a + c.charCodeAt(0), 0);
  return {
    HR: series(82 + seedValue % 18, 9, seedValue),
    SPO2: series(95 - seedValue % 3, 2, seedValue),
    RR: series(18 + seedValue % 5, 3, seedValue),
    TEMP: series(37 + (seedValue % 4) / 10, 1, seedValue),
    BP_SYS: series(116 + seedValue % 18, 8, seedValue),
    BP_DIA: series(72 + seedValue % 10, 5, seedValue),
    PEEP: series(6, 1, seedValue),
    VT: series(420, 20, seedValue),
    ETCO2: series(35, 4, seedValue)
  };
}

function calculateRisk(patient, v){
  const latest = key => {
    const points = v[key] || [{v:0}];
    return points[points.length - 1].v;
  };
  let score = patient.status === 'critical' ? 78 : patient.status === 'watch' ? 54 : 26;
  if(latest('SPO2') < 93) score += 12;
  if(latest('HR') > 110) score += 8;
  score = Math.max(0, Math.min(99, score));
  return {score, level: score > 70 ? 'high' : score > 45 ? 'medium' : 'low'};
}

function related(patientId, key){
  return clone((DB[key] || []).filter(x => x.patientId === patientId));
}

function detail(patient){
  return {
    patient: clone(patient),
    notes: related(patient.id, 'notes'),
    orders: related(patient.id, 'orders'),
    labs: related(patient.id, 'labs'),
    imaging: related(patient.id, 'imaging'),
    alerts: related(patient.id, 'alerts'),
    vitals: vitals(patient.id)
  };
}

function aiFor(patient){
  const v = vitals(patient.id);
  const risk = calculateRisk(patient, v);
  return {
    mode: 'local',
    generatedAt: now(),
    risk,
    summary: `${patient.name} is currently marked ${patient.status}. Review trends, active alerts, and recent orders before care decisions.`,
    recommendations: ['Review latest vital-sign trend changes.', 'Prioritize high-risk alerts and bedside reassessment.', 'Confirm care team handoff notes are current.'],
    disclaimer: 'Informational dashboard support only.'
  };
}

async function handle(req){
  const url = new URL(req.url);
  const method = req.method;
  const path = url.pathname;

  if(path === '/api/signup' && method === 'POST'){
    const b = await body(req);
    if(!b.fullName || !b.username || !b.email || !b.password) return json({ok:false,error:'Missing required fields'}, 400);
    return json({ok:true, username: normalize(b.username).toLowerCase(), message:'Verification code sent to email', devOtp:'123456'});
  }
  if(path === '/api/verify' && method === 'POST') return json({ok:true});
  if(path === '/api/resend-code' && method === 'POST') return json({ok:true, devOtp:'123456'});
  if(path === '/api/login' && method === 'POST'){
    const b = await body(req);
    const username = normalize(b.username).toLowerCase();
    const user = DB.users.find(u => u.username === username) || DB.users[0];
    if(!normalize(b.password)) return json({ok:false,error:'Invalid credentials'}, 401);
    const token = issueToken('staff', user.username);
    sessions.set(token, user.username);
    return json({ok:true, token, user:publicUser(user)});
  }

  if(path === '/api/patient/login' && method === 'POST'){
    const b = await body(req);
    const mrn = normalize(b.mrn).toUpperCase();
    const patient = DB.patients.find(p => String(p.mrn).toUpperCase() === mrn) || DB.patients[0];
    if(!normalize(b.accessCode)) return json({ok:false,error:'Access code is required'}, 400);
    const token = issueToken('patient', patient.id);
    patientSessions.set(token, patient.id);
    return json({ok:true, token, patient:clone(patient)});
  }
  if(path === '/api/patient/logout' && method === 'POST') return json({ok:true});
  if(path === '/api/patient/me') {
    const gate = requirePatientAuth(req); if(gate.error) return gate.error;
    return json({ok:true, patient:clone(gate.patient)});
  }
  if(path === '/api/patient/detail'){
    const gate = requirePatientAuth(req); if(gate.error) return gate.error;
    return json({ok:true, detail:detail(gate.patient)});
  }

  if(path === '/api/logout' && method === 'POST') return json({ok:true});
  const gate = requireAuth(req);
  if(gate.error) return gate.error;
  if(path === '/api/me') return json({ok:true, user:publicUser(gate.user)});
  if(path === '/api/departments') return json({ok:true, departments:['ICU','Emergency','Surgery','Radiology','Maternity','Pediatrics','Laboratory','Pharmacy','Biomedical','Administration','Internal Med','Ambulance']});
  if(path === '/api/services') return json({ok:true, services:clone(DB.services || [])});
  if(path === '/api/patients' && method === 'GET') return json({ok:true, patients:filteredPatients(url)});
  if(path === '/api/patients' && method === 'POST'){
    const p = await body(req);
    return json({ok:true, patient:{...p, id:'p-' + Date.now(), admittedAt:now()}});
  }
  const patientDetail = path.match(/^\/api\/patients\/([^/]+)\/detail$/);
  if(patientDetail){
    const patient = DB.patients.find(p => p.id === patientDetail[1]);
    if(!patient) return json({ok:false,error:'Patient not found'}, 404);
    return json({ok:true, detail:detail(patient)});
  }
  const patientUpdate = path.match(/^\/api\/patients\/([^/]+)$/);
  if(patientUpdate && method === 'PUT') return json({ok:true, patient:{...(await body(req)), id:patientUpdate[1]}});
  if(patientUpdate && method === 'DELETE') return json({ok:true});
  const note = path.match(/^\/api\/patients\/([^/]+)\/notes$/);
  if(note && method === 'POST') return json({ok:true, note:{id:'n-'+Date.now(), patientId:note[1], ts:now(), author:gate.user.fullName, text:(await body(req)).text}});
  const order = path.match(/^\/api\/patients\/([^/]+)\/orders$/);
  if(order && method === 'POST') return json({ok:true, order:{id:'o-'+Date.now(), patientId:order[1], ts:now(), author:gate.user.fullName, status:'Active', text:(await body(req)).text}});
  const alert = path.match(/^\/api\/patients\/([^/]+)\/alerts$/);
  if(alert && method === 'POST') return json({ok:true, alert:{id:'a-'+Date.now(), patientId:alert[1], ts:now(), severity:(await body(req)).severity || 'Medium', text:(await body(req)).text}});
  const vitalsMatch = path.match(/^\/api\/vitals\/([^/]+)$/);
  if(vitalsMatch){
    const patient = DB.patients.find(p => p.id === vitalsMatch[1]) || DB.patients[0];
    const v = vitals(patient.id);
    return json({ok:true, patient:clone(patient), vitals:v, risk:calculateRisk(patient, v), devices:{latest:{}, readings:[]}});
  }
  if(path === '/api/central'){
    const cards = filteredPatients(url).map(patient => ({patient, risk:calculateRisk(patient, vitals(patient.id)), devices:{latest:{}, readings:[]}}));
    return json({ok:true, cards});
  }
  const aiMatch = path.match(/^\/api\/ai\/analyze\/([^/]+)$/);
  if(aiMatch){
    const patient = DB.patients.find(p => p.id === aiMatch[1]) || DB.patients[0];
    return json({ok:true, analysis:aiFor(patient)});
  }
  if(path === '/api/ai/hospital'){
    const ranked = clone(DB.patients || []).map(patient => ({patient, risk:calculateRisk(patient, vitals(patient.id))})).sort((a,b) => b.risk.score - a.risk.score);
    return json({ok:true, ranked});
  }
  if(path === '/api/device/readings'){
    const patientId = url.searchParams.get('patientId');
    let readings = clone(DB.deviceReadings || []);
    if(patientId) readings = readings.filter(r => r.patientId === patientId);
    return json({ok:true, readings});
  }
  if(path === '/api/reports/summary'){
    const patients = DB.patients || [];
    return json({ok:true, summary:{total:patients.length, critical:patients.filter(p=>p.status==='critical').length, watch:patients.filter(p=>p.status==='watch').length, stable:patients.filter(p=>p.status==='stable').length, byUnit:patients.reduce((a,p)=>{a[p.unit]=(a[p.unit]||0)+1; return a;}, {})}});
  }
  if(path === '/api/audit') return json({ok:true, audit:clone(DB.audit || [])});
  return json({ok:false,error:'Not found'}, 404);
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const DELETE = handle;
