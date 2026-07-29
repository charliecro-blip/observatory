# Deploying Compass

**One service: Railway.** The Railway server is a single server — it builds the
frontend *and* the API, then serves both at one URL (static frontend +
`/api/*`, see `railway.toml` and `artifacts/api-server/src/app.ts`).

**Production domain: [compass.day](https://compass.day)**, pointed at Railway
via CNAME (DNS: Cloudflare, grey-clouded/DNS-only — orange-cloud proxying
breaks Railway's TLS cert issuance). The Railway-issued `*.up.railway.app` URL
still works as a fallback but isn't what's shared with users anymore.

> Vercel is retired. It was the original frontend host back when the API server
> didn't serve static files; that role now lives on Railway. Auto-deploys are
> turned off via `git.deploymentEnabled: false` in `vercel.json`. To remove it
> for good, delete (or disconnect the repo from) the project in the Vercel
> dashboard. The old Vercel steps are kept at the bottom of this file for
> reference only.

Estimated time with accounts ready: ~20 minutes.

---

## 1. Database — Neon (free tier)

1. Go to [neon.tech](https://neon.tech) → New project → name it `tides`
2. Copy the **Connection string** (looks like `postgresql://...`)
3. Keep it handy — you'll paste it into Railway

---

## 2. API Server — Railway

1. Go to [railway.app](https://railway.app) → New project → **Deploy from GitHub repo**
2. Select this repo
3. Railway will detect `railway.toml` and configure automatically
4. Go to **Variables** tab and add every key from `.env.example`:

```
DATABASE_URL          ← paste from Neon
AI_INTEGRATIONS_OPENAI_BASE_URL=https://api.openai.com/v1
AI_INTEGRATIONS_OPENAI_API_KEY
GEOAPIFY_API_KEY
VAPID_PUBLIC_KEY
VAPID_PRIVATE_KEY
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
PORT=3000
```

5. Deploy. Wait for health check at `/api/healthz` to pass (green).
6. Copy your Railway public URL, then point your domain at it (Networking →
   Custom Domain) — that domain is your app URL. Open it in a browser and you
   get the Compass frontend; the same server answers `/api/*`.

---

## 3. Frontend — Vercel *(retired — reference only)*

> No longer part of a deploy. Railway serves the frontend (step 2). Kept for
> historical reference. Auto-deploys are already disabled in `vercel.json`.

1. Go to [vercel.com](https://vercel.com) → New project → import this repo
2. Leave **Root Directory** at the repo root (vercel.json handles the rest)
3. Build command: `pnpm --filter @workspace/tides run build`
4. Output directory: `dist/public`
5. Add one environment variable:
   - `VITE_API_URL` = your Railway URL (e.g. `https://tides-api.up.railway.app`)
6. Open `vercel.json (repo root)` and replace `YOUR_RAILWAY_URL` with your actual Railway URL
7. Deploy

---

## 4. Google OAuth — update redirect URI

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. APIs & Services → Credentials → your OAuth 2.0 client
3. Add to **Authorized redirect URIs**:
   ```
   https://YOUR_RAILWAY_URL/api/integrations/google-cal/callback
   ```

---

## 5. VAPID keys (if not already generated)

Run this once locally and add the output to Railway env vars:
```bash
npx web-push generate-vapid-keys
```

---

## 6. Verify

- Open your Railway URL → onboarding modal should appear
- Check `/api/healthz` on Railway → should return `{ "status": "ok" }`
- Set a location in Settings → confirm location search works
- Open Sky view → confirm events load

---

## Sharing with users

Once deployed, users just open [compass.day](https://compass.day). Each person
gets a unique `testerId` generated in their browser on first visit. No sign-up
required.

To share: send the compass.day link. That's it.
