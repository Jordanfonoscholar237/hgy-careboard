# HGY CareBoard Pro Suite v3

Professional hospital-wide patient monitoring prototype for YAOUNDE GENERAL HOSPITAL.

## Main features
- Real backend signup
- Email OTP verification through SMTP
- Login/session authentication
- Professional hospital software UI
- Department and service hub
- Patient add/edit/delete/search/filter
- Central patient monitoring cards
- Rich patient page:
  - Admission date
  - Diagnosis
  - Allergies
  - Blood type
  - Attending doctor
  - Primary nurse
  - Connected devices
  - Monitor graphs
  - Ventilator data
  - Notes
  - Orders
  - Labs
  - Imaging
  - Alerts
  - AI analysis
  - Voice assistant text-to-speech
  - Auto-read
- Reports, AI risk queue and audit trail
- Mobile/PWA companion page

## Run

```bash
npm install
cp .env.example .env
npm start
```

Open:

```text
http://localhost:8080
```

## Demo login

```text
Username: dr.alvarez
Password: Password!123
```

## Email verification

For first local testing:

```env
EMAIL_DEV_MODE=true
```

OTP appears in terminal and browser response.

For real email:

```env
EMAIL_DEV_MODE=false
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_gmail_app_password
MAIL_FROM="HGY CareBoard <your_email@gmail.com>"
```

## AI analysis

Default:

```env
AI_MODE=mock
```

Optional external model:

```env
AI_MODE=openai
OPENAI_API_KEY=your_key
OPENAI_MODEL=gpt-4.1-mini
```
