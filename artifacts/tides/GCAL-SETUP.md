# Turning on Google Calendar (production)

The code is already built end-to-end: OAuth connect/callback, token refresh,
read-only event fetch, disconnect, and a "Connect Google Calendar" button in
Settings. If it doesn't work in production it's **configuration, not code** —
three things have to line up. ~15 minutes.

Production domain: `https://compass.day` (the callback lives here — see the
env var note in step 2 for why only one redirect URI is actually live at a
time). The old Railway URL
(`https://workspaceapi-server-production-69e7.up.railway.app`) still works as
the app's URL, but Calendar's callback now targets compass.day.

---

## 1. Google Cloud — OAuth client + consent screen

1. [console.cloud.google.com](https://console.cloud.google.com) → your project (or create one).
2. **APIs & Services → Enabled APIs → + Enable APIs** → enable **Google Calendar API**.
3. **APIs & Services → Credentials**:
   - If you don't have one: **+ Create Credentials → OAuth client ID → Web application**.
   - Under **Authorized redirect URIs**, add both:
     ```
     https://compass.day/api/integrations/google-cal/callback
     https://workspaceapi-server-production-69e7.up.railway.app/api/integrations/google-cal/callback
     ```
   - Save. Copy the **Client ID** and **Client secret**.
4. **Google Auth Platform** (the console renamed "OAuth consent screen" to this
   — left sidebar has Overview / Branding / **Audience** / Clients / Data
   Access):
   - **Scopes**: it only needs `.../auth/calendar.readonly` (read-only — the app never writes to your calendar).
   - **Audience** tab is where **Publishing status** and **Test users** now
     live. The two states trade off differently:
     - **Testing**: only emails on the **Test users** list can connect, and
       Google **expires refresh tokens after 7 days**, so every tester gets
       silently disconnected weekly. Fine for a couple of people you can
       remind, annoying past that.
     - **Published (unverified)** — *recommended, given beta is ~12 friends/
       clients*: anyone can connect and tokens don't expire, but because
       `calendar.readonly` is a **sensitive scope**, Google shows a
       **"Google hasn't verified this app"** warning until formal
       verification is done. Users click **Advanced → Go to Compass
       (unsafe)** to continue — tell testers to expect this (it's covered in
       TESTER-NOTES.md).
   - **Removing the warning = Google OAuth verification** (days–weeks; only
     worth doing before a wider/public launch, not for this beta): requires a
     **custom domain you own** (have it now — compass.day), a **published
     privacy policy** on that domain (now live at
     [compass.day/privacy](https://compass.day/privacy)), app name/logo, and
     a short justification for calendar access. No third-party security audit
     needed for read-only calendar (that's only for restricted scopes like
     Gmail/Drive) — so verification is realistic whenever it's worth doing,
     just not required to run a friends/clients beta.

> **This is the usual reason "connect" fails silently in prod:** the app is in Testing mode and the person connecting isn't on the Test users list, or the redirect URI doesn't match to the character.

---

## 2. Railway — environment variables

On the `@workspace/api-server` service → **Variables**, set:

```
GOOGLE_CLIENT_ID          = <from step 1>
GOOGLE_CLIENT_SECRET      = <from step 1>
GOOGLE_CAL_REDIRECT_URI   = https://compass.day/api/integrations/google-cal/callback
```

Only **one** `GOOGLE_CAL_REDIRECT_URI` is active at a time — the server sends
this exact value to Google on every auth request, regardless of which domain
the user is browsing from. Registering both URIs in Google Cloud (step 1)
just means you can switch this env var between them without a console trip;
whichever one is set here is the one that has to work. It **must be
byte-identical** to a URI registered in Google Cloud. Redeploy after saving.

---

## 3. Verify

1. Open the app → **Settings → Google Calendar → Connect**.
2. You should land on Google's consent screen, approve, and pop back to the app
   showing "connected".
3. Your day's events now appear on **Today** and the **Calendar** grid, and the
   **Planner** (Plan tab) will schedule *around* them as busy time.

If connect bounces back unconnected: check (a) redirect URI matches exactly,
(b) you're a Test user (or the app is Published), (c) the three env vars are set
and the service redeployed.

---

### Other calendars (Apple / Outlook)

Not built as OAuth integrations, and probably not worth it yet. The app already
exposes an **iCal export** (`/api/ical/...`), so the lighter path is "subscribe
to Compass from any calendar app" rather than pulling each provider in. Revisit
only if testers ask for two-way sync.
