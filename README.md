# LifeView Central

Hospital-wide patient monitoring platform with real-time device data, dashboards, alerts, AI analysis, and mobile/PWA support.

LifeView Central is a hospital-wide patient monitoring and clinical intelligence MVP. It demonstrates how automated medical machines can send real-time data through an authorized device gateway/API into a backend, prototype database, web/mobile dashboards, alerts, reports, and careful AI-assisted review.

> **Prototype and safety disclaimer:** This project is for portfolio, demo, and accelerator application use only. Do not use real patient data in public demos. Do not use this system for diagnosis, treatment, emergency response, or live clinical decisions without hospital authorization, validated device integrations, cybersecurity review, clinical governance, and regulatory/data-protection compliance.

## Problem

Hospitals often have patient information spread across bedside devices, ward notes, lab systems, imaging systems, and manual reporting workflows. LifeView Central shows a unified command center for doctors, nurses, biomedical engineers, and administrators so teams can see patient status faster and coordinate safer care.

## Key Features

- Staff authentication with email OTP development mode.
- Role concept for doctor, nurse, biomedical engineer, and admin users.
- Department hub: ICU, Emergency, Surgery, Radiology, Maternity, Pediatrics, Laboratory, Pharmacy, Biomedical, and Administration.
- Patient list with add, edit, delete, search, filter, and monitoring links.
- Patient detail page with admission data, diagnosis, allergies, attending doctor, nurse, room/bed, blood type, notes, orders, labs, imaging, alerts, and connected devices.
- Simulated vitals: HR, SpO₂, BP, RR, temperature, ventilator values, and EtCO₂.
- Central monitoring/risk queue with severity-aware alert styling.
- Reports, audit logs, and AI decision-support history.
- Mobile/PWA companion page and patient portal demo.
- Device ingestion API and example JSON payloads for bedside monitors, ventilators, infusion pumps, lab analyzers, and imaging systems.

## Tech Stack

Node.js, Express.js, HTML, CSS, vanilla JavaScript, JSON prototype storage, Nodemailer, Helmet, CORS, Morgan, dotenv, PWA manifest/service worker.

## Architecture

```text
Medical devices / automated machines
  -> authorized device adapter or hospital gateway API
  -> LifeView Central Express backend
  -> prototype JSON database (replace with production DB later)
  -> staff dashboards + mobile/PWA + patient portal
  -> alerts, reports, audit logs, and AI-assisted review
```

Real integrations must use hospital-approved, vendor-supported interfaces such as HL7/FHIR, DICOM/PACS, gateway APIs, or approved protocols. Biomedical engineering, IT security, clinical leadership, and device vendors must validate any production connection.

## Installation

## Installation
```bash
git clone https://github.com/YOUR_USERNAME/lifeview-central.git
cd lifeview-central
npm install
cp .env.example .env
npm start
```
Open `http://localhost:8080`.

## Demo login
- Staff username: `dr.alvarez`
- Password: `Password!123`
- Patient portal MRN: `MRN-001`
- Patient access code: `PATIENT123`

## Environment variables
See `.env.example`.
- `EMAIL_DEV_MODE=true` keeps email verification local for demos.
- `AI_MODE=local` works without external APIs.
- `AI_MODE=openai` uses `OPENAI_API_KEY` if provided.
- `DEVICE_INGEST_API_KEY` protects the device-ingestion demo endpoint when set to a non-default value.

## Deployment notes (Render or similar)
1. Create a Node.js web service.
2. Set build command: `npm install`.
3. Set start command: `npm start`.
4. Add environment variables from `.env.example` in the host dashboard.
5. Keep `.env` private and never commit secrets.

## Screenshots
Add screenshots here before public launch:
- Landing/login page
- Hospital dashboard
- Patient detail monitoring page
- Reports / AI risk queue
- Mobile/PWA view

## Security and privacy notes
- This is a prototype MVP, not a regulated clinical system.
- Use synthetic, de-identified sample records for portfolio and presentation environments.
- Real deployments require authentication hardening, encryption, database access controls, audit retention, clinical validation, vendor approvals, and compliance review.
- Device integrations require secure gateways and approved hospital/vendor interfaces.

## Roadmap
- Production database and migrations
- Role-based permissions for doctor, nurse, biomedical engineer, and admin workflows
- FHIR/HL7 integration layer
- Device adapter SDK and queue-based ingestion
- More advanced trend analytics and explainable alert thresholds
- Offline-first PWA support
- Deployment hardening and observability

