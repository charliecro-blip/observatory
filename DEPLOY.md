# Deploying Tides

Two services to deploy: **API server** (Railway) + **Frontend** (Vercel).
Estimated time with accounts ready: ~30 minutes.

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

5. Deploy. Wait for health check at `/api/health` to pass (green).
6. Copy your Railway public URL (e.g. `https://tides-api.up.railway.app`)

---

## 3. Frontend — Vercel

1. Go to [vercel.com](https://vercel.com) → New project → import this repo
2. Set **Root Directory** to `artifacts/tides`
3. Build command: `pnpm --filter @workspace/tides run build`
4. Output directory: `dist/public`
5. Add one environment variable:
   - `VITE_API_URL` = your Railway URL (e.g. `https://tides-api.up.railway.app`)
6. Open `artifacts/tides/vercel.json` and replace `YOUR_RAILWAY_URL` with your actual Railway URL
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

- Open your Vercel URL → onboarding modal should appear
- Check `/api/health` on Railway → should return `{ "status": "ok" }`
- Set a location in Settings → confirm location search works
- Open Sky view → confirm events load

---

## Sharing with users

Once deployed, users just open the Vercel URL. Each person gets a unique `testerId`
generated in their browser on first visit. No sign-up required.

To share: send the Vercel URL. That's it.
