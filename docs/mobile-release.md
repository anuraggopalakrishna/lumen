# Shipping Lumen to a phone (APK) + private AI

This walks through handing a friend a working Lumen APK: offline logging, sync to
your server, and the consent-gated AI suggestions running on your own machine.

The app is a managed Expo project (SDK 54). There is no `android/` folder; builds
are produced by [EAS Build](https://docs.expo.dev/build/introduction/).

## What works offline vs. online

| Capability | Needs the server? |
|---|---|
| Log check-ins, cycle events, symptoms | No — written to local SQLite first |
| History, trends, Insights, daily plan | No — computed on-device |
| Account, sync, export, deletion | Yes |
| AI suggestions (`/v1/recommendations/generate`) | Yes — server + Ollama |

Mutations made offline are queued and replayed (with `Idempotency-Key`) once the
device is signed in and can reach the API. She only needs the server **once** to
register; after that, offline logging works and syncs later.

## Prerequisites

- An Expo account (free) and `eas-cli`:
  `npm install -g eas-cli`
- `cloudflared` (to make your local API reachable): `winget install --id Cloudflare.cloudflared`
- Ollama running locally with an allow-listed model: `ollama pull qwen3:4b`

## 1. Make the API reachable (Cloudflare Tunnel)

Android release builds block cleartext HTTP, so the app must use `https://`.

```powershell
npm run dev:api                       # terminal 1
powershell -File scripts/cloudflared-tunnel.ps1   # terminal 2
```

The script prints a public `https://<random>.trycloudflare.com` URL.

> **Stable URL required.** The tunnel URL is baked into the APK at build time.
> A quick tunnel gets a new random URL every restart, so the APK breaks when it
> changes. For anything beyond a one-off, use a **named** tunnel with a domain
> you control:
>
> ```powershell
> cloudflared tunnel login
> cloudflared tunnel create lumen
> cloudflared tunnel route dns lumen api.example.com
> cloudflared tunnel run --url http://localhost:4000 lumen
> ```
>
> Then your API lives at `https://api.example.com`.

Security note: the server currently allows open registration. Anyone with the
tunnel URL can create an account. Keep the URL private, or add an invite gate
before sharing widely.

## 2. Point the app at that URL and build the APK

Set the URL in `apps/mobile/eas.json` under the `preview` profile:

```json
"preview": {
  "distribution": "internal",
  "android": { "buildType": "apk" },
  "env": { "EXPO_PUBLIC_API_URL": "https://api.example.com" }
}
```

`EXPO_PUBLIC_*` values are inlined into the bundle at build time, so this is the
only place the URL needs to be set for the build.

```powershell
cd apps/mobile
eas login
eas build -p android --profile preview
```

EAS returns a download link for `application.apk`. Send it to her; she enables
"Install unknown apps" for her browser/file manager and installs it.

Local alternative (no Expo account, needs JDK 17 + Android SDK):

```powershell
cd apps/mobile
npx expo prebuild -p android
cd android; ./gradlew assembleRelease
# -> android/app/build/outputs/apk/release/app-release.apk
```

## 3. First run on her phone

1. Open Lumen and **create an account** (this requires the server reachable).
2. Log a check-in. It is saved on the device immediately.
3. In **Profile → Sync**, confirm "Everything is synced" once online.

## 4. Turn on AI suggestions

Generation is consent-gated and fails closed. For her account:

1. **Profile → Consent → “Allow AI processing of my features”** → on.
2. **Profile → Personalized suggestions → “Use my features for suggestions”** → on.
3. Confirm the status line reads `Ready on qwen3:4b.` (the server must be running
   with `AI_GENERATION_ENABLED=true` and Ollama reachable).
4. On **Today → Suggestions for you**, tap **Generate suggestions**. The request
   runs on your machine against the local model and returns in ~30–60 seconds
   (CPU); suggestions then appear with their basis and confidence.

If it fails:

- `403` → consent or health-preferences sharing is off (step 1/2).
- `501` → `AI_GENERATION_ENABLED` is false on the server.
- `504` → inference timed out; the model is still loading or the host is slow.
  Raise `OLLAMA_TIMEOUT_MS`, or keep the model warm.

### Server-side AI settings (`apps/api/.env`)

```env
AI_GENERATION_ENABLED=true
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=qwen3:4b
OLLAMA_TIMEOUT_MS=180000
OLLAMA_KEEP_ALIVE=30m
OLLAMA_NUM_CTX=4096
# Reasoning models (qwen3) "think" before answering, which is slow for
# schema-constrained JSON. Disable it for responsive generation.
OLLAMA_THINK=false
```

The API may only use models on the allow-list in
`apps/api/src/modules/ai/model-registry.ts`.

## Notes / limits

- **Exactly one worker** should run (`npm run worker`) for feature reconciliation.
- The model only ever sees minimized, derived features — never raw notes.
- Web builds use a `localStorage` session fallback
  (`src/services/storage/secure.web.ts`); the APK uses the OS keystore.
- AI suggestions are wellbeing guidance, not medical advice.
