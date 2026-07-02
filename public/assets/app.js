const TX = {
  en: {
    signin: 'Sign in',
    signup: 'Create account',
    verify: 'Verify account',
    username: 'Username',
    password: 'Password',
    email: 'Email',
    fullName: 'Full name',
    department: 'Department',
    confirm: 'Confirm password',
    login: 'Login',
    logout: 'Logout',
    hub: 'Workspace',
    departments: 'Services',
    patients: 'Patients',
    monitoring: 'Monitoring Wall',
    ai: 'AI Analysis',
    reports: 'Reports',
    settings: 'Settings',
    audit: 'Audit',
    add: '+ Add patient',
    search: 'Search patients by name, MRN, diagnosis, bed...',
    all: 'All departments',
    name: 'Name',
    mrn: 'MRN',
    unit: 'Department',
    bed: 'Bed',
    age: 'Age',
    sex: 'Sex',
    tag: 'Tag',
    notes: 'Notes',
    save: 'Save',
    edit: 'Edit',
    delete: 'Delete',
    open: 'Open',
    status: 'Status',
    critical: 'Critical',
    high: 'High risk',
    warning: 'Warning',
    watch: 'Watch',
    stable: 'Stable',
    disconnected: 'Disconnected',
    verification: 'Verification code',
    resend: 'Resend code',
    submit: 'Submit',
    codeSent: 'Code sent to your email.',
    devCode: 'Development code',
    bad: 'Error',
    missing: 'Missing required fields',
    runAi: 'Run AI analysis',
    diagnosis: 'Diagnosis',
    allergies: 'Allergies'
  },
  fr: {
    signin: 'Se connecter',
    signup: 'Creer un compte',
    verify: 'Verifier le compte',
    username: 'Nom utilisateur',
    password: 'Mot de passe',
    email: 'E-mail',
    fullName: 'Nom complet',
    department: 'Service',
    confirm: 'Confirmer le mot de passe',
    login: 'Connexion',
    logout: 'Deconnexion',
    hub: 'Espace',
    departments: 'Services',
    patients: 'Patients',
    monitoring: 'Mur de surveillance',
    ai: 'Analyse IA',
    reports: 'Rapports',
    settings: 'Parametres',
    audit: 'Audit',
    add: '+ Ajouter un patient',
    search: 'Rechercher patients...',
    all: 'Tous les services',
    name: 'Nom',
    mrn: 'MRN',
    unit: 'Service',
    bed: 'Lit',
    age: 'Age',
    sex: 'Sexe',
    tag: 'Tag',
    notes: 'Notes',
    save: 'Enregistrer',
    edit: 'Modifier',
    delete: 'Supprimer',
    open: 'Ouvrir',
    status: 'Statut',
    critical: 'Critique',
    high: 'Haut risque',
    warning: 'Alerte',
    watch: 'Surveillance',
    stable: 'Stable',
    disconnected: 'Deconnecte',
    verification: 'Code de verification',
    resend: 'Renvoyer le code',
    submit: 'Valider',
    codeSent: 'Code envoye a votre e-mail.',
    devCode: 'Code developpement',
    bad: 'Erreur',
    missing: 'Champs obligatoires manquants',
    runAi: 'Lancer analyse IA',
    diagnosis: 'Diagnostic',
    allergies: 'Allergies'
  }
};

function lang(){ return localStorage.getItem('lifeview_lang') || 'en'; }
function setLang(v){ localStorage.setItem('lifeview_lang', v); }
function t(k){ return (TX[lang()] && TX[lang()][k]) || k; }
function token(){ return localStorage.getItem('lifeview_token') || ''; }
function setToken(v){ localStorage.setItem('lifeview_token', v); }
function setCurrentUser(user){ localStorage.setItem('lifeview_user', JSON.stringify(user || {})); }
function currentUser(){
  try { return JSON.parse(localStorage.getItem('lifeview_user') || '{}'); }
  catch(e){ return {}; }
}
function clearToken(){ ['lifeview_token', 'lifeview_user'].forEach(k => localStorage.removeItem(k)); }

