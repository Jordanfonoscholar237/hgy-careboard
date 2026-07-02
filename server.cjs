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

const DEFAULT_HOSPITAL_ID = 'hosp-yaounde-general';
const DEFAULT_BRANCH_ID = 'branch-yaounde-main';
const DEFAULT_DEVICE_API_KEY = 'yg-demo-device-key';
const DEFAULT_DEPARTMENTS = [
  'ICU',
  'Emergency',
  'Surgery',
  'Radiology',
  'Maternity',
  'Pediatrics',
  'Laboratory',
  'Pharmacy',
  'Biomedical',
  'Administration'
];
const ROLES = [
  'super_admin',
  'hospital_admin',
  'doctor',
  'nurse',
  'biomedical_engineer',
  'lab_staff',
  'radiology_staff',
  'pharmacy_staff',
  'patient'
];

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(morgan('dev'));
app.use(express.static(path.join(__dirname, 'public')));

function emptyDb(){
  return {
    hospitals: [],
    branches: [],
    departments: [],
    devices: [],
    users: [],
    patients: [],
    notes: [],
    orders: [],
    labs: [],
    imaging: [],
    alerts: [],
    services: [],
    audit: [],
    patientAccess: [],
    deviceReadings: [],
    aiHistory: []
  };
}

function readDb(){
  try {
    return { ...emptyDb(), ...JSON.parse(fs.readFileSync(DATA_PATH, 'utf8')) };
  } catch(e){
    return emptyDb();
  }
}

function writeDb(db){
  fs.mkdirSync(path.dirname(DATA_PATH), { recursive: true });
  fs.writeFileSync(DATA_PATH, JSON.stringify(db, null, 2), 'utf8');
}

function normalize(s){ return String(s || '').trim(); }
function now(){ return new Date().toISOString(); }
function token(bytes = 24){ return crypto.randomBytes(bytes).toString('hex'); }
function otp(){ return String(Math.floor(100000 + Math.random() * 900000)); }
function makeId(prefix){ return `${prefix}-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`; }
function slugify(value){ return normalize(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'item'; }
function initials(name){ return normalize(name).split(/\s+/).map(x => x[0]).join('').slice(0, 3).toUpperCase() || 'LV'; }

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')){
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256').toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored){
  if(!stored || !stored.includes(':')) return false;
  const [salt, hash] = stored.split(':');
  const candidate = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256').toString('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(candidate, 'hex'));
  } catch(e){
    return false;
  }
}

function normalizeRole(role){
  const raw = normalize(role).toLowerCase().replace(/[\s-]+/g, '_');
  const aliases = {
    admin: 'hospital_admin',
    biomedical: 'biomedical_engineer',
    'biomedical_engineer': 'biomedical_engineer',
    'biomedical_engineer_': 'biomedical_engineer',
    laboratory_staff: 'lab_staff',
    lab: 'lab_staff',
    radiology: 'radiology_staff',
    pharmacy: 'pharmacy_staff'
  };
  const value = aliases[raw] || raw;
  return ROLES.includes(value) ? value : 'doctor';
}

function normalizeStatus(status){
  const value = normalize(status).toLowerCase();
  return ['pending', 'approved', 'suspended'].includes(value) ? value : 'pending';
}

function departmentType(name){
  if(['Laboratory', 'Radiology'].includes(name)) return 'Diagnostic';
  if(['Pharmacy', 'Biomedical'].includes(name)) return 'Support';
  if(name === 'Administration') return 'Operations';
  return 'Clinical';
}

function ensureArrays(db){
  let changed = false;
  for(const key of Object.keys(emptyDb())){
    if(!Array.isArray(db[key])){
      db[key] = [];
      changed = true;
    }
  }
  return changed;
}

function defaultHospital(){
  return {
    id: DEFAULT_HOSPITAL_ID,
    name: 'Yaounde General Hospital',
    legalName: 'Yaounde General Hospital Demo Authority',
    registrationNumber: 'YGH-DEMO-001',
    country: 'Cameroon',
    city: 'Yaounde',
    address: 'Demo hospital campus',
    phone: '+237 000 000 000',
    email: 'admin@yaounde-general.local',
    hospitalType: 'General hospital',
    numberOfBeds: 420,
    logoPlaceholder: 'YGH',
    status: 'approved',
    deviceApiKey: DEFAULT_DEVICE_API_KEY,
    createdAt: now(),
    updatedAt: now()
  };
}

function ensureTenantSchema(){
  const db = readDb();
  let changed = ensureArrays(db);

  let hospital = db.hospitals.find(h => h.id === DEFAULT_HOSPITAL_ID);
  if(!hospital){
    hospital = defaultHospital();
    db.hospitals.push(hospital);
    changed = true;
  }
  if(!hospital.deviceApiKey){
    hospital.deviceApiKey = DEFAULT_DEVICE_API_KEY;
    changed = true;
  }
  if(!hospital.status){
    hospital.status = 'approved';
    changed = true;
  }

  if(!db.branches.find(b => b.id === DEFAULT_BRANCH_ID)){
    db.branches.push({
      id: DEFAULT_BRANCH_ID,
      hospitalId: DEFAULT_HOSPITAL_ID,
      name: 'Main Campus',
      code: 'MAIN',
      city: hospital.city,
      address: hospital.address,
      phone: hospital.phone,
      email: hospital.email,
      status: 'active',
      isDefault: true,
      createdAt: now(),
      updatedAt: now()
    });
    changed = true;
  }

  for(const name of DEFAULT_DEPARTMENTS){
    if(!db.departments.find(d => d.hospitalId === DEFAULT_HOSPITAL_ID && d.name === name)){
      db.departments.push({
        id: `dept-${slugify(name)}`,
        hospitalId: DEFAULT_HOSPITAL_ID,
        branchId: DEFAULT_BRANCH_ID,
        name,
        type: departmentType(name),
        status: 'active',
        description: `${name} workspace for patients, staff, devices, and reports.`,
        userIds: [],
        createdAt: now(),
        updatedAt: now()
      });
      changed = true;
    }
  }

  const ensureUser = (username, fields) => {
    let user = db.users.find(u => u.username === username);
    if(!user){
      user = { id: fields.id || makeId('u'), username, createdAt: now() };
      db.users.push(user);
      changed = true;
    }
    for(const [key, value] of Object.entries(fields)){
      if(user[key] === undefined || user[key] === null || user[key] === ''){
        user[key] = value;
        changed = true;
      }
    }
    const role = normalizeRole(user.role);
    if(user.role !== role){
      user.role = role;
      changed = true;
    }
    return user;
  };

  ensureUser('super.admin', {
    id: 'u-super-admin',
    fullName: 'LifeView Platform Admin',
    email: 'super@lifeview.local',
    phone: '+237 000 000 001',
    role: 'super_admin',
    verified: true,
    passwordHash: hashPassword('Password!123')
  });
  ensureUser('hospital.admin', {
    id: 'u-hospital-admin',
    fullName: 'Hospital Administrator',
    email: 'hospital.admin@yaounde-general.local',
    phone: '+237 000 000 002',
    department: 'Administration',
    role: 'hospital_admin',
    hospitalId: DEFAULT_HOSPITAL_ID,
    branchId: DEFAULT_BRANCH_ID,
    verified: true,
    passwordHash: hashPassword('Password!123')
  });
  ensureUser('dr.alvarez', {
    id: 'u-demo-1',
    fullName: 'Dr. Sofia Alvarez',
    email: 'demo@lifeview.local',
    department: 'ICU',
    role: 'doctor',
    hospitalId: DEFAULT_HOSPITAL_ID,
    branchId: DEFAULT_BRANCH_ID,
    verified: true,
    passwordHash: hashPassword('Password!123')
  });

  for(const user of db.users){
    const role = normalizeRole(user.role);
    if(user.role !== role){ user.role = role; changed = true; }
    if(user.role !== 'super_admin' && !user.hospitalId){ user.hospitalId = DEFAULT_HOSPITAL_ID; changed = true; }
    if(user.role !== 'super_admin' && !user.branchId){ user.branchId = DEFAULT_BRANCH_ID; changed = true; }
    if(!user.department && user.role === 'hospital_admin'){ user.department = 'Administration'; changed = true; }
    const dept = db.departments.find(d => d.hospitalId === user.hospitalId && d.name === user.department);
    if(dept && user.departmentId !== dept.id){ user.departmentId = dept.id; changed = true; }
  }

  const patientHospital = new Map();
  for(const patient of db.patients){
    if(!patient.hospitalId){ patient.hospitalId = DEFAULT_HOSPITAL_ID; changed = true; }
    if(!patient.branchId){ patient.branchId = DEFAULT_BRANCH_ID; changed = true; }
    patientHospital.set(patient.id, patient.hospitalId);
  }

  for(const key of ['notes', 'orders', 'labs', 'imaging', 'alerts', 'patientAccess', 'deviceReadings', 'aiHistory']){
    for(const item of db[key]){
      const hospitalId = item.hospitalId || patientHospital.get(item.patientId) || DEFAULT_HOSPITAL_ID;
      if(item.hospitalId !== hospitalId){ item.hospitalId = hospitalId; changed = true; }
      if(!item.branchId && hospitalId === DEFAULT_HOSPITAL_ID && key !== 'aiHistory'){ item.branchId = DEFAULT_BRANCH_ID; changed = true; }
    }
  }

  for(const service of db.services){
    if(!service.id){ service.id = `svc-${slugify(service.name)}-${token(2)}`; changed = true; }
    if(!service.hospitalId){ service.hospitalId = DEFAULT_HOSPITAL_ID; changed = true; }
    if(!service.branchId){ service.branchId = DEFAULT_BRANCH_ID; changed = true; }
  }

  db.devices = db.devices || [];
  for(const patient of db.patients){
    const map = patient.deviceMap || {};
    for(const [name, deviceId] of Object.entries(map)){
      const normalizedDeviceId = normalize(deviceId);
      if(!normalizedDeviceId) continue;
      if(!db.devices.find(d => d.hospitalId === patient.hospitalId && d.deviceId === normalizedDeviceId)){
        db.devices.push({
          id: `device-${slugify(normalizedDeviceId)}-${token(2)}`,
          hospitalId: patient.hospitalId,
          branchId: patient.branchId || DEFAULT_BRANCH_ID,
          department: patient.unit,
          deviceType: name,
          deviceId: normalizedDeviceId,
          linkedPatientId: patient.id,
          status: 'online',
          lastUpdate: now(),
          source: 'demo-inventory',
          createdAt: now(),
          updatedAt: now()
        });
        changed = true;
      }
    }
  }

  if(changed) writeDb(db);
}

