// Content layer for the Currents (long-term) view.
// House domains × activating-planet mode → emphasis + practices.

export interface HouseMeaning {
  title: string;
  domains: string;      // short phrase
  keywords: string[];
}

export const HOUSE_MEANINGS: Record<number, HouseMeaning> = {
  1:  { title: "Self & Body",        domains: "identity, vitality, how you show up", keywords: ["body", "identity", "beginnings", "presence"] },
  2:  { title: "Resources & Worth",  domains: "money, possessions, self-worth",      keywords: ["income", "values", "resources", "stability"] },
  3:  { title: "Mind & Voice",       domains: "communication, learning, siblings",   keywords: ["writing", "study", "local life", "exchange"] },
  4:  { title: "Home & Roots",       domains: "family, home, foundations, ancestry", keywords: ["home", "family", "roots", "private life"] },
  5:  { title: "Creativity & Play",  domains: "creativity, romance, children, joy",  keywords: ["creativity", "romance", "play", "self-expression"] },
  6:  { title: "Work & Health",      domains: "daily work, health, service, craft",  keywords: ["routine", "health", "service", "skill"] },
  7:  { title: "Partnership",        domains: "relationships, contracts, the other",  keywords: ["partnership", "commitment", "others", "balance"] },
  8:  { title: "Depths & Sharing",   domains: "intimacy, shared resources, rebirth", keywords: ["intimacy", "transformation", "shared money", "depth"] },
  9:  { title: "Meaning & Horizon",  domains: "travel, study, philosophy, belief",   keywords: ["travel", "higher study", "meaning", "publishing"] },
  10: { title: "Vocation & Public",  domains: "career, reputation, public role",     keywords: ["career", "reputation", "authority", "calling"] },
  11: { title: "Community & Hopes",  domains: "friends, networks, goals, groups",    keywords: ["community", "friends", "goals", "networks"] },
  12: { title: "Retreat & Spirit",   domains: "solitude, spirituality, the unseen",  keywords: ["retreat", "rest", "spirituality", "release"] },
};

export interface PlanetMode {
  label: string;
  mode: string;        // the verb of how it activates a house
  color: string;
  arc: string;         // rough duration in a house
  emphasis: (houseTitle: string, domains: string) => string;
  practices: (domains: string) => string[];
}

export const PLANET_MODES: Record<string, PlanetMode> = {
  Jupiter: {
    label: "Jupiter", mode: "expands", color: "#c08040", arc: "~1 year",
    emphasis: (h, d) => `A year of growth and opportunity in ${h.toLowerCase()} — ${d}. Doors open here; say yes, go bigger, take the meeting.`,
    practices: (d) => [`Invest time and ambition into ${d}`, "Take an opportunity you'd normally decline", "Learn or teach in this area"],
  },
  Saturn: {
    label: "Saturn", mode: "tests & structures", color: "#807060", arc: "~2.5 years",
    emphasis: (h, d) => `A chapter of consolidation and testing in ${h.toLowerCase()} — ${d}. Slow, real, earned. Build the structure that lasts; expect to prove it.`,
    practices: (d) => [`Commit to a disciplined practice around ${d}`, "Cut what's not working; keep what's essential", "Build slowly — no shortcuts"],
  },
  Uranus: {
    label: "Uranus", mode: "disrupts & frees", color: "#3090a0", arc: "~7 years",
    emphasis: (h, d) => `A long awakening in ${h.toLowerCase()} — ${d}. Old forms break so something freer can emerge. Expect the unexpected; loosen your grip.`,
    practices: (d) => [`Experiment radically with ${d}`, "Release an outdated commitment here", "Allow disruption rather than forcing stability"],
  },
  Neptune: {
    label: "Neptune", mode: "dissolves & inspires", color: "#4060a0", arc: "~14 years",
    emphasis: (h, d) => `A long, subtle dissolving in ${h.toLowerCase()} — ${d}. Boundaries soften; inspiration and confusion both rise. Stay discerning, stay porous.`,
    practices: (d) => [`Bring imagination or spiritual practice to ${d}`, "Watch for illusion or escapism here", "Let go of rigid definitions"],
  },
  Pluto: {
    label: "Pluto", mode: "transforms", color: "#6a4a70", arc: "~15–20 years",
    emphasis: (h, d) => `A deep, generational transformation in ${h.toLowerCase()} — ${d}. What is here will be rebuilt from the ground up. Face it honestly; don't cling.`,
    practices: (d) => [`Do the deep, honest work around ${d}`, "Release control; allow the death-and-rebirth", "Reclaim power you've given away here"],
  },
};

// Profection year — what it means to have a given house lit up for the year.
export const PROFECTION_GUIDANCE: Record<number, string> = {
  1:  "A year about you — body, identity, fresh starts. Your vitality and direction are the theme. Tend yourself first.",
  2:  "A year about resources and worth — money, stability, what you value. Build your material and inner foundations.",
  3:  "A year about mind and voice — learning, writing, communication, siblings, local life. Say things; move information.",
  4:  "A year about home and roots — family, dwelling, foundations, the past. Tend the base you stand on.",
  5:  "A year about creativity and joy — self-expression, romance, children, play. Make things; let pleasure lead.",
  6:  "A year about work and health — routines, service, craft, the body's maintenance. Refine how you actually spend your days.",
  7:  "A year about partnership — relationships, contracts, the significant other. Meet the world through one-to-one.",
  8:  "A year about depth and sharing — intimacy, shared resources, transformation, endings. Go beneath the surface.",
  9:  "A year about meaning and horizon — travel, study, philosophy, belief, publishing. Widen your world.",
  10: "A year about vocation and the public — career, reputation, calling, authority. You're more visible; step up.",
  11: "A year about community and hopes — friends, networks, groups, long-term goals. Belong; build toward the future.",
  12: "A year about retreat and spirit — solitude, rest, the unconscious, release. Withdraw to restore; let go of what's ending.",
};

export function composePlacement(planet: string, house: number) {
  const mode = PLANET_MODES[planet];
  const h = HOUSE_MEANINGS[house];
  if (!mode || !h) return null;
  return {
    planet,
    house,
    houseTitle: h.title,
    color: mode.color,
    arc: mode.arc,
    emphasis: mode.emphasis(h.title, h.domains),
    practices: mode.practices(h.domains),
  };
}
