# LifeView Central

LifeView Central is a multi-hospital SaaS prototype for hospital-wide patient monitoring. It demonstrates tenant workspaces, hospital registration, role-based dashboards, patient monitoring, alerts, reports, mobile/PWA access, a patient portal, AI-assisted review, and protected demo device ingestion.

> Prototype disclaimer: this project is for demo and portfolio use only. Do not use it for diagnosis, treatment, emergency response, live device connectivity, or real patient data without hospital authorization, clinical governance, cybersecurity review, production infrastructure, and regulatory compliance.

## Multi-Hospital SaaS Model

- Each hospital has its own `hospitalId`.
- Hospital-owned records are scoped by `hospitalId`: users, patients, branches, departments, devices, device readings, alerts, notes, orders, labs, imaging, audit logs, and AI history.
- Hospital users only see records belonging to their hospital.
- Super admins can view and manage all hospital workspaces.
- JSON storage is used for the prototype so the app remains easy to run with `npm install` and `npm start`.

## Hospital Registration

Hospitals can register from `public/register-hospital.html` or the landing page. Registration creates:

- a hospital record
- a default branch
- a default hospital admin user
- default departments: ICU, Emergency, Surgery, Radiology, Maternity, Pediatrics, Laboratory, Pharmacy, Biomedical, Administration

New hospitals start as `pending` and can be approved or suspended from the Super Admin Dashboard.

## Roles

Supported roles:

- `super_admin`
- `hospital_admin`
- `doctor`
- `nurse`
- `biomedical_engineer`
- `lab_staff`
- `radiology_staff`
- `pharmacy_staff`
- `patient`

After login, LifeView Central routes users to the correct workspace: platform admin, hospital admin, clinical dashboard, device gateway, or patient portal.

## Key Features

- Public landing page with hospital login, registration, patient portal, and mobile/PWA entry points.
- Super Admin Dashboard for hospital approvals, suspensions, and platform statistics.
- Hospital Admin Dashboard for profile, branches, services, staff, devices, and reports.
- Role-based sidebar navigation.
- Central monitoring wall with dark navy live bed cards and severity colors.
- Patient detail screen with vitals, connected devices, notes, orders, labs, imaging, alerts, and demo AI analysis.
- Device gateway dashboard for biomedical workflows.
- Patient portal and mobile/PWA companion view.
- Protected device ingestion that requires `hospitalId` or `x-hospital-api-key`.

## Tech Stack

Node.js, Express.js, HTML, CSS, vanilla JavaScript, JSON prototype storage, Nodemailer, Helmet, CORS, Morgan, dotenv, PWA manifest/service worker, and a Sites-compatible Vinext shell for deployment.

## Installation

```bash
git clone https://github.com/Jordanfonoscholar237/hgy-careboard.git
cd hgy-careboard
npm install
cp .env.example .env
npm start
```

Open `http://localhost:8080`.

## Demo Credentials

Super admin:

```text
Username: super.admin
Password: Password!123
```

Hospital admin:

```text
Username: hospital.admin
Password: Password!123
```

Doctor:

```text
Username: dr.alvarez
Password: Password!123
```

Patient portal:

```text
MRN: MRN-001
Access Code: PATIENT123
```

## Device Ingestion

Get examples:

```bash
curl http://localhost:8080/api/device/examples
```

Send a tenant-scoped reading with a hospital API key:

```bash
curl -X POST http://localhost:8080/api/device/ingest \
  -H "Content-Type: application/json" \
  -H "x-hospital-api-key: yg-demo-device-key" \
  -d '{"patientId":"p1","deviceType":"bedside_monitor","deviceId":"MON-ICU-01","values":{"HR":118,"SPO2":91,"BP_SYS":96,"BP_DIA":60,"RR":26,"TEMP":38.4,"ETCO2":35}}'
```

For production, replace demo API-key handling with signed gateway requests, replay protection, key rotation, device/vendor certification, audited integrations, encryption, and hospital-approved interfaces.

## Security Notes

- Do not use real patient data.
- Password hashing is included for the prototype, but production needs hardened auth, MFA, rate limiting, session rotation, RBAC review, secrets management, and audit retention policies.
- Device ingestion must be authorized and validated by hospital IT, biomedical engineering, clinical leadership, and device vendors.
- The AI feature is demo decision-support only and must not be used for clinical diagnosis or treatment.

## Production Database Requirement

The JSON file in `data/db.json` is only for the prototype. Before pilots or production, move tenant data to PostgreSQL or another production database with migrations, indexing, backups, access controls, encryption at rest, tenant isolation tests, and disaster recovery.

## Environment Variables

See `.env.example`.

- `EMAIL_DEV_MODE=true` prints OTP codes locally.
- `AI_MODE=mock` or `AI_MODE=local` works without external services.
- `AI_MODE=openai` uses `OPENAI_API_KEY` if configured.

## License

MIT. See `LICENSE`.

## Contact

FONO PEVETMI JORDAN LOIC

jordanfonoscholar237@gmail.com