function hospitalById(db, hospitalId){
  return (db.hospitals || []).find(h => h.id === hospitalId);
}

function branchById(db, branchId){
  return (db.branches || []).find(b => b.id === branchId);
}

function isSuperAdmin(user){
  return normalizeRole(user.role) === 'super_admin';
}

function scoped(records, req, requestedHospitalId){
  const list = records || [];
  if(isSuperAdmin(req.user)){
    return requestedHospitalId ? list.filter(x => x.hospitalId === requestedHospitalId) : list;
  }
  return list.filter(x => x.hospitalId === req.user.hospitalId);
}

function requestedHospitalId(req){
  return isSuperAdmin(req.user) ? normalize(req.query.hospitalId) : req.user.hospitalId;
}

function publicHospital(h){
  if(!h) return null;
  return {
    id: h.id,
    name: h.name,
    legalName: h.legalName,
    registrationNumber: h.registrationNumber,
    country: h.country,
    city: h.city,
    address: h.address,
    phone: h.phone,
    email: h.email,
    hospitalType: h.hospitalType,
    numberOfBeds: h.numberOfBeds,
    logoPlaceholder: h.logoPlaceholder || initials(h.name),
    status: h.status || 'pending',
    createdAt: h.createdAt,
    updatedAt: h.updatedAt
  };
}

function publicUser(u, db = readDb()){
  const hospital = u.hospitalId ? hospitalById(db, u.hospitalId) : null;
  const branch = u.branchId ? branchById(db, u.branchId) : null;
  return {
    id: u.id,
    username: u.username,
    fullName: u.fullName,
    email: u.email,
    phone: u.phone,
    department: u.department,
    departmentId: u.departmentId,
    verified: !!u.verified,
    role: normalizeRole(u.role),
    hospitalId: u.hospitalId || null,
    hospitalName: hospital ? hospital.name : 'LifeView Central Platform',
    hospitalStatus: hospital ? hospital.status : 'platform',
    branchId: u.branchId || null,
    branchName: branch ? branch.name : ''
  };
}

function audit(user, action, target, detail, hospitalId){
  const db = readDb();
  db.audit = db.audit || [];
  db.audit.unshift({
    id: makeId('audit'),
    ts: now(),
    hospitalId: hospitalId || (user && user.hospitalId) || null,
    user: user ? user.username : 'system',
    action,
    target,
    detail
  });
  db.audit = db.audit.slice(0, 500);
  writeDb(db);
}

function requireAuth(req, res, next){
  const header = req.headers.authorization || '';
  const t = header.startsWith('Bearer ') ? header.slice(7) : '';
  const db = readDb();
  const user = db.users.find(u => u.sessionToken === t && u.sessionExp && u.sessionExp > Date.now());
  if(!user) return res.status(401).json({ ok: false, error: 'Unauthorized' });
  user.role = normalizeRole(user.role);
  if(!isSuperAdmin(user)){
    const hospital = hospitalById(db, user.hospitalId);
    if(!hospital) return res.status(403).json({ ok: false, error: 'Hospital workspace not found' });
    if(hospital.status === 'suspended') return res.status(403).json({ ok: false, error: 'Hospital workspace is suspended' });
  }
  req.user = user;
  next();
}

function requireRole(...roles){
  const allowed = roles.map(normalizeRole);
  return (req, res, next) => {
    if(!allowed.includes(normalizeRole(req.user.role))){
      return res.status(403).json({ ok: false, error: 'Forbidden for this role' });
    }
    next();
  };
}

function requirePatientAuth(req, res, next){
  const header = req.headers.authorization || '';
  const t = header.startsWith('Bearer ') ? header.slice(7) : '';
  const db = readDb();
  const account = (db.patientAccess || []).find(a => a.sessionToken === t && a.sessionExp && a.sessionExp > Date.now());
  if(!account) return res.status(401).json({ ok: false, error: 'Unauthorized patient access' });
  const patient = (db.patients || []).find(p => p.id === account.patientId && p.hospitalId === account.hospitalId);
  if(!patient) return res.status(404).json({ ok: false, error: 'Patient profile not found' });
  req.patientAccount = account;
  req.patient = patient;
  next();
}

function publicPatientAccount(account, patient){
  const db = readDb();
  const hospital = hospitalById(db, patient.hospitalId);
  return {
    id: account.id,
    patientId: account.patientId,
    hospitalId: patient.hospitalId,
    hospitalName: hospital ? hospital.name : '',
    mrn: patient.mrn,
    name: patient.name,
    unit: patient.unit,
    room: patient.room,
    bed: patient.bed,
    verified: !!account.verified
  };
}

