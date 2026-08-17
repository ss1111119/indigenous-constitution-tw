# data-panels Specification

## Purpose

Defines what the population, election, and land panels display: tribe composition and geographic distribution, turnout and the representation gap over legislative terms, and reserved land ownership over time. Also fixes how absent data is stated, when to link to existing published work instead of reproducing it, and how a chart drawn on canvas carries a text alternative — an accessible name that is present whether or not the table is expanded, plus a table of the plotted values derived from the same data the chart is given.

## Requirements

### Requirement: Population panel shows tribe composition and geographic distribution

The population panel SHALL show indigenous population by tribe for the selected scope, and a choropleth of indigenous share of population across the units one level below the selected scope.

The tribe breakdown SHALL include the undeclared-tribe count so that the displayed components sum to the indigenous total.

#### Scenario: National view

- **WHEN** the region selector is set to national scope
- **THEN** the panel shows tribe counts for the whole country and a choropleth across the 22 counties

#### Scenario: County selected

- **WHEN** a county is selected
- **THEN** the panel shows tribe counts for that county and a choropleth across its townships

##### Example: Components sum to the indigenous total

- **GIVEN** the 2026-06 national figures
- **WHEN** the 16 recognised tribes, the 10 plains groups, and the undeclared count are summed
- **THEN** the result equals 637,620

---
### Requirement: Population panel distinguishes indigenous districts

The population panel SHALL indicate which townships are designated indigenous districts when displaying township-level data.

#### Scenario: Township view marks designated districts

- **WHEN** the panel renders townships
- **THEN** townships designated as indigenous districts are visually distinguished from those that are not

---
### Requirement: Election panel shows turnout and representation gap over time

The election panel SHALL show turnout by electoral category across the legislative terms held under the current 113-seat system, and the ratio between electors per regional seat and electors per indigenous seat for the same terms.

#### Scenario: Series across terms

- **WHEN** the election panel renders
- **THEN** it shows one point per term for each of the mountain indigenous, lowland indigenous, and regional categories

##### Example: Ratio trend

| Year | Electors per regional seat | Electors per indigenous seat | Ratio |
| ---- | -------------------------- | ---------------------------- | ----- |
| 2008 | 230,912 | 53,845 | 4.29 |
| 2024 | 260,695 | 73,033 | 3.57 |

---
### Requirement: Election panel explains the institutional cause of the converging ratio

The election panel SHALL state that the indigenous seat count is fixed by constitutional provision and does not vary with population, while regional seats are apportioned by population.

#### Scenario: Explanation accompanies the trend

- **WHEN** the ratio trend is displayed
- **THEN** the panel states that indigenous seats are a fixed number and regional seats are apportioned by population

---
### Requirement: Land panel shows ownership composition over time

The land panel SHALL show reserved land area by ownership category across the available years for the selected scope, with public and private areas distinguishable.

#### Scenario: National ownership trend

- **WHEN** the region selector is set to national scope
- **THEN** the panel shows total, publicly owned, and privately owned reserved land area for each available year

##### Example: National ownership by year in hectares

| ROC year | Total | Private | State-owned |
| -------- | ----- | ------- | ----------- |
| 110 | 265,269.216 | 129,910.314 | 135,135.872 |
| 113 | 265,766.858 | 136,809.112 | 128,762.884 |

---
### Requirement: Land panel states when a county has no reserved land

The land panel SHALL state that a county has no indigenous reserved land when the source contains no records for it.

#### Scenario: County without reserved land

- **WHEN** a county with no reserved land records is selected
- **THEN** the panel states that the county has no indigenous reserved land, and renders no chart implying a zero measurement

---
### Requirement: Link to external work rather than reproducing it

Panels SHALL link to existing published visualisations for population distribution mapping, migration, and tribal settlement locations rather than reproducing them.

#### Scenario: External references present

- **WHEN** the population panel renders
- **THEN** it includes links to the external population distribution and settlement resources

---
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

<!-- @trace
source: chart-table-view
updated: 2026-08-11
code:
  - site/vendor/LICENSE-chartjs.txt
  - site/css/main.css
  - site/js/panel-simulator.js
  - site/js/panel.js
  - LICENSE
  - site/js/panel-population.js
  - README.md
  - site/vendor/LICENSE-leaflet.txt
  - data/sources.json
  - site/js/panel-election.js
  - site/js/panel-land.js
  - site/vendor/README.md
-->

---
### Requirement: Tribe composition statements name what they cover

The population panel presents plains-indigenous groups in a block of their own rather than as bars, including when their population is non-zero. Any statement that the displayed components sum to the indigenous total SHALL name the plains-indigenous block as one of the summed parts, so that the statement stays true while those people are not among the bars.

The panel SHALL NOT claim that a period is the first in which plains-indigenous registrations appear. The panel loads a single period and holds no earlier period to compare against, so such a claim cannot be derived from the data and would remain on screen for every later period.

#### Scenario: Sum statement with non-zero plains groups

- **WHEN** the loaded period reports a non-zero plains-indigenous population
- **THEN** the sum statement names the bars, the undeclared count, and the plains-indigenous block as its parts, and the stated total equals the indigenous total

#### Scenario: Sum statement with zero plains groups

- **WHEN** the loaded period reports zero for every plains-indigenous group
- **THEN** the sum statement remains true and the stated total still equals the indigenous total

#### Scenario: No primacy claim

- **WHEN** the panel renders a period with registered plains-indigenous people
- **THEN** the accompanying text describes the registrations without asserting that this period is the first to contain them

##### Example: what the sum statement covers

| Bars shown | Undeclared | Plains block | Stated total | Indigenous total |
| ---------- | ---------- | ------------ | ------------ | ---------------- |
| 16 recognised tribes | 7,727 | 0 | 637,620 | 637,620 |
| 16 recognised tribes | 7,727 | 846 | 638,466 | 638,466 |
