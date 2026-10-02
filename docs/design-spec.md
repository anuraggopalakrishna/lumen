# Lumen — Technical Design Specification

**Status:** Proposed  
**Audience:** Product, engineering, design, and privacy reviewers  
**Last updated:** October 2, 2026

## 1. Purpose

Lumen is a personal health-tracking app designed around one person's longitudinal patterns. It lets a user record menstrual-cycle events, activity, energy, exhaustion, symptoms, sleep, sickness, and notes. The system turns these entries into clear, modest suggestions around diet, movement, recovery, and wellbeing practices.

Lumen is a wellbeing tool, not a diagnostic, treatment, emergency, or clinical-decision system. Recommendations must be presented as optional suggestions, always show their basis, and never replace professional care.

## 2. Product principles

1. **Personal before generic.** Personal history and stated preferences drive the experience; broad population assumptions are secondary.
2. **The user owns their data.** Consent, export, deletion, and AI-sharing controls are product features, not policy footnotes.
3. **AI is bounded.** Deterministic calculations and safety rules establish facts and limits. The model explains and prioritizes suggestions within those limits.
4. **Offline first.** A check-in should work without a network connection and sync safely later.
5. **No surprise automation.** AI cannot modify health records, act on the user's behalf, or trigger notifications without user-controlled settings.

## 3. Scope

### Initial release

- Daily check-in: energy, exhaustion, mood, stress, symptoms, activity, sleep, and a private note.
- Cycle logging: period start/end, flow, user corrections, and estimated phase.
- Dashboard: current cycle context, recent trends, and a small set of suggestions.
- AI suggestions in four categories: movement, food, recovery, and practices.
- Recommendation feedback: helpful, not helpful, acted on, skipped.
- Consent controls, data export, and account deletion.

### Explicitly out of scope

- Diagnosis, triage, treatment plans, medication changes, or supplement dosing.
- Pregnancy, fertility, or contraceptive decisions.
- Automatic medical alerts or emergency dispatch.
- Sharing with a clinician, health system, insurer, employer, or third party.
- Fine-tuning a model on user health data.
- A vector database / retrieval system for personal check-in history.

## 4. Architecture decision

Use a **TypeScript modular monolith** for the first production version.

- **Mobile:** Expo + React Native + TypeScript.
- **Backend:** Fastify + TypeScript, Zod validation, OpenAPI documentation.
- **Database:** PostgreSQL, using Drizzle or Prisma for migrations and typed access.
- **Async work:** a small TypeScript worker for scheduled features, notification scheduling, and AI jobs.
- **AI integration:** server-side only through a self-hosted Ollama inference module running an approved open-weight model.

Python is not required for the application API or AI integration. Introduce it later only if an independently deployed analytics/forecasting workflow has a concrete need for Python's scientific ecosystem. Do not create a separate Python service preemptively.

### System diagram

```text
┌──────────────────────── Expo React Native ────────────────────────┐
│ UI · local encrypted cache · offline queue · API client           │
└─────────────────────────────────┬────────────────────────────────┘
                                  │ TLS + short-lived access token
┌─────────────────────────────────▼────────────────────────────────┐
│ Fastify API (TypeScript)                                          │
│ auth · consent · health-log API · dashboard · export/delete       │
│ personal feature calculator · safety rules · Ollama client        │
└──────────────┬───────────────────────────┬────────────────────────┘
               │                           │
       ┌───────▼────────┐          ┌───────▼────────┐
       │ PostgreSQL      │          │ Private Ollama  │
       │ canonical data  │          │ inference host  │
       └─────────────────┘          └─────────────────┘
               ▲
       ┌───────┴────────┐
       │ TS worker       │
       │ feature jobs    │
       └─────────────────┘
```

This deliberately avoids microservices. The modules can be deployed together, tested transactionally, and split only when operational evidence requires it.

## 5. Mobile architecture

The mobile app should use the following boundaries:

```text
app/
  screens/             Presentation and navigation
  features/            Check-ins, cycle, activity, insights, profile
  components/          Reusable visual components
  services/            Auth, API client, secure storage, notifications
  stores/              Local UI and sync state
  schemas/             Shared input/output validation contracts
```

