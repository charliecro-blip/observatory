
// ---- Astrowaves: good times for what you want to make room for ----------------------------
// State lives in one local file on the phone. Nothing leaves the device.
const STATE_FILE = 'astrowaves.json', PLAN_FILE = 'astrowaves-plan.json', PLAN_TL = 'astrowaves-timeline.json';
const fmL = FileManager.local(), docPath = n => fmL.joinPath(fmL.documentsDirectory(), n);
function readJSON(n) { try { const p = docPath(n); return fmL.fileExists(p) ? JSON.parse(fmL.readString(p)) : null; } catch (e) { return null; } }
function writeJSON(n, v) { try { fmL.writeString(docPath(n), JSON.stringify(v)); } catch (e) {} }
const GOALS = StarswellPlan.GOALS, WORD = StarswellPlan.WORD;
const GLYPH = { Sun: '☉', Moon: '☽', Mercury: '☿', Venus: '♀', Mars: '♂', Jupiter: '♃', Saturn: '♄', Uranus: '♅', Neptune: '♆', Pluto: '♇' };

function loadState() {
  let s = readJSON(STATE_FILE);
  if (!s) {
    const old = readJSON('starswell-goals.json');   // carry over picks from the earlier build
    s = { goals: (old || []).map(g => Object.assign({ mode: 'best' }, g)), scheduled: {}, pinged: {}, done: [], busy: [], morning: true };
  }
  s.goals = s.goals || []; s.scheduled = s.scheduled || {}; s.pinged = s.pinged || {}; s.done = s.done || []; s.busy = s.busy || [];
  if (s.morning == null) s.morning = true;
  return s;
}
let ST = loadState();
const save = () => writeJSON(STATE_FILE, ST);
function applyLocation() { if (ST.loc) { SETTINGS.lat = ST.loc.lat; SETTINGS.lon = ST.loc.lon; SETTINGS.tz = ST.loc.tz; SETTINGS.city = ST.loc.city || SETTINGS.city; } }
applyLocation();
if (ST.wake != null) SETTINGS.wake = ST.wake;
if (ST.sleep != null) SETTINGS.sleep = ST.sleep;

async function refreshLocation() {
  try {
    Location.setAccuracyToThreeKilometers();
    const l = await Location.current();
    let city = SETTINGS.city;
    try { const g = await Location.reverseGeocode(l.latitude, l.longitude); if (g && g[0]) city = g[0].locality || g[0].subAdministrativeArea || city; } catch (e) {}
    ST.loc = { lat: Math.round(l.latitude * 100) / 100, lon: Math.round(l.longitude * 100) / 100, tz: Intl.DateTimeFormat().resolvedOptions().timeZone || SETTINGS.tz, city, at: Date.now() };
    save(); applyLocation();
  } catch (e) { console.log('location: ' + e); }
}

// Busy times from the phone's calendar for the next eight days, so waves that clash can say so.
async function refreshBusy() {
  try {
    const from = new Date(), to = new Date(Date.now() + 8 * 864e5);
    const evs = await CalendarEvent.between(from, to);
    ST.busy = evs.filter(e => !e.isAllDay && String(e.notes || '').indexOf('Astrowaves') < 0)
      .map(e => ({ t: e.title, s: +e.startDate, e: +e.endDate })).slice(0, 300);
    save();
  } catch (e) { console.log('calendar: ' + e); }
}
const clashOf = w => (ST.busy.find(b => b.s < +w.end && b.e > +w.start) || {}).t || '';

function loadPlan(allowCompute) {
  const goals = ST.goals.map(g => ({ want: g.want, times: g.times, per: g.per, precision: g.precision }));
  const sig = JSON.stringify(goals) + SETTINGS.lat + SETTINGS.lon + SETTINGS.wake + SETTINGS.sleep;
  const c = readJSON(PLAN_FILE), fresh = c && c.sig === sig && Date.now() - c.made < 12 * 3600e3;
  if (c && (fresh || !allowCompute)) return revivePlan(c.plan);
  if (!allowCompute || !goals.length) return null;
  const tlIO = { read: () => { const p = docPath(PLAN_TL); return fmL.fileExists(p) ? fmL.readString(p) : null; }, write: s => fmL.writeString(docPath(PLAN_TL), s) };
  const plan = StarswellPlan.plan({ now: new Date(), lat: SETTINGS.lat, lon: SETTINGS.lon, tz: SETTINGS.tz, wake: SETTINGS.wake, sleep: SETTINGS.sleep, goals, cache: tlIO });
  writeJSON(PLAN_FILE, { sig, made: Date.now(), plan });
  return plan;
}
function revivePlan(p) {
  p.goals.forEach(g => { (g.spans || []).forEach(w => { w.start = new Date(w.start); w.end = new Date(w.end); }); g.windows.forEach(w => { w.start = new Date(w.start); w.end = new Date(w.end); if (w.peak) { w.peak.start = new Date(w.peak.start); w.peak.end = new Date(w.peak.end); } }); if (g.best) { g.best.start = new Date(g.best.start); g.best.end = new Date(g.best.end); } (g.alts || []).forEach(a => { a.start = new Date(a.start); a.end = new Date(a.end); }); });
  return p;
}
// The person's own setup rides on top of the plan: their label, their word, their ping mode.
function mine(g) { const s = ST.goals.find(x => x.want === g.want) || {}; return Object.assign({}, g, { label: s.label || g.short, word: s.word || '', mode: s.mode || 'best', times: s.times || g.times, per: s.per || g.per }); }
const wid = (g, w) => g.want + ':' + (+w.start);
function upcoming(g) { const now = Date.now(); return g.windows.filter(w => +w.end > now); }

