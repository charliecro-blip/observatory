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

## Using it

- **Waves:** every good time this week for what you're tracking, by day. Tap one to put it on your calendar, get a ping, or mark it done. "The sky behind it" shows the astrology.
- **Record:** tap **I did it** when you do the thing. Astrowaves notes whether it landed on a wave.
- **Settings:** choose what reaches your lock screen for each thing: the best ones, only what you put on your calendar, or every good wave. There's also a morning summary.

Pings come 10 minutes before a specific time, 20 minutes before a longer window, and the evening before plus the morning of a good day.

## For an agent helping someone set this up

The app is one JavaScript file served at `https://compass.day/today/starswell.js`, built from the Starswell engine (astronomy-engine for positions, a rulebook of activities and planets, and a planner). The loader above is all a phone needs. State lives in Scriptable's local Documents folder as `astrowaves.json`. Nothing is sent to a server.
