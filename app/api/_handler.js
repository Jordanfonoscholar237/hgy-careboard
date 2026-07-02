import seed from '../../data/db.json';

const DB = structuredClone(seed);
const sessions = new Map();
const patientSessions = new Map();

const DEFAULT_HOSPITAL_ID = 'hosp-yaounde-general';
const DEFAULT_DEVICE_API_KEY = 'yg-demo-device-key';
const DEFAULT_DEPARTMENTS = ['ICU','Emergency','Surgery','Radiology','Maternity','Pediatrics','Laboratory','Pharmacy','Biomedical','Administration'];
const ROLES = ['super_admin','hospital_admin','doctor','nurse','biomedical_engineer','lab_staff','radiology_staff','pharmacy_staff','patient'];

function json(data, status = 200){
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8' } });
}
function now(){ return new Date().toISOString(); }
function normalize(v){ return String(v || '').trim(); }
function clone(v){ return JSON.parse(JSON.stringify(v)); }
function id(prefix){ return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`; }
function initials(name){ return normalize(name).split(/\s+/).map(x => x[0]).join('').slice(0, 3).toUpperCase() || 'LV'; }
function normalizeRole(role){
  const raw = normalize(role).toLowerCase().replace(/[\s-]+/g, '_');
  const aliases = { admin:'hospital_admin', biomedical:'biomedical_engineer', laboratory_staff:'lab_staff', lab:'lab_staff', radiology:'radiology_staff', pharmacy:'pharmacy_staff' };
  const value = aliases[raw] || raw;
  return ROLES.includes(value) ? value : 'doctor';
}
function isSuper(user){ return normalizeRole(user && user.role) === 'super_admin'; }
async function body(req){ return await req.json().catch(() => ({})); }
function hospitalById(hospitalId){ return (DB.hospitals || []).find(h => h.id === hospitalId); }
function publicHospital(h){
  if(!h) return null;
  return {
    id:h.id, name:h.name, legalName:h.legalName, registrationNumber:h.registrationNumber,
    country:h.country, city:h.city, address:h.address, phone:h.phone, email:h.email,
    hospitalType:h.hospitalType, numberOfBeds:h.numberOfBeds, logoPlaceholder:h.logoPlaceholder || initials(h.name),
    status:h.status || 'pending', createdAt:h.createdAt, updatedAt:h.updatedAt
  };
}
function publicUser(user){
  const h = hospitalById(user.hospitalId);
  const branch = (DB.branches || []).find(b => b.id === user.branchId);
  return {
    id:user.id, username:user.username, fullName:user.fullName, email:user.email, phone:user.phone,
    department:user.department, departmentId:user.departmentId, verified:!!user.verified, role:normalizeRole(user.role),
    hospitalId:user.hospitalId || null, hospitalName:h ? h.name : 'LifeView Central Platform',
    hospitalStatus:h ? h.status : 'platform', branchId:user.branchId || null, branchName:branch ? branch.name : ''
  };
}
function issue(prefix, key){
  const value = `${prefix}-${key}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return value;
}
function auth(req){
  const header = req.headers.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  const userId = sessions.get(token);
  return (DB.users || []).find(u => u.id === userId) || null;
}
function patientAuth(req){
  const header = req.headers.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  const patientId = patientSessions.get(token);
  return (DB.patients || []).find(p => p.id === patientId) || null;
}
function requireAuth(req){
  const user = auth(req);
  if(!user) return { error: json({ ok:false, error:'Unauthorized' }, 401) };
  const h = user.hospitalId ? hospitalById(user.hospitalId) : null;
  if(!isSuper(user) && (!h || h.status === 'suspended')) return { error: json({ ok:false, error:'Hospital workspace unavailable' }, 403) };
  return { user };
}
function requireRole(user, roles){
  return roles.map(normalizeRole).includes(normalizeRole(user.role));
}
function scoped(records, user, url){
  const requested = isSuper(user) ? normalize(url.searchParams.get('hospitalId')) : user.hospitalId;
  const list = records || [];
  if(isSuper(user)) return requested ? list.filter(x => x.hospitalId === requested) : list;
  return list.filter(x => x.hospitalId === user.hospitalId);
}
function requestedHospital(user, url){
  return isSuper(user) ? normalize(url.searchParams.get('hospitalId')) || DEFAULT_HOSPITAL_ID : user.hospitalId;
}
function canManage(user, hospitalId){
  return isSuper(user) || (normalizeRole(user.role) === 'hospital_admin' && user.hospitalId === hospitalId);
}
function audit(user, action, target, detail, hospitalId){
  DB.audit = DB.audit || [];
  DB.audit.unshift({ id:id('audit'), ts:now(), hospitalId:hospitalId || (user && user.hospitalId) || null, user:user ? user.username : 'system', action, target, detail });
  DB.audit = DB.audit.slice(0, 500);
}

