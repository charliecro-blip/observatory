const seedTasks = [
  { text: "Draft Venus in Cancer post", category: "Writing / Study", group: "Active this week", timing: "This week", energy: "Deep focus", source: "Manual" },
  { text: "Send client follow-up email", category: "Admin / Logistics", group: "Active this week", timing: "Today", energy: "Light", source: "Manual" },
  { text: "Ask for testimonial", category: "Ask / Request / Pitch", group: "Waiting", timing: "This week", energy: "Steady", source: "Capture" },
  { text: "Review website homepage", category: "Writing / Study", group: "Incubating", timing: "This week", energy: "Medium", source: "Manual" },
  { text: "Study acupuncture notes", category: "Writing / Study", group: "Active this week", timing: "Today", energy: "Deep focus", source: "Capture" },
  { text: "Go for walk / regulate nervous system", category: "Rest / Recovery", group: "Released", timing: "Today", energy: "Low", source: "Capture" },
  { text: "Clean kitchen", category: "Home / Cleaning", group: "Unplaced", timing: "Any low-traction", energy: "Low", source: "Capture" },
  { text: "Record reel", category: "Content Recording / Visibility", group: "Active this week", timing: "This week", energy: "Steady", source: "Manual" }
];

const state = {
  capture: `write Venus post\nemail client back\nclean kitchen\nstudy points\nwalk\nask for testimonial\nschedule dentist\nrecord reel if energy`,
  captureItems: [],
  selectedFilters: new Set(),
  findCategory: "Ask / Request / Pitch",
  findDateRange: "Next 3 days",
  findDuration: "30 min"
};

const content = document.getElementById("content");
const tabs = document.querySelectorAll(".tab");

