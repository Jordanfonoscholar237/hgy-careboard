# HGY CareBoard Pro Suite

HGY CareBoard Pro Suite is a hospital patient monitoring and care coordination web application prototype for YAOUNDE GENERAL HOSPITAL.

The platform is designed to support hospital teams with patient monitoring, patient records, department workflows, clinical notes, orders, labs, imaging, alerts, reports, audit history, and AI-assisted risk review.

> **Important:** This project is a prototype. Do not use it for real clinical decisions, emergency care, or real patient data without proper security review, medical validation, access control, hosting configuration, and data-protection compliance.

## Features

- Node.js and Express backend
- Staff signup and login
- Email OTP verification
- Session-based authentication
- Hospital department and service hub
- Patient roster with add, edit, delete, search, and filter features
- Central patient monitoring cards
- Detailed patient profile page
- Admission and diagnosis information
- Allergies and blood type tracking
- Attending doctor and primary nurse fields
- Connected device information
- Monitor graphs and vital signs
- Ventilator-related data
- Clinical notes
- Medical orders
- Lab records
- Imaging records
- Alerts and risk queue
- AI-assisted analysis mode
- Audit trail
- Reports page
- Mobile/PWA companion interface

## Tech Stack

- Node.js
- Express.js
- HTML
- CSS
- JavaScript
- JSON file storage for prototype data
- Nodemailer for email verification
- Helmet for basic security headers
- CORS
- Morgan request logging
- dotenv for environment variables

## Project Structure

```text
hgy-careboard-pro-suite/
  package.json
  server.js
  README.md
  .env.example
  public/
    index.html
    hub.html
    roster.html
    patient.html
    reports.html
    mobile.html
    manifest.json
    service-worker.js
    assets/
      style.css
      app.js
      patient.js
      images/
        hospital-command-bg.png
  data/
    db.json
```

## Run Locally

Clone the repository:

```bash
git clone https://github.com/ https://github.com/Jordanfonoscholar237/hgy-careboard.git
```

Go into the project folder:

```bash
cd hgy-careboard
```

Install dependencies:

```bash
npm install
```

Create your environment file.

Windows:

```bash
copy .env.example .env
```

macOS/Linux:

```bash
cp .env.example .env
```

Start the app:

```bash
npm start
```

Open in your browser:

```text
http://localhost:8080
```

## Demo Login

For local testing only:

```text
Username: dr.alvarez
Password: Password!123
```

Change or remove demo credentials before any real deployment.

## Environment Variables

The project uses environment variables from `.env`.

Example:

```env
PORT=8080
APP_BASE_URL=http://localhost:8080
SESSION_SECRET=change_this_secret

EMAIL_DEV_MODE=true

SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_gmail_app_password
MAIL_FROM="HGY CareBoard <your_email@gmail.com>"

AI_MODE=mock
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4.1-mini
```

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
MAIL_FROM="HGY CareBoard <your_email@gmail.com>"
```

Do not upload real SMTP passwords or private keys to GitHub.

## AI Analysis

Default mode:

```env
AI_MODE=mock
```

Optional external AI mode:

```env
AI_MODE=openai
OPENAI_API_KEY=your_api_key
OPENAI_MODEL=gpt-4.1-mini
```

Do not upload real API keys to GitHub.

## GitHub Upload Notes

Before uploading to GitHub, create a `.gitignore` file.

Recommended `.gitignore`:

```gitignore
node_modules/
.env
npm-debug.log*
.DS_Store
.vscode/
.idea/
```

If `data/db.json` contains real or sensitive patient information, do not upload it. Add this line to `.gitignore`:

```gitignore
data/db.json
```

For public GitHub repositories, only upload demo or fake patient data.

## Deployment on Render

This project can be deployed on Render as a Node.js web service.

Use these settings:

```text
Runtime: Node
Build Command: npm install
Start Command: npm start
```

Add environment variables on Render:

```text
SESSION_SECRET=your_long_secure_secret
EMAIL_DEV_MODE=true
AI_MODE=mock
```

For production email sending, also add the SMTP variables shown above.

After deployment, Render will provide a live link such as:

```text
https://your-app-name.onrender.com
```

## Patient Access Notes

This project currently behaves like a hospital staff dashboard. It should not be treated as a full patient portal unless patient-specific access control is added.

For a safe patient-facing version, add:

- Patient login
- Patient-only dashboard
- Role-based access control
- Access limited to one patient's own records
- Secure database storage
- HTTPS
- Password reset
- Email verification
- Audit logging
- Data backup
- Privacy and security review

Do not give patients access to a staff dashboard that can display other patients' information.

## Production Recommendations

Before using this with real patient data:

- Replace JSON file storage with a secure database
- Use strong session secrets
- Store passwords and secrets only in environment variables
- Use HTTPS
- Add role-based permissions
- Add patient-specific access rules
- Add backup and recovery
- Review privacy, security, and healthcare data requirements
- Remove demo accounts and demo passwords
- Do not store real patient data in GitHub

## Contact

Project owner:

```text
FONO PEVETMI JORDAN LOIC
```

Email:

```text
jordanfonoscholar237@gmail.com
```
