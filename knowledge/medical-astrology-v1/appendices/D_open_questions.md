# Appendix D — Open Questions

## Purpose

Throughout the reference, individual entries close with a section of **open questions for Charlie** — doctrinal, design, and implementation questions that arose while drafting the content and that need Charlie's decision (or further investigation, or simply explicit acknowledgment that the question is open).

This appendix consolidates all open questions in one place for systematic review. Questions are grouped by part / area of the reference. Where a question is duplicated across multiple entries (e.g., "modern outers — how loud?"), it appears once here with a note about where it was raised.

The aim of this appendix is not to demand answers — it is to **make the open questions visible** so that decisions can be made deliberately rather than by default.

---

## Part I — Foundations (`01_foundations.md`)

The foundations file was drafted earlier in the project and didn't include a formal open-questions section. Items arising:

1. **Tone calibration of the "what disease meant" section** — the historical doctrine of disease as humoral imbalance is foreign to modern medical readers. Is the framing currently struck right between historical fidelity and contemporary accessibility?

---

## Part II — Planets

### Across the planet entries

2. **Modern outers (Uranus, Neptune, Pluto) prominence.** Raised in the Scorpio/Pluto, Aquarius/Uranus, and Pisces/Neptune sign entries and in each modern-outer planet entry. How loud should the modern adjunct be in user-facing copy? Default: modern attribution is an interpretive overlay, not a dignity-bearing ruler; user copy uses it where it's clearly helpful, otherwise hold to the seven classical planets.

