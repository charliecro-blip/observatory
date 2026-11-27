// Starswell plan: the person names one or two things they want to make room for, and how often
// (per day, week or month). We score every waking hour over the next eight days for each one and
// pick the windows to remind them about. No weather lines, no poems: a time, and one reason if asked.
var StarswellPlan = (function () {
  var DAY = 864e5, HORIZON = 8;
  // name: shown in lists. short: in notifications. dfor: "a good day for ___".
  var GOALS = {
    meditate:  { act: 'meditate',          name: 'Meditation / quiet time', short: 'Meditation', dfor: 'meditation', lead: 10, dur: 20 },
    move:      { act: 'train-hard',        name: 'Move / exercise',  short: 'Movement',   dfor: 'moving', lead: 45, dur: 60 },
    walk:      { act: 'gentle-movement',   name: 'Walk or yoga',     short: 'Walk or yoga', dfor: 'a walk or yoga', lead: 20, dur: 40 },
    run:       { act: 'endurance',         name: 'Long run or ride', short: 'Long session', dfor: 'going long', lead: 45, dur: 90 },
    focus:     { act: 'deep-work',         name: 'Deep work',        short: 'Deep work',  dfor: 'deep work', lead: 15, dur: 120 },
    write:     { act: 'first-draft',       name: 'Writing',          short: 'Writing',    dfor: 'writing', lead: 15, dur: 90 },
    create:    { act: 'creative-practice', name: 'Making art',       short: 'Making art', dfor: 'making art', lead: 20, dur: 120 },
    admin:     { act: 'admin-errands',     name: 'Admin and errands', short: 'Admin',     dfor: 'admin and errands', lead: 10, dur: 60 },
    connect:   { act: 'call-family',       name: 'Calling someone',  short: 'Calling someone', dfor: 'calling someone', lead: 10, dur: 30 },
    partner:   { act: 'romantic-time',     name: 'Romance',          short: 'Romance',    dfor: 'romance', lead: 60, dur: 120 },
    rest:      { act: 'deep-rest',         name: 'Downtime',         short: 'Downtime',   dfor: 'downtime', lead: 10, dur: 60 },
    journal:   { act: 'journal',           name: 'Journaling',       short: 'Journaling', dfor: 'journaling', lead: 10, dur: 20 },
    cook:      { act: 'cook',              name: 'Cooking',          short: 'Cooking',    dfor: 'cooking', lead: 30, dur: 60 }
  };
  function ymd(d, tz) { return d.toLocaleDateString('en-US', { timeZone: tz }); }
  // Waking hours may cross midnight (sleep 25.5 = 1:30 am). Compass's waking.ts rule: take a night owl at their word.
  function awake(lh, wake, sleep) { return sleep > 24 ? (lh >= wake || lh < sleep - 24) : (lh >= wake && lh < sleep); }
  // Compass's approach.ts rule: the last two hours before sleep are wind-down, whatever the planet says.
  // Nothing high-arousal or newly begun lands there.
  var WIND = { move: 1, run: 1, focus: 1, admin: 1 };
  function windDown(lh, sleep) { var left = (((sleep - lh) % 24) + 24) % 24; return left > 0 && left <= 2; }
  function localHour(d, tz) { var m = ((d.getUTCHours() * 60 + d.getUTCMinutes() + Sky.offsetMin(d, tz)) % 1440 + 1440) % 1440; return m / 60; }

  // Waking hours with their evidence, for HORIZON days. Scans overlap; keep each hour once.
  function moments(o, cache) {
    var now = o.now, tz = o.tz, wake = o.wake == null ? 6.5 : o.wake, sleep = o.sleep == null ? 22.5 : o.sleep;
    var tl = null, bucket = Math.floor(+now / (6 * 3600e3));
    if (cache) { try { var c = JSON.parse(cache.read() || 'null'); if (c && c.bucket === bucket && c.lat === o.lat && c.lon === o.lon) tl = c.tl; } catch (e) {} }
    var revive = function (x) { if (Array.isArray(x)) return x.map(revive); if (x && typeof x === 'object') { var r = {}; Object.keys(x).forEach(function (k) { var v = x[k]; r[k] = (k === 't' || k === 'start' || k === 'end') && typeof v === 'string' ? new Date(v) : revive(v); }); return r; } return x; };
    if (tl) tl = revive(tl); else {
      tl = Sky.lunarTimeline(new Date(+now - 2.7 * DAY), new Date(+now + (HORIZON + 0.5) * DAY), 60);  // hour-level planning: a 60-minute step is plenty
      if (cache) { try { cache.write(JSON.stringify({ bucket: bucket, lat: o.lat, lon: o.lon, tl: tl })); } catch (e) {} }
    }
    var seen = {}, out = [], end = +now + HORIZON * DAY, scansKept = [];
    for (var k = 0; k < HORIZON; k += 2) {
      var at = new Date(+now + k * DAY), sky = Sky.scan(o.lat, o.lon, tz, at); scansKept.push(sky);
      var ctx = { clock: String, dayClock: String, zangles: sky.angles.map(function (a) { return { planet: a.planet, kind: a.kind, at: a.start, sky: a.start, approx: true }; }), standing: Sky.skyAspects(at), timeline: tl, mercRx: Sky.mercuryRx(at) };
      sky.hours.forEach(function (h) {
        if (seen[+h.start] || +h.end <= +now || +h.start > end) return;
        var mid = new Date((+h.start + +h.end) / 2), lh = localHour(mid, tz);
        if (!awake(lh, wake, sleep)) return;
        seen[+h.start] = 1;
        out.push({ h: h, ev: Engine.evidence(h, mid, ctx), out: null });
      });
    }
    out.sort(function (a, b) { return a.h.start - b.h.start; });
    out.tl = tl; out.scans = scansKept;
    return out;
  }

  // How many reminders fit in the next 8 days for "N per day / week / month".
  function quota(g) { var n = Math.max(1, g.times || 1); return g.per === 'day' ? n * HORIZON : g.per === 'month' ? Math.max(1, Math.round(n * HORIZON / 30)) : Math.max(1, Math.round(n * HORIZON / 7)); }

  // One word per planet, for people who want almost no language. The astrology is one tap away.
  var WORD = { Sun: 'Brighten', Moon: 'Feel', Mercury: 'Think', Venus: 'Enjoy', Mars: 'Push', Jupiter: 'Expand', Saturn: 'Focus', Uranus: 'Spark', Neptune: 'Dream', Pluto: 'Deepen' };
  var ANGLE = { rise: { w: 3, say: 'rising' }, mc: { w: 3, say: 'on the MC' }, set: { w: 2.2, say: 'setting' }, ic: { w: 2, say: 'on the IC' } };
  // The planet gives the quality, the angle gives it a direction. Rising: the body, beginning.
  // MC: work in the world, being seen. Setting: meeting someone. IC: home, roots, rest.
  // A draft for Charlie to correct: multipliers on the crossing's weight, per intention.
  var ANGLE_MEANS = { rise: 'the body, beginning', mc: 'work in the world, being seen', set: 'meeting someone', ic: 'home, roots, rest' };
  var FIT = {
    meditate: { rise: 1.0, mc: 0.8, set: 0.9, ic: 1.3 }, move: { rise: 1.25, mc: 1.0, set: 0.8, ic: 0.7 },
    walk: { rise: 1.15, mc: 0.9, set: 1.0, ic: 0.9 }, run: { rise: 1.2, mc: 1.1, set: 0.8, ic: 0.7 },
    focus: { rise: 1.0, mc: 1.3, set: 0.8, ic: 0.8 }, write: { rise: 1.15, mc: 1.15, set: 0.8, ic: 1.0 },
    create: { rise: 1.2, mc: 1.1, set: 0.9, ic: 1.0 }, admin: { rise: 0.9, mc: 1.25, set: 0.9, ic: 0.9 },
    connect: { rise: 0.9, mc: 1.0, set: 1.3, ic: 1.0 }, partner: { rise: 0.9, mc: 0.7, set: 1.35, ic: 1.1 },
    rest: { rise: 0.8, mc: 0.7, set: 1.0, ic: 1.35 }, journal: { rise: 1.0, mc: 0.8, set: 0.9, ic: 1.2 },
    cook: { rise: 0.9, mc: 0.8, set: 1.1, ic: 1.3 }
  };
  function wantOf(act) { var k = Object.keys(GOALS).filter(function (x) { return GOALS[x].act === act; })[0]; return k; }
  var SOFT = { trine: 1, sextile: 1 }, HARD = { square: 1, opposition: 1 };
  var ACTS = {}; RULES.acts.forEach(function (x) { ACTS[x.key] = x; });

  // Crossings first: a planet the activity needs, crossing an angle, is the sharpest marker of a
  // short stretch of time. Lunar aspects, the planetary hour and the rising sign then rank them.
  function crossings(o, act, scans, tl) {
    var A = ACTS[act], P = A.planets || {}, out = [], seen = {}, wake = o.wake == null ? 6.5 : o.wake, sleep = o.sleep == null ? 22.5 : o.sleep;
    scans.forEach(function (sky) {
      sky.angles.forEach(function (an) {
        if (!P[an.planet] || !ANGLE[an.kind]) return;
        var t = Sky.zodiacal(an.planet, an.kind, an.start, o.lat, o.lon) || an.start, id = an.planet + an.kind + Math.round(+t / 6e5);
        if (seen[id] || +t < +o.now + 10 * 60000 || +t > +o.now + HORIZON * DAY) return; seen[id] = 1;
        var lh = localHour(t, o.tz); if (!awake(lh, wake, sleep - 0.25)) return;
        if (WIND[wantOf(act)] && windDown(lh, sleep)) return;
        var fit = (FIT[wantOf(act)] || {})[an.kind] || 1;
        var why = [an.planet + ' ' + ANGLE[an.kind].say], score = P[an.planet] * ANGLE[an.kind].w * fit, warn = [];
        // Lunar aspects to the activity's planets within two hours.
        tl.perfections.forEach(function (p) {
          if (!P[p.planet] || Math.abs(p.t - t) > 2 * 3600e3) return;
          var fit = p.aspect === 'conjunction' ? 1 : SOFT[p.aspect] ? (A.aspects === 'effort' ? 0.6 : 1.5) : HARD[p.aspect] ? (A.aspects === 'effort' ? 1.4 : -1) : 0;
          if (!fit) return; score += fit * P[p.planet];
          (fit > 0 ? why : warn).push('Moon ' + ({ conjunction: 'conjunct', opposition: 'opposite' }[p.aspect] || p.aspect) + ' ' + p.planet);
        });
        var h = sky.hours.filter(function (x) { return t >= x.start && t < x.end; })[0];
        if (h && (A.hourRulers || []).indexOf(h.planet) >= 0) { score += 1.2; why.push(h.planet + ' hour'); }
        var asc = Sky.SIGNS[Math.floor(Sky.chartAngles(t, o.lat, o.lon).asc / 30)];
        if (A.signs && A.signs[asc]) { score += 1.2; why.push(asc + ' rising'); }
        else if (RB.weather.signElement[asc] === A.element) { score += 0.5; why.push(asc + ' rising'); }
        var moon = Sky.signOf(Sky.positions(t).Moon);
        if (A.signs && A.signs[moon]) { score += 0.8; why.push('Moon in ' + moon); }
        var v = tl.voids.filter(function (x) { return t >= x.start && t < x.end; })[0];
        if (v) { if (A.voc === 'avoid') { score -= 3; warn.push('void Moon'); } else if (A.voc === 'favor') { score += 0.8; why.push('void Moon'); } }
        out.push({ start: new Date(+t - 5 * 60000), end: new Date(+t + 10 * 60000), at: t, score: score, word: WORD[an.planet], planet: an.planet, angle: an.kind, why: why, warn: warn, kind: 'crossing' });
      });
    });
    return out;
  }

  function plan(o) {
    var tz = o.tz, ms = moments(o, o.cache), goals = (o.goals || []).filter(function (g) { return GOALS[g.want]; }).slice(0, o.max || 2);
    var scans = [], tl = ms.tl;
    for (var k = 0; k < HORIZON; k += 2) scans.push(ms.scans[k / 2]);
    return {
      goals: goals.map(function (g) {
        var G = GOALS[g.want], perDay = 3, used = {}, picked = [];
        var cands = crossings(o, G.act, scans, tl).filter(function (c) { return c.score >= 3; });
        if (o.natal) cands = cands.concat(natalCrossings(o, g.want, o.natal).filter(function (c) { return c.score >= 3; }));
        // Fall back to the best planetary hours when crossings are too few.
        var hrs = Engine.findTimes(ms, G.act, { limit: 999, min: 3 }).windows.map(function (w) {
          var hs = w.hours || [], bi = 0; hs.forEach(function (x, i) { if (x.score > hs[bi].score) bi = i; });
          var hr = ms.filter(function (m) { return hs[bi] && +m.h.start === +hs[bi].start; })[0];
          var why = w.why.map(function (r) { return r.replace(/^(an?|the) /, '').replace(/, which.*$/, ''); }).filter(function (r) { return !/window$|^(waxing|waning) Moon$/.test(r); });
          var hourR = why.map(function (r) { return (r.match(/^(\w+) hour$/) || [])[1]; }).filter(Boolean)[0];
          var pl = hourR || ((why[0] || '').match(/^(Sun|Mercury|Venus|Mars|Jupiter|Saturn|Uranus|Neptune|Pluto)\b/) || [])[1] || (hr && hr.h.planet);
          return { start: hs[bi] ? hs[bi].start : w.start, end: hs[bi] ? hs[bi].end : w.end, score: w.score - 1.5, word: pl ? WORD[pl] : '', planet: pl, why: why, warn: w.warn || [], kind: 'hour' };
        });
        if (WIND[g.want]) hrs = hrs.filter(function (w) { return !windDown(localHour(new Date((+w.start + +w.end) / 2), tz), o.sleep == null ? 22.5 : o.sleep); });
        var prec = g.precision || 'moment', pool = prec === 'hours' ? hrs : cands.concat(hrs);
        // Every good wave, not a quota: up to three a day, at least three hours apart. The target count
        // becomes progress in the app; the top ones are flagged so the app can favor them.
        var take = function (list) {
          list.slice().sort(function (a, b) { return b.score - a.score || a.start - b.start; }).forEach(function (w) {
            if (picked.length >= 40) return;
            var d = ymd(w.start, tz); if ((used[d] || 0) >= perDay) return;
            if (picked.some(function (p) { return Math.abs(p.start - w.start) < 3 * 3600e3; })) return;
            used[d] = (used[d] || 0) + 1; picked.push(w);
          });
        };
        if (prec === 'day') {
          // A good day: rank days by their best moment plus a little for the runner-up; keep the peak time.
          var byDay = {};
          cands.concat(hrs).forEach(function (w) { var d = ymd(w.start, tz); (byDay[d] = byDay[d] || []).push(w); });
          var days = Object.keys(byDay).map(function (d) {
            var ws = byDay[d].sort(function (a, b) { return b.score - a.score; }), top = ws[0];
            return Object.assign({}, top, { kind: 'day', score: top.score + (ws[1] ? 0.3 * ws[1].score : 0), peak: { start: top.start, end: top.end } });
          });
          perDay = 1; take(days);
        } else take(pool);
        // The strongest few, at most one a day, so "strong" spreads across the week.
        var topIds = [], topDays = {};
        // A planetary hour is present on almost every day (Compass census: 99%), so on its own it can only reinforce.
        // An hour wave is strong only when a lunar contact backs it.
        var establishes = function (w) { return w.kind !== 'hour' || w.why.some(function (r) { return /^Moon (trine|sextile|conjunct|square|opposite)/.test(r); }); };
        picked.slice().sort(function (a, b) { return b.score - a.score; }).forEach(function (w) { var d = ymd(w.start, tz); if (topIds.length < quota(g) && !topDays[d] && establishes(w)) { topDays[d] = 1; topIds.push(+w.start); } });
        picked.sort(function (a, b) { return a.start - b.start; });
        var out = picked.map(function (w) {
          var at = w.at || w.start, sign = w.planet ? Sky.signOf(Sky.positions(new Date(at))[w.planet]) : '';
          var top = topIds.indexOf(+w.start) >= 0;
          return { start: w.start, end: w.end, at: at, kind: w.kind, word: w.word, planet: w.planet, angle: w.angle || null, natal: !!w.natal, sign: sign, top: top, score: Math.round(w.score * 10) / 10, tier: top ? 'strong' : 'supportive', strength: w.score >= 6 ? 'strong' : 'good', reason: (w.natal && w.why[0]) || (w.planet && w.why.filter(function (r) { return r.indexOf(w.planet) === 0; })[0]) || w.why[0] || '', why: w.why, warn: w.warn, peak: w.peak || null };
        });
        var best = out.slice().sort(function (a, b) { return b.score - a.score; })[0] || null;
        // A thin week is an invitation to come at it another way: neighboring activities whose planets are strong.
        var alts = [];
        if (out.filter(function (w) { return +w.end > +o.now; }).length < quota(g)) {
          (NEIGHBORS[g.want] || []).forEach(function (k) {
            var A = GOALS[k], c = crossings(o, A.act, scans, tl).filter(function (x) { return x.score >= 4; }).sort(function (a, b) { return b.score - a.score; })[0];
            if (c) alts.push({ want: k, name: A.name, short: A.short, dfor: A.dfor, start: c.start, end: c.end, word: c.word, planet: c.planet, reason: c.why[0] || '' });
          });
          alts.sort(function (a, b) { return a.start - b.start; });
        }
        return { want: g.want, name: G.name, short: G.short, dfor: G.dfor, lead: G.lead, dur: G.dur, times: g.times, per: g.per, precision: prec, best: best, windows: out, alts: alts.slice(0, 2), spans: spans(tides(o, g.want, HORIZON, o.natal), null, null, g.want) };
      })
    };
  }

  // ---- Longer waves: whole days and runs of days ----------------------------------------------
  // Cheap day-level conditions that hold for a day or several: the Moon's sign (about 2.5 days),
  // the day's ruler, aspects between the planets the intention needs (these last days), the Moon's
  // aspects that day, and how much of the waking day the Moon is void.
  // Day-level condition of the activity's own planets, ported from Compass's rareWindows.scoreDay: essential
  // dignity first (the biggest driver of a rare day), then retrograde, then how tightly benefics and malefics
  // aspect them, then the Moon's phase where the activity has a preference. Compass's weights, times RARE_K
  // so they sit on this file's day scale.
  var RARE_K = 0.35, CLASSIC = { Sun: 1, Moon: 1, Mercury: 1, Venus: 1, Mars: 1, Jupiter: 1, Saturn: 1 };
  var DIGN = {
    Sun: { dom: ['Leo'], ex: 'Aries', det: ['Aquarius'], fall: 'Libra' }, Moon: { dom: ['Cancer'], ex: 'Taurus', det: ['Capricorn'], fall: 'Scorpio' },
    Mercury: { dom: ['Gemini', 'Virgo'], ex: 'Virgo', det: ['Sagittarius', 'Pisces'], fall: 'Pisces' }, Venus: { dom: ['Taurus', 'Libra'], ex: 'Pisces', det: ['Scorpio', 'Aries'], fall: 'Virgo' },
    Mars: { dom: ['Aries', 'Scorpio'], ex: 'Capricorn', det: ['Libra', 'Taurus'], fall: 'Cancer' }, Jupiter: { dom: ['Sagittarius', 'Pisces'], ex: 'Cancer', det: ['Gemini', 'Virgo'], fall: 'Capricorn' },
    Saturn: { dom: ['Capricorn', 'Aquarius'], ex: 'Libra', det: ['Cancer', 'Leo'], fall: 'Aries' }
  };
  var BENEFIC = { Venus: 1, Jupiter: 1 }, MALEFIC = { Mars: 1, Saturn: 1 };
  var ASPS = [['conjunction', 0], ['sextile', 60], ['square', 90], ['trine', 120], ['opposition', 180]];
  function rare(A, pos, nxt, add) {
    var P = A.planets || {};
    Object.keys(P).forEach(function (pl) {
      if (!CLASSIC[pl] || pos[pl] == null) return; var w = P[pl] * RARE_K, sg = Sky.signOf(pos[pl]), D = DIGN[pl];
      if (D.dom.indexOf(sg) >= 0) add(pl + ' in ' + sg + ', its own sign', 5 * w);
      else if (D.ex === sg) add(pl + ' exalted in ' + sg, 4.5 * w);
      else if (D.det.indexOf(sg) >= 0) add(pl + ' in detriment in ' + sg, -3.5 * w);
      else if (D.fall === sg) add(pl + ' in fall in ' + sg, -3 * w);
      // Compass's activity modes (from activityCorrespondences.modeOf): the retrograde objection is about beginnings,
      // so it counts in force only for an inception, suits a revision, and leaves everyday doing alone.
      var mode = (typeof MODES !== 'undefined' && MODES[A.key]) || 'execution';
      if (pl !== 'Sun' && pl !== 'Moon' && ((((nxt[pl] - pos[pl]) % 360) + 540) % 360 - 180) < 0) {
        if (mode === 'inception') add(pl + ' retrograde', -2.5 * w); else if (mode === 'revision') add(pl + ' retrograde, which suits going back over things', 1.2 * w);
      }
      if (pl === 'Moon') return;
      Object.keys(pos).forEach(function (o2) {
        if (o2 === pl || o2 === 'Moon') return;
        var sep = Math.abs((((pos[pl] - pos[o2]) % 360) + 540) % 360 - 180), hit = null;
        ASPS.forEach(function (a) { if (Math.abs(sep - a[1]) <= 8) hit = { name: a[0], orb: Math.abs(sep - a[1]) }; });
        if (!hit) return; var tight = Math.max(0, 1 - hit.orb / 8), soft = hit.name === 'trine' || hit.name === 'sextile', hard = hit.name === 'square' || hit.name === 'opposition';
        var say = pl + ' ' + ({ conjunction: 'conjunct', opposition: 'opposite' }[hit.name] || hit.name) + ' ' + o2;
        if (soft && BENEFIC[o2]) { if (tight > 0.4) add(say, 2.6 * w * tight); }
        else if (hit.name === 'conjunction' && BENEFIC[o2]) { if (tight > 0.4) add(say, 2.2 * w * tight); }
        else if (soft && !MALEFIC[o2]) { if (tight > 0.6) add(say, 1.1 * w * tight); }
        else if (hard && MALEFIC[o2]) { if (tight > 0.4) add(say, -2.2 * w * tight); }
      });
    });
    var el = (((pos.Moon - pos.Sun) % 360) + 360) % 360, waxing = el < 180;
    if (A.phase === 'waxing') { if (waxing) add('waxing Moon', 0.8); else add('waning Moon', -0.5); }
    else if (A.phase === 'waning' && !waxing) add('waning Moon', 0.8);
  }
  var SLOW = { Jupiter: 1, Saturn: 1, Uranus: 1, Neptune: 1, Pluto: 1 };
  var DAY_RULER = ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn'];
  function localMidnightOf(d, tz) { var y = Sky.localYMD(d, tz), u = Date.UTC(y.y, y.m - 1, y.d); return new Date(u - Sky.offsetMin(new Date(u + 12 * 3600e3), tz) * 60000); }
  function tides(o, want, days, natal) {
    var G = GOALS[want] || { act: want }, A = ACTS[G.act]; if (!A) return [];
    var P = A.planets || {}, out = [], m0 = localMidnightOf(o.now, o.tz);
    var tl = Sky.lunarTimeline(new Date(+m0 - DAY), new Date(+m0 + (days + 1) * DAY), 120);
    for (var k = 0; k < days; k++) {
      var mid = new Date(+m0 + k * DAY + 12 * 3600e3), start = localMidnightOf(mid, o.tz), end = localMidnightOf(new Date(+mid + DAY), o.tz);
      var why = [], add = function (r, v) { why.push({ r: r, v: v }); };
      var pos = Sky.positions(mid), moon = Sky.signOf(pos.Moon), nxt = Sky.positions(new Date(+mid + DAY));
      rare(A, pos, nxt, add);
      if (A.signs && A.signs[moon]) add('Moon in ' + moon, 1.5);
      else if (A.element && RB.weather.signElement[moon] === A.element) add('Moon in ' + moon, 0.6);
      var y = Sky.localYMD(mid, o.tz), ruler = DAY_RULER[new Date(Date.UTC(y.y, y.m - 1, y.d)).getUTCDay()];
      if (P[ruler]) add(ruler + '’s day', 0.8 * P[ruler]); else if ((A.hourRulers || []).indexOf(ruler) >= 0) add(ruler + '’s day', 0.5);
      tl.perfections.forEach(function (pf) {
        if (pf.t < start || pf.t >= end || !P[pf.planet]) return;
        var soft = SOFT[pf.aspect], hard = HARD[pf.aspect], v = pf.aspect === 'conjunction' ? 0.7 : soft ? (A.aspects === 'effort' ? 0.4 : 0.8) : hard ? (A.aspects === 'effort' ? 0.6 : -0.5) : 0;
        if (v) add('Moon ' + ({ conjunction: 'conjunct', opposition: 'opposite' }[pf.aspect] || pf.aspect) + ' ' + pf.planet, v * P[pf.planet]);
      });
      var wake = new Date(+start + (o.wake == null ? 6.5 : o.wake) * 3600e3), sleep = new Date(+start + (o.sleep == null ? 22.5 : o.sleep) * 3600e3), voidMs = 0;
      tl.voids.forEach(function (v) { voidMs += Math.max(0, Math.min(+v.end, +sleep) - Math.max(+v.start, +wake)); });
      var frac = voidMs / (+sleep - +wake);
      if (frac > 0.3) { if (A.voc === 'avoid') add('void Moon much of the day', -1.6 * frac); else if (A.voc === 'favor') add('void Moon much of the day', 0.6 * frac); }
      if (natal) Object.keys(P).forEach(function (pl) {
        if (natal[pl] == null) return; var d = Math.abs((((pos.Moon - natal[pl]) % 360) + 540) % 360 - 180);
        if (d < 7) add('Moon over your natal ' + pl, 0.9 * P[pl]);
      });
      // "Moon in Cancer" and "Moon in Cancer, its own sign" are one fact: keep the fuller line.
      why = why.filter(function (x) { return !why.some(function (y) { return y !== x && y.r.length > x.r.length && y.r.indexOf(x.r) === 0; }); });
      why.sort(function (a, b) { return Math.abs(b.v) - Math.abs(a.v); });
      var score = why.reduce(function (n, x) { return n + x.v; }, 0);
      out.push({ start: start, end: end, score: Math.round(score * 10) / 10, why: why.filter(function (x) { return x.v > 0; }).map(function (x) { return x.r; }), warn: why.filter(function (x) { return x.v < 0; }).map(function (x) { return x.r; }) });
    }
    return out;
  }
  // Runs of good days become one wave: "Thursday to Saturday". A single day stands alone only when it is clearly strong.
  function planetIn(r) { return (String(r).match(/\b(Sun|Moon|Mercury|Venus|Mars|Jupiter|Saturn|Uranus|Neptune|Pluto)\b(?!.*\b(Sun|Mercury|Venus|Mars|Jupiter|Saturn|Uranus|Neptune|Pluto)\b)/) || [])[1]; }
  function spans(days, lo, hi, want) {
    // Judged against this intention's own range: the better third of days count, the top tenth stand alone.
    var sc = days.map(function (d) { return d.score; }).sort(function (a, b) { return a - b; }), sc0 = sc, q = function (f) { return sc.length ? sc[Math.min(sc.length - 1, Math.floor(f * sc.length))] : 0; };
    lo = lo == null ? Math.max(1.2, q(0.66)) : lo; hi = hi == null ? Math.max(lo + 0.8, q(0.9)) : hi;
    var out = [], run = [];
    var flush = function () {
      if (run.length >= 2 || (run.length === 1 && run[0].score >= hi)) {
        var tally = {}; run.forEach(function (d) { d.why.forEach(function (r, i) { tally[r] = (tally[r] || 0) + (3 - Math.min(i, 2)); }); });
        var why = Object.keys(tally).sort(function (a, b) { return tally[b] - tally[a]; }), pl = planetIn(why[0]) || 'Moon';
        // A run carried by the Moon's sign takes the word of the intention's own planet: Moon in Leo for moving is still Push.
        var AP = want && GOALS[want] && (ACTS[GOALS[want].act] || {}).planets;
        if (AP && (pl === 'Moon' || !AP[pl])) { var mainP = Object.keys(AP).sort(function (a, b) { return AP[b] - AP[a]; })[0]; if (mainP) pl = mainP; }
        var sc = run.reduce(function (n, d) { return n + d.score; }, 0) / run.length;
        var rank = sc0.filter(function (x) { return x <= Math.max.apply(null, run.map(function (d) { return d.score; })); }).length / Math.max(1, sc0.length);
        out.push({ kind: 'span', top: Math.max(1, Math.round((1 - rank) * 100 + 0.5)), start: run[0].start, end: run[run.length - 1].end, days: run.length, score: Math.round(sc * 10) / 10, planet: pl, word: WORD[pl], reason: why[0] || '', why: why.slice(0, 4), tier: sc >= hi ? 'strong' : 'supportive' });
      }
      run = [];
    };
    days.forEach(function (d) { if (d.score >= lo) run.push(d); else flush(); });
    flush();
    return out;
  }

  // ---- The sky right now: what is this moment good for? ----------------------------------------
  // Scores every intention for one moment, names the moment by its strongest planet, and says what comes next.
  function moment(o) {
    var t = o.at ? new Date(o.at) : o.now, lat = o.lat, lon = o.lon, tz = o.tz;
    var sky = Sky.scan(lat, lon, tz, new Date(+t - 80 * 60000));
    var angs = sky.angles.filter(function (a) { return ANGLE[a.kind]; }).map(function (a) {
      var at = Sky.zodiacal(a.planet, a.kind, a.start, lat, lon) || a.start; return { planet: a.planet, kind: a.kind, at: at };
    });
    var hour = sky.hours.filter(function (h) { return t >= h.start && t < h.end; })[0];
    var tl = Sky.lunarTimeline(new Date(+t - 3 * 3600e3), new Date(+t + 3 * 3600e3), 30);
    var pos = Sky.positions(t), moonSign = Sky.signOf(pos.Moon), asc = Sky.SIGNS[Math.floor(Sky.chartAngles(t, lat, lon).asc / 30)];
    var isVoid = tl.voids.some(function (v) { return t >= v.start && t < v.end; });
    var near = function (a) { var dt = Math.abs(+a.at - +t) / 60000; return dt <= 15 ? 1 : dt <= 75 ? 1 - (dt - 15) / 60 : 0; };
    var keys = o.wants || Object.keys(GOALS);
    var ranked = keys.map(function (k) {
      var G = GOALS[k], A = ACTS[G.act], P = A.planets || {}, why = [], warn = [], score = 0, lead = null, leadV = 0;
      angs.forEach(function (a) {
        var n = near(a); if (!n || !P[a.planet]) return;
        var v = P[a.planet] * ANGLE[a.kind].w * ((FIT[k] || {})[a.kind] || 1) * n; score += v;
        why.push(a.planet + ' ' + ANGLE[a.kind].say); if (v > leadV) { leadV = v; lead = a.planet; }
      });
      if (hour && (A.hourRulers || []).indexOf(hour.planet) >= 0) { score += 1.2; why.push(hour.planet + ' hour'); if (!lead) lead = hour.planet; }
      else if (hour && P[hour.planet]) { score += 0.8 * P[hour.planet]; why.push(hour.planet + ' hour'); if (!lead) lead = hour.planet; }
      tl.perfections.forEach(function (p) {
        if (!P[p.planet] || Math.abs(p.t - t) > 2 * 3600e3) return;
        var fit = p.aspect === 'conjunction' ? 1 : SOFT[p.aspect] ? (A.aspects === 'effort' ? 0.6 : 1.5) : HARD[p.aspect] ? (A.aspects === 'effort' ? 1.4 : -1) : 0;
        if (!fit) return; score += fit * P[p.planet];
        (fit > 0 ? why : warn).push('Moon ' + ({ conjunction: 'conjunct', opposition: 'opposite' }[p.aspect] || p.aspect) + ' ' + p.planet);
      });
      if (A.signs && A.signs[moonSign]) { score += 0.8; why.push('Moon in ' + moonSign); }
      if (A.signs && A.signs[asc]) { score += 1; why.push(asc + ' rising'); } else if (A.element && RB.weather.signElement[asc] === A.element) { score += 0.4; why.push(asc + ' rising'); }
      if (isVoid) { if (A.voc === 'avoid') { score -= 2; warn.push('void Moon'); } else if (A.voc === 'favor') { score += 0.8; why.push('void Moon'); } }
      if (WIND[k] && o.sleep != null && windDown(localHour(t, tz), o.sleep)) { score -= 2.5; warn.push('close to bedtime'); }
      return { want: k, name: G.name, short: G.short, dfor: G.dfor, score: Math.round(score * 10) / 10, planet: lead, word: lead ? WORD[lead] : '', why: why, warn: warn };
    }).sort(function (a, b) { return b.score - a.score; });
    // Name the moment by its strongest planet on an angle; failing that, by the hour's ruler.
    var W = { Sun: 1, Moon: 1, Mercury: 0.9, Venus: 1, Mars: 1, Jupiter: 1, Saturn: 0.9, Uranus: 0.7, Neptune: 0.7, Pluto: 0.6 };
    var head = null, hv = 0;
    angs.forEach(function (a) { var v = near(a) * ANGLE[a.kind].w * W[a.planet]; if (v > hv) { hv = v; head = { planet: a.planet, angle: a.kind, at: a.at, say: a.planet + ' ' + ANGLE[a.kind].say } }; });
    if (!head && hour) head = { planet: hour.planet, angle: null, at: null, say: hour.planet + ' hour' };
    var until = head && head.at ? new Date(Math.max(+head.at + 45 * 60000, +t + 10 * 60000)) : hour ? hour.end : null;
    var next = angs.filter(function (a) { return +a.at > +t + 20 * 60000 && W[a.planet] >= 0.9; }).sort(function (a, b) { return a.at - b.at; })[0] || null;
    if (next) {
      var suits = Object.keys(GOALS).map(function (k) { var P = (ACTS[GOALS[k].act] || {}).planets || {}; return { k: k, v: (P[next.planet] || 0) * ((FIT[k] || {})[next.kind] || 1) }; })
        .filter(function (x) { return x.v > 0; }).sort(function (a, b) { return b.v - a.v; }).slice(0, 2).map(function (x) { return GOALS[x.k].short; });
      next = { planet: next.planet, angle: next.kind, at: next.at, word: WORD[next.planet], say: next.planet + ' ' + ANGLE[next.kind].say, suits: suits };
    }
    return { at: t, head: head, word: head ? WORD[head.planet] : '', until: until, hour: hour ? { planet: hour.planet, end: hour.end } : null,
      moon: { sign: moonSign, isVoid: isVoid, phase: sky.moon && sky.moon.name }, rising: asc, ranked: ranked, next: next };
  }

  // ---- Your chart (Plus): when the degrees of your natal planets cross the angles where you are ----
  function natalPositions(utc) { return Sky.positions(new Date(utc)); }
  var natalCache = {};
  function natalCrossings(o, want, natal) {
    var G = GOALS[want], A = ACTS[G.act], P = A.planets || {}, out = [], wake = o.wake == null ? 6.5 : o.wake, sleep = o.sleep == null ? 22.5 : o.sleep;
    var key = Math.floor(+o.now / 6e5) + ':' + o.lat + ':' + o.lon, ser = natalCache[key];
    if (!ser) { ser = []; for (var m = 0; m <= HORIZON * 144; m++) { var t = new Date(+o.now + m * 6e5), c = Sky.chartAngles(t, o.lat, o.lon); ser.push({ t: t, rise: c.asc, mc: c.mc, set: c.dsc, ic: c.ic }); } natalCache = {}; natalCache[key] = ser; }
    var d = function (x, L) { return (((x - L) % 360) + 540) % 360 - 180; };
    Object.keys(P).forEach(function (pl) {
      var L = natal[pl]; if (L == null) return;
      ['rise', 'mc', 'set', 'ic'].forEach(function (k) {
        for (var i = 1; i < ser.length; i++) {
          var a = d(ser[i - 1][k], L), b = d(ser[i][k], L); if (!(a < 0 && b >= 0 && b - a < 30)) continue;
          var t = new Date(+ser[i - 1].t + 6e5 * (-a / (b - a)));
          var lh = localHour(t, o.tz); if (+t < +o.now + 10 * 60000 || !awake(lh, wake, sleep - 0.25) || (WIND[want] && windDown(lh, sleep))) continue;
          var why = ['Your natal ' + pl + ' ' + ANGLE[k].say], score = P[pl] * ANGLE[k].w * ((FIT[want] || {})[k] || 1) * 0.95;
          var moon = Sky.signOf(Sky.positions(t).Moon); if (A.signs && A.signs[moon]) { score += 0.8; why.push('Moon in ' + moon); }
          out.push({ start: new Date(+t - 5 * 60000), end: new Date(+t + 10 * 60000), at: t, score: score, word: WORD[pl], planet: pl, angle: k, natal: true, why: why, warn: [], kind: 'crossing' });
        }
      });
    });
    return out;
  }
  var NEIGHBORS = { move: ['walk', 'run'], walk: ['move', 'meditate'], run: ['move', 'walk'], meditate: ['rest', 'journal'], rest: ['meditate', 'cook'],
    journal: ['write', 'meditate'], focus: ['write', 'admin'], write: ['journal', 'focus'], create: ['write', 'journal'], admin: ['focus', 'cook'],
    connect: ['partner', 'cook'], partner: ['connect', 'cook'], cook: ['partner', 'connect'] };
  // Onboarding in the person's own words: "quiet time to pray" -> meditate. Ranked guesses.
  var MATCH = {
    meditate: 'meditat sit still quiet pray prayer breath breathe calm peace mindful contemplat silence centered center ground',
    move: 'workout work out gym exercis train lift weights strength cardio hiit sweat move moving body fit crossfit boxing',
    walk: 'walk yoga stretch pilates hike gentle mobility tai chi qigong',
    run: 'run running ride cycling bike swim marathon long endurance distance',
    focus: 'focus deep work study code coding project concentrat build research thinking',
    write: 'writ draft essay novel journal pages blog poem poetry book',
    create: 'art paint draw music make create craft design creative practice sing dance photo',
    admin: 'admin errand chore email inbox bills taxes clean organiz paperwork tidy',
    connect: 'call friend family mom dad parents reach out check in social text',
    partner: 'date romance partner love intimacy wife husband girlfriend boyfriend sex',
    rest: 'rest nap sleep downtime recover relax unwind nothing chill',
    journal: 'journal reflect diary notes therapy process',
    cook: 'cook meal bake kitchen food eat'
  };
  function match(text) {
    var toks = String(text || '').toLowerCase().split(/[^a-z]+/).filter(function (x) { return x.length > 2; });
    return Object.keys(MATCH).map(function (k) {
      var n = 0; MATCH[k].split(' ').forEach(function (w) { if (w.length > 2 && toks.some(function (t) { return t.indexOf(w) === 0; })) n += w.length > 4 ? 2 : 1; });
      return { key: k, n: n };
    }).filter(function (x) { return x.n > 0; }).sort(function (a, b) { return b.n - a.n; }).map(function (x) { return x.key; });
  }
  return { plan: plan, match: match, moment: moment, tides: tides, spans: spans, natalPositions: natalPositions, GOALS: GOALS, WORD: WORD, FIT: FIT, ANGLE_MEANS: ANGLE_MEANS, HORIZON: HORIZON };
})();
if (typeof module !== 'undefined') module.exports = StarswellPlan;