// ---- words and times ----
const clk = d => new Date(d).toLocaleTimeString('en-US', { timeZone: SETTINGS.tz, hour: 'numeric', minute: '2-digit' }).replace(' AM', ' am').replace(' PM', ' pm');
const dkey = x => new Date(x).toLocaleDateString('en-US', { timeZone: SETTINGS.tz });
function dayWord(d) {
  if (dkey(d) === dkey(Date.now())) return 'Today';
  if (dkey(d) === dkey(Date.now() + 864e5)) return 'Tomorrow';
  return new Date(d).toLocaleDateString('en-US', { timeZone: SETTINGS.tz, weekday: 'short' });
}
const dayLong = d => dkey(d) === dkey(Date.now()) ? 'Today' : dkey(d) === dkey(Date.now() + 864e5) ? 'Tomorrow' : new Date(d).toLocaleDateString('en-US', { timeZone: SETTINGS.tz, weekday: 'long' });
const range = (a, b) => { const x = clk(a), y = clk(b); return (x.slice(-2) === y.slice(-2) ? x.slice(0, -3) : x) + ' to ' + y; };
const wStart = w => w.kind === 'day' && w.peak ? w.peak.start : w.start, wEnd = w => w.kind === 'day' && w.peak ? w.peak.end : w.end;
const span = w => w.kind === 'day' ? dayWord(w.start) + ', especially ' + clk(wStart(w))
  : +w.start <= Date.now() ? 'Now to ' + clk(w.end) : dayWord(w.start) + ' ' + range(w.start, w.end);
const shortSpan = w => w.kind === 'day' ? dayWord(w.start) + ' · ' + clk(wStart(w)) : (+w.start <= Date.now() ? 'Now' : dayWord(w.start) + ' ' + clk(w.start));
// The keyword: the person's own word if they gave one, else the planet's; the planet's sign beside it.
const wordOf = (g, w) => g.word || w.word || '';
// The planet's glyph beside the keyword, in text style rather than emoji.
const signOf = w => w.planet && GLYPH[w.planet] ? GLYPH[w.planet] + '\uFE0E' : '';
const reasonText = w => w.reason || '';
const tagline = (g, w) => (wordOf(g, w) ? wordOf(g, w) + ': ' : '') + (reasonText(w) ? reasonText(w) + ', ' : '') + range(wStart(w), wEnd(w));
const perWord = g => g.per === 'day' && g.times >= 3 ? 'several a day' : g.times + (g.per === 'day' ? ' a day' : g.per === 'month' ? ' a month' : ' a week');

// Progress this period: weeks start on Monday.
function periodStart(per) {
  const off = Sky.offsetMin(new Date(), SETTINGS.tz) * 60000, local = new Date(Date.now() + off);
  local.setUTCHours(0, 0, 0, 0);
  if (per === 'week') local.setUTCDate(local.getUTCDate() - ((local.getUTCDay() + 6) % 7));
  if (per === 'month') local.setUTCDate(1);
  return +local - off;
}
const doneIn = g => ST.done.filter(d => d.want === g.want && d.at >= periodStart(g.per));

// ---- pings ----
function wantsPing(g, w) {
  const id = wid(g, w);
  if (ST.scheduled[id] || ST.pinged[id]) return true;
  // gentle: the strongest waves only, at most one unasked-for ping a day. saved: only what they asked for.
  const m = ST.ping || (g.mode === 'all' ? 'all' : g.mode === 'off' ? 'saved' : 'gentle');
  return m === 'all' || (m === 'gentle' && w.top);
}
const atHour = (d, h) => { const off = Sky.offsetMin(new Date(d), SETTINGS.tz) * 60000, mid = Math.floor((+d + off) / 864e5) * 864e5; return new Date(mid + h * 3600e3 - off); };
function nudges(g, w) {
  if (w.kind === 'day') return [
    { key: 'eve', when: atHour(+w.start - 864e5, 20), title: 'Tomorrow is a good day for ' + g.label.toLowerCase(), body: 'Especially around ' + clk(wStart(w)) + '. ' + tagline(g, w) },
    { key: 'am', when: atHour(w.start, Math.max(7, SETTINGS.wake + 0.5)), title: 'Today is a good day for ' + g.label.toLowerCase(), body: 'Especially around ' + clk(wStart(w)) + '. ' + tagline(g, w) }];
  // Lead time fits the activity: ten minutes to sit, closer to an hour to get to the gym.
  const lead = g.lead || (w.kind === 'crossing' ? 10 : 20), when = w.kind === 'crossing' && w.at ? +new Date(w.at) - 5 * 60000 : +w.start;
  return [{ key: 'pre', when: new Date(when - lead * 60000), title: g.label + ' in ' + (lead >= 60 ? (lead / 60) + (lead > 60 ? ' hours' : ' hour') : lead + ' minutes'), body: tagline(g, w) }];
}
async function scheduleNotifications(plan) {
  const pending = await Notification.allPending();
  const ours = pending.filter(n => n.identifier.indexOf('starswell-') === 0 || n.identifier.indexOf('aw-') === 0);
  const want = [], goals = plan.goals.map(mine);
  const asked = (g, w) => !!(ST.scheduled[wid(g, w)] || ST.pinged[wid(g, w)]);
  goals.forEach(g => upcoming(g).filter(w => wantsPing(g, w)).forEach(w => nudges(g, w).forEach(n => {
    if (+n.when > Date.now()) want.push(Object.assign({ id: 'aw-' + wid(g, w) + '-' + n.key, asked: asked(g, w), score: w.score || 0 }, n));
  })));
  if ((ST.ping || 'gentle') === 'gentle') {
    // Keep only the strongest unasked-for ping each day.
    const best = {};
    want.forEach(x => { if (x.asked) return; const d = dkey(x.when); if (!best[d] || x.score > best[d].score) best[d] = x; });
    for (let i = want.length - 1; i >= 0; i--) if (!want[i].asked && best[dkey(want[i].when)] !== want[i]) want.splice(i, 1);
  }
  (ST.extra || []).filter(x => x.when > Date.now() && !want.some(y => y.id === x.id)).forEach(x => want.push({ id: x.id, when: new Date(x.when), title: x.title, body: x.body }));
  if (ST.morning) {
    for (let d = 0; d < 7; d++) {
      const at = atHour(Date.now() + d * 864e5, Math.max(7, SETTINGS.wake + 1));
      if (+at <= Date.now()) continue;
      const items = [];
      goals.forEach(g => g.windows.filter(w => dkey(w.start) === dkey(at) && w.kind !== 'day').forEach(w => items.push({ g, w })));
      if (!items.length) continue;
      items.sort((a, b) => a.w.start - b.w.start);
      want.push({ id: 'aw-sum-' + dkey(at).replace(/\D/g, ''), when: at, title: 'Today’s waves', body: items.slice(0, 4).map(x => x.g.label + ' ' + clk(x.w.start) + (wordOf(x.g, x.w) ? ' · ' + wordOf(x.g, x.w) : '')).join('\n') });
    }
  }
  want.sort((a, b) => a.when - b.when);
  const keep = want.slice(0, 50), ids = keep.map(x => x.id);
  const stale = ours.filter(n => ids.indexOf(n.identifier) < 0).map(n => n.identifier);
  if (stale.length) Notification.removePending(stale);
  const have = ours.map(n => n.identifier);
  for (const x of keep) {
    if (have.indexOf(x.id) >= 0) continue;
    const n = new Notification();
    n.identifier = x.id; n.threadIdentifier = 'astrowaves';
    n.title = x.title; n.body = x.body;
    n.openURL = 'scriptable:///run/' + encodeURIComponent(Script.name());
    n.setTriggerDate(x.when);
    await n.schedule();
  }
}