function escapeHtml(input) {
  return String(input)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function inferMetadata(line) {
  const lower = line.toLowerCase();
  const entry = {
    text: line,
    category: "Admin / Logistics",
    planetaryFamily: "Mercury family",
    likelyMode: "Light execution",
    electionLevel: "Supportive enough",
    gentlerVersion: "Open a note and sketch one small next move.",
    timing: "Unplaced",
    energy: "Medium",
    source: "Capture"
  };

  if (/write|draft|study|notes|review/.test(lower)) {
    Object.assign(entry, {
      category: "Writing / Study",
      planetaryFamily: "Mercury/Jupiter family",
      likelyMode: "Deep focus",
      electionLevel: "Good supportive window",
      gentlerVersion: "Set a 12-minute timer and make an outline only.",
      energy: "Deep focus"
    });
  }
  if (/ask|testimonial|pitch|request|reach out/.test(lower)) {
    Object.assign(entry, {
      category: "Ask / Request / Pitch",
      planetaryFamily: "Venus/Mercury family",
      likelyMode: "Relational outreach",
      electionLevel: "Prefer relational window",
      gentlerVersion: "Write a warm two-line message draft now, send later.",
      energy: "Steady"
    });
  }
  if (/clean|kitchen|home/.test(lower)) {
    Object.assign(entry, {
      category: "Home / Cleaning",
      planetaryFamily: "Moon/Saturn family",
      likelyMode: "Low-traction tending",
      electionLevel: "Any steady window",
      gentlerVersion: "Clear one surface for 8 minutes.",
      energy: "Low"
    });
  }
  if (/record|reel|video|publish/.test(lower)) {
    Object.assign(entry, {
      category: "Content Recording / Visibility",
      planetaryFamily: "Sun/Mercury family",
      likelyMode: "Visible output",
      electionLevel: "Prefer strong visibility window",
      gentlerVersion: "Record one rough take with no editing.",
      energy: "Steady"
    });
  }
  if (/email|reply|schedule|logistics|dentist/.test(lower)) {
    Object.assign(entry, {
      category: "Admin / Logistics",
      planetaryFamily: "Mercury/Saturn family",
      likelyMode: "Quick admin",
      electionLevel: "Supportive enough",
      gentlerVersion: "Send one short reply or book one thing.",
      energy: "Light"
    });
  }
  if (/walk|rest|recover|regulate/.test(lower)) {
    Object.assign(entry, {
      category: "Rest / Recovery",
      planetaryFamily: "Moon/Venus family",
      likelyMode: "Nervous system recovery",
      electionLevel: "No election needed",
      gentlerVersion: "Take a 10-minute walk and stop there.",
      energy: "Low"
    });
  }

  if (/today|now|asap/.test(lower)) entry.timing = "Today";
  else if (/tomorrow/.test(lower)) entry.timing = "Tomorrow";
  else if (/week|later/.test(lower)) entry.timing = "This week";

  return entry;
}

function card(title, body) {
  return `<section class="card"><h3>${escapeHtml(title)}</h3>${body}</section>`;
}

tabs.forEach((tab) => tab.addEventListener("click", () => {
  tabs.forEach((t) => t.classList.remove("active"));
  tab.classList.add("active");
  render(tab.dataset.tab);
}));

function renderCapture() {
  const chipOptions = [
    "Today", "Tomorrow", "This week", "Low", "Deep focus",
    "Writing / Study", "Ask / Request / Pitch", "Home / Cleaning", "Content Recording / Visibility", "Admin / Logistics", "Rest / Recovery"
  ];

  content.innerHTML = `<div class="grid two">
    ${card("Capture Dump", `<p>What's asking for attention?</p><p class="muted">Dump it here. You do not have to organize it yet.</p><textarea id="captureInput">${escapeHtml(state.capture)}</textarea><div class="chips selectable" id="filterChips">${chipOptions.map((c) => `<button type='button' class='chip toggle-chip ${state.selectedFilters.has(c) ? "selected" : ""}' data-chip='${escapeHtml(c)}'>${escapeHtml(c)}</button>`).join("")}</div><button class="primary" id="addBtn">Refresh preview</button>`)}
    ${card("Parsed Preview", `<div id="preview"></div><p class="small muted">Mock inference adds product-language category, planetary family, likely mode, election level, and a gentler version.</p><p class="small muted">Future sources: Google Calendar, Notion, Apple Notes (not connected yet)</p>`)}
  </div>`;

  const text = document.getElementById("captureInput");
  const preview = document.getElementById("preview");
  const filterChips = document.getElementById("filterChips");
  const addBtn = document.getElementById("addBtn");

  const renderCards = () => {
    const lines = text.value.split("\n").map((x) => x.trim()).filter(Boolean);
    state.capture = text.value;
    const items = lines.map(inferMetadata);
    const filters = Array.from(state.selectedFilters);
    const filtered = filters.length ? items.filter((it) => filters.some((f) => [it.timing, it.energy, it.category].includes(f))) : items;
    preview.innerHTML = filtered.map((item) => `<article class='preview-card'>
      <p class='preview-title'>${escapeHtml(item.text)}</p>
      <div class='chips'>
        <span class='chip'>${escapeHtml(item.category)}</span>
        <span class='chip'>${escapeHtml(item.planetaryFamily)}</span>
        <span class='chip'>${escapeHtml(item.likelyMode)}</span>
        <span class='chip'>${escapeHtml(item.electionLevel)}</span>
      </div>
      <p class='small muted'><strong>Gentler version:</strong> ${escapeHtml(item.gentlerVersion)}</p>
    </article>`).join("") || "<p class='muted small'>No items match selected chips.</p>";
    state.captureItems = items;
  };

  filterChips.addEventListener("click", (e) => {
    const target = e.target;
    if (!(target instanceof HTMLElement) || !target.dataset.chip) return;
    const v = target.dataset.chip;
    state.selectedFilters.has(v) ? state.selectedFilters.delete(v) : state.selectedFilters.add(v);
    renderCapture();
  });
  text.addEventListener("input", renderCards);
  addBtn.addEventListener("click", renderCards);
  renderCards();
}

function renderTasks() {
  const groups = ["Unplaced", "Active this week", "Incubating", "Waiting", "Released"];
  const blocks = groups.map((group) => {
    const rows = seedTasks.filter((t) => t.group === group).map((task) => `<article class='task-row'>
      <p class='preview-title'>${escapeHtml(task.text)}</p>
      <div class='chips'><span class='chip source-chip'>${escapeHtml(task.source)}</span><span class='chip'>${escapeHtml(task.category)}</span><span class='chip'>${escapeHtml(task.timing)}</span><span class='chip'>${escapeHtml(task.energy)}</span></div>
    </article>`).join("") || "<p class='small muted'>None yet.</p>";
    return `<section class='task-group'><h4>${escapeHtml(group)}</h4>${rows}</section>`;
  }).join("");

  content.innerHTML = `${card("Task Pool (Mock)", `<p class='muted'>Grouped by stage to support gentle pacing.</p>${blocks}`)}`;
}

function getFindResults() {
  const map = {
    "Ask / Request / Pitch": ["Today 4:20pm–5:15pm · Venus hour", "Sunday 10:10am–10:45am · Mercury/Jupiter blend"],
    "Writing / Study": ["Tuesday 9:00am–10:30am · Mercury support", "Wednesday 8:30am–9:15am · Quiet focus"],
    "Home / Cleaning": ["Today 1:10pm–1:45pm · Low-traction", "Saturday 10:00am–10:30am · Grounding"],
    "Content Recording / Visibility": ["Wednesday 11:00am–12:00pm · Visibility window", "Tuesday 11:00am–11:35am · Sun/Mercury support"],
    "Admin / Logistics": ["Today 12:00pm–12:30pm · Quick admin", "Monday 2:00pm–3:00pm · Logistics clean-up"],
    "Rest / Recovery": ["Today 3:15pm–3:45pm · Recovery pause", "Sunday 4:00pm–4:40pm · Nervous system reset"]
  };
  return map[state.findCategory] || map["Admin / Logistics"];
}

function renderFind() {
  const categories = ["Writing / Study", "Ask / Request / Pitch", "Home / Cleaning", "Content Recording / Visibility", "Admin / Logistics", "Rest / Recovery"];
  const ranges = ["Next 3 days", "This week", "Next 2 weeks"];
  const durations = ["20 min", "30 min", "45 min", "60 min"];
  const results = getFindResults();

  content.innerHTML = `<div class='grid two'>
    ${card("Find a Time", `<p>Choose controls, then get category-aware mock windows.</p>
      <label class='small'>Event category</label><select id='findCategory'>${categories.map((c) => `<option ${c === state.findCategory ? "selected" : ""}>${escapeHtml(c)}</option>`).join("")}</select>
      <label class='small'>Date range</label><select id='findRange'>${ranges.map((r) => `<option ${r === state.findDateRange ? "selected" : ""}>${escapeHtml(r)}</option>`).join("")}</select>
      <label class='small'>Duration</label><select id='findDuration'>${durations.map((d) => `<option ${d === state.findDuration ? "selected" : ""}>${escapeHtml(d)}</option>`).join("")}</select>
      <p class='small muted'><strong>Intent:</strong> ${escapeHtml(state.findCategory)} · ${escapeHtml(state.findDuration)} · ${escapeHtml(state.findDateRange)}</p>`) }
    ${card("Best Available Windows (Mock)", `<ol class='list'>${results.map((r) => `<li><strong>${escapeHtml(r)}</strong><br/><span class='small'>Category-tuned mocked result.</span></li>`).join("")}</ol>`)}
  </div>`;

  ["findCategory", "findRange", "findDuration"].forEach((id) => {
    document.getElementById(id).addEventListener("change", (e) => {
      const value = e.target.value;
      if (id === "findCategory") state.findCategory = value;
      if (id === "findRange") state.findDateRange = value;
      if (id === "findDuration") state.findDuration = value;
      renderFind();
    });
  });
}

function renderWeek() {
  content.innerHTML = `${card("Week of May 25–31", `<p>A week for preparation, visibility, and careful pacing.</p><p class='muted small'>Early week favors sorting and drafting. Midweek has stronger communication windows. End the week with simplification and recovery.</p>`) }
  <div class="grid two" style="margin-top:1rem;">
    ${card("Weekly Rhythm Map", `<p><strong>Mon:</strong> planning/admin/study</p><p><strong>Tue:</strong> writing and structure</p><p><strong>Wed:</strong> visibility and outreach</p><p><strong>Thu:</strong> cleanup and integration</p><p><strong>Fri:</strong> relationship and repair</p><p><strong>Sat:</strong> home/body tending</p><p><strong>Sun:</strong> rest + prepare lightly</p>`) }
    ${card("Suggested Sessions", `<ul class='list'>
      <li>Writing: Tue 9:00–10:30am <button class='ghost place-btn' data-session='Writing session Tue 9:00–10:30am'>Place on calendar (mock)</button></li>
      <li>Admin: Mon 2:00–3:00pm <button class='ghost place-btn' data-session='Admin session Mon 2:00–3:00pm'>Place on calendar (mock)</button></li>
      <li>Visibility: Wed 11:00am–12:00pm <button class='ghost place-btn' data-session='Visibility session Wed 11:00am–12:00pm'>Place on calendar (mock)</button></li>
    </ul><p id='calendarConfirm' class='small muted'></p>`) }
  </div>`;

  document.querySelectorAll(".place-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const session = btn.dataset.session || "Session";
      document.getElementById("calendarConfirm").textContent = "Calendar placement mocked. Future versions will ask for approval before writing to calendar.";
    });
  });
}

function renderToday() {
  content.innerHTML = `<div class="grid two">
    ${card("Friday, May 22", `<p class="muted">Austin, TX · 11:18am</p><p>A day for sorting before visibility.</p>`)}
    ${card("Current Time Weather", `<p><strong>Mercury Hour</strong> · Moon applying to Jupiter · Moon in Virgo, waxing</p><p class="small">Mercury near the Midheaven at 11:42am. This is a good window for language, planning, study, and messages with a little more confidence behind them.</p><div class="chips"><span class="chip">writing</span><span class="chip">email</span><span class="chip">study</span><span class="chip">teaching prep</span></div><p class="small muted">Move gently around: overcommitting, making the task too big.</p>`)}
    ${card("What Now", `<ol class="list"><li>Draft Venus in Cancer post</li><li>Send client follow-up email</li><li>Study acupuncture notes</li><li>Take a 20-minute walk for nervous system regulation</li></ol><p class="small muted"><strong>Gentler version:</strong> Open one draft and make a 10-line note list.</p>`)}
    ${card("Coming Up", `<p><strong>11:40am–12:25pm</strong> · Mercury near MC<br/>Good for recording, writing, teaching, calls.</p><p><strong>1:10pm–2:05pm</strong> · Moon begins a void period<br/>Better for review, cleanup, rest, loose ends.</p><p><strong>4:20pm–5:15pm</strong> · Venus hour<br/>Better for design, soft outreach, relational repair.</p>`)}
    ${card("Today's Task Matches", `<p><strong>Fits now:</strong> Draft Venus post, client follow-up, study notes</p><p><strong>Better later:</strong> Record reel, relationship text</p><p><strong>Low-traction window:</strong> Clean kitchen, review notes, rest</p>`)}
  </div>`;
}

function render(tab) { ({ today: renderToday, capture: renderCapture, week: renderWeek, tasks: renderTasks, find: renderFind }[tab] || renderToday)(); }
render("today");
