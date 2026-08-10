# data-panels Specification

## Purpose

Defines what the population, election, and land panels display: tribe composition and geographic distribution, turnout and the representation gap over legislative terms, and reserved land ownership over time. Also fixes how absent data is stated and when to link to existing published work instead of reproducing it.

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

### Requirement: Population panel distinguishes indigenous districts

The population panel SHALL indicate which townships are designated indigenous districts when displaying township-level data.

#### Scenario: Township view marks designated districts

- **WHEN** the panel renders townships
- **THEN** townships designated as indigenous districts are visually distinguished from those that are not

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

### Requirement: Election panel explains the institutional cause of the converging ratio

The election panel SHALL state that the indigenous seat count is fixed by constitutional provision and does not vary with population, while regional seats are apportioned by population.

#### Scenario: Explanation accompanies the trend

- **WHEN** the ratio trend is displayed
- **THEN** the panel states that indigenous seats are a fixed number and regional seats are apportioned by population

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

### Requirement: Land panel states when a county has no reserved land

The land panel SHALL state that a county has no indigenous reserved land when the source contains no records for it.

#### Scenario: County without reserved land

- **WHEN** a county with no reserved land records is selected
- **THEN** the panel states that the county has no indigenous reserved land, and renders no chart implying a zero measurement

### Requirement: Link to external work rather than reproducing it

Panels SHALL link to existing published visualisations for population distribution mapping, migration, and tribal settlement locations rather than reproducing them.

#### Scenario: External references present

- **WHEN** the population panel renders
- **THEN** it includes links to the external population distribution and settlement resources