function ensureDemoPatientData(){
  const db = readDb();
  db.patients = db.patients || [];
  if(db.patients.length) return;
  db.patients.push({
    id: 'p1',
    hospitalId: DEFAULT_HOSPITAL_ID,
    branchId: DEFAULT_BRANCH_ID,
    mrn: 'MRN-001',
    name: 'Jane Demo',
    unit: 'ICU',
    bed: 'ICU-1',
    room: 'ICU Wing A',
    age: '46',
    sex: 'F',
    bloodType: 'O+',
    tag: 'High Risk',
    status: 'critical',
    diagnosis: 'Severe pneumonia',
    allergies: 'Penicillin',
    notes: 'Ventilated patient; continuous monitoring required.',
    admittedAt: '2026-04-20T08:30:00Z',
    attending: 'Dr. Sofia Alvarez',
    primaryNurse: 'Nurse Mballa',
    deviceMap: { 'Bedside Monitor': 'Mindray BeneVision / demo', Ventilator: 'Vent-07' }
  });
  db.notes = db.notes || [];
  db.orders = db.orders || [];
  db.labs = db.labs || [];
  db.imaging = db.imaging || [];
  db.notes.push({ id: 'n-demo-1', hospitalId: DEFAULT_HOSPITAL_ID, branchId: DEFAULT_BRANCH_ID, patientId: 'p1', ts: now(), author: 'Care Team', text: 'Patient is under continuous monitoring. Family updates should be confirmed with the attending physician.' });
  db.orders.push({ id: 'o-demo-1', hospitalId: DEFAULT_HOSPITAL_ID, branchId: DEFAULT_BRANCH_ID, patientId: 'p1', ts: now(), author: 'Dr. Sofia Alvarez', status: 'Active', text: 'Continue oxygenation monitoring and scheduled care plan.' });
  db.labs.push({ id: 'l-demo-1', hospitalId: DEFAULT_HOSPITAL_ID, branchId: DEFAULT_BRANCH_ID, patientId: 'p1', ts: now(), type: 'CBC', text: 'Demo lab update available for review with care team.' });
  db.imaging.push({ id: 'i-demo-1', hospitalId: DEFAULT_HOSPITAL_ID, branchId: DEFAULT_BRANCH_ID, patientId: 'p1', ts: now(), type: 'Chest Imaging', text: 'Demo imaging update. Final interpretation should be confirmed by clinician.' });
  writeDb(db);
}

function ensureDemoPatientAccess(){
  const db = readDb();
  db.patientAccess = db.patientAccess || [];
  const patient = (db.patients || []).find(p => p.mrn === 'MRN-001') || (db.patients || [])[0];
  if(patient && !db.patientAccess.find(a => a.patientId === patient.id)){
    db.patientAccess.push({
      id: 'pa-demo-1',
      hospitalId: patient.hospitalId || DEFAULT_HOSPITAL_ID,
      branchId: patient.branchId || DEFAULT_BRANCH_ID,
      patientId: patient.id,
      codeHash: hashPassword('PATIENT123'),
      verified: true,
      createdAt: now()
    });
    writeDb(db);
  }
}

async function sendVerificationEmail(user, code){
  if(String(process.env.EMAIL_DEV_MODE || 'true').toLowerCase() === 'true'){
    console.log(`[DEV EMAIL] OTP for ${user.email}: ${code}`);
    return { dev: true };
  }
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_SECURE || 'false').toLowerCase() === 'true',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
  });
  await transporter.sendMail({
    from: process.env.MAIL_FROM || process.env.SMTP_USER,
    to: user.email,
    subject: 'Your LifeView Central verification code',
    text: `Hello ${user.fullName},\n\nYour LifeView Central verification code is: ${code}\n\nThis code expires in 10 minutes.`,
    html: `<h2>LifeView Central</h2><p>Your code is:</p><div style="font-size:30px;font-weight:bold;letter-spacing:4px">${code}</div>`
  });
  return { dev: false };
}

ensureDemoPatientData();
ensureTenantSchema();
ensureDemoPatientAccess();

function generateVitals(patientId){
  const base = Math.abs([...String(patientId)].reduce((a, c) => a + c.charCodeAt(0), 0)) % 20;
  const nowMs = Date.now();
  const make = (n, min, amp, speed, decimals = 0) => Array.from({ length: n }, (_, i) => ({
    t: nowMs - (n - i) * 1000,
    v: Math.round((min + amp + Math.sin((nowMs / 1000 + i) / speed) * amp + Math.random() * 3) * (decimals ? 10 : 1)) / (decimals ? 10 : 1)
  }));
  return {
    HR: make(100, 70 + base, 9, 4),
    SPO2: make(100, 95, 2, 5),
    RR: make(100, 14, 3, 6),
    TEMP: make(100, 36.6, .35, 7, 1),
    BP_SYS: make(100, 110 + base, 12, 8),
    BP_DIA: make(100, 70, 6, 9),
    PEEP: make(100, 5, 2, 12),
    VT: make(100, 400, 50, 10),
    ETCO2: make(100, 34, 4, 8)
  };
}

function calculateRisk(patient, vitals){
  const latest = {};
  for(const [k, arr] of Object.entries(vitals)){
    latest[k] = arr[arr.length - 1].v;
  }
  let score = 0;
  if(latest.HR > 110 || latest.HR < 50) score += 2;
  if(latest.SPO2 < 92) score += 3;
  if(latest.RR > 24 || latest.RR < 8) score += 2;
  if(latest.TEMP > 38.5 || latest.TEMP < 35) score += 1;
  if(latest.BP_SYS < 90 || latest.BP_SYS > 160) score += 2;
  if(patient.status === 'critical') score += 3;
  if(patient.tag === 'High Risk') score += 2;
  const level = score >= 7 ? 'high' : score >= 4 ? 'medium' : 'low';
  return { score, level, latest };
}

function localAiAnalysis(patient, vitals){
  const risk = calculateRisk(patient, vitals);
  const latest = risk.latest;
  const recommendations = [];
  if(latest.SPO2 < 94) recommendations.push('Review oxygenation, probe position, oxygen delivery, and ventilator settings if applicable.');
  if(latest.HR > 105) recommendations.push('Review pain, fever, anxiety, hypovolemia, or rhythm issues.');
  if(latest.BP_SYS < 100) recommendations.push('Review perfusion, fluid balance, and vasopressor needs according to clinician judgment.');
  if(patient.tag === 'Isolation') recommendations.push('Maintain PPE and isolation workflow.');
  if(recommendations.length === 0) recommendations.push('Continue routine monitoring and reassess trends.');
  return {
    mode: 'mock',
    generatedAt: now(),
    patient: { name: patient.name, mrn: patient.mrn, unit: patient.unit, bed: patient.bed },
    risk,
    summary: `${patient.name} is currently classified as ${risk.level.toUpperCase()} risk based on simulated vitals, status, and tags.`,
    recommendations,
    disclaimer: 'Demo decision-support only. Not for clinical diagnosis or treatment.'
  };
}

async function externalAiAnalysis(patient, vitals){
  const key = process.env.OPENAI_API_KEY;
  if(!key) return localAiAnalysis(patient, vitals);
  const prompt = `Summarize patient for doctor without diagnosis. Patient: ${JSON.stringify(patient)} Risk: ${JSON.stringify(calculateRisk(patient, vitals))}. Return concise clinical dashboard recommendations.`;
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model: process.env.OPENAI_MODEL || 'gpt-4.1-mini', input: prompt })
  });
  if(!response.ok) return localAiAnalysis(patient, vitals);
  const data = await response.json();
  return { mode: 'ai', generatedAt: now(), raw: data, fallback: localAiAnalysis(patient, vitals) };
}

// Production security required: real medical-device ingestion must use signed
// requests, replay protection, gateway identity, vendor-approved interfaces,
// encryption, audit trails, validation, and clinical engineering approval.
const DEVICE_EXAMPLES = {
  bedsideMonitor: {
    hospitalId: DEFAULT_HOSPITAL_ID,
    deviceType: 'bedside_monitor',
    patientId: 'p1',
    deviceId: 'MON-ICU-01',
    timestamp: now(),
    values: { HR: 102, SPO2: 93, BP_SYS: 118, BP_DIA: 76, RR: 21, TEMP: 37.8, ETCO2: 36 }
  },
  ventilator: {
    hospitalId: DEFAULT_HOSPITAL_ID,
    deviceType: 'ventilator',
    patientId: 'p1',
    deviceId: 'VENT-07',
    timestamp: now(),
    values: { mode: 'AC/VC', FiO2: 0.45, PEEP: 6, VT: 420, RR_SET: 16, ETCO2: 37 }
  },
  infusionPump: {
    hospitalId: DEFAULT_HOSPITAL_ID,
    deviceType: 'infusion_pump',
    patientId: 'p1',
    deviceId: 'PUMP-12',
    timestamp: now(),
    values: { channel: 'A', medication: 'Demo medication', rateMlHr: 12.5, volumeRemainingMl: 86, alarm: 'none' }
  },
  labMachine: {
    hospitalId: DEFAULT_HOSPITAL_ID,
    deviceType: 'lab_analyzer',
    patientId: 'p1',
    deviceId: 'LAB-CBC-02',
    timestamp: now(),
    values: { test: 'Hemoglobin', value: 11.8, unit: 'g/dL', flag: 'normal' }
  },
  imagingSystem: {
    hospitalId: DEFAULT_HOSPITAL_ID,
    deviceType: 'imaging_system',
    patientId: 'p1',
    deviceId: 'PACS-DEMO',
    timestamp: now(),
    values: { modality: 'X-Ray', study: 'Chest X-Ray', status: 'reported', summary: 'Demo imaging summary for clinician review.' }
  }
};

