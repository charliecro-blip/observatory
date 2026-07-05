// The canonical glyph sets — planets, signs, aspects — in ONE place.
// Before this module, 14 files each carried their own copy of these maps, so a
// glyph change meant a 14-file hunt (the air-color fix touched 10). Import from
// here; when the bespoke designed glyph set lands, it lands everywhere at once.
//
// Colors are deliberately NOT consolidated here yet: element/planet palettes
// still vary per surface and are part of the active design-glyph work.

export const PLANET_GLYPH: Record<string, string> = {
  Sun: "☉", Moon: "☽", Mercury: "☿", Venus: "♀", Mars: "♂",
  Jupiter: "♃", Saturn: "♄", Uranus: "♅", Neptune: "♆", Pluto: "♇",
};

export const SIGN_GLYPH: Record<string, string> = {
  Aries: "♈", Taurus: "♉", Gemini: "♊", Cancer: "♋", Leo: "♌", Virgo: "♍",
  Libra: "♎", Scorpio: "♏", Sagittarius: "♐", Capricorn: "♑", Aquarius: "♒", Pisces: "♓",
};

// Lowercase aspect names (the API's convention after .toLowerCase()).
export const ASPECT_GLYPH: Record<string, string> = {
  conjunction: "☌", opposition: "☍", square: "□", trine: "△", sextile: "⚹",
};