function escapeHtml(value){
  return String(value == null ? '' : value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
}

async function api(path, opts = {}){
  const headers = opts.headers || {};
  headers['Content-Type'] = 'application/json';
  if(token()) headers.Authorization = 'Bearer ' + token();
  const res = await fetch(path, { ...opts, headers });
  const data = await res.json().catch(() => ({ ok: false, error: 'Invalid response' }));
  if(!res.ok) throw data;
  return data;
}

function initials(n){
  return (n || '?').split(' ').map(x => x[0]).join('').slice(0, 2).toUpperCase();
}

function roleLabel(role){
  return String(role || 'doctor').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function hospitalName(){
  const u = currentUser();
  return u.hospitalName || 'Hospital Workspace';
}

function roleHome(role){
  const r = String(role || '').toLowerCase();
  if(r === 'super_admin') return 'platform-admin.html';
  if(r === 'hospital_admin') return 'hospital-admin.html';
  if(r === 'biomedical_engineer') return 'device-dashboard.html';
  if(r === 'patient') return 'patient-portal.html';
  return 'hub.html';
}

function statusBadge(s){
  const k = String(s || 'stable').toLowerCase();
  return `<span class="badge ${escapeHtml(k)}">${escapeHtml(t(k) || k)}</span>`;
}

function severityBadge(s){
  const k = String(s || 'low').toLowerCase();
  return `<span class="badge severity-${escapeHtml(k)}">${escapeHtml(t(k) || s)}</span>`;
}

function attachLang(){
  const l = document.getElementById('lang');
  if(l){
    l.value = lang();
    l.onchange = () => { setLang(l.value); location.reload(); };
  }
}

async function ensureAuth(){
  if(!token()) location.href = 'index.html';
}

async function logout(){
  try { await api('/api/logout', { method: 'POST', body: '{}' }); } catch(e){}
  clearToken();
  location.href = 'index.html';
}

function drawChart(canvas, data, label){
  if(!canvas || !data || !data.length) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width = canvas.clientWidth;
  const H = canvas.height = canvas.clientHeight;
  ctx.clearRect(0, 0, W, H);
  const grad = ctx.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, '#061a2d');
  grad.addColorStop(1, '#0b2637');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = 'rgba(255,255,255,.10)';
  for(let y = 22; y < H; y += 34){
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }
  const vals = data.map(x => Number(x.v));
  let min = Math.min(...vals);
  let max = Math.max(...vals);
  if(max - min < 1) max = min + 1;
  ctx.strokeStyle = '#2dd4bf';
  ctx.lineWidth = 3;
  ctx.beginPath();
  data.forEach((p, i) => {
    const x = data.length === 1 ? 0 : i / (data.length - 1) * W;
    const y = H - ((Number(p.v) - min) / (max - min)) * H;
    if(i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
  ctx.fillStyle = '#e6f7fb';
  ctx.font = '700 14px Inter, Arial';
  ctx.fillText(label, 12, 22);
  ctx.fillStyle = '#7dd3fc';
  ctx.font = '800 24px Inter, Arial';
  ctx.fillText(String(vals[vals.length - 1]), 12, 52);
}

function enableExpand(){
  let bd = document.getElementById('backdrop');
  if(!bd){
    bd = document.createElement('div');
    bd.id = 'backdrop';
    bd.className = 'backdrop';
    document.body.appendChild(bd);
  }
  document.querySelectorAll('.canvas').forEach(c => {
    c.onclick = () => {
      c.classList.toggle('full');
      bd.classList.toggle('show');
    };
  });
  bd.onclick = () => {
    document.querySelectorAll('.full').forEach(x => x.classList.remove('full'));
    bd.classList.remove('show');
  };
}

function brandLockup(size = ''){
  const u = currentUser();
  const cls = size === 'sm' ? 'brand-mark sm' : 'brand-mark';
  const home = roleHome(u.role);
  const sub = u.hospitalName || 'Multi-hospital SaaS platform';
  return `<a class="brand-lockup" href="${home}" aria-label="LifeView Central home"><span class="${cls}" aria-hidden="true"><span></span></span><span><strong>LifeView Central</strong><small>${escapeHtml(sub)}</small></span></a>`;
}

function navForRole(role){
  const r = String(role || '').toLowerCase();
  if(r === 'super_admin'){
    return [
      ['platform', 'Platform Admin', 'platform-admin.html'],
      ['hospitals', 'Hospitals', 'platform-admin.html#hospitals'],
      ['approvals', 'Approvals', 'platform-admin.html#approvals'],
      ['stats', 'Platform Stats', 'platform-admin.html#stats'],
      ['subscriptions', 'Subscriptions', 'platform-admin.html#subscriptions']
    ];
  }
  if(r === 'hospital_admin'){
    return [
      ['hospital-admin', 'Hospital Admin', 'hospital-admin.html'],
      ['profile', 'Hospital Profile', 'hospital-admin.html#profile'],
      ['branches', 'Branches', 'hospital-admin.html#branches'],
      ['services', 'Services', 'hospital-admin.html#services'],
      ['staff', 'Staff', 'hospital-admin.html#staff'],
      ['devices', 'Devices', 'hospital-admin.html#devices'],
      ['reports', 'Reports', 'reports.html']
    ];
  }
  if(r === 'biomedical_engineer'){
    return [
      ['devices', 'Devices', 'device-dashboard.html'],
      ['gateway', 'Gateway', 'device-dashboard.html#gateway'],
      ['connectivity', 'Connectivity', 'device-dashboard.html#connectivity'],
      ['maintenance', 'Maintenance', 'device-dashboard.html#maintenance'],
      ['patients', t('patients'), 'roster.html']
    ];
  }
  if(['lab_staff', 'radiology_staff', 'pharmacy_staff'].includes(r)){
    return [
      ['hub', t('hub'), 'hub.html'],
      ['patients', t('patients'), 'roster.html'],
      ['reports', t('reports'), 'reports.html']
    ];
  }
  return [
    ['hub', t('hub'), 'hub.html'],
    ['patients', t('patients'), 'roster.html'],
    ['monitoring', t('monitoring'), 'monitoring-wall.html'],
    ['reports', `${t('reports')} / ${t('ai')}`, 'reports.html'],
    ['mobile', 'Mobile / PWA', 'mobile.html']
  ];
}

function side(active = ''){
  const u = currentUser();
  const links = navForRole(u.role).map(([key, label, href]) => `<a class="${active === key ? 'active' : ''}" href="${href}">${escapeHtml(label)}</a>`).join('');
  return `<aside class="side">${brandLockup()}<div class="side-meta"><span>${escapeHtml(roleLabel(u.role))}</span><b>${escapeHtml(u.fullName || u.username || 'User')}</b></div><nav class="nav">${links}</nav><button class="btn secondary" onclick="logout()">${t('logout')}</button></aside>`;
}

function workspaceTop(title, options = {}){
  const u = currentUser();
  const hospital = escapeHtml(u.hospitalName || 'LifeView Central Platform');
  const role = escapeHtml(roleLabel(u.role));
  const branch = escapeHtml(u.branchName || 'Main workspace');
  const subtitle = options.subtitle ? `<p class="small">${escapeHtml(options.subtitle)}</p>` : '';
  return `<div class="workspace-top">
    <div>
      <p class="eyebrow">${escapeHtml(title || 'LifeView Central')}</p>
      <h1>LifeView Central &mdash; ${hospital} Workspace</h1>
      ${subtitle}
    </div>
    <div class="workspace-actions">
      <span class="pill">${branch}</span>
      <span class="pill">${role}</span>
      <span class="pill">3 notifications</span>
      <select id="lang" class="input lang-select"><option value="en">EN</option><option value="fr">FR</option></select>
      <button class="btn secondary" onclick="logout()">${t('logout')}</button>
    </div>
  </div>`;
}

function mountWorkspaceTop(target, title, options){
  const node = typeof target === 'string' ? document.querySelector(target) : target;
  if(node){
    node.innerHTML = workspaceTop(title, options);
    attachLang();
  }
}