## GitHub repository setup
Suggested repository description:
> Hospital-wide patient monitoring platform with real-time device data, dashboards, alerts, AI analysis, and mobile/PWA support.

Recommended topics: `healthcare`, `healthtech`, `patient-monitoring`, `hospital-management`, `medical-dashboard`, `ai-healthcare`, `iot`, `nodejs`, `express`, `pwa`.

Rename repository to `lifeview-central`:
```bash
# Option A: GitHub CLI
gh repo rename lifeview-central

Open `http://localhost:8080`.

## Demo Login

Staff portal:

```text
Username: dr.alvarez
Password: Password!123
```

Patient portal:

```text
MRN: MRN-001
Access Code: PATIENT123
```

Remove or rotate demo credentials before private testing with any sensitive data.

## Environment Variables

See `.env.example`.

SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_gmail_app_password
MAIL_FROM="LifeView Central <your_email@gmail.com>"

AI_MODE=mock
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4.1-mini
```

Do not upload real SMTP passwords, OpenAI keys, session secrets, or private `.env` files to GitHub.

## Email Verification

For local development:

```env
EMAIL_DEV_MODE=true
```

When development mode is enabled, OTP codes are printed in the terminal for testing.

For real email verification:

```env
EMAIL_DEV_MODE=false
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_gmail_app_password
MAIL_FROM="LifeView Central <your_email@gmail.com>"
```

## AI Analysis
- `EMAIL_DEV_MODE=true` prints OTP codes for local testing.
- `AI_MODE=mock` works without external services.
- `AI_MODE=openai` only uses OpenAI when `OPENAI_API_KEY` is configured.

## Device Ingestion Demo

Get example payloads:

```bash
curl http://localhost:8080/api/device/examples
```

Post demo data:

```bash
curl -X POST http://localhost:8080/api/device/ingest \
  -H "Content-Type: application/json" \
  -d '{"patientId":"p1","deviceType":"bedside_monitor","deviceId":"MON-ICU-01","values":{"HR":118,"SPO2":91,"BP_SYS":96,"BP_DIA":60,"RR":26,"TEMP":38.4,"ETCO2":35}}'
```

## Deployment Notes (Render or similar)

1. Create a Web Service from the GitHub repository.
2. Build command: `npm install`.
3. Start command: `npm start`.
4. Add environment variables from `.env.example` in the hosting dashboard.
5. Do not upload `.env`, real SMTP passwords, OpenAI keys, or real patient data.
6. Replace JSON storage with a production database before serious pilots.

## Screenshots

Add presentation screenshots here after deployment:

- Landing/login page
- Hospital dashboard
- Patient roster
- Patient monitoring page
- Reports and AI risk queue
- Mobile/PWA view

## Roadmap

- Production database and migrations.
- Stronger RBAC and audit export.
- HL7/FHIR/DICOM integration adapters.
- Device gateway authentication and queueing.
- Alert escalation workflows.
- Clinician-reviewed AI prompt and validation process.
- Offline-capable PWA improvements.

## GitHub Presentation

Suggested repository description:

> Hospital-wide patient monitoring platform with real-time device data, dashboards, alerts, AI analysis, and mobile/PWA support.

Recommended topics: `healthcare`, `healthtech`, `patient-monitoring`, `hospital-management`, `medical-dashboard`, `ai-healthcare`, `iot`, `nodejs`, `express`, `pwa`.

## Rename Repository

If using GitHub CLI:

```bash
gh repo rename lifeview-central --yes
git remote -v
git remote set-url origin https://github.com/YOUR_USERNAME/lifeview-central.git
git remote -v
```

Or use GitHub: repository **Settings → General → Repository name → lifeview-central**.

## License

MIT. See `LICENSE`.

## Contact

Project owner:

```text
FONO PEVETMI JORDAN LOIC
```

Email:

```text
jordanfonoscholar237@gmail.com
```


## Repository Rename

Recommended GitHub repository name: `lifeview-central`.

Using GitHub CLI:

```bash
gh repo rename lifeview-central --yes
git remote set-url origin https://github.com/YOUR_USERNAME/lifeview-central.git
git remote -v
```
Add your GitHub profile, email, or portfolio link here before publishing.
