function pToken(){ return localStorage.getItem('lifeview_patient_token') || ''; }
function setPToken(v){ localStorage.setItem('lifeview_patient_token', v); }
function clearPToken(){ ['lifeview_patient_token','lifeview_patient_user'].forEach(k=>localStorage.removeItem(k)); }
async function pApi(path, opts={}){
  const headers = opts.headers || {};
  headers['Content-Type'] = 'application/json';
  if(pToken()) headers['Authorization'] = 'Bearer ' + pToken();
  const res = await fetch(path, {...opts, headers});
  const data = await res.json().catch(()=>({ok:false,error:'Invalid response'}));
  if(!res.ok) throw data;
  return data;
}
function safe(v){ return v && String(v).trim() ? String(v) : 'Not provided'; }
function formatDate(v){ if(!v) return 'Not provided'; try { return new Date(v).toLocaleString(); } catch(e){ return v; } }
function timeline(items, empty){
  if(!items || !items.length) return `<div class="empty">${empty}</div>`;
  return items.map(item=>`<div class="timeline-item"><b>${formatDate(item.ts || item.createdAt || item.date)}</b><p>${safe(item.text || item.result || item.summary || item.name || item.type)}</p>${item.status?`<span class="badge">${item.status}</span>`:''}</div>`).join('');
}
function infoItem(label, value){ return `<div class="info-item"><b>${label}</b>${safe(value)}</div>`; }

const loginButton = document.getElementById('patientLoginBtn');
if(loginButton){
  loginButton.onclick = async () => {
    const msg = document.getElementById('patientLoginMsg');
    msg.textContent = '';
    try{
      const r = await pApi('/api/patient/login', {
        method: 'POST',
        body: JSON.stringify({ mrn: patientMrn.value, accessCode: patientAccessCode.value })
      });
      setPToken(r.token);
      localStorage.setItem('lifeview_patient_user', JSON.stringify(r.patient));
      location.href = 'patient-portal.html';
    }catch(e){
      msg.textContent = e.error || 'Could not login. Check your MRN and access code.';
    }
  };
}

async function patientLogout(){
  try{ await pApi('/api/patient/logout', {method:'POST', body:'{}'}); }catch(e){}
  clearPToken();
  location.href = 'patient-login.html';
}

async function loadPatientPortal(){
  if(!pToken()){ location.href = 'patient-login.html'; return; }
  try{
    const r = await pApi('/api/patient/detail');
    const d = r.detail;
    const p = d.patient;
    portalPatientName.textContent = p.name;
    portalPatientMeta.textContent = `${p.mrn} - ${p.unit} - ${p.room || p.bed}`;
    portalPatientStatus.textContent = (p.status || 'stable').toUpperCase();
    portalPatientStatus.className = `patient-status ${p.status || 'stable'}`;

    careTeam.innerHTML = [
      infoItem('Attending Doctor', p.attending),
      infoItem('Primary Nurse', p.primaryNurse),
      infoItem('Department', p.unit),
      infoItem('Room / Bed', `${safe(p.room)} / ${safe(p.bed)}`)
    ].join('');

    medicalSummary.innerHTML = [
      infoItem('Diagnosis / Reason for Care', p.diagnosis),
      infoItem('Allergies', p.allergies),
      infoItem('Blood Type', p.bloodType),
      infoItem('Admitted', formatDate(p.admittedAt)),
      infoItem('Notes', p.notes)
    ].join('');

    if(typeof drawChart === 'function'){
      drawChart(document.getElementById('pHR'), d.vitals.HR, 'Heart Rate');
      drawChart(document.getElementById('pSPO2'), d.vitals.SPO2, 'Oxygen Saturation');
      drawChart(document.getElementById('pBP'), d.vitals.BP_SYS, 'Blood Pressure Systolic');
    }

    patientOrders.innerHTML = timeline(d.orders, 'No current orders are shared.');
    patientLabs.innerHTML = timeline(d.labs, 'No lab results are shared.');
    patientImaging.innerHTML = timeline(d.imaging, 'No imaging updates are shared.');
    patientNotes.innerHTML = timeline(d.notes, 'No clinical notes are shared.');
  }catch(e){
    clearPToken();
    location.href = 'patient-login.html';
  }
}