function latestDeviceValues(db, patientId, hospitalId){
  const readings = (db.deviceReadings || [])
    .filter(r => r.patientId === patientId && (!hospitalId || r.hospitalId === hospitalId))
    .sort((a, b) => String(b.timestamp || '').localeCompare(String(a.timestamp || '')));
  const latest = {};
  readings.forEach(r => { if(!latest[r.deviceType]) latest[r.deviceType] = r; });
  return { latest, readings: readings.slice(0, 25) };
}

function mergeLatestIntoVitals(vitals, latest){
  const reading = latest.bedside_monitor || latest.ventilator;
  if(!reading || !reading.values) return vitals;
  for(const [k, v] of Object.entries(reading.values)){
    if(vitals[k] && typeof v === 'number') vitals[k][vitals[k].length - 1].v = v;
  }
  return vitals;
}

function alarmStatus(patient, risk, devices){
  const hasConnection = Object.keys(devices.latest || {}).length || Object.keys(patient.deviceMap || {}).length;
  if(!hasConnection) return 'disconnected';
  if(patient.status === 'critical' || risk.score >= 7) return 'critical';
  if(risk.score >= 5) return 'high';
  if(risk.score >= 3 || patient.status === 'watch') return 'warning';
  return 'stable';
}

function findScopedPatient(db, req, id){
  return scoped(db.patients || [], req).find(p => p.id === id);
}

function relatedRecords(db, patient){
  const related = key => (db[key] || []).filter(x => x.patientId === patient.id && x.hospitalId === patient.hospitalId);
  return {
    notes: related('notes'),
    orders: related('orders'),
    labs: related('labs'),
    imaging: related('imaging'),
    alerts: related('alerts')
  };
}

function userCanManageHospital(req, hospitalId){
  return isSuperAdmin(req.user) || (normalizeRole(req.user.role) === 'hospital_admin' && req.user.hospitalId === hospitalId);
}

app.post('/api/hospitals/register', (req, res) => {
  const b = req.body || {};
  const required = ['hospitalName', 'legalName', 'registrationNumber', 'country', 'city', 'address', 'phone', 'email', 'hospitalType', 'numberOfBeds', 'adminFullName', 'adminEmail', 'adminPhone', 'adminUsername', 'adminPassword'];
  const missing = required.filter(k => !normalize(b[k]));
  if(missing.length) return res.status(400).json({ ok: false, error: `Missing required fields: ${missing.join(', ')}` });
  if(String(b.adminPassword).length < 8 || !/\d/.test(String(b.adminPassword))) return res.status(400).json({ ok: false, error: 'Admin password must be at least 8 characters and include a number' });

  const db = readDb();
  const hospitalEmail = normalize(b.email).toLowerCase();
  const adminEmail = normalize(b.adminEmail).toLowerCase();
  const adminUsername = normalize(b.adminUsername).toLowerCase();
  if(db.hospitals.find(h => normalize(h.registrationNumber).toLowerCase() === normalize(b.registrationNumber).toLowerCase())) return res.status(409).json({ ok: false, error: 'Hospital registration number already exists' });
  if(db.users.find(u => u.username === adminUsername)) return res.status(409).json({ ok: false, error: 'Admin username already exists' });
  if(db.users.find(u => normalize(u.email).toLowerCase() === adminEmail)) return res.status(409).json({ ok: false, error: 'Admin email already exists' });

  const hospitalId = makeId('hosp');
  const branchId = makeId('branch');
  const hospital = {
    id: hospitalId,
    name: normalize(b.hospitalName),
    legalName: normalize(b.legalName),
    registrationNumber: normalize(b.registrationNumber),
    country: normalize(b.country),
    city: normalize(b.city),
    address: normalize(b.address),
    phone: normalize(b.phone),
    email: hospitalEmail,
    hospitalType: normalize(b.hospitalType),
    numberOfBeds: Number(b.numberOfBeds) || 0,
    logoPlaceholder: normalize(b.logoPlaceholder) || initials(b.hospitalName),
    status: 'pending',
    deviceApiKey: `lvh_${token(18)}`,
    createdAt: now(),
    updatedAt: now()
  };
  const branch = {
    id: branchId,
    hospitalId,
    name: 'Main Campus',
    code: 'MAIN',
    city: hospital.city,
    address: hospital.address,
    phone: hospital.phone,
    email: hospital.email,
    status: 'active',
    isDefault: true,
    createdAt: now(),
    updatedAt: now()
  };
  const departments = DEFAULT_DEPARTMENTS.map(name => ({
    id: makeId('dept'),
    hospitalId,
    branchId,
    name,
    type: departmentType(name),
    status: 'active',
    description: `${name} workspace for ${hospital.name}.`,
    userIds: [],
    createdAt: now(),
    updatedAt: now()
  }));
  const admin = {
    id: makeId('u'),
    hospitalId,
    branchId,
    department: 'Administration',
    departmentId: departments.find(d => d.name === 'Administration').id,
    username: adminUsername,
    fullName: normalize(b.adminFullName),
    email: adminEmail,
    phone: normalize(b.adminPhone),
    role: 'hospital_admin',
    verified: true,
    passwordHash: hashPassword(String(b.adminPassword)),
    createdAt: now()
  };
  db.hospitals.push(hospital);
  db.branches.push(branch);
  db.departments.push(...departments);
  db.users.push(admin);
  writeDb(db);
  audit(admin, 'register_hospital', 'hospital', hospital.name, hospitalId);
  res.status(201).json({
    ok: true,
    hospital: publicHospital(hospital),
    branch,
    departments,
    admin: publicUser(admin, db),
    message: 'Hospital workspace created. A super admin can approve the hospital before production use.'
  });
});

app.post('/api/signup', async (req, res) => {
  const b = req.body || {};
  const fullName = normalize(b.fullName);
  const username = normalize(b.username).toLowerCase();
  const email = normalize(b.email).toLowerCase();
  const department = normalize(b.department) || 'ICU';
  const password = String(b.password || '');
  if(!fullName || !username || !email || !password) return res.status(400).json({ ok: false, error: 'Missing required fields' });
  if(password.length < 8 || !/\d/.test(password)) return res.status(400).json({ ok: false, error: 'Password must be at least 8 characters and include a number' });
  if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return res.status(400).json({ ok: false, error: 'Invalid email' });
  const db = readDb();
  if(db.users.find(u => u.username === username)) return res.status(409).json({ ok: false, error: 'Username already exists' });
  if(db.users.find(u => u.email === email)) return res.status(409).json({ ok: false, error: 'Email already exists' });
  const code = otp();
  const role = normalizeRole(b.role || 'doctor');
  const dept = db.departments.find(d => d.hospitalId === DEFAULT_HOSPITAL_ID && d.name === department);
  const user = {
    id: makeId('u'),
    username,
    fullName,
    email,
    hospitalId: DEFAULT_HOSPITAL_ID,
    branchId: DEFAULT_BRANCH_ID,
    department,
    departmentId: dept ? dept.id : undefined,
    role: role === 'super_admin' ? 'doctor' : role,
    verified: false,
    passwordHash: hashPassword(password),
    otpHash: hashPassword(code),
    otpExp: Date.now() + 10 * 60 * 1000,
    createdAt: now()
  };
  db.users.push(user);
  writeDb(db);
  try {
    const sent = await sendVerificationEmail(user, code);
    res.json({ ok: true, username, message: 'Verification code sent to email', devOtp: sent.dev ? code : undefined });
  } catch(e){
    res.status(500).json({ ok: false, error: 'Could not send verification email. Check SMTP settings.' });
  }
});