// ---- actions from the app screen ----
function findWave(plan, id) { for (const g0 of plan.goals) { const g = mine(g0); for (const w of g.windows) if (wid(g, w) === id) return { g, w }; } return null; }
async function addToCalendar(plan, id) {
  const x = findWave(plan, id); if (!x) return;
  const ev = new CalendarEvent();
  ev.title = x.g.label;
  ev.startDate = new Date(wStart(x.w)); ev.endDate = new Date(wEnd(x.w));
  ev.notes = 'Astrowaves · ' + tagline(x.g, x.w);
  try { ev.calendar = await Calendar.defaultForEvents(); } catch (e) {}
  await ev.save();
  ST.scheduled[id] = ev.identifier || true; save();
}
function logDone(plan, want, id) {
  const now = Date.now(), g = plan && plan.goals.find(x => x.want === want);
  const onWave = !!(g && g.windows.some(w => +w.start - 15 * 60000 <= now && now <= +w.end + 15 * 60000));
  ST.done.push({ want, at: now, onWave, wave: id || null }); save();
}
async function act(plan, url) {
  const q = {}; String(url).split('?')[1].split('&').forEach(kv => { const i = kv.indexOf('='); q[kv.slice(0, i)] = decodeURIComponent(kv.slice(i + 1)); });
  if (q.a === 'cal') await addToCalendar(plan, q.id);
  if (q.a === 'ping') { if (ST.pinged[q.id]) delete ST.pinged[q.id]; else ST.pinged[q.id] = 1; save(); }
  if (q.a === 'done') logDone(plan, q.want, q.id);
  if (q.a === 'undo') { const i = ST.done.map(d => d.want).lastIndexOf(q.want); if (i >= 0) { ST.done.splice(i, 1); save(); } }
  if (q.a === 'mode') { const s = ST.goals.find(x => x.want === q.want); if (s) { s.mode = q.m; save(); } }
  if (q.a === 'morning') { ST.morning = !ST.morning; save(); }
  try { await scheduleNotifications(plan); } catch (e) { console.log('notifications: ' + e); }
}

// ---- the shared interface: the same screens as compass.day/waves, with the phone doing calendar and pings ----
const UI_FILE = 'astrowaves-ui.html', UI_CORE = 'astrowaves-ui-core.js', UI_BASE = 'https://compass.day/waves/';
async function fetchCached(url, file, test) {
  const p = docPath(file), have = fmL.fileExists(p), age = have ? Date.now() - fmL.modificationDate(p) : 1e12;
  if (age > 6 * 3600e3) { try { const r = new Request(url); r.timeoutInterval = 8; const t = await r.loadString(); if (test(t)) { fmL.writeString(p, t); return t; } } catch (e) { console.log('ui fetch: ' + e); } }
  return have ? fmL.readString(p) : null;
}
async function coastUI() {
  const html = await fetchCached(UI_BASE, UI_FILE, t => t.indexOf('AW_HOST') > 0);
  const core = await fetchCached(UI_BASE + 'core.js', UI_CORE, t => t.indexOf('StarswellPlan') > 0 && t.indexOf('moment') > 0);
  if (!html || !core) return null;
  const host = { state: webState(), busy: ST.busy.map(b => ({ title: b.t, start: b.s, end: b.e })), phone: true };
  return html.replace('<script src="./core.js"></script>', '<script>window.AW_HOST=' + JSON.stringify(host).replace(/</g, '\\u003c') + ';</script><script>' + core + '</script>');
}
// The interface keeps its own shape of state; the phone keeps its file. These two translate.
function webState() {
  const w = ST.web || {};
  return Object.assign({ look: 'sun', glyphs: true, words: {}, plus: true, freeView: false, birth: null }, w, {
    v: 1, goals: ST.goals.map(g => ({ want: g.want, label: g.label, times: g.times || 3, per: g.per || 'week', precision: g.precision })),
    loc: ST.loc ? { lat: ST.loc.lat, lon: ST.loc.lon, tz: ST.loc.tz, city: ST.loc.city } : null,
    wake: SETTINGS.wake, sleep: SETTINGS.sleep, ping: ST.ping || 'gentle',
    done: ST.done.map(d => ({ want: d.want, label: d.label, at: new Date(d.at).toISOString(), how: d.how || (d.onWave ? 'caught' : 'other'), wave: d.wave || null, planet: d.planet || null, word: d.word || null })),
    saved: Object.keys(ST.scheduled).concat(Object.keys(ST.pinged)),
    onboarded: !!(w.onboarded || ST.goals.length)
  });
}
function fromWeb(S) {
  ST.goals = (S.goals || []).map(g => Object.assign({}, ST.goals.find(x => x.want === g.want) || {}, { want: g.want, label: g.label, times: g.times, per: g.per, precision: g.precision }));
  if (S.loc && (!ST.loc || S.loc.lat !== ST.loc.lat || S.loc.lon !== ST.loc.lon)) { ST.loc = Object.assign({}, S.loc, { at: Date.now(), manual: true }); applyLocation(); }
  ST.wake = S.wake; ST.sleep = S.sleep; SETTINGS.wake = S.wake; SETTINGS.sleep = S.sleep;
  ST.ping = S.ping || 'gentle';
  ST.done = (S.done || []).map(d => ({ want: d.want, label: d.label, at: +new Date(d.at), how: d.how, onWave: d.how === 'caught', wave: d.wave, planet: d.planet, word: d.word }));
  ST.web = { look: S.look, glyphs: S.glyphs, words: S.words, plus: S.plus, freeView: S.freeView, birth: S.birth, onboarded: S.onboarded };
  save();
}
async function hostAct(url) {
  const q = {}; String(url).split('?')[1].split('&').forEach(kv => { const i = kv.indexOf('='); q[kv.slice(0, i)] = decodeURIComponent(kv.slice(i + 1)); });
  const d = q.d ? JSON.parse(q.d) : {};
  if (q.a === 'save') fromWeb(d);
  if (q.a === 'cal') {
    const ev = new CalendarEvent(); ev.title = d.title; ev.startDate = new Date(d.start);
    ev.endDate = d.allDay ? new Date(d.end) : new Date(+new Date(d.start) + (d.mins || 30) * 60000); ev.isAllDay = !!d.allDay;
    ev.notes = d.notes || 'Astrowaves';
    try { ev.calendar = await Calendar.defaultForEvents(); } catch (e) {}
    await ev.save();
  }
  if (q.a === 'ping') {
    ST.pinged[d.id] = 1;
    const lead = d.lead || 10, when = +new Date(d.at) - 5 * 60000 - lead * 60000;
    ST.extra = (ST.extra || []).filter(x => x.when > Date.now() && x.id !== 'aw-' + d.id + '-pre');
    ST.extra.push({ id: 'aw-' + d.id + '-pre', when, title: d.title + ' in ' + (lead >= 60 ? (lead / 60) + (lead > 60 ? ' hours' : ' hour') : lead + ' minutes'), body: (d.word ? d.word + ': ' : '') + (d.reason || '') });
    save();
  }
  if (q.a === 'export') { await ShareSheet.present([d.text]); return; }
  const plan = loadPlan(true);
  if (plan) { try { await scheduleNotifications(plan); } catch (e) { console.log('notifications: ' + e); } }
}