function series(base, spread, seedValue, n = 60){
  return Array.from({length:n}, (_, i) => ({ t: Date.now() - (n - i) * 1000, v: Math.round(base + Math.sin((i + seedValue) / 4) * spread + ((i + seedValue) % 5 - 2)) }));
}
function vitals(idValue){
  const seedValue = [...String(idValue || 'p1')].reduce((a, c) => a + c.charCodeAt(0), 0);
  return {
    HR: series(82 + seedValue % 18, 9, seedValue),
    SPO2: series(96 - seedValue % 3, 2, seedValue),
    RR: series(18 + seedValue % 5, 3, seedValue),
    TEMP: series(37 + (seedValue % 4) / 10, 1, seedValue),
    BP_SYS: series(116 + seedValue % 18, 8, seedValue),
    BP_DIA: series(72 + seedValue % 10, 5, seedValue),
    PEEP: series(6, 1, seedValue),
    VT: series(420, 20, seedValue),
    ETCO2: series(35, 4, seedValue)
  };
}
function latestDeviceValues(patientId, hospitalId){
  const readings = (DB.deviceReadings || []).filter(r => r.patientId === patientId && (!hospitalId || r.hospitalId === hospitalId)).sort((a,b) => String(b.timestamp || '').localeCompare(String(a.timestamp || '')));
  const latest = {};
  readings.forEach(r => { if(!latest[r.deviceType]) latest[r.deviceType] = r; });
  return { latest, readings: readings.slice(0, 25) };
}
function mergeLatest(v, latest){
  const reading = latest.bedside_monitor || latest.ventilator;
  if(!reading || !reading.values) return v;
  for(const [key, value] of Object.entries(reading.values)){
    if(v[key] && typeof value === 'number') v[key][v[key].length - 1].v = value;
  }
  return v;
}
function calculateRisk(patient, v){
  const latest = {};
  for(const [key, arr] of Object.entries(v)) latest[key] = arr[arr.length - 1].v;
  let score = 0;
  if(latest.HR > 110 || latest.HR < 50) score += 2;
  if(latest.SPO2 < 92) score += 3;
  if(latest.RR > 24 || latest.RR < 8) score += 2;
  if(latest.TEMP > 38.5 || latest.TEMP < 35) score += 1;
  if(latest.BP_SYS < 90 || latest.BP_SYS > 160) score += 2;
  if(patient.status === 'critical') score += 3;
  if(patient.tag === 'High Risk') score += 2;
  return { score, level: score >= 7 ? 'high' : score >= 4 ? 'medium' : 'low', latest };
}
function alarmStatus(patient, risk, devices){
  const hasConnection = Object.keys(devices.latest || {}).length || Object.keys(patient.deviceMap || {}).length;
  if(!hasConnection) return 'disconnected';
  if(patient.status === 'critical' || risk.score >= 7) return 'critical';
  if(risk.score >= 5) return 'high';
  if(risk.score >= 3 || patient.status === 'watch') return 'warning';
  return 'stable';
}
function related(patient){
  const byKey = key => (DB[key] || []).filter(x => x.patientId === patient.id && x.hospitalId === patient.hospitalId);
  return { notes:byKey('notes'), orders:byKey('orders'), labs:byKey('labs'), imaging:byKey('imaging'), alerts:byKey('alerts') };
}
function aiFor(patient){
  const v = vitals(patient.id);
  const risk = calculateRisk(patient, v);
  return {
    mode:'mock', generatedAt:now(), patient:{name:patient.name,mrn:patient.mrn,unit:patient.unit,bed:patient.bed},
    risk, summary:`${patient.name} is currently classified as ${risk.level.toUpperCase()} risk based on simulated vitals, status, and tags.`,
    recommendations:['Review latest vital-sign trends.', 'Prioritize active alarms and bedside reassessment.', 'Confirm care team handoff notes are current.'],
    disclaimer:'Demo decision-support only. Not for clinical diagnosis or treatment.'
  };
}

