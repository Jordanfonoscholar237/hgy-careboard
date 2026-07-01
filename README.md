# LifeView Central

Hospital-wide patient monitoring platform with device data, dashboards, alerts, AI analysis, patient portal access, and mobile/PWA support.

LifeView Central is a hospital-wide patient monitoring and clinical intelligence MVP. It demonstrates how authorized medical-device gateways or hospital APIs can send patient status into a backend, prototype database, staff dashboards, patient views, alerts, reports, and AI-assisted review.

> Prototype and safety note: this project is for portfolio, demo, and accelerator application use. Do not use this system for diagnosis, treatment, emergency response, or live clinical decisions without hospital authorization, validated device integrations, cybersecurity review, clinical governance, and regulatory/data-protection compliance.

## Key Features

- Staff authentication with email OTP development mode.
- Role concept for doctor, nurse, biomedical engineer, and admin users.
- Department hub for ICU, Emergency, Surgery, Radiology, Maternity, Pediatrics, Laboratory, Pharmacy, Biomedical, and Administration.
- Patient list with add, edit, delete, search, filter, and monitoring links.
- Patient detail page with admission data, diagnosis, allergies, attending doctor, nurse, room/bed, blood type, notes, orders, labs, imaging, alerts, and connected devices.
- Simulated vitals and ventilator values.
- Reports, audit logs, risk queue, and AI analysis history.
- Mobile/PWA companion page and patient portal.
- Device ingestion API and example JSON payloads.

## Tech Stack

Node.js, Express.js, HTML, CSS, vanilla JavaScript, JSON prototype storage, Nodemailer, Helmet, CORS, Morgan, dotenv, PWA manifest/service worker.

## Architecture

```text
Medical devices / automated machines
  -> authorized device adapter or hospital gateway API
  -> LifeView Central Express backend
  -> prototype JSON database
  -> staff dashboards + mobile/PWA + patient portal
  -> alerts, reports, audit logs, and AI-assisted review
```

Real integrations must use hospital-approved, vendor-supported interfaces such as HL7/FHIR, DICOM/PACS, gateway APIs, or approved protocols. Biomedical engineering, IT security, clinical leadership, and device vendors must validate any production connection.

## Installation

```bash
git clone https://github.com/Jordanfonoscholar237/hgy-careboard.git
cd hgy-careboard
npm install
cp .env.example .env
npm start
```

Open `http://localhost:8080`.

## Local Test Credentials

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

## Environment Variables

See `.env.example`.

- `EMAIL_DEV_MODE=true` prints OTP codes locally.
- `AI_MODE=mock` or `AI_MODE=local` works without external services.
- `AI_MODE=openai` uses `OPENAI_API_KEY` if configured.
- `DEVICE_INGEST_API_KEY` protects the device-ingestion endpoint when set to a non-default value.

## Device Ingestion Example

```bash
curl http://localhost:8080/api/device/examples
```

```bash
curl -X POST http://localhost:8080/api/device/ingest \
  -H "Content-Type: application/json" \
  -d '{"patientId":"p1","deviceType":"bedside_monitor","deviceId":"MON-ICU-01","values":{"HR":118,"SPO2":91,"BP_SYS":96,"BP_DIA":60,"RR":26,"TEMP":38.4,"ETCO2":35}}'
```

## Deployment Notes

1. Create a Node.js web service.
2. Set build command: `npm install`.
3. Set start command: `npm start`.
4. Add environment variables from `.env.example`.
5. Keep `.env`, SMTP passwords, OpenAI keys, session secrets, and sensitive records private.
6. Replace JSON storage with a production database before serious pilots.

## Repository Presentation

Suggested repository description:

> Hospital-wide patient monitoring platform with device data, dashboards, alerts, AI analysis, and mobile/PWA support.

Recommended topics: `healthcare`, `healthtech`, `patient-monitoring`, `hospital-management`, `medical-dashboard`, `ai-healthcare`, `iot`, `nodejs`, `express`, `pwa`.

## License

MIT. See `LICENSE`.

## Contact

FONO PEVETMI JORDAN LOIC

jordanfonoscholar237@gmail.com
