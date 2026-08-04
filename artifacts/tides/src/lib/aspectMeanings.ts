/**
 * What two planets in aspect mean for your day.
 *
 * Lifted out of Sky.tsx and rewritten. The old table was the app's largest
 * concentration of AI-shaped copy: "Excellent for …" opened fourteen of the
 * seventy-two lines, abstract nouns did the acting ("emotional power and
 * psychological insight work for you"), and almost every entry resolved into a
 * three-item list. It read as a horoscope generator, which is exactly what the
 * rest of the app is written not to sound like.
 *
 * The rewrite follows the register already set by lib/alternatives and
 * PLANET_ROADS: a concrete verb, a real object, and the failure mode named
 * rather than softened. "Avoid overindulgence; clarify what you truly value"
 * became "The second helping will not fix it."
 *
 * `domains` is deliberately UNCHANGED. It is a taxonomy the page filters on,
 * not prose, and rewriting it would have altered behaviour under cover of a
 * copy edit.
 *
 * The shapes this file is not allowed to drift back into are pinned by
 * tests/aspectCopy.test.ts — a style rule nobody can enforce by memory across
 * ninety-six strings.
 */

export interface PairMeaning {
  /** The pair itself, before the angle between them is known. */
  meaning: string;
  /** Conjunction — the two merged. */
  conj: string;
  /** Trine or sextile. */
  soft: string;
  /** Square or opposition. */
  hard: string;
  domains: string[];
}