3. **Pluto co-rulership formal status.** Is Pluto a co-ruler of Scorpio (modern doctrine), an interpretive overlay (Observatory's current default), or held entirely outside the rulership system? Decision affects how the Workbench's dignity calculator handles Pluto.

4. **The malefic/benefic translation** — Observatory translates "malefic" to "demanding" and "benefic" to "supportive" for user copy. Is the translation language final, or do alternative wordings warrant testing?

5. **Sect doctrine prominence.** The diurnal/nocturnal distinction is a strong traditional teaching that the modern audience often hasn't been exposed to. How prominently does it appear in user copy vs. practitioner Workbench?

### Saturn entry specifically

6. **Saturn return** as a body-weather event — does it get its own Body Weather feature (and similar treatment for Jupiter return, Uranus square, etc.)?

7. **Saturn-as-resource framing** — the "Saturn as patience teacher" / "Saturn as boundary-setter" Observatory reframings are the heaviest translation work in the planet entries. Are they currently struck right between honoring the traditional gravity and refusing the fatalistic register?

---

## Part III — Zodiac signs

### Across the sign entries

8. **Sun-sign personality firewall consistency** — each sign entry includes a firewall against popular sun-sign personality readings. Are these firewalls verbose enough or too verbose? Could they be consolidated into a single Part X cross-reference?

9. **Body-region claim calibration for medical conditions** — each sign carries firewalls against specific clinical conditions in its body region (e.g., Taurus → no thyroid attribution; Cancer → no breast cancer attribution). Currently extensive. Is the volume of these firewalls right, or do they need to be more selective?

### Specific sign entries

10. **Aries — head/face/brain attribution** — modern medical-astrology readers sometimes expect mental-illness pattern-matching from Aries-head. The Aries firewall holds; should it be explicit at greater length?

11. **Cancer — cancer-the-disease firewall** — currently extensively documented because of the etymological coincidence. Is the architecture (heavy firewall at top, integrated throughout) optimal?

12. **Leo — cardiac firewall** — Leo's heart attribution requires careful firewall language. Is the current calibration right?

13. **Virgo — gut and assimilation register** — modern microbiome interest creates pressure for chart-derived gut-health readings; Observatory's firewall holds these out. Is the user-facing language strong enough?

14. **Libra — adrenals attribution** — modern extension via the kidneys. Included as a soft inheritance (current default) or held out?

15. **Scorpio — sexuality language calibration** — the entry treats sexuality matter-of-factly. Confirm this is the right register for user copy.

16. **Sagittarius — TCM Liver-Wood convergence** — this is the strongest cross-tradition convergence in the reference. Should it get a dedicated longer teaching note?

17. **Capricorn — joints generally vs. knees specifically** — Observatory's default is the layered reading. Confirm.

18. **Aquarius — peripheral nervous system attribution** — modern extension. Standard register or only when Aquarius is heavily engaged?

19. **Pisces — autoimmune and addiction firewalls** — these are heaviest in the Pisces (and Neptune) territory. Confirm the language.

### Axes file specifically

20. **Per-axis standalone files** — the six axes are currently treated in a single consolidated file. Each could be expanded into its own file. Is this needed?

21. **Cancer-Capricorn Stomach-Earth inversion** — Western Cancer-Moon-stomach vs. TCM Saturn-Earth-stomach is doctrinally interesting. Should it get deeper treatment in Part XI?

---

## Part IV — Houses

### Across the house entries

22. **House system default — confirmed Whole-Sign.** First-chart UX: offer the user a choice, or show Whole-Sign default with a "switch system" option?

23. **Practitioner vs. physician — 7th vs. 10th attribution.** Observatory's resolution: 7th for the physician-as-person, 10th for the medicine. Confirm.

24. **The cadent-house teaching for the 6th** — the cadent-house dignity reading combined with the "house of illness" attribution can land as "your illness placements are weak." Is the practitioner-side-only handling current correct?

25. **Father vs. mother — 4th vs. 10th** — sources differ on which parent goes to which angular house. Currently documented without enforcement. Is user-customizable preference needed?

26. **The 12th-house translation work** — the heaviest in the reference. Confirm architecture: document the doctrine, translate explicitly, exclude the fatalistic content.

27. **Derived chart logic** — surface to advanced users via Workbench, or hold strictly to practitioner mode?

28. **8th-house mortality content architecture** — the exclusion is at the top of the entry and restated at the bottom; is this the right structure?

---

## Part V — Temperament & Constitution

29. **Clarity-gating thresholds** — currently 20% combination gap and 30% single-quality gap. Calibration: are these the right numbers, or do they need adjustment from practical use?

30. **Eleven-factor weights** — confirmed from the Haley worksheet. Should the engine support user-customizable weights for practitioners who use different schemes?

31. **Planetary day/hour as constitutional signature** — surfaced as a secondary signature with practical cultivation register. How prominent in user copy vs. Workbench?

32. **TCM constitutional cross-reference in Blueprint** — Observatory currently holds the two systems side by side. Should there be a user-facing "compare with TCM constitutional type" option?

33. **Physical-appearance content from the classical sources** — currently held very light. Confirm.

34. **Lifespan changes** — temperaments shift with age. Observatory currently doesn't adjust for age. Should it?

---

## Part VI — Body Weather

35. **Default Body Weather output volume** — currently 1-3 signals at a time. Confirm.

36. **Eight-phase Moon vs. four-phase Moon** — default which?

37. **Planetary hour layer** — surfaced by default or opt-in?

38. **Eclipse and major-ingress dedicated content** — separate articles or folded into daily Body Weather?

39. **Body Weather frequency** — daily push, on-demand, or both?

40. **Composite (natal × transit) generation** — templated patterns vs. fresh narrative each day. Implementation question.

---

## Part VII — Decumbiture

41. **Decumbiture module surfacing** — opt-in or automatic? Default: opt-in given safety stakes.

42. **Critical-days reflection markers** — scheduled prompts or only in initial reading?

43. **Four-party frame in user copy** — fully exposed or gradual?

44. **Practitioner mode for decumbiture** — same exclusions as user mode, with deeper technical access. Confirm.

45. **Decumbiture for someone else** (a practitioner casting for a patient) — supported or self-only?

46. **Onset-chart breadth** — illness onset only, or also treatment-start, hospitalization, diagnosis?

---

## Part VIII — Materia Medica & Herbal Compass

47. **Toxic plants — included with prominent warnings (current default) or excluded entirely from Compass?** Default current; confirm.

48. **TCM annotations on Compass** — when does this layer get built? (Initial build is Western-traditional.)

49. **Modern clinical-evidence layer for plants** — included or held strictly historical-symbolic?

50. **Practitioner mode for Compass** — same scope limits as user mode, or deeper access to classical clinical content?

51. **User journey for actual herbal use** — referral language and pathway to qualified practitioners. Vetted practitioner directory?

---

## Part IX — Workbench

52. **Workbench access** — open to all interested users, or gated to verified practitioners?

53. **Report sharing settings** — defaults (expiring links, practitioner-bound accounts).

54. **House system per chart vs. system-wide** — currently per-chart with Whole-Sign default. Confirm.

55. **Future Ayurvedic integration in Workbench** — roadmap and scope.

56. **Practitioner directory** — Observatory-vetted or user-found?

57. **Multi-user / clinic mode** — practitioners working with multiple users, with appropriate consent and data separation. In scope for Workbench or separate module?

---

## Part X — Safety Floor

58. **Translation protocol visibility** — currently used as internal documentation format. Should there be a user-facing toggle to "see the traditional source"?

59. **Visible "what Observatory doesn't do" language** — proactive communication of the firewalls in user copy. How prominent?

60. **No medical-authority impression** — visual / design implications. How is this enforced in the design system?

61. **Practitioner-agreement language** for Workbench — scope-of-practice acknowledgment. Format and location?

62. **Crisis resources** — region-appropriate listings. Maintenance and localization model.

63. **Cultural sensitivity in framing** — assumes a Western-clinical referral model. Adaptation for other contexts.

---

## Part XI — Cross-Tradition

64. **Planet-to-element mappings** — current defaults documented. Specific changes Charlie wants?

65. **Ayurvedic integration timeline / priority.**

66. **TCM annotations on Herbal Compass** — when?

67. **Yin/yang meta-frame prominence** — currently used selectively. More prominent in user copy?

68. **Vedic astrology (Jyotisha) mode** — sidereal vs. tropical. Planned?

69. **Practitioner cross-tradition self-identification** — informs how the system surfaces content?

---

## Appendix A — Sources

70. **Modern source partnerships** — which contemporary practitioners should Observatory partner with or seek permission from?

71. **Cornell edition sourcing** — rights-clear early edition vs. most-complete revised edition.

72. **Ayurvedic source roadmap.**

73. **User reading list curation.**

74. **"Translator's notes" appendix** — explicit documentation of key translation choices. Add it?

---

## Appendix B — Glossary

75. **Glossary depth — single layer or beginner / practitioner split?**

76. **Cross-references in glossary entries** — currently inline; add "see also" patterns?

77. **TCM and (future) Ayurvedic terms** — alongside Western or in subsections?

78. **Pronunciation aids for Greek/Latin terms** — included?

---

## Appendix C — Tables

79. **Table format / renderer compatibility.**

80. **Sign symbols, planet symbols, aspect glyphs** — higher visibility in tables?

81. **Cross-references from table cells to long entries** — implementation question.

82. **Ayurvedic correspondence tables (future) location.**

83. **Practitioner-grade tables** (asteroids, Arabic parts, fixed stars) — out of scope or future?

---

## Cross-cutting questions

84. **Integration with the Replit-developed app codebase** — Charlie's noted intention to integrate this reference with the app's read/write access for future GPT-mediated work. Roadmap?

85. **Versioning and source-of-truth management** — as the reference evolves, how is the canonical version managed across the app and the reference?

86. **Translation work for non-English-speaking users** — Observatory's reference is currently English-only. Anticipated translation strategy?

87. **Accessibility** — the reference is text-heavy. Image, audio, alternative-format access for users with different needs?

88. **Practitioner contribution model** — practitioners using the Workbench could contribute back (improvements to readings, corrections, expansions). Mechanism for this?

89. **User testing and feedback loops** — how does Observatory learn what's landing and what isn't? Feedback infrastructure?

90. **Update cadence** — when does the reference get revised? Quarterly, annually, on-demand?

---

## How to use this appendix

Charlie can work through these questions in any order. Some are quick decisions (e.g., "confirm current default"); some are substantial design choices that involve broader system architecture or partnership decisions.

Working pattern suggestion:
1. **Quick confirmations first** — go through and ratify (or change) the current defaults.
2. **Doctrinal decisions next** — the questions affecting how the reference reads (modern outers, cross-tradition prominence, etc.).
3. **Implementation questions in parallel** — the engineering and UX questions that affect the modules.
4. **Long-horizon items last** — partnerships, future expansions, internationalization.

The reference is **drafted** but **not frozen**. As questions are resolved, the relevant entries can be updated; the build-status table in the index can track the revision.