- Store pending writes locally in SQLite and sync idempotently when the device is online.
- Store only secrets and encryption-key references in platform-secure storage; do not put API keys in the app.
- Use React Query (or equivalent) for remote cache and mutation retries.
- Treat the backend as the source of truth after sync; retain local draft state so the user never loses a check-in.

## 6. Backend modules and API surface

```text
src/
  modules/
    auth/              Identity, sessions, device registrations
    consent/           Purpose-based consent and revocation
    profile/           Preferences, goals, constraints, timezone
    health-log/        Check-ins, activities, sleep, symptoms, cycle
    dashboard/         Read models for the Today screen
    features/          Derived personal signals and feature versions
    recommendations/   Suggestions, feedback, expiry, user actions
    ai/                Context minimization, Ollama client, output validation
    safety/            Red flags, disallowed requests, safe fallback
    privacy/           Export, deletion, audit events
  jobs/                Feature refreshes and notification scheduling
```

Initial endpoints:

| Method | Endpoint | Responsibility |
|---|---|---|
| `POST` | `/v1/check-ins` | Save an idempotent daily check-in |
| `POST` | `/v1/cycle-events` | Record or correct a cycle event |
| `POST` | `/v1/activities` | Record activity |
| `POST` | `/v1/symptoms` | Record a user-reported symptom |
| `GET` | `/v1/dashboard/today` | Current cycle context, trends, suggestions |
| `POST` | `/v1/recommendations/generate` | Generate bounded suggestions from current snapshot |
| `POST` | `/v1/recommendations/:id/feedback` | Capture helpfulness and action taken |
| `GET` | `/v1/privacy/export` | Start or retrieve a machine-readable export |
| `DELETE` | `/v1/account` | Start verified deletion workflow |

Every handler must obtain `userId` only from the authenticated session and scope every query to it. Never accept a user ID from a mobile request body as an authorization decision.

## 7. Data model

All user-owned health records carry `user_id`, creation/update timestamps, and a deletion marker or deletion workflow state. Store instants as `TIMESTAMPTZ`; retain `local_date DATE` for entries that belong to a user's day. Cycle calculations must not rely on server time.

| Table | Key fields | Notes |
|---|---|---|
| `users` | `id`, `created_at`, `status` | Minimal account identity. |
| `profiles` | `user_id`, `display_name`, `timezone`, `birth_date` optional | Keep demographic data optional. |
| `consents` | `id`, `user_id`, `purpose`, `policy_version`, `granted_at`, `revoked_at` | Separate consent for AI processing and notifications. |
| `health_preferences` | `user_id`, `goals`, `dietary_constraints`, `activity_constraints`, `ai_sharing_enabled` | JSON only for genuinely flexible, user-entered choices. |
| `daily_checkins` | `id`, `user_id`, `local_date`, `energy`, `exhaustion`, `mood`, `stress`, `note` | Unique `(user_id, local_date)` for the default daily view. |
| `cycle_events` | `id`, `user_id`, `event_date`, `event_type`, `flow`, `source`, `confidence` | Event history is canonical; estimates are derived. |
| `symptom_events` | `id`, `user_id`, `occurred_at`, `symptom_code`, `severity`, `duration_minutes`, `user_label` | A reported symptom is not a diagnosis. |
| `activity_entries` | `id`, `user_id`, `occurred_at`, `activity_type`, `duration_minutes`, `intensity`, `perceived_exertion` | Allow a user-defined activity label. |
| `sleep_entries` | `id`, `user_id`, `sleep_date`, `duration_minutes`, `quality`, `source` | Supports manual and future wearable source data. |
| `daily_features` | `id`, `user_id`, `local_date`, `feature_version`, `values_json` | Versioned derived snapshot; rebuildable from canonical events. |
| `recommendation_runs` | `id`, `user_id`, `feature_version`, `policy_version`, `model_version_id`, `prompt_version`, `schema_version`, `created_at` | Do not log raw sensitive prompts by default. |
| `model_versions` | `id`, `ollama_model_ref`, `model_digest`, `modelfile_version`, `options_json`, `status` | Immutable allow-list and rollback record for approved local models. |
| `recommendations` | `id`, `run_id`, `category`, `suggestion_json`, `status`, `expires_at` | User-visible, validated output. |
| `recommendation_feedback` | `id`, `recommendation_id`, `helpfulness`, `action_taken`, `comment` | Teaches prioritization without fine-tuning. |
| `audit_events` | `id`, `user_id`, `event_type`, `occurred_at`, `metadata` | For privacy-sensitive actions, not routine reading. |
| `deletion_requests` | `id`, `user_id`, `requested_at`, `completed_at`, `status` | Supports verifiable, asynchronous deletion. |

