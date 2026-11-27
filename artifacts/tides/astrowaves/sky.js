// Sky model for the Compass widget prototype. Needs global `Astronomy` (astronomy-engine).
var Sky = (function () {
  var A = Astronomy;
  var CHALDEAN = ['Saturn', 'Jupiter', 'Mars', 'Sun', 'Venus', 'Mercury', 'Moon'];
  var WEEKDAY_RULER = ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn'];
  var SIGNS = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'];
  var DAY = 86400000;

  function offsetMin(date, tz) {
    var p = {};
    new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' })
      .formatToParts(date).forEach(function (x) { p[x.type] = +x.value; });
    var asUTC = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
    return Math.round((asUTC - date.getTime()) / 60000);
  }
  function localYMD(date, tz) {
    var p = {};
    new Intl.DateTimeFormat('en-US', { timeZone: tz, year: 'numeric', month: 'numeric', day: 'numeric' })
      .formatToParts(date).forEach(function (x) { p[x.type] = +x.value; });
    return { y: p.year, m: p.month, d: p.day };
  }
  function localMidnight(y, m, d, tz) {
    var guess = Date.UTC(y, m - 1, d);
    var t = guess - offsetMin(new Date(guess), tz) * 60000;
    return new Date(guess - offsetMin(new Date(t), tz) * 60000);
  }
  function weekday(y, m, d) { return new Date(Date.UTC(y, m - 1, d)).getUTCDay(); }

  function sunrise(obs, from) { var r = A.SearchRiseSet('Sun', obs, +1, from, 2); return r && r.date; }
  function sunset(obs, from) { var r = A.SearchRiseSet('Sun', obs, -1, from, 2); return r && r.date; }

  // Planetary hours for the astrological day that starts at sunrise on local date (y,m,d).
  function hoursFor(obs, tz, y, m, d) {
    var mid = localMidnight(y, m, d, tz);
    var rise = sunrise(obs, mid);
    if (!rise) return [];
    var set = sunset(obs, rise);
    var next = sunrise(obs, set);
    if (!set || !next) return [];
    var ruler = WEEKDAY_RULER[weekday(y, m, d)];
    var idx = CHALDEAN.indexOf(ruler);
    var out = [];
    for (var i = 0; i < 24; i++) {
      var day = i < 12;
      var a = day ? rise : set, b = day ? set : next;
      var len = (b - a) / 12, k = day ? i : i - 12;
      out.push({ type: 'hour', planet: CHALDEAN[(idx + i) % 7], start: new Date(+a + k * len), end: new Date(+a + (k + 1) * len), dayRuler: ruler, night: !day, n: i + 1, rise: rise, set: set, next: next, len: len });
    }
    return out;
  }

  // Rise, culmination, set and lower culmination for a body between two dates.
  function angles(body, obs, from, to) {
    var out = [];
    function collect(kind, finder) {
      var t = from;
      for (var guard = 0; guard < 6; guard++) {
        var hit = finder(t);
        if (!hit || hit > to) break;
        out.push({ type: 'angle', planet: body, kind: kind, start: hit, end: hit });
        t = new Date(+hit + 3600000);
      }
    }
    collect('rise', function (t) { var r = A.SearchRiseSet(body, obs, +1, t, 3); return r && r.date; });
    collect('set', function (t) { var r = A.SearchRiseSet(body, obs, -1, t, 3); return r && r.date; });
    collect('mc', function (t) { var r = A.SearchHourAngle(body, obs, 0, t); return r && r.time.date; });
    collect('ic', function (t) { var r = A.SearchHourAngle(body, obs, 12, t); return r && r.time.date; });
    return out;
  }

  function moon(date) {
    var phase = A.MoonPhase(date);
    var lon = A.EclipticGeoMoon(date).lon;
    var names = ['New Moon', 'Waxing crescent', 'First quarter', 'Waxing gibbous', 'Full Moon', 'Waning gibbous', 'Last quarter', 'Waning crescent'];
    var name = names[Math.floor(((phase + 22.5) % 360) / 45)];
    var illum = A.Illumination('Moon', date).phase_fraction;
    return { phase: phase, name: name, sign: SIGNS[Math.floor(lon / 30)], illum: illum, lon: lon };
  }

  // Everything from `now` to the end of tomorrow (local), for the given observer.
  function scan(lat, lon, tz, now) {
    var obs = new A.Observer(lat, lon, 0);
    var t = localYMD(now, tz);
    var today = localMidnight(t.y, t.m, t.d, tz);
    var dayAfter = localYMD(new Date(+today + 2 * DAY + 3 * 3600000), tz);
    var end = localMidnight(dayAfter.y, dayAfter.m, dayAfter.d, tz);
    var hours = [];
    [-1, 0, 1].forEach(function (off) {
      var p = localYMD(new Date(+today + off * DAY + 12 * 3600000), tz);
      hours = hours.concat(hoursFor(obs, tz, p.y, p.m, p.d));
    });
    var current = hours.filter(function (h) { return h.start <= now && h.end > now; })[0];
    var dayHours = current ? hours.filter(function (h) { return +h.rise === +current.rise; }) : [];
    hours = hours.filter(function (h) { return h.end > now && h.start < end; });
    var from = new Date(+now - 45 * 60000);
    var bodies = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'];
    var ang = [];
    bodies.forEach(function (b) { ang = ang.concat(angles(b, obs, from, end)); });
    var tomorrow = localYMD(new Date(+today + DAY + 12 * 3600000), tz);
    return { now: now, end: end, hours: hours, dayHours: dayHours, angles: ang, current: current, moon: moon(now), dayRuler: current ? current.dayRuler : null, tomorrow: tomorrow };
  }

  // Zodiacal angles: the ecliptic degree on the Ascendant and Midheaven (tropical, true equinox of date).
  function chartAngles(date, lat, lon) {
    var r = Math.PI / 180, t = A.MakeTime(date);
    var ramc = ((A.SiderealTime(t) * 15 + lon) % 360 + 360) % 360;
    var eps = A.e_tilt(t).tobl * r;
    var mc = (Math.atan2(Math.sin(ramc * r), Math.cos(ramc * r) * Math.cos(eps)) / r + 360) % 360;
    var asc = (Math.atan2(Math.cos(ramc * r), -(Math.sin(ramc * r) * Math.cos(eps) + Math.tan(lat * r) * Math.sin(eps))) / r + 360) % 360;
    return { asc: asc, mc: mc, dsc: (asc + 180) % 360, ic: (mc + 180) % 360 };
  }
  function eclon(body, date) { return body === 'Moon' ? A.EclipticGeoMoon(date).lon : A.Ecliptic(A.GeoVector(body, date, true)).elon; }
  // When does the body's degree sit exactly on the chart angle? Searched minute by minute near the sky crossing.
  function zodiacal(body, kind, near, lat, lon) {
    var key = { rise: 'asc', set: 'dsc', mc: 'mc', ic: 'ic' }[kind], prev = null;
    function dAt(t) { return ((chartAngles(t, lat, lon)[key] - eclon(body, t)) + 540) % 360 - 180; }
    for (var m = -90; m <= 90; m += 5) {
      var t = new Date(+near + m * 60000);
      var diff = dAt(t);
      if (prev !== null && prev < 0 && diff >= 0 && Math.abs(diff) < 10) {
        var lo = +t - 300000, hi = +t;
        for (var k = 0; k < 9; k++) { var mid = (lo + hi) / 2; if (dAt(new Date(mid)) >= 0) hi = mid; else lo = mid; }
        return new Date(Math.ceil(hi / 60000) * 60000);
      }
      prev = diff;
    }
    return null;
  }
  function dms(lon) { var s = Math.floor(lon / 30), d = lon - s * 30, deg = Math.floor(d), min = Math.floor((d - deg) * 60); return deg + '\u00B0' + (min < 10 ? '0' : '') + min + '\u2032 ' + SIGNS[s]; }


  // ---- Testimony layer: positions, aspects, void Moon --------------------------------
  var BODIES = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'];
  var CLASSICAL = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn'];
  var ASPECTS = [
    { name: 'conjunction', a: 0, sym: '☌' }, { name: 'sextile', a: 60, sym: '⚹', hard: false },
    { name: 'square', a: 90, sym: '□', hard: true }, { name: 'trine', a: 120, sym: '△', hard: false },
    { name: 'opposition', a: 180, sym: '☍', hard: true }];
  var MALEFIC = { Mars: 1, Saturn: 1, Uranus: 1, Pluto: 1 };
  function positions(date) { var o = {}; BODIES.forEach(function (b) { o[b] = eclon(b, date); }); return o; }
  function signOf(lon) { return SIGNS[Math.floor((((lon % 360) + 360) % 360) / 30)]; }
  function sep(a, b) { return Math.abs((((a - b) % 360) + 540) % 360 - 180); }
  function aspectOf(l1, l2, orb, p1, p2) {
    var s = sep(l1, l2);
    for (var i = 0; i < ASPECTS.length; i++) {
      var x = ASPECTS[i], o = Math.abs(s - x.a);
      if (o <= orb) return { name: x.name, sym: x.sym, angle: x.a, orb: o, hard: x.hard === undefined ? !!(MALEFIC[p1] || MALEFIC[p2]) : x.hard };
    }
    return null;
  }
  // The Moon's aspects within 8 degrees, with whether each is applying and roughly when it perfects.
  function moonAspects(date) {
    var p = positions(date), q = positions(new Date(+date + 3600000)), out = [];
    BODIES.forEach(function (b) {
      if (b === 'Moon') return;
      var x = aspectOf(p.Moon, p[b], 8, 'Moon', b); if (!x) return;
      var o2 = Math.abs(sep(q.Moon, q[b]) - x.angle);
      x.planet = b; x.applying = o2 < x.orb;
      x.hoursToExact = x.applying ? x.orb / (x.orb - o2) : null;
      out.push(x);
    });
    return out.sort(function (a, b) { return a.orb - b.orb; });
  }
  // Planet-to-planet aspects within 2 degrees (the Moon excluded): the standing sky of the day.
  function skyAspects(date) {
    var p = positions(date), q = positions(new Date(+date + 6 * 3600000)), out = [];
    for (var i = 0; i < BODIES.length; i++) for (var j = i + 1; j < BODIES.length; j++) {
      var a = BODIES[i], b = BODIES[j]; if (a === 'Moon' || b === 'Moon') continue;
      var x = aspectOf(p[a], p[b], 2, a, b); if (!x) continue;
      x.p1 = a; x.p2 = b; x.applying = Math.abs(sep(q[a], q[b]) - x.angle) < x.orb; out.push(x);
    }
    return out.sort(function (a, b) { return a.orb - b.orb; });
  }
  // Void of course, traditional: no Ptolemaic aspect to the six other classical planets before the Moon leaves its sign.
  // Planets are held still while the Moon moves, which is close enough for a prototype.
  function voidMoon(date) {
    var p = positions(date), m = p.Moon, end = (Math.floor(m / 30) + 1) * 30;
    var nextLast = null;
    CLASSICAL.forEach(function (b) {
      if (b === 'Moon') return;
      [0, 60, 90, 120, 180, 240, 270, 300].forEach(function (a) {
        var t = ((p[b] + a) % 360 + 360) % 360; if (t < m) t += 360;
        if (t > m && t < end + (end < m ? 360 : 0)) nextLast = nextLast === null ? t : Math.min(nextLast, t);
      });
    });
    var speed = sep(positions(new Date(+date + 3600000)).Moon, m);
    return { isVoid: nextLast === null, entersIn: (end - m) / speed, nextSign: SIGNS[(Math.floor(m / 30) + 1) % 12] };
  }

  // Lunar timeline, matching Compass's production rule (astro.ts voidOfCourse, dayarc.ts):
  // every Moon perfection to the planets, every ingress, and void windows running from the
  // Moon's last perfection to a classical planet (Sun to Saturn) until she leaves the sign.
  var VOC_PLANETS = ['Sun', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn'];
  var ANG_NAME = { 0: 'conjunction', 60: 'sextile', 300: 'sextile', 90: 'square', 270: 'square', 120: 'trine', 240: 'trine', 180: 'opposition' };
  var ANGLES8 = [0, 60, 90, 120, 180, 240, 270, 300];
  var OTHERS = ['Sun', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'];
  function norm(x) { return ((x % 360) + 360) % 360; }
  function lunarTimeline(from, to, stepMin) {
    var STEP = (stepMin || 20) * 60000, perf = [], ingress = [];
    var t = +from, m0 = eclon('Moon', new Date(t)), prev = {};
    OTHERS.forEach(function (b) { prev[b] = norm(m0 - eclon(b, new Date(t))); });
    var prevSign = Math.floor(norm(m0) / 30);
    for (t = +from + STEP; t <= +to; t += STEP) {
      var d = new Date(t), m = eclon('Moon', d), sg = Math.floor(norm(m) / 30);
      if (sg !== prevSign) {
        var lo = t - STEP, hi = t;
        for (var k = 0; k < 12; k++) { var mid = (lo + hi) / 2; if (Math.floor(norm(eclon('Moon', new Date(mid))) / 30) !== prevSign) hi = mid; else lo = mid; }
        ingress.push({ t: new Date(hi), sign: SIGNS[sg], from: SIGNS[prevSign] }); prevSign = sg;
      }
      OTHERS.forEach(function (b) {
        var dd = norm(m - eclon(b, d)), p = prev[b];
        ANGLES8.forEach(function (A) {
          var crossed = dd >= p ? (p < A && A <= dd) : (A > p || A <= dd);
          if (crossed) {
            var span = dd >= p ? dd - p : dd + 360 - p, part = (norm(A - p)) / (span || 1);
            perf.push({ t: new Date(t - STEP + part * STEP), planet: b, aspect: ANG_NAME[A], angle: A % 180 === 0 ? A : (A > 180 ? 360 - A : A) });
          }
        });
        prev[b] = dd;
      });
    }
    perf.sort(function (a, b) { return a.t - b.t; });
    // Void windows: within each sign stretch, from the last classical perfection to the ingress.
    var voids = [], marks = [{ t: new Date(+from) }].concat(ingress);
    for (var i = 1; i < marks.length; i++) {
      var a = marks[i - 1].t, b = marks[i].t;
      var last = perf.filter(function (x) { return VOC_PLANETS.indexOf(x.planet) >= 0 && x.t >= a && x.t < b; }).pop();
      if (last) voids.push({ start: last.t, end: b, sign: marks[i].from, next: marks[i].sign, lastAspect: last });
    }
    return { perfections: perf, ingresses: ingress, voids: voids };
  }
  function mercuryRx(date) { return norm(eclon('Mercury', new Date(+date + 864e5)) - eclon('Mercury', date) + 180) - 180 < 0; }

  return { chartAngles: chartAngles, lunarTimeline: lunarTimeline, mercuryRx: mercuryRx, positions: positions, signOf: signOf, moonAspects: moonAspects, skyAspects: skyAspects, voidMoon: voidMoon, CLASSICAL: CLASSICAL, scan: scan, zodiacal: zodiacal, eclon: eclon, dms: dms, CHALDEAN: CHALDEAN, offsetMin: offsetMin, localYMD: localYMD, SIGNS: SIGNS };
})();
if (typeof module !== 'undefined') module.exports = Sky;
