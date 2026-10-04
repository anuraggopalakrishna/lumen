# Closed-loop AI (Phase 3 scaffold)

The goal: personalization runs entirely inside your trust boundary. No health
data is sent to any model provider — inference happens on a private, self-hosted
Ollama server, and the loop is closed by feature snapshots and user feedback,
**not** by fine-tuning on health logs.

## The loop

```
record ─► daily_features ─► wellbeing state ─► minimized context ─► local model
   ▲                                                    │                │
   │                                          schema + safety gate ◄──────┘
   └──────── recommendation_feedback re-ranks ◄──────────┘
```

The **wellbeing state** is a deterministic classifier
(`packages/shared/src/wellbeing-state.ts`) computed from the same feature windows
as the offline plan. It maps the data to one of `no_data`, `steady`, `low`,
`recovering`, or `prolonged_low`, and the prompt uses it to decide how many and
what kind of suggestions to make: a dip gets targeted ideas, a rebound gets
"maintain this", continued normalcy gets little or nothing, and a sustained low
(4+ consecutive low days, or 6+ during menstruation, so a couple of rough days
never escalates) gets a fixed clinician nudge.

Every step is recorded (`daily_features`, `recommendation_runs`,
`recommendations`, `recommendation_feedback`) and versioned
(`promptVersion`, `schemaVersion`, `policyVersion`, `model_version_id`).

There is deliberately **no training loop**. Feedback steers priorities and
context; it is never used to fine-tune weights.

## Trust boundary

Health data may only exist in: the local device, your Postgres, and the private
inference host. The code enforces the boundary; the rest is deployment:

- `OLLAMA_BASE_URL` must be a private/local address. Never set it to a hosted or
  cloud inference endpoint.
- The mobile app never calls Ollama — only the API does.
- Telemetry and external log/trace pipelines must be off or PII-scrubbed.
- Pin the model tag; the run records the resolved digest (`model_versions`).
- Keep port `11434` off the public network; allow only the API/worker identity.

## Enabling it

Generation is **off by default** and fails closed.

```bash
AI_GENERATION_ENABLED=true
OLLAMA_BASE_URL=http://<private-inference-host>:11434
OLLAMA_MODEL=qwen3:4b        # must be on the allow-list
```

Start the optional local host with Compose (dev):

```bash
docker compose --profile ai up --build
docker compose exec ollama ollama pull qwen3:4b
```

Check the boundary (no health data in the response):

```bash
curl -H "Authorization: Bearer <access token>" http://localhost:4000/v1/ai/status
# { enabled, model, approved, license, reachable, digest, promptVersion, ... }
```

Then generate (requires `ai_processing` consent + `aiSharingEnabled`):

```bash
curl -X POST -H "Authorization: Bearer <access token>" \
  http://localhost:4000/v1/recommendations/generate
```

## What the model can and cannot see

`minimizeContext` (`apps/api/src/modules/ai/context.ts`) sends only derived,
consented features:

**Included:** derived wellbeing state, cycle estimate + confidence, 28-day
feature windows (energy, exhaustion, sleep, movement), symptom counts/severity,
stated goals and constraints, recent feedback signals.

**Never included:** raw check-in notes, lifetime raw event logs, account
identifiers, audit events, session/device data.

`includedFields` / `excludedFields` are attached to each context for review.

## Model allow-list

`apps/api/src/modules/ai/model-registry.ts` is the gate. Production refuses any
model not on it (`assertModelAllowed`). Adding a model is a reviewed change that
requires a documented open-weight license, hardware headroom, and passing the
evaluation suite. Small classifier-role models (≤1B) are allow-listed for
pre-filtering only — never for user-facing guidance.

## Request flow (enforced in code)

1. `AI_GENERATION_ENABLED` must be true.
2. Model must be on the allow-list.
3. `ai_processing` consent must be granted and `aiSharingEnabled` true.
4. Load minimized context (above).
5. Resolve model digest; record a `model_versions` row.
6. Call Ollama `/api/chat`, `stream: false`, JSON Schema in `format`,
   `temperature: 0`.
7. Zod-validate the output against the recommendation contract.
8. Run the deterministic safety gate per suggestion (`validateSuggestion`);
   drop any that fail, duplicate a category, or cite no basis.
9. On a `prolonged_low` state, prepend a fixed clinician nudge (not model text).
10. Persist the run + accepted suggestions with a 3-day expiry.
11. When listing, show only the latest run (max 4), re-ranked by recent feedback
    so helpful categories surface first.

A model that is unreachable, times out, or returns invalid output yields a
`502`/`503`/`504` and writes nothing partial.

## Still required before production AI

- **Evaluation fixtures** (Phase 3): unsafe requests, hallucinated facts,
  privacy leakage, malformed JSON, and model-version regression runs. Promotion
  onto the allow-list is gated on this.
- **Egress proof**: firewall rules and telemetry-off checks you can demonstrate.