app.post('/api/resend-code', async (req, res) => {
  const username = normalize(req.body.username).toLowerCase();
  const db = readDb();
  const user = db.users.find(u => u.username === username);
  if(!user) return res.status(404).json({ ok: false, error: 'User not found' });
  if(user.verified) return res.json({ ok: true, message: 'Already verified' });
  const code = otp();
  user.otpHash = hashPassword(code);
  user.otpExp = Date.now() + 10 * 60 * 1000;
  writeDb(db);
  const sent = await sendVerificationEmail(user, code);
  res.json({ ok: true, devOtp: sent.dev ? code : undefined });
});

app.post('/api/verify', (req, res) => {
  const username = normalize(req.body.username).toLowerCase();
  const code = normalize(req.body.code);
  const db = readDb();
  const user = db.users.find(u => u.username === username);
  if(!user) return res.status(404).json({ ok: false, error: 'User not found' });
  if(user.verified) return res.json({ ok: true, message: 'Already verified' });
  if(!user.otpHash || !user.otpExp || user.otpExp < Date.now()) return res.status(400).json({ ok: false, error: 'Code expired' });
  if(!verifyPassword(code, user.otpHash)) return res.status(400).json({ ok: false, error: 'Invalid code' });
  user.verified = true;
  delete user.otpHash;
  delete user.otpExp;
  writeDb(db);
  res.json({ ok: true });
});

app.post('/api/login', (req, res) => {
  const username = normalize(req.body.username).toLowerCase();
  const password = String(req.body.password || '');
  const db = readDb();
  const user = db.users.find(u => u.username === username);
  if(!user || !verifyPassword(password, user.passwordHash)) return res.status(401).json({ ok: false, error: 'Invalid credentials' });
  if(!user.verified) return res.status(403).json({ ok: false, error: 'Account not verified', needsVerification: true });
  const role = normalizeRole(user.role);
  if(role !== 'super_admin'){
    const hospital = hospitalById(db, user.hospitalId);
    if(!hospital) return res.status(403).json({ ok: false, error: 'Hospital workspace not found' });
    if(hospital.status === 'suspended') return res.status(403).json({ ok: false, error: 'Hospital workspace is suspended' });
  }
  user.role = role;
  user.sessionToken = token();
  user.sessionExp = Date.now() + 8 * 60 * 60 * 1000;
  writeDb(db);
  audit(user, 'login', 'user', user.username);
  res.json({ ok: true, token: user.sessionToken, user: publicUser(user, db) });
});

app.post('/api/logout', requireAuth, (req, res) => {
  const db = readDb();
  const user = db.users.find(u => u.id === req.user.id);
  if(user){
    delete user.sessionToken;
    delete user.sessionExp;
    writeDb(db);
  }
  res.json({ ok: true });
});

app.get('/api/me', requireAuth, (req, res) => res.json({ ok: true, user: publicUser(req.user) }));

app.get('/api/hospitals/me', requireAuth, (req, res) => {
  const db = readDb();
  if(isSuperAdmin(req.user)){
    return res.json({ ok: true, hospital: null, platform: true });
  }
  const hospital = hospitalById(db, req.user.hospitalId);
  res.json({
    ok: true,
    hospital: publicHospital(hospital),
    branches: (db.branches || []).filter(b => b.hospitalId === req.user.hospitalId),
    departments: (db.departments || []).filter(d => d.hospitalId === req.user.hospitalId)
  });
});

app.put('/api/hospitals/me', requireAuth, requireRole('hospital_admin', 'super_admin'), (req, res) => {
  const db = readDb();
  const hospitalId = requestedHospitalId(req) || req.user.hospitalId;
  if(!userCanManageHospital(req, hospitalId)) return res.status(403).json({ ok: false, error: 'Forbidden for this hospital' });
  const hospital = hospitalById(db, hospitalId);
  if(!hospital) return res.status(404).json({ ok: false, error: 'Hospital not found' });
  for(const field of ['name', 'legalName', 'registrationNumber', 'country', 'city', 'address', 'phone', 'email', 'hospitalType', 'numberOfBeds', 'logoPlaceholder']){
    if(req.body[field] !== undefined) hospital[field] = field === 'numberOfBeds' ? Number(req.body[field]) || 0 : normalize(req.body[field]);
  }
  hospital.updatedAt = now();
  writeDb(db);
  audit(req.user, 'update', 'hospital', hospital.name, hospital.id);
  res.json({ ok: true, hospital: publicHospital(hospital) });
});

app.get('/api/admin/hospitals', requireAuth, requireRole('super_admin'), (req, res) => {
  const db = readDb();
  const hospitals = (db.hospitals || []).map(h => {
    const stats = {
      users: (db.users || []).filter(u => u.hospitalId === h.id).length,
      patients: (db.patients || []).filter(p => p.hospitalId === h.id).length,
      branches: (db.branches || []).filter(b => b.hospitalId === h.id).length,
      departments: (db.departments || []).filter(d => d.hospitalId === h.id).length,
      devices: (db.devices || []).filter(d => d.hospitalId === h.id).length
    };
    return { ...publicHospital(h), stats };
  });
  const platformStats = {
    hospitals: hospitals.length,
    approved: hospitals.filter(h => h.status === 'approved').length,
    pending: hospitals.filter(h => h.status === 'pending').length,
    suspended: hospitals.filter(h => h.status === 'suspended').length,
    users: (db.users || []).length,
    patients: (db.patients || []).length,
    devices: (db.devices || []).length
  };
  res.json({ ok: true, hospitals, stats: platformStats });
});

app.put('/api/admin/hospitals/:id/status', requireAuth, requireRole('super_admin'), (req, res) => {
  const db = readDb();
  const hospital = hospitalById(db, req.params.id);
  if(!hospital) return res.status(404).json({ ok: false, error: 'Hospital not found' });
  hospital.status = normalizeStatus(req.body.status);
  hospital.updatedAt = now();
  writeDb(db);
  audit(req.user, 'update_status', 'hospital', `${hospital.name}: ${hospital.status}`, hospital.id);
  res.json({ ok: true, hospital: publicHospital(hospital) });
});

app.get('/api/branches', requireAuth, (req, res) => {
  const db = readDb();
  res.json({ ok: true, branches: scoped(db.branches || [], req, requestedHospitalId(req)) });
});

app.post('/api/branches', requireAuth, requireRole('hospital_admin', 'super_admin'), (req, res) => {
  const db = readDb();
  const hospitalId = requestedHospitalId(req) || req.user.hospitalId;
  if(!userCanManageHospital(req, hospitalId)) return res.status(403).json({ ok: false, error: 'Forbidden for this hospital' });
  if(!normalize(req.body.name)) return res.status(400).json({ ok: false, error: 'Branch name is required' });
  const branch = {
    id: makeId('branch'),
    hospitalId,
    name: normalize(req.body.name),
    code: normalize(req.body.code) || slugify(req.body.name).toUpperCase().slice(0, 8),
    city: normalize(req.body.city),
    address: normalize(req.body.address),
    phone: normalize(req.body.phone),
    email: normalize(req.body.email),
    status: normalize(req.body.status) || 'active',
    createdAt: now(),
    updatedAt: now()
  };
  db.branches.push(branch);
  writeDb(db);
  audit(req.user, 'create', 'branch', branch.name, hospitalId);
  res.status(201).json({ ok: true, branch });
});

app.put('/api/branches/:id', requireAuth, requireRole('hospital_admin', 'super_admin'), (req, res) => {
  const db = readDb();
  const branch = (db.branches || []).find(b => b.id === req.params.id);
  if(!branch) return res.status(404).json({ ok: false, error: 'Branch not found' });
  if(!userCanManageHospital(req, branch.hospitalId)) return res.status(403).json({ ok: false, error: 'Forbidden for this branch' });
  for(const field of ['name', 'code', 'city', 'address', 'phone', 'email', 'status']){
    if(req.body[field] !== undefined) branch[field] = normalize(req.body[field]);
  }
  branch.updatedAt = now();
  writeDb(db);
  audit(req.user, 'update', 'branch', branch.name, branch.hospitalId);
  res.json({ ok: true, branch });
});

