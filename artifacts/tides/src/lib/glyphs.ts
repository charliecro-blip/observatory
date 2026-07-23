// The canonical glyph sets — planets, signs, aspects — in ONE place.
// Before this module, 14 files each carried their own copy of these maps, so a
// glyph change meant a 14-file hunt (the air-color fix touched 10). Import from
// here; when the bespoke designed glyph set lands, it lands everywhere at once.
//
// Colors are deliberately NOT consolidated here yet: element/planet palettes
// still vary per surface and are part of the active design-glyph work.

// Every glyph carries U+FE0E (text-presentation selector) — without it,
// browsers swap in color emoji instead of the line glyph. Pluto is U+2BD3
// (circle-in-crescent over cross) per the design handoff, NOT U+2647 ("PL").
const T = "\uFE0E";

export const PLANET_GLYPH: Record<string, string> = {
  Sun: "☉" + T, Moon: "☽" + T, Mercury: "☿" + T, Venus: "♀" + T, Mars: "♂" + T,
  Jupiter: "♃" + T, Saturn: "♄" + T, Uranus: "♅" + T, Neptune: "♆" + T,
  Pluto: String.fromCodePoint(0x2bd3) + T,
  Chiron: String.fromCodePoint(0x26b7) + T, // ⚷ — the centaur's key
  "North Node": "☊" + T, "South Node": "☋" + T, // the lunar nodes / eclipse axis
  Ceres: String.fromCodePoint(0x26b3) + T, Pallas: String.fromCodePoint(0x26b4) + T, Juno: String.fromCodePoint(0x26b5) + T, Vesta: String.fromCodePoint(0x26b6) + T,
};

export const SIGN_GLYPH: Record<string, string> = {
  Aries: "♈" + T, Taurus: "♉" + T, Gemini: "♊" + T, Cancer: "♋" + T, Leo: "♌" + T, Virgo: "♍" + T,
  Libra: "♎" + T, Scorpio: "♏" + T, Sagittarius: "♐" + T, Capricorn: "♑" + T, Aquarius: "♒" + T, Pisces: "♓" + T,
};

// Lowercase aspect names (the API's convention after .toLowerCase()).
export const ASPECT_GLYPH: Record<string, string> = {
  conjunction: "☌" + T, opposition: "☍" + T, square: "□" + T, trine: "△" + T, sextile: "⚹" + T,
};
