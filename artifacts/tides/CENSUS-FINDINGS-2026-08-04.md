# Uncapped census — what the valid measurement says

Method: day by day across 30 days, `span: "day"` (chronological, uncapped), all
46 activities, one timed natal chart, San Antonio, October 2026. The harness
now asserts it evaluated all 46 activities across all 30 distinct days before
reporting any frequency, and fails if any activity's count lands on exactly 14
— the month-span selection limit that invalidated the earlier figures.

## Results

| | |
|---|---|
| total windows | 7,361 |
| supported | 6,224 |
| **convergent** | **1,137 (15%)** |
| activities ever convergent | 42 of 46 |
| median convergent days per activity per month | **7** |
| max | 30 |

## Family presence, as a share of activity-days

| family | fires on | role in the contract |
|---|---|---|
| `planetary-time` | **99%** | reinforcing |
| `natal-house` | 41% | reinforcing |
| `lunar-contact` | 39% | establishing |
| `lunar-condition` | 33% | reinforcing |
| `standing-sky` | 11% | establishing |
| `natal-contact` | 5% | establishing |

## What this settles

**My hypothesis was wrong.** I predicted `lunar-contact` was near-continuous
and therefore too undiscriminating to establish convergence. It fires on 39% of
activity-days — roughly two days in five. That is an event, not an ambient
condition.

**The near-continuous family is `planetary-time`, at 99%.** It is present on
essentially every activity-day, which is precisely why it cannot establish
anything. The doctrinal ruling — that planetary hours are independent enough to
appear in the evidence but not discriminating enough to establish convergence
without additional testimony — is confirmed by measurement it was not derived
from. It was decided on doctrine and the census agrees.

**The establishing/reinforcing split lines up with the frequency data almost
exactly.** The three establishing families are the three least frequent
(39%, 11%, 5%). The three reinforcing families include the two most frequent
(99%, 41%). Nobody chose them that way — they were assigned on whether a family
is relational and event-specific — and the ordering fell out.

**Per activity, convergence is genuinely scarce**: a median of 7 days a month.
The alarming "every one of 30 days" figure was the pooled union across all 46
activities, which is not a quantity anyone experiences.

## What this does NOT settle

Cadence per palette. 1,137 convergent windows across 46 activities is not a
user-facing number, and the episode deduplication has not been re-run on census
data. Until it is, the honest statement remains:

> Convergence is intended to be discriminating. Its actual cadence for a real
> activity palette is not yet established.

The next measurement is episodes — anchor-and-overlap merged — computed from the
census rather than from a ranked selection, and reported per representative
palette per week.

## The methodological finding, worth keeping

**A route designed to return the top N recommendations cannot double as a
calibration census.** `span: "month"` returns fourteen score-ranked windows;
reading a frequency off it converts a product-selection limit into a scientific
conclusion, and does so in a consistently flattering direction, because the
highest-scoring windows are exactly the ones carrying the most agreeing
families.

The harness now proves its own sample shape before reporting anything from it.
Measurement APIs and product-ranking APIs must stay separate.