app.delete('/api/branches/:id', requireAuth, requireRole('hospital_admin', 'super_admin'), (req, res) => {
  const db = readDb();
  const branch = (db.branches || []).find(b => b.id === req.params.id);
  if(!branch) return res.status(404).json({ ok: false, error: 'Branch not found' });
  if(branch.isDefault) return res.status(400).json({ ok: false, error: 'Default branch cannot be deleted' });
  if(!userCanManageHospital(req, branch.hospitalId)) return res.status(403).json({ ok: false, error: 'Forbidden for this branch' });
  db.branches = db.branches.filter(b => b.id !== branch.id);
  writeDb(db);
  audit(req.user, 'delete', 'branch', branch.name, branch.hospitalId);
  res.json({ ok: true });
});

app.get('/api/departments', requireAuth, (req, res) => {
  const db = readDb();
  const departments = scoped(db.departments || [], req, requestedHospitalId(req));
  res.json({ ok: true, departments, names: departments.map(d => d.name) });
});

app.get('/api/services', requireAuth, (req, res) => {
  const db = readDb();
  const departments = scoped(db.departments || [], req, requestedHospitalId(req));
  const legacyServices = scoped(db.services || [], req, requestedHospitalId(req));
  const merged = departments.map(d => ({
    id: d.id,
    hospitalId: d.hospitalId,
    branchId: d.branchId,
    name: d.name,
    type: d.type || 'Department',
    status: d.status || 'active',
    description: d.description || `${d.name} workspace.`
  }));
  for(const svc of legacyServices){
    if(!merged.find(x => x.name === svc.name)) merged.push(svc);
  }
  res.json({ ok: true, services: merged });
});

app.post('/api/departments', requireAuth, requireRole('hospital_admin', 'super_admin'), (req, res) => {
  const db = readDb();
  const hospitalId = requestedHospitalId(req) || req.user.hospitalId;
  if(!userCanManageHospital(req, hospitalId)) return res.status(403).json({ ok: false, error: 'Forbidden for this hospital' });
  if(!normalize(req.body.name)) return res.status(400).json({ ok: false, error: 'Department name is required' });
  const branchId = normalize(req.body.branchId) || (db.branches.find(b => b.hospitalId === hospitalId && b.isDefault) || {}).id;
  const department = {
    id: makeId('dept'),
    hospitalId,
    branchId,
    name: normalize(req.body.name),
    type: normalize(req.body.type) || 'Clinical',
    status: normalize(req.body.status) || 'active',
    description: normalize(req.body.description),
    userIds: Array.isArray(req.body.userIds) ? req.body.userIds : [],
    createdAt: now(),
    updatedAt: now()
  };
  db.departments.push(department);
  writeDb(db);
  audit(req.user, 'create', 'department', department.name, hospitalId);
  res.status(201).json({ ok: true, department });
});

app.put('/api/departments/:id', requireAuth, requireRole('hospital_admin', 'super_admin'), (req, res) => {
  const db = readDb();
  const department = (db.departments || []).find(d => d.id === req.params.id);
  if(!department) return res.status(404).json({ ok: false, error: 'Department not found' });
  if(!userCanManageHospital(req, department.hospitalId)) return res.status(403).json({ ok: false, error: 'Forbidden for this department' });
  for(const field of ['name', 'type', 'status', 'description', 'branchId']){
    if(req.body[field] !== undefined) department[field] = normalize(req.body[field]);
  }
  if(Array.isArray(req.body.userIds)){
    department.userIds = req.body.userIds;
    for(const user of db.users){
      if(user.hospitalId === department.hospitalId && department.userIds.includes(user.id)){
        user.department = department.name;
        user.departmentId = department.id;
      }
    }
  }
  department.updatedAt = now();
  writeDb(db);
  audit(req.user, 'update', 'department', department.name, department.hospitalId);
  res.json({ ok: true, department });
});

app.delete('/api/departments/:id', requireAuth, requireRole('hospital_admin', 'super_admin'), (req, res) => {
  const db = readDb();
  const department = (db.departments || []).find(d => d.id === req.params.id);
  if(!department) return res.status(404).json({ ok: false, error: 'Department not found' });
  if(!userCanManageHospital(req, department.hospitalId)) return res.status(403).json({ ok: false, error: 'Forbidden for this department' });
  db.departments = db.departments.filter(d => d.id !== department.id);
  writeDb(db);
  audit(req.user, 'delete', 'department', department.name, department.hospitalId);
  res.json({ ok: true });
});

app.get('/api/users', requireAuth, requireRole('hospital_admin', 'super_admin'), (req, res) => {
  const db = readDb();
  const users = scoped(db.users || [], req, requestedHospitalId(req)).map(u => publicUser(u, db));
  res.json({ ok: true, users });
});

app.post('/api/users', requireAuth, requireRole('hospital_admin', 'super_admin'), (req, res) => {
  const db = readDb();
  const hospitalId = requestedHospitalId(req) || req.user.hospitalId;
  if(!userCanManageHospital(req, hospitalId)) return res.status(403).json({ ok: false, error: 'Forbidden for this hospital' });
  const username = normalize(req.body.username).toLowerCase();
  const email = normalize(req.body.email).toLowerCase();
  const password = String(req.body.password || '');
  const role = normalizeRole(req.body.role);
  if(!normalize(req.body.fullName) || !username || !email || !password) return res.status(400).json({ ok: false, error: 'fullName, username, email, and password are required' });
  if(role === 'super_admin' && !isSuperAdmin(req.user)) return res.status(403).json({ ok: false, error: 'Only a platform admin can create super admins' });
  if(db.users.find(u => u.username === username)) return res.status(409).json({ ok: false, error: 'Username already exists' });
  if(db.users.find(u => normalize(u.email).toLowerCase() === email)) return res.status(409).json({ ok: false, error: 'Email already exists' });
  const dept = (db.departments || []).find(d => d.id === req.body.departmentId || (d.hospitalId === hospitalId && d.name === req.body.department));
  const branch = (db.branches || []).find(b => b.id === req.body.branchId && b.hospitalId === hospitalId) || db.branches.find(b => b.hospitalId === hospitalId && b.isDefault);
  const user = {
    id: makeId('u'),
    hospitalId: role === 'super_admin' ? null : hospitalId,
    branchId: role === 'super_admin' ? null : branch && branch.id,
    department: dept ? dept.name : normalize(req.body.department),
    departmentId: dept && dept.id,
    username,
    fullName: normalize(req.body.fullName),
    email,
    phone: normalize(req.body.phone),
    role,
    verified: true,
    passwordHash: hashPassword(password),
    createdAt: now()
  };
  db.users.push(user);
  if(dept){
    dept.userIds = Array.from(new Set([...(dept.userIds || []), user.id]));
  }
  writeDb(db);
  audit(req.user, 'create', 'user', user.username, hospitalId);
  res.status(201).json({ ok: true, user: publicUser(user, db) });
});

app.get('/api/patients', requireAuth, (req, res) => {
  const db = readDb();
  const { unit, q, status } = req.query;
  let patients = scoped(db.patients || [], req, requestedHospitalId(req));
  if(unit) patients = patients.filter(p => p.unit === unit);
  if(status) patients = patients.filter(p => p.status === status);
  if(q){
    const s = String(q).toLowerCase();
    patients = patients.filter(p => [p.name, p.mrn, p.bed, p.unit, p.tag, p.diagnosis].some(v => String(v || '').toLowerCase().includes(s)));
  }
  res.json({ ok: true, patients });
});

app.post('/api/patients', requireAuth, (req, res) => {
  const p = req.body || {};
  if(!p.name || !p.mrn || !p.unit || !p.bed) return res.status(400).json({ ok: false, error: 'Missing patient fields' });
  const db = readDb();
  const hospitalId = isSuperAdmin(req.user) ? normalize(p.hospitalId) || DEFAULT_HOSPITAL_ID : req.user.hospitalId;
  const branchId = normalize(p.branchId) || req.user.branchId || (db.branches.find(b => b.hospitalId === hospitalId && b.isDefault) || {}).id;
  const patient = {
    id: makeId('p'),
    hospitalId,
    branchId,
    mrn: normalize(p.mrn),
    name: normalize(p.name),
    unit: normalize(p.unit),
    bed: normalize(p.bed),
    room: normalize(p.room) || normalize(p.bed),
    age: normalize(p.age),
    sex: normalize(p.sex),
    tag: normalize(p.tag),
    notes: normalize(p.notes),
    diagnosis: normalize(p.diagnosis),
    allergies: normalize(p.allergies),
    bloodType: normalize(p.bloodType),
    attending: normalize(p.attending),
    primaryNurse: normalize(p.primaryNurse),
    status: normalize(p.status) || 'stable',
    admittedAt: normalize(p.admittedAt) || now(),
    deviceMap: p.deviceMap || {}
  };
  db.patients.unshift(patient);
  writeDb(db);
  audit(req.user, 'create', 'patient', patient.mrn, hospitalId);
  res.status(201).json({ ok: true, patient });
});

