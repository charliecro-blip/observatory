// Starswell for Scriptable. Widget, lock screen and notifications, computed on the phone.
// Settings: change these and save.
const SETTINGS = {
  city: 'Austin', lat: 30.2672, lon: -97.7431, tz: 'America/Chicago',
  focus: 'day',          // day | move | rest | still | edges
  wake: 6.5, sleep: 22.5, // waking hours, as decimal hours
  notify: true,          // void, edge, heavy, hazy and generous stretches; never more than three a day
  web: 'https://compass.day/today'
};

/*CORE*/

// Lock screen tiles: type one of these in Parameter for a tile that shows the best time today.
const LOCK_ACTS = { workout: 'train-hard', run: 'endurance', walk: 'gentle-movement', yoga: 'gentle-movement', work: 'deep-work', write: 'first-draft', errands: 'admin-errands', talk: 'hard-conversation', date: 'first-date', cook: 'cook', nap: 'deep-rest', meditate: 'meditate', launch: 'launch-venture', sign: 'sign-contract', post: 'publish' };
let MODE = 'now';
// Per-widget focus: long-press the widget, Edit Widget, and type a focus in Parameter
// (day, move, rest, still or edges; "nourish" and "stillness" work too). Blank uses SETTINGS.focus.
(function () {
  const p = String((typeof args !== 'undefined' && args.widgetParameter) || '').toLowerCase().trim();
  const alias = { nourish: 'rest', 'nourish & rest': 'rest', stillness: 'still', 'whole day': 'day', edge: 'edges' };
  const k = alias[p] || p;
  if (k && RB.focuses[k]) SETTINGS.focus = k;
  if (k === 'next' || LOCK_ACTS[k]) MODE = k;
})();

const C = { night: new Color('#141A33'), swell: new Color('#26406B'), foam: new Color('#A9C3CF'), brass: new Color('#C9A35B'), star: new Color('#F1E8D6'), dim: new Color('#D9CFBE'), ember: new Color('#E3B9A0') };
const serif = s => new Font('Georgia', s), serifB = s => new Font('Georgia-Bold', s);
const GL = { Sun: '☉', Moon: '☽', Mercury: '☿', Venus: '♀', Mars: '♂', Jupiter: '♃', Saturn: '♄', Uranus: '♅', Neptune: '♆', Pluto: '♇' };

function cacheIO() {
  const fm = FileManager.local(), p = fm.joinPath(fm.documentsDirectory(), 'starswell-timeline.json');
  return { read: () => fm.fileExists(p) ? fm.readString(p) : null, write: s => fm.writeString(p, s) };
}

function getReading() {
  return Starswell.reading({ now: new Date(), lat: SETTINGS.lat, lon: SETTINGS.lon, tz: SETTINGS.tz, focus: SETTINGS.focus, wake: SETTINGS.wake, sleep: SETTINGS.sleep, cache: cacheIO() });
}

function txt(stack, s, font, color, lines) { const t = stack.addText(s); t.font = font; t.textColor = color; if (lines) t.lineLimit = lines; t.minimumScaleFactor = 0.8; return t; }
function dayKey(d) { return new Date(d).toLocaleDateString('en-US', { timeZone: SETTINGS.tz }); }
function stamp(R, d) { return (dayKey(d) === dayKey(Date.now()) ? '' : 'Tmrw ') + R.clock(d); }
function short(item, R) {
  if (!item) return '';
  if (item.kind === 'guard') return 'Edges ' + (item.live ? 'now' : stamp(R, item.start));
  return item.live ? 'now' : stamp(R, item.start);
}
function bestTime(R, key, ws) {
  ws = ws || R.find(key).windows; const today = ws.filter(w => !/^tomorrow/i.test(w.when));
  return (today.length ? today : ws).slice().sort((x, y) => y.score - x.score)[0] || null;
}
const tight = s => s.replace(/ (am|pm)/g, '$1');

function nextRefresh(R) {
  const now = Date.now(), cands = [now + 30 * 60000];
  R.hours.forEach(h => { if (+h.start > now) cands.push(+h.start + 60000); });
  R.events.forEach(e => { if (+e.at > now) cands.push(+e.at + 60000); });
  if (R.voidNow) cands.push(+R.voidNow.end + 60000);
  return new Date(Math.min.apply(null, cands));
}

