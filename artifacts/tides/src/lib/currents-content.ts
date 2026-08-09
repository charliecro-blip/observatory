// House meanings — the survivor of the retired Currents (long-term) view.
// The page died 2026-08; HOUSE_MEANINGS outlived it because it's the shared
// vocabulary for houses everywhere (TransitTake, Planets, GuidingStarsHub).

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