/** Keys are canonical: planets in PLANET_ORDER order, joined by "|". */
export const PAIR_MEANINGS: Record<string, PairMeaning> = {
  "Moon|Sun": {
    meaning: "What you need and what you are aiming at, in one room.",
    conj: "New Moon — the cycle starts here. What you begin now has a month to grow, so set it small enough that you are still doing it in three weeks.",
    soft: "What you want and what you need agree for once. Say the thing, make the thing, be seen doing it.",
    hard: "Needs and goals pulling opposite ways, usually around the Full Moon. Don't pick a winner today. Name both and let the week decide.",
    domains: ["Self-expression", "Confidence", "Emotional clarity"],
  },
  "Moon|Mercury": {
    meaning: "You think in feelings today, and it shows.",
    conj: "Perceptive and not remotely objective. Write it down, talk it through, sign nothing.",
    soft: "The words for the feeling actually arrive. Good for the honest message and the conversation you have rehearsed.",
    hard: "Overthinking the feeling, or feeling too much about the thought. Take notes. Decide tomorrow.",
    domains: ["Communication", "Writing", "Emotional intelligence"],
  },
  "Moon|Venus": {
    meaning: "Care and pleasure in the same gesture.",
    conj: "Comfort and company come easily. Good for hosting, for making something look right, for the person you have been meaning to see.",
    soft: "People are easy to be around and your taste is good. Make something, mend something, feed someone.",
    hard: "Wanting comfort and not being satisfied by it. The second helping will not fix it. Work out what you actually value.",
    domains: ["Relationships", "Creativity", "Pleasure", "Aesthetics"],
  },
  "Moon|Mars": {
    meaning: "Feeling arrives as action, ready or not.",
    conj: "Drive is up and so is the fuse. Spend it on something physical with an end. Do not spend it on a person.",
    soft: "Nerve and feeling point the same way. Do the thing you have been putting off — today you will finish it.",
    hard: "Short-tempered, and the feeling comes out as impatience. Move the body first. Leave the sensitive subject alone.",
    domains: ["Physical energy", "Assertiveness", "Drive"],
  },
  "Moon|Jupiter": {
    meaning: "Feeling runs generous, and a size too large.",
    conj: "Warm, confident, inclined to say yes. Good for showing work publicly or starting something you want to get big. Reread what you agreed to tomorrow.",
    soft: "The optimism is earned. Share it, celebrate it, commit to it.",
    hard: "Promising more than fits in the week. Enjoy the mood; read the details before you sign.",
    domains: ["Abundance", "Growth", "Social", "Publishing"],
  },
  "Moon|Saturn": {
    meaning: "Feeling meets the limit, and the limit holds.",
    conj: "Sober and focused. Good for the long plan and for taking something on. Not a light day, but a durable one.",
    soft: "You can sit with dull necessary work and not mind. Spend it on what needs years rather than hours.",
    hard: "Heavy — restriction, loneliness, or a mood that arrives dressed as evidence. Honour the limit. Do not build a life story out of one afternoon.",
    domains: ["Structure", "Discipline", "Long-term planning", "Responsibility"],
  },
  "Moon|Uranus": {
    meaning: "The routine gets interrupted.",
    conj: "Plans shift and insight lands sideways. Restless. Follow the novelty rather than defending the schedule.",
    soft: "Intuition goes off-script and is right. Good for the odd idea and the unfamiliar room.",
    hard: "Mood, plan, or place changes without warning. Bend. Forcing the comfortable version costs more than it saves.",
    domains: ["Innovation", "Change", "Intuition", "Disruption"],
  },
  "Moon|Neptune": {
    meaning: "The edge between you and the room goes soft.",
    conj: "Empathic and porous. Good for art and inner work, bad for contracts — you will not read the fine print today.",
    soft: "Imagination and compassion are open. Music, rest, the receptive kind of making.",
    hard: "Confused, or carrying someone else's state as your own. Check the facts before acting on the feeling.",
    domains: ["Creativity", "Spirituality", "Imagination", "Boundaries"],
  },
  "Moon|Pluto": {
    meaning: "Feeling goes all the way down.",
    conj: "Intensity peaks. What surfaces is either a relief or too much. Inner work, therapy, the buried thing.",
    soft: "You can look at hard things without flinching. Good for research, and for the conversation you have been circling.",
    hard: "Compulsive feeling and power struggles. Do not suppress it, and do not act on it in the same hour.",
    domains: ["Transformation", "Psychology", "Power", "Depth work"],
  },
  "Sun|Mercury": {
    meaning: "What you think and who you are, fused.",
    conj: "Peak clarity, no perspective. Write, plan, commit to a position — then have someone else read it.",
    soft: "You can say what you mean with authority. A good day to state a position in public.",
    hard: "Ego in the argument: stubborn, or overthinking how you come across. Listen as much as you talk.",
    domains: ["Communication", "Planning", "Decision-making"],
  },
  "Sun|Venus": {
    meaning: "Vitality and pleasure agree.",
    conj: "Charm is available and so is taste. Good for anything that has to be liked as well as correct.",
    soft: "Warm and well received. Ask for the thing; today it lands.",
    hard: "Wanting to be liked more than wanting to be right. Have the pleasant thing, then say the true one.",
    domains: ["Relationships", "Creativity", "Social", "Aesthetics"],
  },
  "Sun|Mars": {
    meaning: "Will and force, same direction or opposite.",
    conj: "Full output — bold, and slightly too much. Aim it at work rather than at people.",
    soft: "Courage and purpose line up. Do the hard version of the task.",
    hard: "Pushing and meeting resistance, with ego in the fight. Spend it physically before it finds a colleague.",
    domains: ["Drive", "Physical effort", "Courage", "Competition"],
  },
  "Sun|Jupiter": {
    meaning: "Purpose gets bigger.",
    conj: "Confidence is high and so is appetite. Good for the bigger ask. Bad for the estimate.",
    soft: "Things open up and generosity is well placed. Say yes to the wider version.",
    hard: "Overreach — promising the horizon and skipping the ground. Scale it to what you can actually build.",
    domains: ["Visibility", "Growth", "Leadership", "Ambition"],
  },
  "Sun|Saturn": {
    meaning: "Ambition meets what it costs.",
    conj: "Slow and serious. Take on the responsibility; it will hold.",
    soft: "Discipline is available and does not feel like punishment. Build the boring foundation.",
    hard: "Blocked, unrecognised, or tired of proving it. The limit is real. Work inside it rather than against it.",
    domains: ["Discipline", "Authority", "Long-term work", "Structure"],
  },
  "Mercury|Venus": {
    meaning: "Words come out well.",
    conj: "Charming and persuasive. Good for the pitch, the apology, the thing that has to sound right.",
    soft: "Easy conversation and good judgment about people. Negotiate, write, smooth something over.",
    hard: "Saying the pleasant thing instead of the accurate one. Notice which you are doing.",
    domains: ["Communication", "Aesthetics", "Diplomacy"],
  },
  "Mercury|Mars": {
    meaning: "Thinking gets fast and sharp.",
    conj: "Quick, decisive, cutting. Good for debate and for the difficult email. Reread it before it sends.",
    soft: "Mental energy with somewhere to go. Take the work that needs both speed and nerve.",
    hard: "Arguing for the sake of it, and sharp turning unkind. Slow down by one sentence.",
    domains: ["Communication", "Debate", "Decision-making"],
  },
  "Mercury|Jupiter": {
    meaning: "The idea gets ambitious.",
    conj: "Big thinking and a good pitch. Check the number you just quoted.",
    soft: "The wide view, and the words for it. Teach, publish, explain.",
    hard: "Confident about details you never checked. The shape is right; the specifics are not.",
    domains: ["Ideas", "Teaching", "Publishing", "Planning"],
  },
  "Mercury|Saturn": {
    meaning: "Thinking slows down and gets rigorous.",
    conj: "Serious and precise. Good for the contract, the audit, anything that has to be right.",
    soft: "Concentration holds. Do the careful work while it does.",
    hard: "Doubt where a decision was what was needed, and pessimism reading as realism. Decide anyway.",
    domains: ["Planning", "Writing", "Editing", "Discipline"],
  },
  "Venus|Mars": {
    meaning: "Wanting, and going after it.",
    conj: "Appetite with nerve behind it. Good for making the first move, and for making something.",
    soft: "Warmth with drive behind it. Creative work goes well, and so does asking.",
    hard: "Wanting and frustration in the same hour. Do not send it at midnight.",
    domains: ["Relationships", "Creativity", "Passion", "Art"],
  },
  "Venus|Jupiter": {
    meaning: "Pleasure with no brake fitted.",
    conj: "Generous, warm, and expensive. Good for celebrating. Check the receipt tomorrow.",
    soft: "Things go well socially and it is not luck. Ask, host, introduce two people.",
    hard: "Too much of a good thing. Enjoy it, then stop one earlier than you want to.",
    domains: ["Pleasure", "Abundance", "Social", "Aesthetics"],
  },
  "Venus|Saturn": {
    meaning: "Love meets commitment, or meets the wall.",
    conj: "Serious about people. Good for the long promise, bad for the light mood.",
    soft: "Loyalty that shows up as actual behaviour. Do the reliable thing for someone.",
    hard: "Withheld, unwanted, or counting the cost. It usually passes in a day — do not renegotiate the relationship inside it.",
    domains: ["Relationships", "Commitment", "Creative refinement"],
  },
  "Mars|Jupiter": {
    meaning: "Drive with room to run.",
    conj: "Energy and confidence together. Go further than usual, but not further than you can pay for.",
    soft: "Effort pays off more than it should. Push on the thing that matters.",
    hard: "Overcommitting, then resenting the load. Take the smaller version.",
    domains: ["Ambition", "Physical energy", "Competition", "Launches"],
  },
  "Mars|Saturn": {
    meaning: "Force meets resistance.",
    conj: "Hard grinding effort that gets somewhere. Endurance work, not speed.",
    soft: "Discipline and drive in the same hand — the best aspect there is for finishing a long job.",
    hard: "Stuck, and pushing anyway. The block is real. Redirect rather than force.",
    domains: ["Discipline", "Stamina", "Strategy", "Long-term effort"],
  },
  "Jupiter|Saturn": {
    meaning: "Growth and structure: the pair that builds things.",
    conj: "A cycle starts. Whatever you set up now you will be living inside for years, so set it up deliberately.",
    soft: "Ambition with a plan under it. Good for building the thing rather than describing it.",
    hard: "Growth and limit at odds — either the plan is too big or the frame is too tight. One has to give.",
    domains: ["Long-term planning", "Vision", "Structure", "Legacy"],
  },
};

/** Canonical order for building a pair key — Moon fastest, Pluto slowest. */
export const PLANET_ORDER = ["Moon","Sun","Mercury","Venus","Mars","Jupiter","Saturn","Uranus","Neptune","Pluto"];

export function pairKey(p1: string, p2: string): string {
  const i1 = PLANET_ORDER.indexOf(p1);
  const i2 = PLANET_ORDER.indexOf(p2);
  return i1 <= i2 ? `${p1}|${p2}` : `${p2}|${p1}`;
}