// ---- onboarding: in their own words ----
async function editGoals() {
  const goals = [], prompts = [
    ['What do you want help making time for?', 'Describe something you’re excited to do, in your own words.', 'quiet time to pray'],
    ['And something you keep putting off?', 'This one is optional, and again in your own words.', 'getting to the gym']];
  for (let i = 0; i < 2; i++) {
    const a = new Alert(); a.title = prompts[i][0]; a.message = prompts[i][1];
    a.addTextField(prompts[i][2], '');
    a.addAction('Next'); a.addAction('Pick from a list'); a.addCancelAction(i === 0 ? 'Cancel' : 'Skip');
    const r = await a.present();
    if (r < 0) break;
    const said = r === 0 ? a.textFieldValue(0).trim() : '';
    let key = null;
    const guesses = said ? StarswellPlan.match(said).filter(k => !goals.some(g => g.want === k)) : [];
    if (guesses.length) {
      const b = new Alert(); b.title = 'Sounds like ' + GOALS[guesses[0]].name.toLowerCase() + '.';
      b.message = 'We’ll time it with the planets that suit it.';
      guesses.slice(0, 3).forEach(k => b.addAction(GOALS[k].name));
      b.addAction('Something else');
      const p = await b.presentSheet();
      if (p >= 0 && p < Math.min(3, guesses.length)) key = guesses[p];
    }
    if (!key) {
      const c = new Alert(); c.title = said ? 'Which is closest?' : 'Pick one';
      const keys = Object.keys(GOALS).filter(k => !goals.some(g => g.want === k));
      keys.forEach(k => c.addAction(GOALS[k].name)); c.addCancelAction('Cancel');
      const p = await c.presentSheet(); if (p < 0) break; key = keys[p];
    }
    const d = new Alert(); d.title = 'Your words';
    d.message = 'What should we call it, and is there a word for how you want it to feel? We’ll show these instead of ours.';
    const defLabel = said ? (said.charAt(0).toUpperCase() + said.slice(1)).slice(0, 28) : GOALS[key].short;
    d.addTextField('Name', defLabel); d.addTextField('A feeling word (optional), like Stillness', '');
    d.addAction('Save');
    await d.present();
    const label = d.textFieldValue(0).trim() || defLabel, word = d.textFieldValue(1).trim();
    const e = new Alert(); e.title = 'How often, for ' + label.toLowerCase() + '?';
    const opts = [[3, 'day'], [1, 'day'], [2, 'day'], [2, 'week'], [3, 'week'], [4, 'week'], [5, 'week'], [2, 'month'], [4, 'month']];
    opts.forEach(o => e.addAction(o[1] === 'day' && o[0] >= 3 ? 'Several times a day' : o[0] + (o[1] === 'day' ? ' a day' : o[1] === 'week' ? ' a week' : ' a month')));
    const o = opts[Math.max(0, await e.presentSheet())];
    const f = new Alert(); f.title = 'How exact should the timing be?';
    const precs = [['moment', 'A specific time (about 15 minutes)'], ['hours', 'A good hour or so'], ['day', 'A good day']];
    precs.forEach(p => f.addAction(p[1]));
    const pr = precs[Math.max(0, await f.presentSheet())][0];
    const h = new Alert(); h.title = 'When should we ping you?'; h.message = 'You’ll always see every good wave in the app.';
    const modes = [['best', 'The best ones, ' + (o[1] === 'day' && o[0] >= 3 ? 'several a day' : o[0] + ' a ' + o[1])], ['scheduled', 'Only times I put on my calendar'], ['all', 'Every good wave']];
    modes.forEach(m => h.addAction(m[1]));
    const mode = modes[Math.max(0, await h.presentSheet())][0];
    goals.push({ want: key, said, label, word, times: o[0], per: o[1], precision: o[1] === 'day' && pr === 'day' ? 'hours' : pr, mode });
  }
  if (goals.length) { ST.goals = goals; save(); writeJSON(PLAN_FILE, null); }
}

