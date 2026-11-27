// Headless Starswell reading: the same compute and slot rules as the prototype page, returned as plain data.
// Shared by the Scriptable widget and the compass.day page. Needs Sky, RB, DOC, RULES and Engine in scope.
var Starswell = (function () {
  function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
  function fmt(d, tz, o) { return d.toLocaleString('en-US', Object.assign({ timeZone: tz }, o)); }
  function clockIn(tz) { return function (d) { return fmt(d, tz, { hour: 'numeric', minute: '2-digit' }).replace(' AM', ' am').replace(' PM', ' pm'); }; }
  function ymd(d, tz) { return fmt(d, tz, { year: 'numeric', month: '2-digit', day: '2-digit' }); }
  function localHour(d, tz) { var m = ((d.getUTCHours() * 60 + d.getUTCMinutes() + Sky.offsetMin(d, tz)) % 1440 + 1440) % 1440; return m / 60; }
  function hash(s) { var h = 0; for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); }

  function reading(opts) {
    var now = opts.now || new Date(), lat = opts.lat, lon = opts.lon, tz = opts.tz, focus = opts.focus || 'day';
    var wake = opts.wake == null ? 6.5 : opts.wake, sleep = opts.sleep == null ? 22.5 : opts.sleep, log = opts.log || {};
    if (!RB.focuses[focus]) focus = 'day';
    var F = RB.focuses[focus], clock = clockIn(tz), today = ymd(now, tz);
    function awake(d) { var h = localHour(d, tz); return h >= wake && h < sleep; }
    function dayWord(d) { if (ymd(d, tz) === today) return ''; return ymd(d, tz) === ymd(new Date(+now + 864e5), tz) ? 'tomorrow ' : fmt(d, tz, { weekday: 'short' }) + ' '; }
    function when(d) { return dayWord(d) + clock(d); }

    var sky = Sky.scan(lat, lon, tz, now);
    // The lunar timeline is the slow part; reuse it for six hours when a cache is supplied.
    var tl = null, bucket = Math.floor(+now / (6 * 3600e3));
    function revive(x) {
      if (Array.isArray(x)) return x.map(revive);
      if (x && typeof x === 'object') { var o = {}; Object.keys(x).forEach(function (k) { var v = x[k]; o[k] = (k === 't' || k === 'start' || k === 'end') && typeof v === 'string' ? new Date(v) : revive(v); }); return o; }
      return x;
    }
    if (opts.cache) { try { var c = JSON.parse(opts.cache.read() || 'null'); if (c && c.bucket === bucket && c.lat === lat && c.lon === lon) tl = revive(c.tl); } catch (e) { tl = null; } }
    if (!tl) {
      tl = Sky.lunarTimeline(new Date(+now - 2.7 * 864e5), new Date(+now + 2.6 * 864e5));
      if (opts.cache) { try { opts.cache.write(JSON.stringify({ bucket: bucket, lat: lat, lon: lon, tl: tl })); } catch (e) {} }
    }
    var ctx = { clock: clock, dayClock: when, zangles: Engine.zodiacalAngles(sky, lat, lon), standing: Sky.skyAspects(now),
      timeline: tl, mercRx: Sky.mercuryRx(now) };
    var ms = sky.hours.filter(function (h) {
      var live = h.start <= now && h.end > now; return live || awake(new Date((+h.start + +h.end) / 2));
    }).map(function (h) {
      var live = h.start <= now && h.end > now, mid = new Date((+h.start + +h.end) / 2);
      var ev = Engine.evidence(h, mid, ctx);
      return { h: h, live: live, ev: ev, J: Engine.judge(ev), id: +h.start, clock: when };
    });
    function skipFor(m) { var s = {}; Object.keys(log).forEach(function (k) { if (log[k] === 'skip' && k.indexOf(today + '|' + m.id + '|') === 0) s[k.split('|')[2]] = 1; }); return s; }
    ms.forEach(function (m) {
      m.out = Engine.decide(m, focus, { skip: skipFor(m), rot: function (s) { return hash(today + s + m.id); } });
      m.guard = m.J.guards[0] || null;
      m.attend = m.J.attends[0] || null;
    });

    // Slots: now, the next different weather, and an edge (same rules as the page).
    var out = [], cur = ms.filter(function (m) { return m.live; })[0];
    function guardItem(m) {
      var run = ms.filter(function (x) { return x.guard && x.guard.guard.planet === m.guard.guard.planet && x.h.start >= m.h.start; });
      var end = m.h.end; run.forEach(function (x) { if (+x.h.start === +end) end = x.h.end; });
      return { kind: 'guard', m: m, planet: m.guard.guard.planet, until: end, ev: m.guard };
    }
    if (focus === 'edges') {
      var seen = {};
      ms.forEach(function (m) { if (m.guard && !seen[m.guard.guard.planet] && out.length < 2) { seen[m.guard.guard.planet] = 1; out.push(guardItem(m)); } });
      var at = ms.filter(function (m) { return m.attend; })[0];
      if (at) out.push({ kind: 'attend', m: at, planet: at.attend.attend.planet, ev: at.attend });
    } else {
      if (cur && cur.out) out.push({ kind: cur.out.kind, m: cur, o: cur.out });
      var firstCluster = out[0] ? out[0].o.cluster : null;
      var firstId = out[0] ? (out[0].o.act ? out[0].o.act.key : out[0].o.motif || out[0].o.cluster) : null;
      var oneCluster = F.motifs && F.motifs.every(function (k) { return RB.motifs[k].cluster === RB.motifs[F.motifs[0]].cluster; });
      var stEnd = out[0] && out[0].o.state ? +out[0].o.state.end : 0;
      var next = ms.filter(function (m) {
        if (m.live || !m.out) return false;
        if (stEnd && +m.h.start < stEnd) return false;
        if (m.out.cluster !== firstCluster) return true;
        var id = m.out.act ? m.out.act.key : m.out.motif || m.out.cluster;
        return oneCluster && id !== firstId;
      })[0];
      if (next) out.push({ kind: next.out.kind, m: next, o: next.out });
      if (F.kinds.indexOf('guard') >= 0) { var gm = ms.filter(function (m) { return m.guard; })[0]; if (gm) out.push(guardItem(gm)); }
      if (out.length < 3 && F.kinds.indexOf('attend') >= 0) { var am = ms.filter(function (m) { return m.attend; })[0]; if (am) out.push({ kind: 'attend', m: am, planet: am.attend.attend.planet, ev: am.attend }); }
      out = out.slice(0, 3);
    }

    // Plain items.
    var items = out.map(function (it) {
      var m = it.m, o = it.o, x = { kind: it.kind, live: m.live, start: m.h.start, end: m.h.end, hourPlanet: m.h.planet };
      if (it.kind === 'guard') {
        x.label = 'Edges'; x.planet = it.planet; x.end = it.until;
        x.headline = RB.weather.guards[it.planet];
        x.helps = cap(RB.weather.helps[it.planet] || DOC.roads[it.planet].work) + '.';
        x.when = cap((m.live ? 'Now' : when(m.h.start)) + ' until ' + (!m.live && dayWord(it.until) === dayWord(m.h.start) ? clock(it.until) : when(it.until)));
        x.receipts = [it.ev.title + ': ' + it.ev.fact];
      } else if (it.kind === 'attend') {
        x.label = 'Notice'; x.planet = it.planet;
        x.headline = RB.weather.attends[it.planet];
        x.when = m.live ? 'Now' : cap(when(m.h.start));
        x.receipts = [it.ev.title + ': ' + it.ev.fact];
      } else if (it.kind === 'state') {
        x.label = o.state.label; x.state = o.state.key;
        x.headline = o.state.headline;
        x.suits = o.state.sub.replace(/^Suits /, '');
        x.end = o.state.end;
        x.when = cap((m.live ? 'Now' : when(m.h.start)) + ' until ' + (!m.live && dayWord(o.state.end) === dayWord(m.h.start) ? clock(o.state.end) : when(o.state.end)));
        x.receipts = (o.receipts || []).map(function (e) { return e.title + ': ' + e.fact; });
      } else {
        x.label = 'The hour';
        x.headline = o.modeLine;
        x.suits = (o.suits || []).join(', ');
        x.motif = o.motif || o.cluster;
        x.evidence = o.coherence;
        x.state = o.state ? o.state.key : null;
        x.stateLine = o.state ? o.state.label + ' until ' + when(o.state.end) + '. ' + o.state.headline : null;
        x.graced = o.graced ? RB.graced[o.graced.perf.planet] : null;
        x.lean = o.lean ? (o.lean.caution ? 'Watch for ' : 'Lean into ') + o.lean.planet + ' in ' + o.lean.sign + ': ' + o.lean.text + '.' : null;
        x.when = m.live ? 'Now until ' + clock(m.h.end) : cap(when(m.h.start) + ' to ' + clock(m.h.end));
        x.receipts = (o.receipts || []).map(function (e) { return e.title + ': ' + e.fact; });
      }
      x.key = today + '|' + m.id + '|' + (it.kind === 'guard' ? 'guard-' + it.planet : it.kind === 'attend' ? 'attend-' + it.planet : it.kind === 'state' ? 'state-' + o.state.key : o.act ? 'act-' + o.act.key : (o.level === 'motif' ? o.motif : 'cluster-' + o.cluster));
      return x;
    });

    // The day line and the void tag.
    var ruler = sky.dayRuler, moon = sky.moon, tl = ctx.timeline;
    var vNow = tl.voids.filter(function (v) { return v.start <= now && v.end > now; })[0];
    var vNext = tl.voids.filter(function (v) { return v.start > now && +v.start < +now + 18 * 3600e3; })[0];
    var voidTag = vNow ? 'void until ' + when(vNow.end) : vNext ? 'void ' + (dayWord(vNext.start) ? 'tmrw ' : '') + clock(vNext.start) : '';
    var dayLine = ruler + '’s day · Moon in ' + moon.sign + (voidTag ? ' · ' + voidTag : '');

    // Events ahead for notifications: voids, edges, generous windows, heavy and hazy stretches.
    var horizon = +now + 36 * 3600e3, events = [];
    tl.voids.forEach(function (v) {
      if (+v.start > +now && +v.start < horizon) {
        var w = RB.weather.voids[v.sign];
        events.push({ id: 'void-' + +v.start, at: v.start, title: 'The Moon goes void at ' + clock(v.start), body: w.w + ' Until ' + when(v.end) + '. Suits ' + w.s + '.' });
      }
    });
    tl.perfections.forEach(function (p) {
      if (+p.t <= +now || +p.t > horizon) return;
      var hard = /conj|square|oppo/.test(p.aspect);
      if ((p.planet === 'Saturn' || p.planet === 'Neptune') && hard) {
        var W = p.planet === 'Saturn' ? RB.weather.quiet : RB.weather.fog, st = new Date(+p.t - 3 * 3600e3);
        if (+st > +now) events.push({ id: p.planet + '-' + +p.t, at: st, title: (p.planet === 'Saturn' ? 'A heavier stretch until ' : 'A hazy stretch until ') + clock(new Date(+p.t + 3 * 3600e3)), body: W.w + ' Suits ' + W.s + '.' });
      }
      if ((p.planet === 'Jupiter' || p.planet === 'Venus') && (p.aspect === 'conjunction' || p.aspect === 'trine' || p.aspect === 'sextile')) {
        var inVoid = tl.voids.some(function (v) { return p.t >= v.start && p.t < v.end; });
        if (!inVoid) events.push({ id: p.planet + '-' + +p.t, at: new Date(+p.t - 2 * 3600e3), title: 'Opens wide around ' + clock(p.t), body: RB.graced[p.planet] });
      }
    });
    var seenG = {};
    ms.forEach(function (m) {
      if (!m.guard || m.live || seenG[m.guard.guard.planet]) return;
      var prev = ms.filter(function (x) { return +x.h.end === +m.h.start; })[0];
      if (prev && prev.guard && prev.guard.guard.planet === m.guard.guard.planet) return;
      seenG[m.guard.guard.planet] = 1;
      var gi = guardItem(m);
      events.push({ id: 'edge-' + gi.planet + '-' + m.id, at: m.h.start, title: RB.weather.guards[gi.planet].replace(/\.$/, '') + ', until ' + clock(gi.until), body: 'What helps: ' + (RB.weather.helps[gi.planet] || DOC.roads[gi.planet].work) + '.' });
    });
    // An edge from Saturn or Neptune that sits inside its own heavy or hazy stretch is the same news twice.
    events = events.filter(function (e) {
      var m = /^edge-(Saturn|Neptune)-/.exec(e.id); if (!m) return true;
      return !events.some(function (x) { return x.id.indexOf(m[1] + '-') === 0 && Math.abs(x.at - e.at) <= 6 * 3600e3; });
    });
    events = events.filter(function (e) { return awake(e.at); }).sort(function (a, b) { return a.at - b.at; });

    var hours = ms.filter(function (m) { return +m.h.end > +now; }).map(function (m) {
      var o = m.out;
      return { start: m.h.start, planet: m.h.planet, clock: when(m.h.start), live: m.live,
        line: o ? (o.kind === 'state' ? o.state.headline : o.modeLine) : 'Nothing much moving',
        evidence: o && o.coherence ? o.coherence : 0, state: o && o.state ? o.state.key : (m.ev.states.void ? 'void' : ''), guard: m.guard ? m.guard.guard.planet : null };
    });

    return { now: now, tz: tz, focus: focus, focusName: F.name, ruler: ruler, moon: { sign: moon.sign, phase: moon.name },
      dayLine: dayLine, voidNow: vNow ? { sign: vNow.sign, end: vNow.end, w: RB.weather.voids[vNow.sign].w } : null,
      voidNext: vNext ? { sign: vNext.sign, start: vNext.start, end: vNext.end } : null,
      items: items, events: events, hours: hours, clock: clock, when: when,
      find: function (key) {
        var r = Engine.findTimes(ms.filter(function (m) { return +m.h.end > +now; }), key);
        r.windows.forEach(function (w) { w.when = (+w.start <= +now ? 'Now' : cap(when(w.start))) + ' to ' + clock(w.end); });
        return r;
      },
      quiet: items.length === 0 ? 'Nothing much moving; your day, your call.' : null };
  }
  return { reading: reading };
})();
if (typeof module !== 'undefined') module.exports = Starswell;