Suggested index set:

```sql
create unique index daily_checkins_user_day_idx
  on daily_checkins (user_id, local_date);

create index symptom_events_user_time_idx
  on symptom_events (user_id, occurred_at desc);

create index activity_entries_user_time_idx
  on activity_entries (user_id, occurred_at desc);

create index daily_features_user_day_idx
  on daily_features (user_id, local_date desc);

create index recommendations_user_status_idx
  on recommendations (user_id, status, expires_at desc);
```

## 8. Personalization and feature calculation

The canonical health-log tables hold facts. `daily_features` holds derived facts that can be recalculated when an entry changes.

Examples of derived features:

- Current cycle day and phase estimate, including confidence.
- Cycle regularity and a predicted period window.
- 3-, 7-, and 28-day energy, exhaustion, sleep, and movement averages.
- Symptom frequency and severity trends.
- User-specific associations such as low sleep preceding lower reported energy.
- Goal progress and feedback on prior suggestions.

Features must name their time window and source version. A suggestion should be able to state why it was made without inventing causality: “Your reported energy averaged lower than usual over the last three days” is acceptable; “Your hormone level is low” is not.

Run a feature refresh after a write and a nightly reconciliation job. For a single-user product, normal PostgreSQL queries and materialized/derived records are sufficient; do not add a vector database for chronological personal data.

## 9. AI architecture

### Request flow

1. Verify the user has given current AI-processing consent.
2. Load only the minimum relevant, versioned personal feature snapshot and preferences.
3. Run deterministic safety checks before invoking the model.
4. Build a compact structured context; avoid sending lifetime raw logs and optional notes unless the user opted in.
5. Ask the model for strict JSON matching the recommendation contract.
6. Validate the output server-side, apply category and language policy, and reject invalid output.
7. Persist only the approved suggestion and a privacy-safe run record.
8. Show the suggestion with its rationale and capture user feedback.

```text
health data → features → safety gate → minimized context → model
                                                   ↓
user-facing UI ← validated recommendation ← structured JSON
```

### Recommendation contract

```ts
export type Suggestion = {
  category: 'movement' | 'food' | 'recovery' | 'practice';
  recommendation: string;
  rationale: string;
  basedOn: Array<{
    metric: string;
    window: string;
    observation: string;
  }>;
  caution?: string;
  confidence: 'low' | 'medium' | 'high';
};
```

The API converts the model response into this contract before it reaches the client. The model is not a database writer, and it must never receive tools that can change health data.

### Ollama inference policy

- Run the selected open-weight model through a **local Ollama server**, not Ollama Cloud, for production health-data requests.
- The mobile app must never reach Ollama directly. Only the backend can call the internal Ollama endpoint.
- Deploy Ollama on a private GPU-capable host or private container node in the same network as the API. Do not expose port `11434` to the public internet.
- Use Ollama's `/api/chat` endpoint with `stream: false` and a full JSON Schema supplied through `format`; still validate the parsed response with a server-side Zod schema.
- Pin the exact model tag/digest, Modelfile, system prompt version, inference options, and schema version for each release. Record them in every `recommendation_run`.
- Persist model conversations only in Lumen's own database when the user explicitly chooses to retain them. Do not send logs, traces, or raw notes to external observability vendors.
- Do not use live web search as a source for personalized health guidance.
- Do not fine-tune on health logs. Personalization comes from current, consented feature snapshots and feedback.