// ---- widgets ----
// Widget colors follow the local sun, like the app: sand and sea by day, deep navy and brass at night.
function coastColors() {
  let night = false;
  try {
    const obs = new Astronomy.Observer(SETTINGS.lat, SETTINGS.lon, 0), r = Astronomy.SearchRiseSet('Sun', obs, +1, new Date(Date.now() - 12 * 3600e3), 2), st = Astronomy.SearchRiseSet('Sun', obs, -1, r.date, 2);
    night = !(Date.now() > +r.date && Date.now() < +st.date - 20 * 60000);
    if ((ST.web || {}).look === 'day') night = false; if ((ST.web || {}).look === 'night') night = true;
  } catch (e) {}
  return night ? { bg: new Color('#0E1B33'), ink: new Color('#EFE9DC'), mute: new Color('#9AA7C0'), a: new Color('#5FE0CC'), b: new Color('#D9B46A') }
    : { bg: new Color('#F3EEE4'), ink: new Color('#10233A'), mute: new Color('#5B6B7C'), a: new Color('#1E6E8C'), b: new Color('#E26D4F') };
}
// The sky right now, as a widget: Parameter "now".
function nowWidget(family) {
  const w = new ListWidget(); w.url = 'scriptable:///run/' + encodeURIComponent(Script.name());
  w.refreshAfterDate = new Date(Date.now() + 15 * 60000);
  const m = StarswellPlan.moment({ now: new Date(), lat: SETTINGS.lat, lon: SETTINGS.lon, tz: SETTINGS.tz });
  const words = ((ST.web || {}).words) || {}, wd = p => words[p] || WORD[p] || '', hp = m.head && m.head.planet;
  const head = 'A time to ' + (wd(hp) || 'pause').toLowerCase(), gl = hp && GLYPH[hp] ? GLYPH[hp] + '\uFE0E' : '';
  const suits = m.ranked.slice(0, 2).map(r => r.short.toLowerCase()).join(' and ');
  if (family === 'accessoryInline') { w.addText((gl ? gl + ' ' : '') + head); return w; }
  if (family === 'accessoryCircular') { const s = w.addStack(); s.layoutVertically(); txt(s, gl || '✦', Font.systemFont(20), Color.white(), 1); txt(s, wd(hp).slice(0, 7), Font.systemFont(10), Color.white(), 1); return w; }
  if (family === 'accessoryRectangular') { const W = Color.white(); txt(w, 'NOW' + (m.until ? ' · UNTIL ' + clk(m.until).toUpperCase() : ''), Font.boldSystemFont(10), W, 1); txt(w, (gl ? gl + ' ' : '') + head, Font.systemFont(13), W, 1); txt(w, 'Suits ' + suits, Font.systemFont(11), W, 1); return w; }
  const K = coastColors(); w.backgroundColor = K.bg; w.setPadding(14, 16, 14, 16);
  txt(w, 'THE SKY RIGHT NOW', Font.semiboldSystemFont(9.5), K.mute, 1); w.addSpacer();
  if (gl) txt(w, gl, Font.systemFont(family === 'small' ? 26 : 30), K.b, 1);
  txt(w, head, Font.semiboldSystemFont(family === 'small' ? 17 : 20), K.ink, 2);
  txt(w, (m.head ? m.head.say : '') + (m.until ? ' · until ' + clk(m.until) : ''), Font.systemFont(11.5), K.mute, 1);
  w.addSpacer(4); txt(w, 'Suits ' + suits, Font.systemFont(12), K.a, 2);
  if (family !== 'small' && m.next) { w.addSpacer(4); txt(w, 'Next ' + clk(m.next.at) + ' · ' + wd(m.next.planet) + ' ' + (GLYPH[m.next.planet] || '') + '\uFE0E · ' + m.next.say, Font.systemFont(11), K.mute, 1); }
  return w;
}
function planWidget(plan, family) {
  const w = new ListWidget();
  w.url = 'scriptable:///run/' + encodeURIComponent(Script.name());
  const goals = plan ? plan.goals.map(mine) : [];
  const nexts = goals.map(g => ({ g, up: upcoming(g) }));
  const soon = nexts.filter(x => x.up.length).sort((a, b) => a.up[0].start - b.up[0].start);
  const refresh = [Date.now() + 3 * 3600e3]; soon.forEach(x => refresh.push(+x.up[0].end + 60000, +x.up[0].start + 60000));
  w.refreshAfterDate = new Date(Math.min.apply(null, refresh.filter(t => t > Date.now())));
  const kw = (g, v) => (wordOf(g, v) + ' ' + signOf(v)).trim();
  if (!plan) { const t = w.addText('Open Astrowaves to find your wave.'); t.font = Font.systemFont(12); return w; }
  if (family === 'accessoryInline') { w.addText(soon.length ? soon[0].g.label + ' ' + shortSpan(soon[0].up[0]).replace('Today ', '') : 'No standout waves this week'); return w; }
  if (family === 'accessoryCircular') {
    const s = w.addStack(); s.layoutVertically(); s.centerAlignContent(); const x = soon[0];
    txt(s, x ? (+x.up[0].start <= Date.now() ? 'now' : clk(wStart(x.up[0])).replace(/ (am|pm)/, '')) : '–', Font.boldSystemFont(13), Color.white(), 1);
    txt(s, x ? signOf(x.up[0]) || x.g.label.slice(0, 5) : '', Font.systemFont(10), Color.white(), 1);
    return w;
  }
  if (family === 'accessoryRectangular') {
    const W = Color.white();
    soon.slice(0, 2).forEach(x => {
      txt(w, x.g.label.toUpperCase(), Font.boldSystemFont(10), W, 1);
      txt(w, shortSpan(x.up[0]).replace(/ (am|pm)/g, '$1') + (kw(x.g, x.up[0]) ? ' · ' + kw(x.g, x.up[0]) : ''), Font.systemFont(12.5), W, 1);
      if (soon.length === 1 && x.up[1]) txt(w, 'Then ' + dayWord(x.up[1].start).replace(/^T/, 't') + ' ' + clk(wStart(x.up[1])), Font.systemFont(10.5), W, 1);
    });
    if (!soon.length) txt(w, 'No standout waves this week.', Font.systemFont(12), W, 2);
    return w;
  }
  const K = coastColors();
  w.backgroundColor = K.bg; w.setPadding(14, 16, 14, 16);
  const lab = (st, s, col) => txt(st, s.toUpperCase(), Font.semiboldSystemFont(9.5), col || K.mute, 1);
  if (family === 'small') {
    const x = soon[0];
    lab(w, x ? x.g.label : 'Astrowaves', x && goals.indexOf(x.g) === 1 ? K.b : K.a);
    w.addSpacer();
    if (x) {
      const v = x.up[0];
      txt(w, v.kind === 'day' ? dayWord(v.start) + ', especially' : +v.start <= Date.now() ? 'Now' : dayWord(v.start), Font.systemFont(12), K.mute, 1);
      txt(w, v.kind !== 'day' && +v.start <= Date.now() ? 'until ' + clk(v.end) : clk(wStart(v)), Font.semiboldSystemFont(24), K.ink, 1);
      if (kw(x.g, v)) txt(w, kw(x.g, v), Font.systemFont(14), goals.indexOf(x.g) === 1 ? K.b : K.a, 1);
    } else txt(w, 'No standout waves this week', Font.systemFont(14), K.ink, 2);
    return w;
  }
  const show = family === 'large' ? 4 : 2;
  nexts.forEach((x, gi) => {
    const col = gi === 1 ? K.b : K.a;
    if (gi) w.addSpacer(family === 'large' ? 14 : 8);
    const head = w.addStack(); head.centerAlignContent();
    lab(head, x.g.label, col); head.addSpacer();
    lab(head, x.g.per === 'day' && x.g.times >= 3 ? doneIn(x.g).length + ' today' : doneIn(x.g).length + ' of ' + x.g.times + (x.g.per === 'day' ? ' today' : x.g.per === 'month' ? ' this month' : ' this week'));
    w.addSpacer(3);
    if (!x.up.length) { const a = (x.g.alts || []).find(a => +a.end > Date.now()); txt(w, a ? 'Try ' + a.dfor + ' instead, ' + dayWord(a.start) + ' ' + clk(a.start) : 'No standout waves this week', Font.systemFont(12), K.mute, 1); return; }
    x.up.slice(0, nexts.length === 1 ? show + 1 : show).forEach((v, i) => {
      const r = w.addStack(); r.centerAlignContent();
      txt(r, span(v) + (ST.scheduled[wid(x.g, v)] ? '  ◷' : ''), i === 0 ? Font.semiboldSystemFont(nexts.length === 1 ? 18 : 15) : Font.systemFont(12), i === 0 ? K.ink : K.mute, 1);
      if (kw(x.g, v)) { r.addSpacer(); txt(r, kw(x.g, v), i === 0 ? Font.systemFont(14) : Font.systemFont(12), i === 0 ? col : K.mute, 1); }
      w.addSpacer(i === 0 ? 3 : 1);
    });
  });
  w.addSpacer();
  return w;
}

