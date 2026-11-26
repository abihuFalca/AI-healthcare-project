# AegisAI Triage — AI Early-Risk Detection & Patient Triage System

A full-stack clinical decision-support web app. Patients complete a guided health
assessment; the system estimates their risk, explains *why*, and routes them to a
clinician with the right urgency. Doctors get a prioritised queue, an AI case summary
and a review workflow; admins manage users, clinician approvals and audit logs.

> **Disclaimer:** this is a portfolio/research prototype, not a medical device. It does
> not diagnose, and its output must always be reviewed by a qualified clinician.

---

## Features

**Patients**
- 7-step assessment wizard: basics (auto BMI), symptoms (free text and/or checklist),
  medical history, medications, risk factors, vitals with range warnings, and review
- Explicit consent screen before any health data is processed (decline = no processing)
- Result page with a 0–100 risk score, risk band, triage priority and recommendation
- Plain-language AI explanation, read-aloud (text-to-speech) support
- **AI assistant** to ask questions about their own result (never diagnoses; emergency
  phrases get an immediate "call emergency services" reply without going to the AI)
- Risk and vitals timeline across past assessments, in-app notifications

**Healthcare workers**
- Dashboard and high-risk queue sorted by urgency, score and waiting time
- Patient review page with verbatim symptoms, vitals, history and risk drivers
- **AI case summary**: a short structured summary built only from the recorded data
- Confirm or override triage and add clinical notes

**Admins**
- User management, clinician verification/approval, system settings, model info
- Full audit log (logins, consent, assessments, AI usage)

## How the triage pipeline works

```
Patient input
   │
   ├─ 1. Consent check ─────────────── no accepted consent → request rejected (403)
   ├─ 2. Symptom extraction
   │      ├─ rule/lexicon NLP (synonyms, negation, duration, severity)
   │      └─ LLM reader: maps free text onto the same canonical symptom list
   │         (can only ADD known symptoms, never remove; negations excluded)
   ├─ 3. Deterministic safety rules ─── red flags force EMERGENCY / HIGH
   ├─ 4. Calibrated risk model ──────── 0–100 score → LOW / MODERATE / HIGH
   ├─ 5. Explainability ─────────────── SHAP-style factor attribution
   ├─ 6. Recommendation engine
   └─ 7. Persist + notify assigned clinician (high-risk alerts)
```

Safety is deterministic: the AI components can only make a result **more** cautious,
and the rule engine always has the final say on emergencies.

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite, lucide-react icons, custom SVG charts |
| Backend | Python, FastAPI, Pydantic |
| Database | PostgreSQL on Supabase (schema + row-level-security migrations included) |
| Auth | JWT bearer tokens, role-based access control (patient / healthcare worker / admin) |
| AI | Rule-based NLP, deterministic safety engine, interpretable risk model, SHAP-style explanations, LLM via OpenAI-compatible API (Google Gemini free tier, Groq, or OpenAI) |

## Project structure

```
backend/
  main.py                 FastAPI app (also serves the built frontend)
  database.py             PostgreSQL connection + table setup
  auth_utils.py           JWT, RBAC, audit logging
  routes/                 auth, patient, assessment, ai, doctor, admin, notifications
  ai/                     nlp, safety_rules, risk_model, explainability,
                          recommendations, llm_service
  migrations/             SQL schema, seed data, RLS policies
  tests/                  API and end-to-end scripts
frontend/
  src/views/              patient, doctor and admin screens
  src/components/         charts, risk gauge, AI explanation, assistant, case summary
```

## Running locally

**Requirements:** Python 3.11+, Node.js 20+, a PostgreSQL database (a free Supabase project works).

1. **Configure environment**
   ```bash
   cp .env.example .env
   ```
   Fill in `DATABASE_URL` and a long random `JWT_SECRET_KEY`. For the AI features, set
   `LLM_PROVIDER=gemini` and a free key from [Google AI Studio](https://aistudio.google.com/apikey)
   in `GEMINI_API_KEY` (or use `groq` with a free [Groq](https://console.groq.com/keys) key).
   Without a key, the app still works; only the LLM features are switched off.

2. **Database:** run the SQL files in `backend/migrations/` in order (001 → 005) in the
   Supabase SQL editor. The backend also creates any missing tables on startup.

3. **Backend**
   ```bash
   pip install -r backend/requirements.txt
   python -m uvicorn main:app --app-dir backend --port 8000
   ```
   API docs: http://localhost:8000/docs

4. **Frontend**
   ```bash
   cd frontend
   npm install
   npm run dev        # http://localhost:3000, proxies /api to the backend
   ```
   Or run `npm run build` and open http://localhost:8000 — the backend serves the build.

Demo accounts created by the seed data are listed in `TEST_LOGIN_WORKFLOW.md`.

## Key API endpoints

| Method | Endpoint | Who |
|---|---|---|
| POST | `/api/auth/register`, `/api/auth/login` | public |
| POST | `/api/auth/consent` · GET `/api/auth/consent/status` | signed-in user |
| POST | `/api/assessments` | patient |
| GET | `/api/assessments/{id}`, `/api/assessments/history/list` | patient / clinician |
| POST | `/api/ai/assistant` | patient (own assessments only) |
| GET | `/api/ai/case-summary/{id}` | healthcare worker, admin |
| GET | `/api/doctor/high-risk`, POST `/api/doctor/reviews` | healthcare worker |
| GET | `/api/admin/audit-logs`, PUT `/api/admin/healthcare-workers/{id}/approve` | admin |

## Known limitations / roadmap

- Password hashing uses a simple salted SHA-256 for the prototype; production should move to bcrypt/argon2
- The risk model uses hand-calibrated weights; next step is training on a public clinical dataset
- On LLM free tiers, data may be used by the provider; use demo data only