const ASP = { opposition: 'opposite', conjunction: 'with', square: 'square', trine: 'trine', sextile: 'sextile' };
function causes(it) {
  return (it && it.receipts || []).map(x => x.split(':')[0]).filter(h => !/^Moon in |hour$/.test(h))
    .map(h => h.replace(/\b(opposition|conjunction|square|trine|sextile)\b/, m => ASP[m]));
}
const cause = (it, n) => causes(it).slice(0, n || 1).join(' and ');
// Name the planetary hour only when the hour is part of the evidence for this line.
// Name the hour in a label only when nothing stronger explains the line.
const hourOf = it => it && it.hourPlanet && !causes(it).length && (it.receipts || []).some(r => r.indexOf(it.hourPlanet + ' hour') === 0) ? it.hourPlanet + ' hour' : '';
const PL = /Sun|Moon|Mercury|Venus|Mars|Jupiter|Saturn|Uranus|Neptune|Pluto/g;
// Two reasons only when they share a planet, so the pair reads as one story.
const whyShort = w => { const r = w.why.filter(x => !/Moon in |waxing|waning|void/.test(x)).map(x => x.replace(/^an? /, '')); if (!r.length) return ''; const p1 = (r[0].match(PL) || []).filter(p => p !== 'Moon'); const two = r.slice(1).find(x => (x.match(PL) || []).some(p => p1.indexOf(p) >= 0)); return two ? r[0] + ', ' + two : r[0]; };
const suitsOf = it => it.suits ? 'Suits ' + it.suits : it.helps ? 'What helps: ' + it.helps.charAt(0).toLowerCase() + it.helps.slice(1) : '';
const capf = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
function todayBest(R, key) {
  const ws = R.find(key).windows, t = ws.filter(w => !/^tomorrow/i.test(w.when));
  return { today: t.slice().sort((x, y) => y.score - x.score)[0] || null, later: ws.find(w => /^tomorrow/i.test(w.when)) || null };
}