Ollama supports both local and cloud APIs; this design intentionally uses the local-server path, which is documented at `http://localhost:11434/api` for a local machine. Ollama also supports a JSON Schema as its structured-output format. [Ollama API introduction](https://docs.ollama.com/api/introduction) · [Ollama structured outputs](https://ollama.com/blog/structured-outputs)

### Model release policy

Do not select a model merely because it is popular or small. Maintain an allow-list of models that have passed Lumen's safety and structured-output evaluation suite. A model release must have:

- A documented open-weight license compatible with the intended deployment.
- Sufficient hardware headroom at the chosen quantization and context length.
- Reliable structured-output success on recommendation, refusal, and adversarial test cases.
- A reviewed model card and a reproducible Ollama `Modelfile`.
- A rollback target that has already passed the same evaluation suite.

JSON-schema-constrained output makes the response shape more reliable; it does **not** make health advice clinically reliable. The deterministic safety layer and post-generation content checks remain mandatory.

## 10. Safety layer

The safety module runs before and after AI generation.

### Block or safely redirect

- Requests for diagnosis, medication, dosage, treatment, fertility prediction, or emergency advice.
- Outputs that claim certainty about a health condition or make unsupported causal claims.
- Activity suggestions that conflict with a declared injury or constraint.
- Requests that involve self-harm, acute distress, or other red-flag phrases.

### Safe fallback behavior

- State that Lumen cannot assess or diagnose the situation.
- Encourage appropriate professional or emergency support for urgent situations, without pretending to triage.
- Offer low-risk tracking or grounding actions only where policy permits.
- Display a reason the personalized suggestion was unavailable.

The suggestions UI must visibly label output as wellbeing guidance and show which recent, user-entered patterns informed it.

## 11. Privacy and security requirements

- Encrypt data in transit and at rest; protect mobile secrets with device-secure storage.
- Keep database credentials and any inference-host credentials off the client.
- Restrict the Ollama host to the private service network; allow requests only from the API/worker identity and keep its management interface inaccessible from the public network.
- Pin and scan model artifacts before promotion; do not let production pull arbitrary model names at runtime.
- Apply least-privilege database roles and strict user scoping/RLS where applicable.
- Use separate, purpose-based consents for account operation, AI processing, notifications, and any future sharing.
- Redact or avoid raw notes in operational logs, traces, error reporting, and AI-run records.
- Provide portable export and verified account deletion from the product.
- Define retention windows for logs, backups, queued jobs, and Ollama host traces before production use.
- Do not permit advertising, sale, or cross-user model training from personal health data.

Legal obligations depend on country, business model, and whether Lumen works on behalf of a healthcare provider. In the United States, an app developer acting for a covered entity may be a HIPAA business associate; this must be reviewed before any provider integration. See [HHS business-associate guidance](https://www.hhs.gov/hipaa/for-professionals/privacy/guidance/business-associates/index.html). Software regulation can also be function-specific rather than platform-specific; see [FDA digital-health guidance](https://www.fda.gov/medical-devices/digital-health-center-excellence/device-software-functions-including-mobile-medical-applications).

## 12. Delivery plan

### Phase 1 — Private tracking foundation

1. Refactor the prototype into feature modules and add local SQLite persistence.
2. Build Fastify API, authentication, consent, and PostgreSQL migrations.
3. Ship cycle events, daily check-ins, symptoms, activity, and dashboard read model.
4. Add offline queue, idempotency keys, export, deletion, and audit logging.

**Exit criteria:** a user can record and correct personal data reliably across device sessions; no AI is involved.

### Phase 2 — Deterministic personalization

1. Implement versioned `daily_features` calculation.
2. Generate dashboard trends directly from features.
3. Add constraints, goals, and suggestion feedback.
4. Build safety policy tests and manual content review flow.

**Exit criteria:** the product can explain a dashboard trend entirely without a model.

### Phase 3 — Bounded AI suggestions

1. Deploy a private Ollama inference host and add consent-gated AI orchestration with minimal context.
2. Enforce structured output and post-generation policy validation.
3. Release one suggestion per category, with expiry and feedback.
4. Add evaluation fixtures for unsafe requests, hallucinated facts, privacy leakage, weak evidence, malformed JSON, and model-version regressions.

**Exit criteria:** no model output reaches the user without schema validation, safety checks, and a visible evidence basis.

### Phase 4 — Iterate from evidence

1. Improve suggestions using aggregation and feedback, not fine-tuning.
2. Add optional wearable imports only after consent, source attribution, and deletion handling are complete.
3. Assess whether a dedicated analytics worker is actually needed.

## 13. Key decisions to retain

- TypeScript end to end for the first build.
- PostgreSQL is the source of truth; SQLite supports private offline use.
- A modular monolith is sufficient; no microservices initially.
- AI creates bounded, explainable suggestions; it does not diagnose or change data.
- Personal features and feedback are more useful than RAG or fine-tuning for this use case.
- Privacy consent and deletion paths ship before production AI access.
