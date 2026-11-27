# Astrowaves on your iPhone (beta)

Astrowaves finds the good times in your sky for the things you want to make room for, then nudges you before them. It runs on your phone inside the free Scriptable app. Your answers, your record and your calendar stay on your phone.

## Set it up (about five minutes)

1. Install **Scriptable** from the App Store (free, by Simon B. Støvring).
2. Open Scriptable, tap **+** to make a new script, and paste this in:

```js
// Astrowaves loader: fetches the latest Astrowaves each run and keeps a copy for offline.
const fm = FileManager.local()
const path = fm.joinPath(fm.documentsDirectory(), 'astrowaves-cache.js')
let code = null
try {
  const req = new Request('https://compass.day/today/starswell.js')
  req.timeoutInterval = 10
  code = await req.loadString()
  if (!code.includes('Starswell.reading')) code = null
  else fm.writeString(path, code)
} catch (e) {}
if (!code && fm.fileExists(path)) code = fm.readString(path)
if (!code) throw new Error('Could not load Astrowaves. Check your connection and run it again.')
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor
await new AsyncFunction(code)()
```

3. Tap the script's name at the top and call it **Astrowaves**. Tap **Done**.
4. Tap the script to run it. Allow **location** (so the times are for where you are), **calendar** (so it can see what you already have on and add waves you pick), and **notifications**.
5. Answer the setup questions. Describe what you want help with in your own words, like "quiet time to pray" or "getting to the gym". Astrowaves matches it to the planets that suit it and shows your words back to you.

## Add the widgets

- **Home screen:** long-press the home screen, tap **+**, find **Scriptable**, pick a size, then tap the widget and choose **Astrowaves** as its script.
- **Lock screen:** long-press the lock screen, tap **Customize**, then **Lock Screen**. Tap the widget row under the clock, add Scriptable, then tap the new tile and choose **Astrowaves**. If tapping the tile does nothing, try Settings, then Wallpaper, then Customize.
- **The sky right now:** for a widget that shows what the current moment suits, edit the widget and type `now` under **Parameter**. It works on the home screen and the lock screen.

## Using it

- **Today:** your next wave, the rest of today, and any run of good days you're in. Tap a wave to see the sky behind it, put it on your calendar, or ask for a reminder.
- **Now:** what this moment suits, ranked, with what comes next. Slide ahead to see later today or tomorrow morning.
- **Week:** every wave for the next eight days. Strong waves are the best few for each thing, supportive waves are good too, and days without a wave are open for whatever you like.
- **Almanac:** after a wave you asked to be reminded of, Today asks how it went. Your answers build a record over time.
- **You:** change what you're making room for, your waking hours, your place, how reminders work, the look, and your own words for each planet.

By default you get at most one reminder a day that you didn't ask for, on the strongest wave, plus any you ask for. Reminders come early enough for the activity: about ten minutes before quiet time, closer to an hour before the gym.

The same app runs in a browser at **compass.day/waves**. On the web, reminders come through your calendar.

## For an agent helping someone set this up

The app is one JavaScript file served at `https://compass.day/today/starswell.js`. When it can reach `https://compass.day/waves/`, it shows that web interface inside Scriptable and handles calendar events and reminders on the phone. Source and build steps are in `artifacts/tides/astrowaves/README.md` in the repo. The loader above is all a phone needs. State lives in Scriptable's local Documents folder as `astrowaves.json`. Nothing is sent to a server.