function buildWidget(R, family) {
  const w = new ListWidget();
  w.url = 'scriptable:///run/' + encodeURIComponent(Script.name());
  w.refreshAfterDate = nextRefresh(R);
  const now = R.items.find(i => i.live && i.kind !== 'attend' && i.kind !== 'guard') || R.items.find(i => i.live);
  const watch = R.items.find(i => i.live && i !== now && (i.kind === 'attend' || i.kind === 'guard'));
  const next = R.items.find(i => !i.live && i.kind !== 'guard' && i.kind !== 'attend');
  const edge = R.items.find(i => !i.live && i.kind === 'guard');
  const dayCtx = R.dayLine;                                   // "Mars's day · Moon in Sagittarius": true all day
  const nowCtx = now ? ['Now', hourOf(now), now.end ? 'until ' + R.clock(now.end) : ''].filter(Boolean).join(' · ') : 'Now';

  if (family === 'accessoryInline') { w.addText((R.voidNow ? '☽ void · ' : '') + (now ? now.headline.replace(/\.$/, '') : 'A quiet stretch')); return w; }
  if (family === 'accessoryCircular') {
    const s = w.addStack(); s.layoutVertically(); s.centerAlignContent();
    txt(s, R.voidNow ? '☽○' : '☽', Font.systemFont(16), Color.white()); txt(s, R.moon.sign.slice(0, 3), Font.boldSystemFont(11), Color.white());
    return w;
  }
  if (family === 'accessoryRectangular') {
    const W = Color.white(), hd = s => txt(w, s.toUpperCase(), Font.boldSystemFont(10), W, 1);
    const body = (s, n) => txt(w, s, Font.systemFont(12.5), W, n), foot = s => txt(w, s, Font.systemFont(10.5), W, 1);
    const act = LOCK_ACTS[MODE];
    if (act) {
      const b = todayBest(R, act);
      hd(MODE + ' · rest of today');
      if (!b.today) { body('No clear window left today.', 1); if (b.later) foot('Tmrw ' + tight(b.later.when.replace(/^Tomorrow /, ''))); return w; }
      body(tight(b.today.when) + ' · ' + b.today.strength, 1);
      foot(capf(whyShort(b.today)));
      if (b.later) foot('Tmrw ' + tight(b.later.when.replace(/^Tomorrow /, '')));
      return w;
    }
    const it = MODE === 'next' ? next : now;
    if (!it) { hd(R.moon.sign + ' Moon'); body(R.quiet, 3); return w; }
    hd((MODE === 'next' ? [stamp(R, it.start), hourOf(it)] : ['Now until ' + R.clock(it.end), hourOf(it)]).filter(Boolean).join(' · '));
    body(it.headline, 2);
    if (cause(it)) foot(cause(it));
    if (MODE !== 'next' && next) foot('Then ' + stamp(R, next.start) + ' · ' + next.headline.replace(/\.$/, ''));
    return w;
  }

  w.backgroundColor = R.voidNow ? C.swell : C.night;
  w.setPadding(14, 16, 14, 16);
  const lab = (st, s, col) => txt(st, s.toUpperCase(), Font.semiboldSystemFont(9.5), col || C.brass, 1);

  if (family === 'small') {
    lab(w, R.voidNow ? 'Void Moon · until ' + R.clock(R.voidNow.end) : now ? ['Til ' + R.clock(now.end), hourOf(now)].filter(Boolean).join(' · ') : R.moon.sign + ' Moon', C.foam);
    w.addSpacer();
    txt(w, R.voidNow ? R.voidNow.w : (now ? now.headline : R.quiet), serif(15), C.star, 5);
    w.addSpacer();
    txt(w, now && cause(now) ? cause(now) : dayCtx, Font.systemFont(10), C.dim, 2);
    return w;
  }

  // 1. The day: what holds from morning to night.
  const head = w.addStack(); head.centerAlignContent();
  lab(head, dayCtx, C.foam); head.addSpacer(); lab(head, SETTINGS.city, C.foam);
  if (R.voidNow) { w.addSpacer(2); txt(w, 'Void Moon until ' + R.when(R.voidNow.end), Font.systemFont(10.5), C.foam, 1); }
  w.addSpacer(family === 'large' ? 10 : 6);

  // 2. Now: this planetary hour, and what in the sky is making it feel this way.
  lab(w, nowCtx);
  w.addSpacer(2);
  if (now) {
    txt(w, now.headline, serif(family === 'large' ? 19 : 16), C.star, 2);
    const because = cause(now), suits = suitsOf(now);
    if (family === 'large') {
      if (because) { w.addSpacer(2); txt(w, 'From ' + because, Font.systemFont(10.5), C.foam, 1); }
      if (suits) { w.addSpacer(1); txt(w, suits, Font.systemFont(11), C.dim, 2); }
      if (watch) { w.addSpacer(3); txt(w, (watch.kind === 'guard' ? 'Edges too: ' : 'Also: ') + watch.headline.charAt(0).toLowerCase() + watch.headline.slice(1), Font.systemFont(11), C.ember, 1); }
    } else if (because || suits) { w.addSpacer(2); txt(w, because ? 'From ' + because : suits, Font.systemFont(11), C.dim, 1); }
  } else txt(w, R.quiet, serif(16), C.star, 2);

  w.addSpacer();
  // 3. Next: the following hour, with its own time and cause.
  const row = (it, tag, col) => {
    const r = w.addStack(); r.layoutVertically();
    lab(r, [tag + ' ' + stamp(R, it.start), hourOf(it)].filter(Boolean).join(' · '), col);
    txt(r, it.headline, serif(13.5), C.star, 1);
    if (family === 'large' && cause(it)) txt(r, 'From ' + cause(it), Font.systemFont(10.5), C.foam, 1);
  };
  if (next) row(next, 'Next', C.brass);
  if (edge && family === 'large') { w.addSpacer(6); row(edge, 'Edges', C.ember); }

  // 4. Best times: only windows still ahead today, each with the reason.
  if (family === 'large') {
    w.addSpacer(10);
    lab(w, 'Best times, rest of today', C.foam);
    w.addSpacer(3);
    [['Workout', 'train-hard'], ['Focus', 'deep-work'], ['People', 'call-family'], ['Wind down', 'deep-rest']].forEach(([name, key]) => {
      const b = todayBest(R, key), r = w.addStack(); r.centerAlignContent();
      const n = txt(r, name, Font.semiboldSystemFont(11), C.brass, 1); r.addSpacer(8);
      if (b.today) { txt(r, tight(b.today.when), Font.systemFont(11.5), C.star, 1); r.addSpacer(); txt(r, whyShort(b.today), Font.systemFont(10), C.foam, 1); }
      else { txt(r, 'none left today', Font.systemFont(11.5), C.dim, 1); r.addSpacer(); if (b.later) txt(r, 'tmrw ' + tight(b.later.when.replace(/^Tomorrow /, '')), Font.systemFont(10), C.foam, 1); }
      w.addSpacer(2);
    });
  }
  return w;
}