// ---- the app screen: Waves, Record, Settings ----
function planHTML(plan) {
  const goals = plan ? plan.goals.map(mine) : [];
  const COL = ['#6FF2E0', '#FFC46B'];
  const data = goals.map((g, gi) => ({
    want: g.want, label: g.label, col: COL[gi], per: perWord(g), done: doneIn(g).length, target: g.times, mode: g.mode,
    sideways: (g.alts || []).filter(a => +a.end > Date.now()).length ? 'Not many waves for ' + g.label.toLowerCase() + ' this week, so try coming at it sideways: ' + (g.alts || []).filter(a => +a.end > Date.now()).map(a => a.dfor + ' ' + dayLong(a.start).replace('Today', 'today').replace('Tomorrow', 'tomorrow') + ' at ' + clk(a.start) + (a.reason ? ', under ' + a.reason : '')).join(', or ') + '.' : '',
    best: g.best ? dayLong(g.best.start) + ' is your best day for ' + g.label.toLowerCase() + ', ' + range(wStart(g.best), wEnd(g.best)) : '',
    record: (() => { const since = Date.now() - 28 * 864e5, ds = ST.done.filter(d => d.want === g.want && d.at >= since); return { n: ds.length, on: ds.filter(d => d.onWave).length }; })(),
    waves: upcoming(g).map(w => ({ id: wid(g, w), day: dayLong(w.start), dk: dkey(w.start), time: w.kind === 'day' ? 'Especially ' + clk(wStart(w)) : (+w.start <= Date.now() ? 'Now to ' + clk(w.end) : range(w.start, w.end)),
      word: wordOf(g, w), glyph: signOf(w), reason: reasonText(w), why: w.why.slice(1).concat(w.planet && w.sign ? [w.planet + ' in ' + w.sign] : []).join(' · '), warn: w.warn.join(' · '),
      top: !!w.top, cal: !!ST.scheduled[wid(g, w)], ping: wantsPing(g, w), started: +w.start <= Date.now(), clash: clashOf(w), t: +w.start }))
  }));
  const run = q => 'scriptable:///run/' + encodeURIComponent(Script.name()) + '?' + q;
  const json = JSON.stringify({ goals: data, city: SETTINGS.city, morning: ST.morning, edit: run('edit=1'), sky: run('sky=1') }).replace(/</g, '\\u003c');
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>
:root{--bg:#0A1022;--card:#131B33;--line:#1E2744;--ink:#EEF2FA;--mute:#9AA6C4;--soft:#C3CCE2}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.4 -apple-system,system-ui,sans-serif;-webkit-font-smoothing:antialiased}
main{padding:18px 18px 110px}h1{font-size:28px;font-weight:700;margin:6px 0 2px;letter-spacing:-.01em}.sub{color:var(--mute);font-size:14px;margin:0 0 16px}
.pills{display:flex;gap:10px;margin:0 0 12px}.pill{flex:1;background:var(--card);border-radius:16px;padding:12px 14px;min-width:0}.pill .k{display:flex;align-items:center;gap:7px;font-size:12px;color:var(--mute);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dot{width:9px;height:9px;border-radius:5px;display:inline-block;flex:none}.pill .n{font-size:20px;font-weight:600;margin-top:4px}
.best{background:var(--card);border-radius:16px;padding:12px 14px;margin:0 0 10px;font-size:15px;color:var(--soft)}
.day{font-size:12px;font-weight:600;letter-spacing:.08em;color:var(--mute);margin:18px 0 4px;text-transform:uppercase}
.row{display:flex;align-items:center;gap:12px;padding:13px 2px;border:0;border-top:1px solid var(--line);width:100%;background:none;color:inherit;font:inherit;text-align:left}
.row .m{flex:1;min-width:0}.row .t{font-size:16px;font-weight:500}.row .s{font-size:13px;color:var(--mute);display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.wd{font-size:16px;font-style:italic;font-family:Georgia,serif;white-space:nowrap}.ic{width:18px;height:18px;flex:none}
nav{position:fixed;left:0;right:0;bottom:0;background:rgba(10,16,34,.96);border-top:1px solid var(--line);display:flex;padding:8px 0 calc(10px + env(safe-area-inset-bottom))}
nav button{flex:1;background:none;border:0;color:var(--mute);font:600 12px -apple-system,system-ui;padding:8px 0;min-height:44px}nav button.on{color:var(--ink)}
.sheet{position:fixed;inset:0;background:rgba(3,6,14,.6);display:none;align-items:flex-end}.sheet.on{display:flex}
.panel{background:var(--card);width:100%;border-radius:24px 24px 0 0;padding:12px 20px calc(24px + env(safe-area-inset-bottom))}
.grab{width:40px;height:5px;border-radius:3px;background:#2C3658;margin:0 auto 14px}.big{font-size:34px;font-weight:700;letter-spacing:-.01em;line-height:1.1}
.btn{display:block;width:100%;border-radius:14px;padding:15px;font:600 16px -apple-system,system-ui;border:1px solid #2C3658;background:none;color:var(--ink);margin-top:10px;min-height:48px}
.btn.p{background:var(--ink);color:var(--bg);border-color:var(--ink)}.two{display:grid;grid-template-columns:1fr 1fr;gap:10px}.two .btn{margin-top:0}
details{border-top:1px solid var(--line);margin-top:16px;padding-top:12px}summary{color:var(--mute);font-size:14px}
.card{background:var(--card);border-radius:18px;padding:16px;margin:0 0 12px}.opt{display:flex;align-items:center;gap:12px;padding:12px 0;border:0;border-top:1px solid var(--line);width:100%;background:none;color:var(--ink);font:inherit;text-align:left;min-height:48px}
.opt:first-child{border-top:0}.radio{width:20px;height:20px;border-radius:10px;border:2px solid #3A4568;flex:none}.radio.on{border:6px solid currentColor}
.warn{color:#F2B8A0}.clash{color:#F2B8A0;font-size:13px}.muted{color:var(--mute)}.link{color:var(--mute);text-decoration:none;display:block;text-align:center;padding:14px;font-size:14px}
</style></head><body><main id="app"></main>
<nav><button id="t-waves" class="on">Waves</button><button id="t-record">Record</button><button id="t-settings">Settings</button></nav>
<div class="sheet" id="sheet"><div class="panel" id="panel"></div></div>
<script>
const D=${json};
const go=u=>{try{sessionStorage.setItem('aw-tab',tab)}catch(e){}location.href=u};
const cal='<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="#FFC46B" stroke-width="2" aria-label="On your calendar"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>';
const bell='<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="#9AA6C4" stroke-width="2" aria-label="You will get a ping"><path d="M6 8a6 6 0 1 1 12 0c0 7 3 8 3 8H3s3-1 3-8"/><path d="M10 20a2 2 0 0 0 4 0"/></svg>';
const esc=s=>String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;');
let tab='waves';try{const s=sessionStorage.getItem('aw-tab');if(s)tab=s}catch(e){}
function waves(){
  if(!D.goals.length) return '<h1>Astrowaves</h1><p class="sub">Check the stars like you check the weather.</p><button class="btn p" onclick="go(D.edit)">Get started</button>';
  let h='<h1>This week</h1><p class="sub">Check the stars like you check the weather.</p><div class="pills">';
  D.goals.forEach(g=>{h+='<div class="pill"><div class="k"><span class="dot" style="background:'+g.col+'"></span>'+esc(g.label)+'</div><div class="n">'+g.done+' of '+g.target+'</div></div>'});
  h+='</div>';
  D.goals.forEach(g=>{ if(g.sideways) h+='<div class="best" style="border:1px dashed #3A4568;background:none"><span class="dot" style="background:'+g.col+'"></span> '+esc(g.sideways)+'</div>'; else if(g.best) h+='<div class="best"><span class="dot" style="background:'+g.col+'"></span> '+esc(g.best)+'</div>'; });
  const all=[];D.goals.forEach(g=>g.waves.forEach(w=>all.push({g,w})));all.sort((a,b)=>a.w.t-b.w.t);
  if(!all.length) return h+'<p class="sub">No standout waves this week.</p>';
  let last='';
  all.forEach(({g,w})=>{
    if(w.dk!==last){h+='<div class="day">'+esc(w.day)+'</div>';last=w.dk;}
    h+='<button class="row" onclick="openW(\\''+w.id+'\\')"><span class="dot" style="background:'+g.col+'"></span><span class="m"><span class="t">'+esc(w.time)+'</span><span class="s">'+esc(g.label)+(w.top?' · best':'')+(w.clash?' · clashes with '+esc(w.clash):'')+'</span></span><span class="wd" style="color:'+g.col+'">'+esc(w.word)+' '+w.glyph+'</span>'+(w.cal?cal:w.ping?bell:'<span class="ic"></span>')+'</button>';
  });
  return h;
}
function openW(id){
  let g,w;D.goals.forEach(G=>G.waves.forEach(W=>{if(W.id===id){g=G;w=W}}));if(!w)return;
  let h='<div class="grab"></div><div style="font-size:13px;font-weight:600;letter-spacing:.06em;color:'+g.col+'">'+esc(g.label.toUpperCase())+(w.top?' · BEST':'')+'</div>';
  h+='<div class="muted" style="margin-top:10px">'+esc(w.day)+'</div><div class="big">'+esc(w.time)+'</div>';
  if(w.word) h+='<div class="wd" style="font-size:26px;color:'+g.col+';margin-top:8px">'+esc(w.word)+' <span style="font-style:normal">'+w.glyph+'</span></div>';
  h+='<div style="color:var(--soft);margin-top:4px">'+esc(w.reason)+'</div>';
  if(w.clash) h+='<div class="clash" style="margin-top:6px">Clashes with '+esc(w.clash)+'</div>';
  h+=w.cal?'<button class="btn" disabled>On your calendar</button>':'<button class="btn p" onclick="go(\\'aw://x?a=cal&id='+encodeURIComponent(id)+'\\')">Put it on my calendar</button>';
  h+='<div class="two" style="margin-top:10px"><button class="btn" onclick="go(\\'aw://x?a=ping&id='+encodeURIComponent(id)+'\\')">'+(w.ping?'Pinging you':'Ping me')+'</button>';
  h+=w.started?'<button class="btn" onclick="go(\\'aw://x?a=done&want='+g.want+'&id='+encodeURIComponent(id)+'\\')">Done it</button>':'<button class="btn" disabled style="opacity:.45">Done it</button>';
  h+='</div><details><summary>The sky behind it</summary><p style="color:var(--soft);font-size:14px;line-height:1.6;margin:8px 0 0">'+esc([w.reason,w.why].filter(Boolean).join(' · '))+(w.warn?'<br><span class="warn">Watch for '+esc(w.warn)+'</span>':'')+'</p></details>';
  document.getElementById('panel').innerHTML=h;document.getElementById('sheet').classList.add('on');
}
document.getElementById('sheet').onclick=e=>{if(e.target.id==='sheet')e.target.classList.remove('on')};
function record(){
  let h='<h1>Your record</h1><p class="sub">Tap I did it when you do the thing, and we’ll note whether it landed on a wave over the last four weeks.</p>';
  D.goals.forEach(g=>{h+='<div class="card"><div style="display:flex;align-items:center;gap:8px;font-weight:600"><span class="dot" style="background:'+g.col+'"></span>'+esc(g.label)+'</div><div style="font-size:34px;font-weight:700;margin-top:8px">'+g.record.n+' <span style="font-size:15px;font-weight:400;color:var(--soft)">'+(g.record.n===1?'session':'sessions')+' · '+g.record.on+' on a wave</span></div><div class="two" style="margin-top:12px"><button class="btn p" onclick="go(\\'aw://x?a=done&want='+g.want+'\\')">I did it</button><button class="btn" onclick="go(\\'aw://x?a=undo&want='+g.want+'\\')">Undo last</button></div></div>'});
  return h+(D.goals.length?'':'<p class="sub">Pick something to track first.</p>');
}
function settings(){
  const M=[['best','The best ones'],['scheduled','Only what I put on my calendar'],['all','Every good wave']];
  let h='<h1>When we ping you</h1><p class="sub">You always see every good wave here. These decide what reaches your lock screen.</p>';
  D.goals.forEach(g=>{h+='<div class="day" style="color:'+g.col+'">'+esc(g.label)+' · '+esc(g.per)+'</div><div class="card" style="padding:4px 16px">';
    M.forEach(m=>{h+='<button class="opt" onclick="go(\\'aw://x?a=mode&want='+g.want+'&m='+m[0]+'\\')"><span class="radio'+(g.mode===m[0]?' on':'')+'" style="color:'+g.col+'"></span>'+m[1]+'</button>'});h+='</div>'});
  h+='<div class="card" style="padding:4px 16px"><button class="opt" onclick="go(\\'aw://x?a=morning\\')"><span class="radio'+(D.morning?' on':'')+'" style="color:#EEF2FA"></span><span>Morning summary<br><span class="muted" style="font-size:13px">Today\\u2019s waves when you wake up</span></span></button></div>';
  h+='<button class="btn" onclick="go(D.edit)">Change what you\\u2019re tracking</button><a class="link" href="'+D.sky+'">What\\u2019s up in the sky</a><p class="sub" style="text-align:center">Timed for '+esc(D.city)+'</p>';
  return h;
}
function draw(){document.getElementById('app').innerHTML=tab==='waves'?waves():tab==='record'?record():settings();['waves','record','settings'].forEach(t=>document.getElementById('t-'+t).classList.toggle('on',t===tab))}
['waves','record','settings'].forEach(t=>document.getElementById('t-'+t).onclick=()=>{tab=t;draw();window.scrollTo(0,0)});
draw();
</script></body></html>`;
}

// ---- Main ----
const Q = (typeof args !== 'undefined' && args.queryParameters) || {};
const inWidget = config.runsInWidget || config.runsInAccessoryWidget;
if (MODE !== 'now' || (args && String(args.widgetParameter || '').toLowerCase().trim() === 'sky')) {
  const R = getReading();                      // the old sky reading, kept behind Parameter "sky"
  Script.setWidget(buildWidget(R, config.widgetFamily || 'medium'));
} else if (Q.sky) {
  const R = getReading(); const wv = new WebView(); await wv.loadHTML(pageHTML(R)); await wv.present(true);
} else {
  if (!inWidget) {
    if (!ST.loc || Date.now() - ST.loc.at > 7 * 864e5) await refreshLocation();
    await refreshBusy();
  }
  const ui = inWidget || Q.preview || Q.classic ? null : await coastUI();
  if (!inWidget && !ui && (Q.edit || !ST.goals.length)) await editGoals();
  const plan = loadPlan(!config.runsInAccessoryWidget);
  if (plan) { try { await scheduleNotifications(plan); } catch (e) { console.log('notifications: ' + e); } }
  const wparam = args && String(args.widgetParameter || '').toLowerCase().trim();
  if (inWidget) Script.setWidget(wparam === 'now' ? nowWidget(config.widgetFamily || 'small') : planWidget(plan, config.widgetFamily || 'medium'));
  else if (Q.preview) await planWidget(plan, Q.preview).presentLarge();
  else if (ui) {
    const wv = new WebView();
    wv.shouldAllowRequest = req => {
      const u = req.url || '';
      if (u.indexOf('aw://') === 0) { hostAct(u).catch(e => console.log('action: ' + e)); return false; }
      return true;
    };
    await wv.loadHTML(ui, UI_BASE); await wv.present(true);
  } else {
    const wv = new WebView();
    wv.shouldAllowRequest = req => {
      const u = req.url || '';
      if (u.indexOf('aw://') === 0) { act(plan, u).then(() => wv.loadHTML(planHTML(plan))).catch(e => console.log('action: ' + e)); return false; }
      if (u.indexOf('scriptable:') === 0) { Safari.open(u); return false; }
      return true;
    };
    await wv.loadHTML(planHTML(plan)); await wv.present(true);
  }
}
Script.complete();