function listPatients(user, url){
  let patients = scoped(DB.patients || [], user, url);
  const unit = url.searchParams.get('unit');
  const status = url.searchParams.get('status');
  const q = (url.searchParams.get('q') || '').toLowerCase();
  if(unit) patients = patients.filter(p => p.unit === unit);
  if(status) patients = patients.filter(p => p.status === status);
  if(q) patients = patients.filter(p => [p.name,p.mrn,p.bed,p.unit,p.tag,p.diagnosis].some(v => String(v || '').toLowerCase().includes(q)));
  return patients;
}

export async function handle(req){
  const url = new URL(req.url);
  const path = url.pathname;
  const method = req.method;

  if(path === '/api/signup' && method === 'POST'){
    const b = await body(req);
    if(!b.fullName || !b.username || !b.email || !b.password) return json({ ok:false, error:'Missing required fields' }, 400);
    const username = normalize(b.username).toLowerCase();
    if((DB.users || []).find(u => u.username === username)) return json({ ok:false, error:'Username already exists' }, 409);
    const user = { id:id('u'), username, fullName:normalize(b.fullName), email:normalize(b.email).toLowerCase(), hospitalId:DEFAULT_HOSPITAL_ID, branchId:'branch-yaounde-main', department:normalize(b.department) || 'ICU', role:normalizeRole(b.role), verified:false, password:String(b.password), createdAt:now() };
    DB.users.push(user);
    return json({ ok:true, username, message:'Verification code sent to email', devOtp:'123456' });
  }
  if(path === '/api/verify' && method === 'POST'){
    const b = await body(req);
    const user = (DB.users || []).find(u => u.username === normalize(b.username).toLowerCase());
    if(user) user.verified = true;
    return json({ ok:true });
  }
  if(path === '/api/resend-code' && method === 'POST') return json({ ok:true, devOtp:'123456' });
  if(path === '/api/login' && method === 'POST'){
    const b = await body(req);
    const username = normalize(b.username).toLowerCase();
    const user = (DB.users || []).find(u => u.username === username);
    if(!user) return json({ ok:false, error:'Invalid credentials' }, 401);
    const expected = user.password || 'Password!123';
    if(String(b.password || '') !== expected) return json({ ok:false, error:'Invalid credentials' }, 401);
    if(user.verified === false) return json({ ok:false, error:'Account not verified', needsVerification:true }, 403);
    const t = issue('staff', user.id);
    sessions.set(t, user.id);
    audit(user, 'login', 'user', user.username, user.hospitalId);
    return json({ ok:true, token:t, user:publicUser(user) });
  }

  if(path === '/api/patient/login' && method === 'POST'){
    const b = await body(req);
    const mrn = normalize(b.mrn).toUpperCase();
    const patient = (DB.patients || []).find(p => String(p.mrn || '').toUpperCase() === mrn && (!b.hospitalId || p.hospitalId === b.hospitalId));
    if(!patient || String(b.accessCode || '') !== 'PATIENT123') return json({ ok:false, error:'Invalid patient credentials' }, 401);
    const t = issue('patient', patient.id);
    patientSessions.set(t, patient.id);
    const h = hospitalById(patient.hospitalId);
    return json({ ok:true, token:t, patient:{ id:'pa-demo-1', patientId:patient.id, hospitalId:patient.hospitalId, hospitalName:h ? h.name : '', mrn:patient.mrn, name:patient.name, unit:patient.unit, room:patient.room, bed:patient.bed, verified:true } });
  }
  if(path === '/api/patient/logout' && method === 'POST') return json({ ok:true });
  if(path === '/api/patient/me'){
    const patient = patientAuth(req);
    if(!patient) return json({ ok:false, error:'Unauthorized patient access' }, 401);
    const h = hospitalById(patient.hospitalId);
    return json({ ok:true, patient:{ patientId:patient.id, hospitalId:patient.hospitalId, hospitalName:h ? h.name : '', mrn:patient.mrn, name:patient.name, unit:patient.unit, room:patient.room, bed:patient.bed } });
  }
  if(path === '/api/patient/detail'){
    const patient = patientAuth(req);
    if(!patient) return json({ ok:false, error:'Unauthorized patient access' }, 401);
    const safePatient = { mrn:patient.mrn, name:patient.name, hospitalId:patient.hospitalId, unit:patient.unit, room:patient.room, bed:patient.bed, age:patient.age, sex:patient.sex, bloodType:patient.bloodType, allergies:patient.allergies, diagnosis:patient.diagnosis, status:patient.status, admittedAt:patient.admittedAt, attending:patient.attending, primaryNurse:patient.primaryNurse, notes:patient.notes };
    const v = vitals(patient.id);
    return json({ ok:true, detail:{ patient:safePatient, ...related(patient), vitals:v, risk:calculateRisk(patient, v) } });
  }

  if(path === '/api/device/examples'){
    return json({ ok:true, architecture:'authorized medical devices or hospital gateways -> LifeView Central API -> tenant-scoped JSON prototype store -> dashboards/mobile -> AI-assisted review', requiredTenantContext:'Send hospitalId in the JSON body or x-hospital-api-key in the request headers.', demoHeader:{'x-hospital-api-key':DEFAULT_DEVICE_API_KEY}, examples:{ bedsideMonitor:{ hospitalId:DEFAULT_HOSPITAL_ID, patientId:'p1', deviceType:'bedside_monitor', deviceId:'MON-ICU-01', values:{HR:102,SPO2:93,BP_SYS:118,BP_DIA:76,RR:21,TEMP:37.8} } } });
  }
  if(path === '/api/device/ingest' && method === 'POST'){
    const b = await body(req);
    const key = normalize(req.headers.get('x-hospital-api-key') || b.hospitalDeviceApiKey || b.apiKey);
    let hospital = key ? (DB.hospitals || []).find(h => h.deviceApiKey === key) : hospitalById(normalize(b.hospitalId));
    if(!hospital) return json({ ok:false, error:'hospitalId or valid x-hospital-api-key is required' }, key ? 401 : 400);
    if(b.hospitalId && b.hospitalId !== hospital.id) return json({ ok:false, error:'hospitalId does not match API key' }, 403);
    const patient = (DB.patients || []).find(p => (p.id === b.patientId || p.mrn === b.patientId) && p.hospitalId === hospital.id);
    if(!patient) return json({ ok:false, error:'Patient not found for this hospital' }, 404);
    const reading = { id:id('dev'), hospitalId:hospital.id, branchId:patient.branchId, patientId:patient.id, department:patient.unit, deviceType:normalize(b.deviceType), deviceId:normalize(b.deviceId), timestamp:b.timestamp || now(), values:b.values || {}, source:normalize(b.source) || 'hospital-gateway', status:normalize(b.status) || 'online' };
    DB.deviceReadings.unshift(reading);
    let device = (DB.devices || []).find(d => d.hospitalId === hospital.id && d.deviceId === reading.deviceId);
    if(!device){ device = { id:id('device'), hospitalId:hospital.id, branchId:patient.branchId, department:patient.unit, deviceType:reading.deviceType, deviceId:reading.deviceId, linkedPatientId:patient.id, source:reading.source, createdAt:now() }; DB.devices.unshift(device); }
    Object.assign(device, { status:reading.status, department:patient.unit, linkedPatientId:patient.id, lastUpdate:reading.timestamp, updatedAt:now() });
    audit({ username:'device-gateway', hospitalId:hospital.id }, 'device_ingest', 'patient', patient.mrn, hospital.id);
    return json({ ok:true, reading });
  }

  const gate = requireAuth(req);
  if(gate.error) return gate.error;
  const user = gate.user;

  if(path === '/api/logout' && method === 'POST') return json({ ok:true });
  if(path === '/api/me') return json({ ok:true, user:publicUser(user) });
  if(path === '/api/hospitals/me' && method === 'GET'){
    if(isSuper(user)) return json({ ok:true, hospital:null, platform:true });
    return json({ ok:true, hospital:publicHospital(hospitalById(user.hospitalId)), branches:(DB.branches || []).filter(b => b.hospitalId === user.hospitalId), departments:(DB.departments || []).filter(d => d.hospitalId === user.hospitalId) });
  }
  if(path === '/api/hospitals/me' && method === 'PUT'){
    if(!requireRole(user, ['hospital_admin','super_admin'])) return json({ ok:false, error:'Forbidden for this role' }, 403);
    const hospital = hospitalById(requestedHospital(user, url));
    if(!hospital) return json({ ok:false, error:'Hospital not found' }, 404);
    Object.assign(hospital, await body(req), { updatedAt:now() });
    return json({ ok:true, hospital:publicHospital(hospital) });
  }
  if(path === '/api/hospitals/register' && method === 'POST'){
    const b = await body(req);
    const required = ['hospitalName','legalName','registrationNumber','country','city','address','phone','email','hospitalType','numberOfBeds','adminFullName','adminEmail','adminPhone','adminUsername','adminPassword'];
    const missing = required.filter(k => !normalize(b[k]));
    if(missing.length) return json({ ok:false, error:`Missing required fields: ${missing.join(', ')}` }, 400);
    const hospitalId = id('hosp');
    const branchId = id('branch');
    const hospital = { id:hospitalId, name:normalize(b.hospitalName), legalName:normalize(b.legalName), registrationNumber:normalize(b.registrationNumber), country:normalize(b.country), city:normalize(b.city), address:normalize(b.address), phone:normalize(b.phone), email:normalize(b.email).toLowerCase(), hospitalType:normalize(b.hospitalType), numberOfBeds:Number(b.numberOfBeds) || 0, logoPlaceholder:normalize(b.logoPlaceholder) || initials(b.hospitalName), status:'pending', deviceApiKey:`lvh_${Math.random().toString(16).slice(2)}`, createdAt:now(), updatedAt:now() };
    const branch = { id:branchId, hospitalId, name:'Main Campus', code:'MAIN', city:hospital.city, address:hospital.address, phone:hospital.phone, email:hospital.email, status:'active', isDefault:true, createdAt:now(), updatedAt:now() };
    const departments = DEFAULT_DEPARTMENTS.map(name => ({ id:id('dept'), hospitalId, branchId, name, type:['Laboratory','Radiology'].includes(name) ? 'Diagnostic' : ['Pharmacy','Biomedical'].includes(name) ? 'Support' : name === 'Administration' ? 'Operations' : 'Clinical', status:'active', description:`${name} workspace for ${hospital.name}.`, userIds:[], createdAt:now(), updatedAt:now() }));
    const admin = { id:id('u'), hospitalId, branchId, department:'Administration', departmentId:(departments.find(d => d.name === 'Administration') || {}).id, username:normalize(b.adminUsername).toLowerCase(), fullName:normalize(b.adminFullName), email:normalize(b.adminEmail).toLowerCase(), phone:normalize(b.adminPhone), role:'hospital_admin', verified:true, password:String(b.adminPassword), createdAt:now() };
    DB.hospitals.push(hospital); DB.branches.push(branch); DB.departments.push(...departments); DB.users.push(admin);
    return json({ ok:true, hospital:publicHospital(hospital), branch, departments, admin:publicUser(admin), message:'Hospital workspace created. A super admin can approve the hospital before production use.' }, 201);
  }

  if(path === '/api/admin/hospitals' && method === 'GET'){
    if(!isSuper(user)) return json({ ok:false, error:'Forbidden for this role' }, 403);
    const hospitals = (DB.hospitals || []).map(h => ({ ...publicHospital(h), stats:{ users:(DB.users || []).filter(u => u.hospitalId === h.id).length, patients:(DB.patients || []).filter(p => p.hospitalId === h.id).length, branches:(DB.branches || []).filter(b => b.hospitalId === h.id).length, departments:(DB.departments || []).filter(d => d.hospitalId === h.id).length, devices:(DB.devices || []).filter(d => d.hospitalId === h.id).length } }));
    return json({ ok:true, hospitals, stats:{ hospitals:hospitals.length, approved:hospitals.filter(h => h.status === 'approved').length, pending:hospitals.filter(h => h.status === 'pending').length, suspended:hospitals.filter(h => h.status === 'suspended').length, users:(DB.users || []).length, patients:(DB.patients || []).length, devices:(DB.devices || []).length } });
  }
  const adminStatus = path.match(/^\/api\/admin\/hospitals\/([^/]+)\/status$/);
  if(adminStatus && method === 'PUT'){
    if(!isSuper(user)) return json({ ok:false, error:'Forbidden for this role' }, 403);
    const h = hospitalById(decodeURIComponent(adminStatus[1]));
    if(!h) return json({ ok:false, error:'Hospital not found' }, 404);
    h.status = normalize((await body(req)).status) || 'pending';
    h.updatedAt = now();
    return json({ ok:true, hospital:publicHospital(h) });
  }

  if(path === '/api/branches' && method === 'GET') return json({ ok:true, branches:scoped(DB.branches || [], user, url) });
  if(path === '/api/branches' && method === 'POST'){
    const hospitalId = requestedHospital(user, url);
    if(!canManage(user, hospitalId)) return json({ ok:false, error:'Forbidden for this hospital' }, 403);
    const b = await body(req);
    const branch = { id:id('branch'), hospitalId, name:normalize(b.name), code:normalize(b.code), city:normalize(b.city), address:normalize(b.address), phone:normalize(b.phone), email:normalize(b.email), status:normalize(b.status) || 'active', createdAt:now(), updatedAt:now() };
    DB.branches.push(branch);
    return json({ ok:true, branch }, 201);
  }
  const branchRoute = path.match(/^\/api\/branches\/([^/]+)$/);
  if(branchRoute){
    const branch = (DB.branches || []).find(b => b.id === decodeURIComponent(branchRoute[1]));
    if(!branch) return json({ ok:false, error:'Branch not found' }, 404);
    if(!canManage(user, branch.hospitalId)) return json({ ok:false, error:'Forbidden for this branch' }, 403);
    if(method === 'PUT'){ Object.assign(branch, await body(req), { updatedAt:now() }); return json({ ok:true, branch }); }
    if(method === 'DELETE'){ if(branch.isDefault) return json({ ok:false, error:'Default branch cannot be deleted' }, 400); DB.branches = DB.branches.filter(b => b.id !== branch.id); return json({ ok:true }); }
  }

  if(path === '/api/departments' && method === 'GET'){
    const departments = scoped(DB.departments || [], user, url);
    return json({ ok:true, departments, names:departments.map(d => d.name) });
  }
  if(path === '/api/services' && method === 'GET'){
    const services = scoped(DB.departments || [], user, url).map(d => ({ id:d.id, hospitalId:d.hospitalId, branchId:d.branchId, name:d.name, type:d.type || 'Department', status:d.status || 'active', description:d.description || `${d.name} workspace.` }));
    return json({ ok:true, services });
  }
  if(path === '/api/departments' && method === 'POST'){
    const hospitalId = requestedHospital(user, url);
    if(!canManage(user, hospitalId)) return json({ ok:false, error:'Forbidden for this hospital' }, 403);
    const b = await body(req);
    const department = { id:id('dept'), hospitalId, branchId:normalize(b.branchId) || ((DB.branches || []).find(x => x.hospitalId === hospitalId && x.isDefault) || {}).id, name:normalize(b.name), type:normalize(b.type) || 'Clinical', status:normalize(b.status) || 'active', description:normalize(b.description), userIds:[], createdAt:now(), updatedAt:now() };
    DB.departments.push(department);
    return json({ ok:true, department }, 201);
  }
  const deptRoute = path.match(/^\/api\/departments\/([^/]+)$/);
  if(deptRoute){
    const dept = (DB.departments || []).find(d => d.id === decodeURIComponent(deptRoute[1]));
    if(!dept) return json({ ok:false, error:'Department not found' }, 404);
    if(!canManage(user, dept.hospitalId)) return json({ ok:false, error:'Forbidden for this department' }, 403);
    if(method === 'PUT'){ Object.assign(dept, await body(req), { updatedAt:now() }); return json({ ok:true, department:dept }); }
    if(method === 'DELETE'){ DB.departments = DB.departments.filter(d => d.id !== dept.id); return json({ ok:true }); }
  }

  if(path === '/api/users' && method === 'GET'){
    if(!requireRole(user, ['hospital_admin','super_admin'])) return json({ ok:false, error:'Forbidden for this role' }, 403);
    return json({ ok:true, users:scoped(DB.users || [], user, url).map(publicUser) });
  }
  if(path === '/api/users' && method === 'POST'){
    if(!requireRole(user, ['hospital_admin','super_admin'])) return json({ ok:false, error:'Forbidden for this role' }, 403);
    const hospitalId = requestedHospital(user, url);
    if(!canManage(user, hospitalId)) return json({ ok:false, error:'Forbidden for this hospital' }, 403);
    const b = await body(req);
    const dept = (DB.departments || []).find(d => d.id === b.departmentId);
    const staff = { id:id('u'), hospitalId, branchId:normalize(b.branchId) || user.branchId, department:dept ? dept.name : normalize(b.department), departmentId:dept && dept.id, username:normalize(b.username).toLowerCase(), fullName:normalize(b.fullName), email:normalize(b.email).toLowerCase(), phone:normalize(b.phone), role:normalizeRole(b.role), verified:true, password:String(b.password || 'Password!123'), createdAt:now() };
    DB.users.push(staff);
    if(dept) dept.userIds = Array.from(new Set([...(dept.userIds || []), staff.id]));
    return json({ ok:true, user:publicUser(staff) }, 201);
  }

  if(path === '/api/devices' && method === 'GET'){
    const patients = DB.patients || [];
    const devices = scoped(DB.devices || [], user, url).map(d => { const p = patients.find(x => x.id === d.linkedPatientId); return { ...d, linkedPatientName:p ? p.name : '', bed:p ? p.bed : '' }; });
    return json({ ok:true, devices });
  }
  if(path === '/api/devices' && method === 'POST'){
    const hospitalId = requestedHospital(user, url);
    const b = await body(req);
    const patient = (DB.patients || []).find(p => p.id === b.linkedPatientId && p.hospitalId === hospitalId);
    const device = { id:id('device'), hospitalId, branchId:normalize(b.branchId) || (patient && patient.branchId) || user.branchId, department:normalize(b.department) || (patient && patient.unit) || 'Biomedical', deviceType:normalize(b.deviceType), deviceId:normalize(b.deviceId), linkedPatientId:patient ? patient.id : normalize(b.linkedPatientId), status:normalize(b.status) || 'online', lastUpdate:now(), source:normalize(b.source) || 'manual', createdAt:now(), updatedAt:now() };
    DB.devices.unshift(device);
    return json({ ok:true, device }, 201);
  }

  if(path === '/api/patients' && method === 'GET') return json({ ok:true, patients:listPatients(user, url) });
  if(path === '/api/patients' && method === 'POST'){
    const b = await body(req);
    const hospitalId = requestedHospital(user, url);
    const patient = { id:id('p'), hospitalId, branchId:normalize(b.branchId) || user.branchId, mrn:normalize(b.mrn), name:normalize(b.name), unit:normalize(b.unit), bed:normalize(b.bed), room:normalize(b.room) || normalize(b.bed), age:normalize(b.age), sex:normalize(b.sex), tag:normalize(b.tag), notes:normalize(b.notes), diagnosis:normalize(b.diagnosis), allergies:normalize(b.allergies), bloodType:normalize(b.bloodType), attending:normalize(b.attending), primaryNurse:normalize(b.primaryNurse), status:normalize(b.status) || 'stable', admittedAt:normalize(b.admittedAt) || now(), deviceMap:b.deviceMap || {} };
    DB.patients.unshift(patient);
    return json({ ok:true, patient }, 201);
  }
  const patientDetail = path.match(/^\/api\/patients\/([^/]+)\/detail$/);
  if(patientDetail && method === 'GET'){
    const patient = scoped(DB.patients || [], user, url).find(p => p.id === decodeURIComponent(patientDetail[1]));
    if(!patient) return json({ ok:false, error:'Patient not found' }, 404);
    return json({ ok:true, detail:{ patient, ...related(patient), devices:latestDeviceValues(patient.id, patient.hospitalId) } });
  }
  const patientAction = path.match(/^\/api\/patients\/([^/]+)\/(notes|orders|alerts)$/);
  if(patientAction && method === 'POST'){
    const patient = scoped(DB.patients || [], user, url).find(p => p.id === decodeURIComponent(patientAction[1]));
    if(!patient) return json({ ok:false, error:'Patient not found' }, 404);
    const b = await body(req);
    const key = patientAction[2];
    const item = { id:id(key[0]), hospitalId:patient.hospitalId, branchId:patient.branchId, patientId:patient.id, ts:now(), author:user.fullName || user.username, text:normalize(b.text) };
    if(key === 'orders') item.status = 'Active';
    if(key === 'alerts') item.severity = normalize(b.severity) || 'Medium';
    DB[key].unshift(item);
    return json({ ok:true, [key.slice(0, -1)]:item }, 201);
  }
  const patientRoute = path.match(/^\/api\/patients\/([^/]+)$/);
  if(patientRoute){
    const patient = scoped(DB.patients || [], user, url).find(p => p.id === decodeURIComponent(patientRoute[1]));
    if(!patient) return json({ ok:false, error:'Patient not found' }, 404);
    if(method === 'PUT'){ Object.assign(patient, await body(req), { id:patient.id, hospitalId:patient.hospitalId }); return json({ ok:true, patient }); }
    if(method === 'DELETE'){ DB.patients = DB.patients.filter(p => p.id !== patient.id); return json({ ok:true }); }
  }

  const vitalsRoute = path.match(/^\/api\/vitals\/([^/]+)$/);
  if(vitalsRoute){
    const patient = scoped(DB.patients || [], user, url).find(p => p.id === decodeURIComponent(vitalsRoute[1])) || scoped(DB.patients || [], user, url)[0];
    if(!patient) return json({ ok:false, error:'Patient not found' }, 404);
    const devices = latestDeviceValues(patient.id, patient.hospitalId);
    const v = mergeLatest(vitals(patient.id), devices.latest);
    return json({ ok:true, patient, vitals:v, risk:calculateRisk(patient, v), devices });
  }
  if(path === '/api/central'){
    const cards = listPatients(user, url).map(patient => {
      const devices = latestDeviceValues(patient.id, patient.hospitalId);
      const v = mergeLatest(vitals(patient.id), devices.latest);
      const risk = calculateRisk(patient, v);
      return { patient, risk, devices, alarmStatus:alarmStatus(patient, risk, devices) };
    });
    return json({ ok:true, cards });
  }
  const aiRoute = path.match(/^\/api\/ai\/analyze\/([^/]+)$/);
  if(aiRoute){
    const patient = scoped(DB.patients || [], user, url).find(p => p.id === decodeURIComponent(aiRoute[1]));
    if(!patient) return json({ ok:false, error:'Patient not found' }, 404);
    const analysis = aiFor(patient);
    DB.aiHistory.unshift({ id:id('ai'), hospitalId:patient.hospitalId, patientId:patient.id, ts:now(), user:user.username, result:analysis });
    return json({ ok:true, analysis });
  }
  if(path === '/api/ai/hospital'){
    const ranked = scoped(DB.patients || [], user, url).map(patient => ({ patient, risk:calculateRisk(patient, vitals(patient.id)) })).sort((a, b) => b.risk.score - a.risk.score);
    return json({ ok:true, ranked });
  }
  if(path === '/api/device/readings'){
    const patientId = url.searchParams.get('patientId');
    let readings = scoped(DB.deviceReadings || [], user, url);
    if(patientId) readings = readings.filter(r => r.patientId === patientId);
    return json({ ok:true, readings:readings.slice(0, 100) });
  }
  if(path === '/api/reports/summary'){
    const patients = scoped(DB.patients || [], user, url);
    return json({ ok:true, summary:{ total:patients.length, critical:patients.filter(p => p.status === 'critical').length, watch:patients.filter(p => p.status === 'watch').length, stable:patients.filter(p => p.status === 'stable').length, byUnit:patients.reduce((a,p) => { a[p.unit] = (a[p.unit] || 0) + 1; return a; }, {}) } });
  }
  if(path === '/api/audit') return json({ ok:true, audit:scoped(DB.audit || [], user, url) });

  return json({ ok:false, error:'Not found' }, 404);
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const DELETE = handle;