app.put('/api/patients/:id', requireAuth, (req, res) => {
  const db = readDb();
  const i = (db.patients || []).findIndex(p => p.id === req.params.id);
  if(i < 0) return res.status(404).json({ ok: false, error: 'Patient not found' });
  if(!isSuperAdmin(req.user) && db.patients[i].hospitalId !== req.user.hospitalId) return res.status(403).json({ ok: false, error: 'Forbidden for this patient' });
  db.patients[i] = { ...db.patients[i], ...req.body, id: req.params.id, hospitalId: db.patients[i].hospitalId };
  writeDb(db);
  audit(req.user, 'update', 'patient', db.patients[i].mrn, db.patients[i].hospitalId);
  res.json({ ok: true, patient: db.patients[i] });
});

app.delete('/api/patients/:id', requireAuth, (req, res) => {
  const db = readDb();
  const old = (db.patients || []).find(p => p.id === req.params.id);
  if(!old) return res.status(404).json({ ok: false, error: 'Patient not found' });
  if(!isSuperAdmin(req.user) && old.hospitalId !== req.user.hospitalId) return res.status(403).json({ ok: false, error: 'Forbidden for this patient' });
  db.patients = db.patients.filter(p => p.id !== req.params.id);
  writeDb(db);
  audit(req.user, 'delete', 'patient', old.mrn, old.hospitalId);
  res.json({ ok: true });
});

app.get('/api/patients/:id/detail', requireAuth, (req, res) => {
  const db = readDb();
  const patient = findScopedPatient(db, req, req.params.id);
  if(!patient) return res.status(404).json({ ok: false, error: 'Patient not found' });
  const devices = latestDeviceValues(db, patient.id, patient.hospitalId);
  res.json({ ok: true, detail: { patient, ...relatedRecords(db, patient), devices } });
});

app.post('/api/patients/:id/notes', requireAuth, (req, res) => {
  const db = readDb();
  const patient = findScopedPatient(db, req, req.params.id);
  if(!patient) return res.status(404).json({ ok: false, error: 'Patient not found' });
  db.notes = db.notes || [];
  const item = { id: makeId('n'), hospitalId: patient.hospitalId, branchId: patient.branchId, patientId: patient.id, ts: now(), author: req.user.fullName || req.user.username, text: normalize(req.body.text) };
  db.notes.unshift(item);
  writeDb(db);
  audit(req.user, 'create', 'note', patient.mrn, patient.hospitalId);
  res.status(201).json({ ok: true, note: item });
});

app.post('/api/patients/:id/orders', requireAuth, (req, res) => {
  const db = readDb();
  const patient = findScopedPatient(db, req, req.params.id);
  if(!patient) return res.status(404).json({ ok: false, error: 'Patient not found' });
  db.orders = db.orders || [];
  const item = { id: makeId('o'), hospitalId: patient.hospitalId, branchId: patient.branchId, patientId: patient.id, ts: now(), author: req.user.fullName || req.user.username, status: 'Active', text: normalize(req.body.text) };
  db.orders.unshift(item);
  writeDb(db);
  audit(req.user, 'create', 'order', patient.mrn, patient.hospitalId);
  res.status(201).json({ ok: true, order: item });
});

app.post('/api/patients/:id/alerts', requireAuth, (req, res) => {
  const db = readDb();
  const patient = findScopedPatient(db, req, req.params.id);
  if(!patient) return res.status(404).json({ ok: false, error: 'Patient not found' });
  db.alerts = db.alerts || [];
  const item = { id: makeId('a'), hospitalId: patient.hospitalId, branchId: patient.branchId, patientId: patient.id, ts: now(), severity: normalize(req.body.severity) || 'Medium', text: normalize(req.body.text) };
  db.alerts.unshift(item);
  writeDb(db);
  audit(req.user, 'create', 'alert', patient.mrn, patient.hospitalId);
  res.status(201).json({ ok: true, alert: item });
});

app.get('/api/vitals/:id', requireAuth, (req, res) => {
  const db = readDb();
  const patient = findScopedPatient(db, req, req.params.id) || scoped(db.patients || [], req)[0];
  if(!patient) return res.status(404).json({ ok: false, error: 'Patient not found' });
  let vitals = generateVitals(patient.id);
  const devices = latestDeviceValues(db, patient.id, patient.hospitalId);
  vitals = mergeLatestIntoVitals(vitals, devices.latest);
  res.json({ ok: true, patient, vitals, risk: calculateRisk(patient, vitals), devices });
});

app.get('/api/central', requireAuth, (req, res) => {
  const db = readDb();
  const unit = req.query.unit;
  let patients = scoped(db.patients || [], req, requestedHospitalId(req));
  if(unit) patients = patients.filter(p => p.unit === unit);
  const cards = patients.map(patient => {
    let vitals = generateVitals(patient.id);
    const devices = latestDeviceValues(db, patient.id, patient.hospitalId);
    vitals = mergeLatestIntoVitals(vitals, devices.latest);
    const risk = calculateRisk(patient, vitals);
    return { patient, risk, devices, alarmStatus: alarmStatus(patient, risk, devices) };
  });
  res.json({ ok: true, cards });
});

app.get('/api/ai/analyze/:id', requireAuth, async (req, res) => {
  const db = readDb();
  const patient = findScopedPatient(db, req, req.params.id);
  if(!patient) return res.status(404).json({ ok: false, error: 'Patient not found' });
  const vitals = generateVitals(patient.id);
  const result = process.env.AI_MODE === 'openai' ? await externalAiAnalysis(patient, vitals) : localAiAnalysis(patient, vitals);
  db.aiHistory = db.aiHistory || [];
  db.aiHistory.unshift({ id: makeId('ai'), hospitalId: patient.hospitalId, patientId: patient.id, ts: now(), user: req.user.username, result });
  db.aiHistory = db.aiHistory.slice(0, 100);
  writeDb(db);
  audit(req.user, 'ai_analyze', 'patient', patient.mrn, patient.hospitalId);
  res.json({ ok: true, analysis: result });
});

app.get('/api/ai/hospital', requireAuth, (req, res) => {
  const db = readDb();
  const ranked = scoped(db.patients || [], req, requestedHospitalId(req))
    .map(patient => ({ patient, risk: calculateRisk(patient, generateVitals(patient.id)) }))
    .sort((a, b) => b.risk.score - a.risk.score);
  res.json({ ok: true, ranked });
});

app.get('/api/devices', requireAuth, (req, res) => {
  const db = readDb();
  const patients = db.patients || [];
  const devices = scoped(db.devices || [], req, requestedHospitalId(req)).map(device => {
    const patient = patients.find(p => p.id === device.linkedPatientId);
    return { ...device, linkedPatientName: patient ? patient.name : '', bed: patient ? patient.bed : '' };
  });
  res.json({ ok: true, devices });
});

app.post('/api/devices', requireAuth, requireRole('hospital_admin', 'biomedical_engineer', 'super_admin'), (req, res) => {
  const db = readDb();
  const hospitalId = requestedHospitalId(req) || req.user.hospitalId;
  if(!userCanManageHospital(req, hospitalId) && normalizeRole(req.user.role) !== 'biomedical_engineer') return res.status(403).json({ ok: false, error: 'Forbidden for this hospital' });
  if(!normalize(req.body.deviceId) || !normalize(req.body.deviceType)) return res.status(400).json({ ok: false, error: 'deviceId and deviceType are required' });
  const patient = (db.patients || []).find(p => p.id === req.body.linkedPatientId && p.hospitalId === hospitalId);
  const device = {
    id: makeId('device'),
    hospitalId,
    branchId: normalize(req.body.branchId) || (patient && patient.branchId) || req.user.branchId,
    department: normalize(req.body.department) || (patient && patient.unit) || 'Biomedical',
    deviceType: normalize(req.body.deviceType),
    deviceId: normalize(req.body.deviceId),
    linkedPatientId: patient ? patient.id : normalize(req.body.linkedPatientId),
    status: normalize(req.body.status) || 'online',
    lastUpdate: now(),
    source: normalize(req.body.source) || 'manual',
    createdAt: now(),
    updatedAt: now()
  };
  db.devices.unshift(device);
  writeDb(db);
  audit(req.user, 'create', 'device', device.deviceId, hospitalId);
  res.status(201).json({ ok: true, device });
});

