# LifeView Central

Hospital-wide patient monitoring platform with real-time device data, dashboards, alerts, AI analysis, and mobile/PWA support.

> Prototype build for product demonstration. Clinical review and local regulatory validation are required before any real-world deployment.

## Problem solved
Hospitals often have patient information, bedside monitor values, laboratory updates, imaging status, and clinical handover notes scattered across rooms, paper, and separate systems. LifeView Central demonstrates one unified command center where clinicians can see patient status faster and coordinate safer care.

## Key features
- Professional landing/login page focused on one command center for monitoring, alerts, and clinical coordination.
- Department hub: ICU, Emergency, Surgery, Radiology, Maternity, Pediatrics, Laboratory, Pharmacy, Biomedical, Administration.
- Patient roster with add, edit, delete, search, filter, status badges, and empty states.
- Patient details: admission, diagnosis, allergies, doctor, nurse, room/bed, blood type, notes, orders, labs, imaging, alerts.
- Simulated real-time vitals: HR, SpO₂, BP, RR, temperature, ventilator values, EtCO₂.
- Central monitoring wall and reports with alarm/risk colors.
- Alerts with low, medium, high, critical severity labels.
- AI-style clinical support demo with abnormal value summary, risk score, careful recommendations, and audit logging.
- Mobile/PWA companion and patient portal demo.
- Device ingestion API for future authorized gateway integrations.

## Tech stack
- Node.js + Express
- JSON demo database in `data/db.json`
- Vanilla HTML/CSS/JavaScript frontend
- PWA manifest and service worker
- Optional SMTP email verification
- Optional OpenAI API mode via `.env`

## Architecture
```text
Medical devices / automated machines
  -> authorized device adapter or gateway API
  -> LifeView Central backend (/api/device/ingest)
  -> demo JSON database / future production database
  -> web dashboard + mobile/PWA views
  -> alerts, audit logs, and decision-support analysis
```

Real hospital device integration must be authorized, secure, validated, and done through vendor-supported interfaces, HL7/FHIR, gateway APIs, or approved protocols.

## Device integration demo
Endpoint:
```bash
POST /api/device/ingest
Content-Type: application/json
x-device-api-key: your-demo-key
```

Example bedside monitor payload:
```json
{
  "patientId": "p1",
  "deviceType": "bedside-monitor",
  "deviceId": "MON-ICU-01",
  "values": { "HR": 118, "SPO2": 91, "BP_SYS": 88, "BP_DIA": 54, "RR": 28, "TEMP": 38.6, "ETCO2": 31 },
  "alerts": [{ "severity": "Critical", "text": "Low SpO2 and hypotension threshold crossed" }]
}
```

More examples are available at `/api/device/examples` for bedside monitors, ventilators, infusion pumps, lab machines, and imaging systems.

## Installation
```bash
git clone https://github.com/<your-github-username>/lifeview-central.git
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

# Option B: GitHub website
# Repository Settings -> General -> Repository name -> lifeview-central

# Then update local remote if needed
git remote set-url origin https://github.com/<your-github-username>/lifeview-central.git
git remote -v
```

## License
MIT. See `LICENSE`.

## Contact
Add your GitHub profile, LinkedIn, email, or accelerator contact here.
