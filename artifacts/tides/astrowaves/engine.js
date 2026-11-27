// Daily orientation engine, built to the Daily Orientation Rulebook (draft, Oct 31 2026),
// with Compass's inherited doctrine: the Moon and real aspects lead, hours and days are
// secondary (owner, 2026-08-22); the void Moon is a state with a reading per sign
// (voidOfCourse.ts); hard Moon contacts to Saturn and Neptune are troughs (dayarc.ts).
// Needs Astronomy, Sky, RB, RULES, DOC.
var Engine = (function () {
  var N = RB.numbers, ST = N.strength;
  var ACT = {}; RULES.acts.forEach(function (a) { ACT[a.key] = a; });
  var ELEMENT = ['fire', 'earth', 'air', 'water'], MODALITY = ['cardinal', 'fixed', 'mutable'];
  var ANGLE_NAME = { rise: 'Ascendant', mc: 'Midheaven', set: 'Descendant', ic: 'IC' };
  var MOTIF_KEYS = Object.keys(RB.motifs);
  var HARD = { conjunction: 1, square: 1, opposition: 1 };
  var SOFT = { sextile: 1, trine: 1 };

  function signIndex(lon) { return Math.floor((((lon % 360) + 360) % 360) / 30); }
  function expression(planet, lon) {
    var P = RB.planets[planet], out = {}, adds = [];
    P.base.forEach(function (m) { out[m] = 1; });
    if (!P.outer) {
      var si = signIndex(lon), el = RB.element[ELEMENT[si % 4]];
      var e = el.filter(function (m) { return P.base.indexOf(m) < 0; })[0] || el[0];
      var mo = RB.modality[MODALITY[si % 3]];
      [e, mo].forEach(function (m) { if (!out[m]) { out[m] = N.signAdd; adds.push(m); } });
    }
    return { motifs: out, adds: adds };
  }
  function scale(motifs, k) { var o = {}; for (var m in motifs) o[m] = motifs[m] * k; return o; }
  function merge(a, b) { for (var m in b) a[m] = (a[m] || 0) + b[m]; return a; }
  function fromList(list, k) { var o = {}; list.forEach(function (m) { o[m] = k; }); return o; }
  function tierOf(orb) { return orb <= N.strongOrb ? 'strong' : orb <= N.presentOrb ? 'present' : 'faint'; }
  function phaseKind(ph) { return ph < 15 || ph > 345 ? 'new' : ph > 165 && ph < 195 ? 'full' : ph < 180 ? 'waxing' : 'waning'; }

  function zodiacalAngles(sky, lat, lon) {
    return sky.angles.map(function (a) {
      var z = Sky.zodiacal(a.planet, a.kind, a.start, lat, lon);
      return { planet: a.planet, kind: a.kind, at: z || a.start, sky: a.start, approx: !z };
    });
  }

  // States at a moment, from the lunar timeline.
  function statesAt(at, ctx) {
    var S = {};
    ctx.timeline.voids.forEach(function (v) { if (at >= v.start && at < v.end) S.void = v; });
    ctx.timeline.perfections.forEach(function (p) {
      var c = RB.contacts[p.planet];
      if (!c || !c.dampener || !HARD[p.aspect]) return;
      if (Math.abs(p.t - at) <= 3 * 3600e3 && !S[c.dampener]) S[c.dampener] = { perf: p, start: new Date(+p.t - 3 * 3600e3), end: new Date(+p.t + 3 * 3600e3) };
    });
    // Graced: the Moon's next perfection is a trine, sextile or conjunction to Venus or Jupiter, within six hours.
    var next = ctx.timeline.perfections.filter(function (p) { return p.t > at && RB.planets[p.planet] && !RB.planets[p.planet].outer; })[0];
    if (next && RB.contacts[next.planet].benefic && (SOFT[next.aspect] || next.aspect === 'conjunction') && next.t - at <= 6 * 3600e3 && !S.void) S.graced = { perf: next };
    return S;
  }

  // ---- Evidence for one moment ----------------------------------------------------------
  function evidence(h, at, ctx) {
    var pos = Sky.positions(at), E = [], moonSign = Sky.signOf(pos.Moon), states = statesAt(at, ctx);
    var phase = Astronomy.MoonPhase(at), pk = phaseKind(phase);
    // Primary: the Moon's condition. Her sign and phase; when void, the void's scope instead.
    var mx = expression('Moon', pos.Moon);
    if (states.void) {
      var vr = DOC.voids[moonSign];
      var vm = fromList(RB.states.void.motifs, ST.present);
      if (vr.benign) merge(vm, scale(mx.motifs, ST.faint));
      E.push({ id: 'void', family: 'lunar-condition', tier: 'primary', planets: ['Moon'], strength: 'present', motifs: vm, hold: RB.beginnings,
        title: 'Void Moon in ' + moonSign, fact: 'Her last aspect was a ' + states.void.lastAspect.aspect + ' to ' + states.void.lastAspect.planet + ' at ' + ctx.clock(states.void.lastAspect.t) +
          '; she makes no more before entering ' + states.void.next + ' at ' + ctx.dayClock(states.void.end) + '. ' + (vr.provenance ? vr.provenance + ' ' : '') + DOC.scope });
    } else {
      E.push({ id: 'moon', family: 'lunar-condition', tier: 'primary', planets: ['Moon'], strength: 'present',
        motifs: merge(scale(mx.motifs, ST.present), fromList(RB.phaseMotifs[pk], ST.faint)),
        title: 'Moon in ' + moonSign + ', ' + pk, fact: 'Moon at ' + Sky.dms(pos.Moon) + '; the sign adds ' + mx.adds.join(' and ') + ', and a ' + pk + ' Moon leans toward ' + RB.phaseMotifs[pk].join(' and ') + '.' });
    }
    // Primary: the Moon's contacts. Applying within orb, or still partile while separating.
    Sky.moonAspects(at).forEach(function (x) {
      if (!(x.applying && x.orb <= N.moonOrb) && !(!x.applying && x.orb <= 1)) return;
      var c = RB.contacts[x.planet]; if (!c) return;
      var hard = !!HARD[x.name] && (x.name !== 'conjunction' || !c.benefic);
      var tier = tierOf(x.orb), st = ST[tier] * (x.orb <= 1 ? 1.45 : 1);
      var graced = c.benefic && x.applying && (SOFT[x.name] || x.name === 'conjunction');
      if (graced) st *= 1.3;
      var hold = (c.holdAny || []).concat(hard ? (c.holdHard || []) : []);
      var ev = { id: 'moon|' + x.planet + x.name, family: 'lunar-contact', tier: tier === 'faint' && !graced ? 'secondary' : 'primary', planets: ['Moon', x.planet], strength: x.orb <= 1 ? 'partile' : tier, hard: hard, aspect: x.name,
        motifs: fromList(c.adds, st), hold: hold,
        title: 'Moon ' + x.name + ' ' + x.planet + (RB.planets[x.planet].signReading ? ' in ' + Sky.signOf(pos[x.planet]) : ''),
        fact: (x.applying ? 'Applying, ' : 'Separating but still partile, ') + x.orb.toFixed(1) + '° from exact' + (x.applying && x.hoursToExact ? ', exact in about ' + Math.max(1, Math.round(x.hoursToExact)) + ' h' : '') + '. ' +
          x.planet + ' ' + RB.planets[x.planet].verb + ' the Moon' + (graced ? '; a benefic contact, the tradition’s strongest good omen' : '') + (hold.length ? '; it holds back ' + hold.join(' and ') : '') + '.' };
      if (hard && RB.guardPlanets.indexOf(x.planet) >= 0 && x.applying) ev.guard = { planet: x.planet, target: 'Moon' };
      if (x.name === 'opposition' || RB.planets[x.planet].outer) ev.attend = { planet: x.planet };
      E.push(ev);
    });
    // Primary: real aspects between planets. Configurations between slow planets are an era, not a day.
    ctx.standing.forEach(function (x) {
      var era = RB.slow.indexOf(x.p1) >= 0 && RB.slow.indexOf(x.p2) >= 0;
      var tier = x.orb <= N.skyStrongOrb ? 'strong' : 'present', st = ST[tier];
      var ev = { id: 'sky|' + x.p1 + x.p2 + x.name, family: 'standing-sky', tier: era ? 'background' : 'primary', planets: [x.p1, x.p2], strength: era ? 'ambient' : tier, hard: x.hard, aspect: x.name,
        motifs: merge(fromList(RB.contacts[x.p1].adds, st * 0.5), fromList(RB.contacts[x.p2].adds, st * 0.5)), hold: x.hard && !era ? RB.holdBack : [],
        title: x.p1 + ' ' + x.name + ' ' + x.p2, fact: 'Within ' + x.orb.toFixed(1) + '° and ' + (x.applying ? 'tightening' : 'loosening') + (era ? '. Both are slow planets, so this is the era’s weather and colors the day without counting.' : '. One event, so it counts once.') };
      if (!era && x.hard && x.applying) {
        var gp = [x.p1, x.p2].filter(function (p) { return RB.guardPlanets.indexOf(p) >= 0; });
        var tp = [x.p1, x.p2].filter(function (p) { return RB.personal.indexOf(p) >= 0; });
        var g = gp.filter(function (p) { return p !== tp[0] || tp.length > 1; }).pop();
        if (g && tp.length) ev.guard = { planet: g, target: tp.filter(function (p) { return p !== g; })[0] || tp[0] };
      }
      if (!era && x.name === 'opposition') ev.attend = { planet: x.p2 };
      E.push(ev);
    });
    // Primary: the luminaries, benefics and malefics on the Ascendant or Midheaven (dayarc.ts). Others only modify.
    ctx.zangles.forEach(function (z) {
      if (z.at < h.start || z.at >= h.end) return;
      var counts = RB.angleTestimony.indexOf(z.planet) >= 0 && (z.kind === 'rise' || z.kind === 'mc');
      var tier = z.kind === 'rise' || z.kind === 'mc' ? 'strong' : 'present', P = RB.planets[z.planet];
      E.push({ id: 'angle|' + z.planet + z.kind + +z.at, family: 'angularity', tier: 'primary', modOnly: !counts, planets: [z.planet], strength: tier,
        motifs: fromList(P.base, ST[tier]), title: z.planet + ' on the ' + ANGLE_NAME[z.kind],
        fact: z.planet + ' at ' + Sky.dms(Sky.eclon(z.planet, z.at)) + ' reaches the ' + ANGLE_NAME[z.kind] + ' degree at ' + ctx.clock(z.at) +
          (z.approx ? '' : '; it crosses the ' + (z.kind === 'rise' || z.kind === 'set' ? 'horizon' : 'meridian') + ' in the sky at ' + ctx.clock(z.sky)) + (counts ? '.' : '. Only strengthens what is already there.') });
    });
    // Secondary: the planetary hour. Adds weight and can earn an activity its place, never a family.
    var hx = expression(h.planet, pos[h.planet]);
    E.push({ id: 'hour', family: 'planetary-time', tier: 'secondary', planets: [h.planet], strength: 'secondary', motifs: scale(hx.motifs, ST.faint),
      title: h.planet + ' hour', fact: 'Hour ' + h.n + ' of 24, ' + ctx.clock(h.start) + '–' + ctx.clock(h.end) + '. ' + DOC.hourPrompts[h.planet.toLowerCase()] + ' Secondary to the Moon and to real aspects, so it never counts as agreement.' });
    var bg = [{ id: 'bg-day', title: h.dayRuler + '’s day, ' + h.dayRuler + ' in ' + Sky.signOf(pos[h.dayRuler]), motifs: scale(expression(h.dayRuler, pos[h.dayRuler]).motifs, N.backgroundTie), planets: [h.dayRuler] }];
    var notes = [];
    var ml = ((pos.Moon % 360) + 360) % 360;
    if (ml >= 195 && ml < 225) notes.push('The Moon is in the via combusta (15° Libra to 15° Scorpio), a soft caution for beginnings.');
    if (ml % 30 >= 29) notes.push('The Moon is in the last degree of ' + moonSign + ', with little room for anything begun now to develop.');
    return { list: E, background: bg, pos: pos, moonSign: moonSign, phase: phase, phaseKind: pk, states: states, notes: notes, isVoid: !!states.void };
  }

  // ---- Judge -------------------------------------------------------------------------------
  function judge(ev) {
    var sup = {};
    MOTIF_KEYS.forEach(function (m) { sup[m] = { sum: 0, fam: {}, events: [], held: 0, byPlanet: {} }; });
    function add(e, m, w, counts) {
      var s = sup[m]; if (!s) return; s.sum += w; if (counts) s.fam[e.family] = 1; s.events.push({ e: e, w: w });
      e.planets.forEach(function (p) { s.byPlanet[p] = (s.byPlanet[p] || 0) + w / e.planets.length; });
    }
    ev.list.forEach(function (e) { if (e.tier !== 'background' && !e.modOnly) for (var m in e.motifs) add(e, m, e.motifs[m], e.tier === 'primary'); });
    ev.list.forEach(function (e) { if (e.modOnly) for (var m in e.motifs) if (Object.keys(sup[m].fam).length) add(e, m, e.motifs[m], true); });
    ev.list.forEach(function (e) { if (e.tier === 'background') for (var m in e.motifs) sup[m].sum += e.motifs[m] * 0.3; });
    ev.list.forEach(function (e) { if (e.tier !== 'background') (e.hold || []).forEach(function (m) { sup[m].sum -= 0.6 * (ST[e.strength] || ST.present); sup[m].held += 1; sup[m].heldBy = e; }); });
    ev.background.forEach(function (b) { for (var m in b.motifs) sup[m].sum += b.motifs[m]; });
    // An hour is picked only by something timed: a Moon contact or an angle crossing. Day-long conditions describe the day.
    MOTIF_KEYS.forEach(function (m) { var f = sup[m].fam; sup[m].timed = !!(f['lunar-contact'] || f['angularity']); sup[m].n = sup[m].timed ? Object.keys(f).length : Math.min(1, Object.keys(f).length); });
    var clusters = {};
    Object.keys(RB.clusters).forEach(function (c) {
      var fam = {}, sum = 0, members = [];
      MOTIF_KEYS.forEach(function (m) { if (RB.motifs[m].cluster !== c) return; if (sup[m].sum > 0 && !sup[m].held) members.push(m); sum += Math.max(0, sup[m].sum); for (var f in sup[m].fam) fam[f] = 1; });
      var timed = !!(fam['lunar-contact'] || fam['angularity']);
      clusters[c] = { n: timed ? Object.keys(fam).length : Math.min(1, Object.keys(fam).length), sum: sum, members: members };
    });
    return { sup: sup, clusters: clusters, guards: ev.list.filter(function (e) { return e.guard; }), attends: ev.list.filter(function (e) { return e.attend; }) };
  }

  // ---- Decide ------------------------------------------------------------------------------
  function decide(M, focusKey, opts) {
    var F = RB.focuses[focusKey], J = M.J, S = M.ev.states;
    var state = S.void ? 'void' : S.quiet ? 'quiet' : S.fog ? 'fog' : null;
    var allowed = (F.motifs || MOTIF_KEYS).slice();
    if (state) {
      var scope = RB.states[state].motifs.slice();
      if (state === 'void' && DOC.voids[M.ev.moonSign].benign) {
        // Lilly's easy voids: the sign's own motifs come first (owner, 2026-10-31).
        var own = Object.keys(expression('Moon', M.ev.pos.Moon).motifs);
        scope = scope.concat(own); opts.prefer = own;
      }
      allowed = allowed.filter(function (m) { return scope.indexOf(m) >= 0; });
    }
    var stateCard = state ? stateInfo(state, M) : null;
    if (!F.motifs || F.motifs.length) {
      var res = choose(M, J, F, allowed, opts);
      if (res) { res.state = stateCard; res.graced = S.graced ? S.graced : null; return res; }
    }
    if (stateCard && F.kinds.indexOf('mode') >= 0) return { kind: 'state', state: stateCard, coherence: null, cluster: 'state-' + state, motifs: [], receipts: M.ev.list.filter(function (e) { return e.tier === 'primary'; }), lines: [], altActs: [] };
    return null;
  }
  function stateInfo(state, M) {
    var S = M.ev.states;
    if (state === 'void') { var vr = DOC.voids[M.ev.moonSign], vw = RB.weather.voids[M.ev.moonSign]; return { key: 'void', label: RB.states.void.label, headline: vw.w, sub: 'Suits ' + vw.s + '.', feel: vr.feel, doctrine: vr.instead, note: vr.provenance || '', start: S.void.start, end: S.void.end, benign: vr.benign }; }
    if (state === 'quiet') return { key: 'quiet', label: RB.states.quiet.label, headline: RB.weather.quiet.w, sub: 'Suits ' + RB.weather.quiet.s + '.', doctrine: cap(DOC.roads.Saturn.work) + '.', note: 'Moon ' + S.quiet.perf.aspect + ' Saturn, exact at ' + M.clock(S.quiet.perf.t), start: S.quiet.start, end: S.quiet.end };
    return { key: 'fog', label: RB.states.fog.label, headline: RB.weather.fog.w, sub: 'Suits ' + RB.weather.fog.s + '.', doctrine: cap(DOC.roads.Neptune.work) + '.', note: 'Moon ' + S.fog.perf.aspect + ' Neptune, exact at ' + M.clock(S.fog.perf.t), start: S.fog.start, end: S.fog.end };
  }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  function choose(M, J, F, allowed, opts) {
    if (!allowed.length) return null;
    var pref = opts.prefer || [];
    var cand = allowed.filter(function (m) { return J.sup[m].n >= 2 && J.sup[m].sum > 0 && !(opts.skip && opts.skip[m]); })
      .sort(function (a, b) { return ((pref.indexOf(b) >= 0) - (pref.indexOf(a) >= 0)) || (J.sup[b].n - J.sup[a].n) || (J.sup[b].sum - J.sup[a].sum); });
    var motif = cand[0], cluster = null, level = 'motif', coherence;
    if (motif) { cluster = RB.motifs[motif].cluster; coherence = J.sup[motif].n; }
    else {
      var cs = Object.keys(J.clusters).filter(function (c) {
        var mem = J.clusters[c].members.filter(function (m) { return allowed.indexOf(m) >= 0; });
        return J.clusters[c].n >= 2 && mem.length >= 2 && !(opts.skip && opts.skip['cluster-' + c]);
      }).sort(function (a, b) { return (J.clusters[b].n - J.clusters[a].n) || (J.clusters[b].sum - J.clusters[a].sum); });
      if (!cs.length) return null;
      cluster = cs[0]; level = 'cluster'; coherence = J.clusters[cluster].n;
    }
    var motifs = level === 'motif' ? [motif] : J.clusters[cluster].members.filter(function (m) { return allowed.indexOf(m) >= 0; });
    var dos = [];
    if (F.kinds.indexOf('do') >= 0) Object.keys(RB.acts).forEach(function (k) {
      var A = RB.acts[k], C = ACT[k];
      if (!C || A.tier === 'plan' || (A.safety === 'context' && !F.allowContext)) return;
      if (motifs.indexOf(A.motifs[0]) < 0) return;
      if (M.ev.isVoid && C.voc === 'avoid') return;
      var hits = [];
      if (C.hourRulers.indexOf(M.h.planet) >= 0) hits.push('it’s one of its own hours (' + M.h.planet + ')');
      if (C.signs[M.ev.moonSign]) hits.push('the activity table lists the Moon in ' + M.ev.moonSign + ' for it: “' + C.signs[M.ev.moonSign] + '”');
      var pk = M.ev.phaseKind === 'full' ? 'waning' : M.ev.phaseKind;
      if (C.phase && C.phase === pk) hits.push('it prefers a ' + pk + ' Moon');
      if (M.ev.isVoid && C.voc === 'favor') hits.push('the activity table marks it as suited to a void Moon');
      if (hits.length && !(opts.skip && opts.skip['act-' + k])) dos.push({ key: k, label: C.label, hits: hits, small: A.small, gloss: C.gloss });
    });
    dos.sort(function (a, b) { return (b.hits.length - a.hits.length) || (opts.rot(a.key) - opts.rot(b.key)); });
    var earned = dos.length === 1 || (dos.length > 1 && dos[0].hits.length >= 2 && dos[0].hits.length > dos[1].hits.length);
    var alts = dos.slice(earned ? 1 : 0, (earned ? 1 : 0) + 3);
    var byP = {};
    motifs.forEach(function (m) { for (var p in J.sup[m].byPlanet) byP[p] = (byP[p] || 0) + J.sup[m].byPlanet[p]; });
    var lp = Object.keys(byP).filter(function (p) { return RB.planets[p] && RB.planets[p].signReading; }).sort(function (a, b) { return byP[b] - byP[a]; })[0];
    var pressed = lp && M.ev.list.some(function (e) { return e.hard && e.tier === 'primary' && e.planets.indexOf(lp) >= 0; });
    var lean = null;
    if (lp) { var r = RULES.pis[lp][Sky.signOf(M.ev.pos[lp])]; lean = { planet: lp, sign: Sky.signOf(M.ev.pos[lp]), caution: pressed, text: pressed ? r.misses : r.does, other: pressed ? r.does : r.misses }; }
    var el = RB.weather.signElement[M.ev.moonSign], byEl = level === 'motif' && RB.weather.byElement[motif] ? RB.weather.byElement[motif][el] || [] : [];
    var lines = byEl.concat(level === 'motif' ? RB.weather.motifs[motif] : RB.weather.clusters[cluster]);
    var pool = dos.slice();
    if (pool.length < 3) Object.keys(RB.acts).forEach(function (k) {
      var A = RB.acts[k], C = ACT[k];
      if (!C || A.tier === 'plan' || (A.safety === 'context' && !F.allowContext) || !A.motifs.some(function (m) { return motifs.indexOf(m) >= 0; }) || (M.ev.isVoid && C.voc === 'avoid')) return;
      if (!pool.some(function (d) { return d.key === k; })) pool.push({ key: k, label: C.label, hits: [], small: A.small, fill: true });
    });
    pool.sort(function (a, b) { return (b.hits.length - a.hits.length) || (opts.rot('s-' + a.key) - opts.rot('s-' + b.key)); });
    var suits = pool.slice(0, 3).map(function (d) { return RB.weather.nouns[d.key] || d.label.toLowerCase(); });
    var receipts = [], wt = new Map();
    motifs.forEach(function (m) { J.sup[m].events.forEach(function (x) { if (receipts.indexOf(x.e) < 0) receipts.push(x.e); wt.set(x.e, (wt.get(x.e) || 0) + x.w); }); });
    // Strongest contributors to this weather line first, so the first receipt is the one that explains it.
    receipts.sort(function (a, b) { return ((a.tier === 'secondary') - (b.tier === 'secondary')) || (wt.get(b) - wt.get(a)); });
    return { kind: earned ? 'do' : 'mode', level: level, motif: motif, motifs: motifs, cluster: cluster, coherence: coherence,
      modeLine: (function () { var r = opts.rot('line-' + (motif || cluster)); return byEl.length && r % 3 !== 0 ? byEl[Math.floor(r / 3) % byEl.length] : lines[r % lines.length]; })(), lines: lines, suits: suits, act: earned ? dos[0] : null, altActs: alts,
      lean: lean, receipts: receipts };
  }


  // ---- Find a time ----------------------------------------------------------------------
  // Rank the coming waking hours for one activity from Compass's activity table. Each hour
  // scores on: its planetary hour, the Moon's sign and phase, the Moon's applying contacts to
  // the activity's planets (soft activities dislike hard contacts; effortful ones can use them),
  // those planets on an angle, and the void, heavy and hazy states. Adjacent good hours merge.
  var FIND = {
    'train-hard': 'a workout', 'endurance': 'a long run or ride', 'gentle-movement': 'a walk, yoga or a stretch', 'deep-rest': 'rest or a nap',
    'deep-work': 'deep work', 'first-draft': 'writing a first draft', 'edit-revise': 'editing', 'creative-practice': 'making art',
    'admin-errands': 'admin and errands', 'organize': 'tidying and sorting', 'hard-conversation': 'a hard conversation', 'repair-bond': 'making up with someone',
    'first-date': 'a date', 'romantic-time': 'time with your partner', 'host': 'having people over', 'call-family': 'calling home',
    'cook': 'cooking', 'meditate': 'meditation', 'journal': 'journaling', 'negotiate': 'asking for more',
    'publish': 'publishing or posting', 'launch-venture': 'launching something', 'sign-contract': 'signing something', 'big-purchase': 'a considered purchase'
  };
  function findTimes(moments, key, opts) {
    opts = opts || {};
    var C = ACT[key]; if (!C) return { key: key, windows: [], none: 'Unknown activity.' };
    var W = C.planets || {}, begins = ['publish', 'launch-venture', 'sign-contract', 'big-purchase', 'first-date', 'negotiate'].indexOf(key) >= 0;
    var scored = moments.map(function (m) {
      var ev = m.ev, sc = 0, why = [], warn = [], out = false;
      if (ev.isVoid && (C.voc === 'avoid' || begins)) { out = true; warn.push('the Moon is void, so nothing begun now takes hold'); }
      if (C.hourRulers.indexOf(m.h.planet) >= 0) { sc += 2; why.push('a ' + m.h.planet + ' hour'); }
      if (C.signs && C.signs[ev.moonSign]) { sc += 1.5; why.push('the Moon in ' + ev.moonSign); }
      var pk = ev.phaseKind === 'full' ? 'waning' : ev.phaseKind;
      if (C.phase && C.phase === pk) { sc += 0.5; why.push('a ' + pk + ' Moon'); }
      ev.list.forEach(function (e) {
        if (e.family === 'lunar-contact' && e.tier !== 'background') {
          var p = e.planets[1], w = W[p]; if (!w) return;
          if (!e.hard) { sc += 1.5 * w; why.push(e.title.replace(/ in [A-Z][a-z]+$/, '')); }
          else if (C.aspects === 'effort') { sc += 0.75 * w; why.push(e.title.replace(/ in [A-Z][a-z]+$/, '') + ', which effort can use'); }
          else { sc -= 1.5 * w; warn.push(e.title.replace(/ in [A-Z][a-z]+$/, '')); }
        }
        if (e.family === 'angularity' && W[e.planets[0]]) { sc += 1.5 * W[e.planets[0]]; why.push(e.title); }
      });
      var S = ev.states || {};
      if (ev.isVoid && C.voc === 'favor') { sc += 1; why.push('a void Moon, which suits it'); }
      if (S.quiet) { if (W.Saturn) { sc += 0.5; why.push('a heavy, steady stretch'); } else if (C.aspects === 'effort' || begins) { sc -= 1; warn.push('a heavy stretch'); } }
      if (S.fog) { if (W.Neptune) { sc += 0.5; why.push('a hazy stretch'); } else { sc -= 1; warn.push('a hazy stretch'); } }
      if (S.graced && !ev.isVoid) { sc += 1; why.push('a generous window'); }
      var o = m.out, line = o ? (o.kind === 'state' ? o.state.headline : o.modeLine) : null;
      return { m: m, score: out ? -99 : sc, why: why, warn: warn, line: line };
    });
    var good = scored.filter(function (x) { return x.score >= (opts.min == null ? 2.5 : opts.min); });
    var wins = [];
    good.forEach(function (x) {
      var last = wins[wins.length - 1];
      if (last && +last.end === +x.m.h.start) { last.end = x.m.h.end; last.hours.push(x); if (x.score > last.best.score) last.best = x; }
      else wins.push({ start: x.m.h.start, end: x.m.h.end, hours: [x], best: x });
    });
    wins.sort(function (a, b) { return b.best.score - a.best.score || a.start - b.start; });
    var top = wins.slice(0, opts.limit || 3).sort(function (a, b) { return a.start - b.start; }).map(function (w) {
      var why = []; w.hours.forEach(function (x) { x.why.forEach(function (r) { if (why.indexOf(r) < 0) why.push(r); }); });
      var warn = []; w.hours.forEach(function (x) { x.warn.forEach(function (r) { if (warn.indexOf(r) < 0) warn.push(r); }); });
      return { start: w.start, end: w.end, hours: w.hours.map(function (x) { return { start: x.m.h.start, end: x.m.h.end, score: x.score }; }), score: Math.round(w.best.score * 10) / 10, strength: w.best.score >= 5 ? 'strong' : w.best.score >= 3.5 ? 'good' : 'fair', why: why.slice(0, 5), warn: warn.slice(0, 2), line: w.best.line };
    });
    return { key: key, name: FIND[key] || C.label.toLowerCase(), windows: top, none: top.length ? null : 'Nothing stands out for ' + (FIND[key] || C.label.toLowerCase()) + ' in the next day or so; any hour you have free will do.' };
  }

  return { findTimes: findTimes, FIND: FIND, evidence: evidence, judge: judge, decide: decide, zodiacalAngles: zodiacalAngles, expression: expression, ANGLE_NAME: ANGLE_NAME, statesAt: statesAt };
})();
if (typeof module !== 'undefined') module.exports = Engine;
