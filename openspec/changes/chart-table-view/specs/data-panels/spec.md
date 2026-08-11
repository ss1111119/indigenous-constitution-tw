## ADDED Requirements

### Requirement: Charts drawn on canvas carry a text alternative

A chart drawn on a `canvas` element conveys nothing to assistive technology on its own. Every such chart SHALL carry an accessible name and summary describing what the chart shows and the categories or periods it covers, and SHALL additionally offer the values it plots in a table the reader can reach.

The accessible name SHALL be present whether or not the table is expanded, because a collapsed disclosure is absent from the accessibility tree. The table alone therefore does not satisfy this requirement.

The table SHALL present the same values the chart plots, derived from the same data the chart is given, so that the two cannot state different numbers.

#### Scenario: every canvas chart is named

- **WHEN** a panel containing a canvas chart renders
- **THEN** that canvas has an image role and a non-empty accessible name summarising what the chart shows and what it covers

#### Scenario: plotted values are available as a table

- **WHEN** a reader opens the table offered with a chart
- **THEN** the table lists one row per category or period the chart plots, and one value column per series the chart draws

#### Scenario: the table cannot drift from the chart

- **GIVEN** a chart and its table
- **WHEN** the values the chart is given change
- **THEN** the table shows the changed values, because it is derived from the same data rather than assembled separately

#### Scenario: absent data stays distinguishable in the table

- **GIVEN** a series with no data for a period, alongside a series whose value for some period is zero
- **WHEN** the table renders
- **THEN** the absent period shows a not-available marker and the zero shows as zero, and the two are different text

##### Example: reserved land table across the recorded years

| Year | Value shown | Notes |
| --- | --- | --- |
| 民國 107 年 | the recorded area | data exists |
| 民國 108 年 | not-available marker | no data collected; not zero, not blank |
| 民國 109 年 | not-available marker | no data collected; not zero, not blank |
| 民國 110 年 | the recorded area | data exists |

#### Scenario: the chart itself is unchanged

- **WHEN** the text alternative and table are added to a chart
- **THEN** the chart's axes, colour scale, legend, plotted points, and its breaks across periods with no data all render as before