async function scheduleNotifications(R) {
  if (!SETTINGS.notify) return;
  const pending = await Notification.allPending();
  const ours = pending.filter(n => n.identifier.indexOf('starswell-') === 0);
  const day = d => d.toLocaleDateString('en-US', { timeZone: SETTINGS.tz });
  const counts = {};
  const keep = R.events.filter(e => { const k = day(e.at); counts[k] = (counts[k] || 0) + 1; return counts[k] <= 3; });
  const ids = keep.map(e => 'starswell-' + e.id);
  const stale = ours.filter(n => ids.indexOf(n.identifier) < 0).map(n => n.identifier);
  if (stale.length) Notification.removePending(stale);
  for (const e of keep) {
    const at = new Date(+e.at - 10 * 60000);
    if (+at <= Date.now()) continue;
    const n = new Notification();
    n.identifier = 'starswell-' + e.id; n.threadIdentifier = 'starswell';
    n.title = e.title; n.body = e.body; n.openURL = 'scriptable:///run/' + encodeURIComponent(Script.name());
    n.setTriggerDate(at);
    await n.schedule();
  }
}

function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;'); }
const FIND_KEYS = ['train-hard', 'endurance', 'gentle-movement', 'deep-work', 'first-draft', 'edit-revise', 'admin-errands', 'hard-conversation', 'first-date', 'romantic-time', 'call-family', 'cook', 'deep-rest', 'meditate', 'publish', 'launch-venture', 'sign-contract'];
function findHTML(R) {
  const opts = FIND_KEYS.map(k => { const f = R.find(k); return { k, name: f.name, html: f.windows.length ? f.windows.map(w => '<li><b>' + esc(w.when) + '</b> <span class="st">' + w.strength + '</span><br>' + (w.line ? '<span class="q">' + esc(w.line) + '</span><br>' : '') + '<span class="why">Why: ' + esc(w.why.join(', ')) + '.' + (w.warn.length ? ' Watch for ' + esc(w.warn.join(', ')) + '.' : '') + '</span></li>').join('') : '<li>' + esc(f.none) + '</li>' }; });
  return '<h3>Find a time for</h3><select id="fa" onchange="document.querySelectorAll(\'.fr\').forEach(e=>e.hidden=e.dataset.k!==this.value)">' + opts.map(o => '<option value="' + o.k + '">' + esc(o.name.charAt(0).toUpperCase() + o.name.slice(1)) + '</option>').join('') + '</select>' +
    opts.map((o, i) => '<ul class="fr" data-k="' + o.k + '"' + (i ? ' hidden' : '') + '>' + o.html + '</ul>').join('');
}
function pageHTML(R) {
  const card = it => '<section class="card ' + it.kind + '"><div class="k">' + esc(it.label) + ' <span>' + esc(it.when) + '</span></div>' +
    (it.stateLine ? '<p class="band">' + esc(it.stateLine) + '</p>' : '') + (it.graced ? '<p class="band g">' + esc(it.graced) + '</p>' : '') +
    '<h2>' + esc(it.headline) + '</h2>' + (it.suits ? '<p><b>Suits</b> ' + esc(it.suits) + '.</p>' : '') + (it.helps ? '<p><b>What helps</b> ' + esc(it.helps) + '</p>' : '') +
    (it.lean ? '<p class="q">' + esc(it.lean) + '</p>' : '') +
    (it.receipts && it.receipts.length ? '<details><summary>Receipts' + (it.evidence ? ', ' + it.evidence + ' kinds of evidence' : '') + '</summary><ul>' + it.receipts.map(r => '<li>' + esc(r) + '</li>').join('') + '</ul></details>' : '') + '</section>';
  const hours = R.hours.map(h => '<tr class="' + (h.live ? 'now ' : '') + (h.state || '') + (h.guard ? ' edge' : '') + '"><td>' + esc(h.clock) + '</td><td>' + (GL[h.planet] || '') + '</td><td>' + esc(h.line) + '</td></tr>').join('');
  const ev = R.events.map(e => '<li><b>' + esc(+e.at <= Date.now() ? 'now' : R.when(e.at)) + '</b> ' + esc(e.title) + '</li>').join('');
  return '<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>' +
    'body{margin:0;background:#141A33;color:#F1E8D6;font:16px/1.45 -apple-system,system-ui;padding:20px 16px 40px}h1{font:600 26px Georgia,serif;margin:0 0 4px}.day{color:#D9CFBE;font-size:14px;margin:0 0 18px}' +
    '.card{background:#1C2547;border-radius:16px;padding:14px 16px;margin:0 0 12px}.card.guard{background:#2A1E28}.k{font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#C9A35B;font-weight:600}.guard .k{color:#E3B9A0}.k span{color:#A9C3CF;letter-spacing:0;text-transform:none;font-weight:400;margin-left:6px}' +
    'h2{font:400 21px/1.2 Georgia,serif;margin:6px 0 8px}p{margin:4px 0;color:#D9CFBE;font-size:14.5px}b{color:#C9A35B;font-weight:600}.band{font-size:13px;color:#A9C3CF}.q{font-style:italic}details{margin-top:8px;font-size:13px;color:#A9C3CF}ul{padding-left:18px;margin:6px 0}' +
    'h3{font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:#A9C3CF;margin:22px 0 8px}table{width:100%;border-collapse:collapse;font-size:13.5px}td{padding:7px 4px;border-top:1px solid #2C3558;vertical-align:top}td:first-child{white-space:nowrap;color:#A9C3CF}tr.now td{color:#F1E8D6;font-weight:600}tr.void td:first-child{border-left:3px solid #A9C3CF}tr.edge td:first-child{border-left:3px solid #E3B9A0}a{color:#C9A35B}select{font:inherit;font-size:16px;padding:10px;border-radius:10px;background:#1C2547;color:#F1E8D6;border:1px solid #2C3558;width:100%}.fr{list-style:none;padding:0}.fr li{border-top:1px solid #2C3558;padding:10px 0;font-size:14.5px}.fr .st{font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#C9A35B}.fr .why{color:#A9C3CF;font-size:13px}[hidden]{display:none}' +
    '</style><h1>Starswell</h1><p class="day">' + esc(R.dayLine) + ' · ' + esc(SETTINGS.city) + '</p>' +
    (R.items.length ? R.items.map(card).join('') : '<section class="card"><h2>' + esc(R.quiet) + '</h2></section>') +
    (ev ? '<h3>Coming up</h3><ul>' + ev + '</ul>' : '') + findHTML(R) + '<h3>Hour by hour</h3><table>' + hours + '</table>' +
    '<p style="margin-top:20px"><a href="' + SETTINGS.web + '">Open the full day on the web</a></p>';
}

const R = getReading();
try { if (!(args && args.widgetParameter)) await scheduleNotifications(R); } catch (e) { console.log('notifications: ' + e); }
if (config.runsInWidget || config.runsInAccessoryWidget) {
  Script.setWidget(buildWidget(R, config.widgetFamily || 'medium'));
} else if (args.queryParameters && args.queryParameters.preview) {
  await buildWidget(R, args.queryParameters.preview).presentMedium();
} else {
  const wv = new WebView(); await wv.loadHTML(pageHTML(R)); await wv.present(true);
}
Script.complete();