app.get('/api/device/examples', (req, res) => {
  res.json({
    ok: true,
    architecture: 'authorized medical devices or hospital gateways -> LifeView Central API -> tenant-scoped JSON prototype store -> dashboards/mobile -> AI-assisted review',
    requiredTenantContext: 'Send hospitalId in the JSON body or x-hospital-api-key in the request headers.',
    demoHeader: { 'x-hospital-api-key': DEFAULT_DEVICE_API_KEY },
    examples: DEVICE_EXAMPLES,
    disclaimer: 'Prototype examples only. Real integrations require hospital authorization, validation, cybersecurity review, and vendor-supported interfaces such as HL7/FHIR, DICOM, gateway APIs, or approved protocols.'
  });
});

app.get('/api/device/readings', requireAuth, (req, res) => {
  const db = readDb();
  const patientId = req.query.patientId;
  let readings = scoped(db.deviceReadings || [], req, requestedHospitalId(req));
  if(patientId) readings = readings.filter(r => r.patientId === patientId);
  res.json({ ok: true, readings: readings.slice(0, 100) });
});

app.post('/api/device/ingest', (req, res) => {
  const payload = req.body || {};
  if(!payload.patientId || !payload.deviceType || !payload.deviceId || !payload.values){
    return res.status(400).json({ ok: false, error: 'patientId, deviceType, deviceId, and values are required' });
  }
  const db = readDb();
  const bodyHospitalId = normalize(payload.hospitalId);
  const apiKey = normalize(req.headers['x-hospital-api-key'] || payload.hospitalDeviceApiKey || payload.apiKey);
  let hospital = null;
  if(apiKey){
    hospital = (db.hospitals || []).find(h => h.deviceApiKey === apiKey);
    if(!hospital) return res.status(401).json({ ok: false, error: 'Invalid hospital device API key' });
    if(bodyHospitalId && bodyHospitalId !== hospital.id) return res.status(403).json({ ok: false, error: 'hospitalId does not match API key' });
  } else if(bodyHospitalId){
    hospital = hospitalById(db, bodyHospitalId);
    if(!hospital) return res.status(404).json({ ok: false, error: 'Hospital not found' });
  } else {
    return res.status(400).json({ ok: false, error: 'hospitalId or x-hospital-api-key is required' });
  }
  if(hospital.status === 'suspended') return res.status(403).json({ ok: false, error: 'Hospital workspace is suspended' });

  const patient = (db.patients || []).find(p => (p.id === payload.patientId || p.mrn === payload.patientId) && p.hospitalId === hospital.id);
  if(!patient) return res.status(404).json({ ok: false, error: 'Patient not found for this hospital' });

  const reading = {
    id: makeId('dev'),
    hospitalId: hospital.id,
    branchId: patient.branchId,
    patientId: patient.id,
    department: patient.unit,
    deviceType: normalize(payload.deviceType),
    deviceId: normalize(payload.deviceId),
    timestamp: payload.timestamp || now(),
    values: payload.values,
    source: normalize(payload.source) || 'hospital-gateway',
    status: normalize(payload.status) || 'online'
  };
  db.deviceReadings = db.deviceReadings || [];
  db.deviceReadings.unshift(reading);
  db.deviceReadings = db.deviceReadings.slice(0, 1000);
  let device = (db.devices || []).find(d => d.hospitalId === hospital.id && d.deviceId === reading.deviceId);
  if(!device){
    device = {
      id: makeId('device'),
      hospitalId: hospital.id,
      branchId: patient.branchId,
      department: patient.unit,
      deviceType: reading.deviceType,
      deviceId: reading.deviceId,
      linkedPatientId: patient.id,
      source: reading.source,
      createdAt: now()
    };
    db.devices.unshift(device);
  }
  device.status = reading.status;
  device.department = patient.unit;
  device.linkedPatientId = patient.id;
  device.lastUpdate = reading.timestamp;
  device.updatedAt = now();
  writeDb(db);
  audit({ username: 'device-gateway', hospitalId: hospital.id }, 'device_ingest', 'patient', patient.mrn, hospital.id);
  res.json({ ok: true, reading });
});

app.get('/api/reports/summary', requireAuth, (req, res) => {
  const db = readDb();
  const patients = scoped(db.patients || [], req, requestedHospitalId(req));
  res.json({
    ok: true,
    summary: {
      total: patients.length,
      critical: patients.filter(p => p.status === 'critical').length,
      watch: patients.filter(p => p.status === 'watch').length,
      stable: patients.filter(p => p.status === 'stable').length,
      byUnit: patients.reduce((a, p) => { a[p.unit] = (a[p.unit] || 0) + 1; return a; }, {})
    }
  });
});

app.get('/api/audit', requireAuth, (req, res) => {
  const db = readDb();
  res.json({ ok: true, audit: scoped(db.audit || [], req, requestedHospitalId(req)) });
});

app.post('/api/patient/login', (req, res) => {
  const mrn = normalize(req.body.mrn).toUpperCase();
  const accessCode = String(req.body.accessCode || '');
  const hospitalId = normalize(req.body.hospitalId);
  const db = readDb();
  const patient = (db.patients || []).find(p => String(p.mrn || '').toUpperCase() === mrn && (!hospitalId || p.hospitalId === hospitalId));
  if(!patient) return res.status(401).json({ ok: false, error: 'Invalid patient credentials' });
  const account = (db.patientAccess || []).find(a => a.patientId === patient.id && a.hospitalId === patient.hospitalId);
  if(!account || !verifyPassword(accessCode, account.codeHash)) return res.status(401).json({ ok: false, error: 'Invalid patient credentials' });
  account.sessionToken = token();
  account.sessionExp = Date.now() + 4 * 60 * 60 * 1000;
  account.lastLogin = now();
  writeDb(db);
  audit({ username: `patient:${patient.mrn}`, hospitalId: patient.hospitalId }, 'patient_login', 'patient', patient.mrn, patient.hospitalId);
  res.json({ ok: true, token: account.sessionToken, patient: publicPatientAccount(account, patient) });
});

app.post('/api/patient/logout', requirePatientAuth, (req, res) => {
  const db = readDb();
  const account = (db.patientAccess || []).find(a => a.id === req.patientAccount.id);
  if(account){
    delete account.sessionToken;
    delete account.sessionExp;
    writeDb(db);
  }
  res.json({ ok: true });
});

app.get('/api/patient/me', requirePatientAuth, (req, res) => {
  res.json({ ok: true, patient: publicPatientAccount(req.patientAccount, req.patient) });
});

app.get('/api/patient/detail', requirePatientAuth, (req, res) => {
  const db = readDb();
  const patient = req.patient;
  const related = relatedRecords(db, patient);
  const vitals = generateVitals(patient.id);
  const safePatient = {
    mrn: patient.mrn,
    name: patient.name,
    hospitalId: patient.hospitalId,
    unit: patient.unit,
    room: patient.room,
    bed: patient.bed,
    age: patient.age,
    sex: patient.sex,
    bloodType: patient.bloodType,
    allergies: patient.allergies,
    diagnosis: patient.diagnosis,
    status: patient.status,
    admittedAt: patient.admittedAt,
    attending: patient.attending,
    primaryNurse: patient.primaryNurse,
    notes: patient.notes
  };
  res.json({ ok: true, detail: { patient: safePatient, ...related, vitals, risk: calculateRisk(patient, vitals) } });
});

app.listen(PORT, () => console.log(`LifeView Central SaaS prototype running at http://localhost:${PORT}`));
