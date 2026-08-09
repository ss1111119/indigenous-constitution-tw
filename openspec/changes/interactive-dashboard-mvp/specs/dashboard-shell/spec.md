## ADDED Requirements

### Requirement: Present four panels on one page

The site SHALL present four panels — population, election, land, and seat simulator — reachable without a page reload.

#### Scenario: Panels are present

- **WHEN** a user opens the site
- **THEN** all four panels are reachable from the initial view

### Requirement: Global region selector is the only shared state

The site SHALL provide one region selector whose value is the sole state shared across panels. No panel SHALL filter another panel by any other means.

#### Scenario: Selecting a county

- **WHEN** a user selects a county in the region selector
- **THEN** the population and land panels re-render for that county

#### Scenario: Panels that cannot follow the selector

- **WHEN** a user selects a county
- **THEN** the election and seat simulator panels continue to show national figures and state on the panel that they are national in scope

### Requirement: Declare geographic scope on every panel

Each panel SHALL state the geographic scope of the figures it displays.

#### Scenario: Scope is visible

- **WHEN** any panel renders
- **THEN** the panel states whether its figures are national or for the selected region

### Requirement: Support drill-down from county to township

The region selector SHALL allow narrowing from a county to a township within that county, and SHALL allow returning to the county and national levels.

#### Scenario: Drilling into townships

- **WHEN** a user selects a county and then requests township detail
- **THEN** the townships of that county become selectable and the panels re-render at township level

#### Scenario: Returning to national scope

- **WHEN** a user clears the region selection
- **THEN** all panels re-render with national figures

### Requirement: Load township geometry only when needed

The site SHALL load county geometry on first render and SHALL defer township geometry until a drill-down is requested.

#### Scenario: Deferred township load

- **WHEN** a user first opens the site
- **THEN** only county-level geometry is requested

### Requirement: Isolate panel data failures

A failure to load one panel's data SHALL NOT prevent the other panels from rendering.

#### Scenario: One data file unavailable

- **WHEN** the land data file fails to load
- **THEN** the land panel shows an error message naming its source, and the population, election, and simulator panels render normally

### Requirement: Remain readable without scripting

The page SHALL present its explanatory text and its data source list when scripting is unavailable.

#### Scenario: Scripting disabled

- **WHEN** a user opens the page with scripting disabled
- **THEN** the page shows readable explanatory text and the list of data sources
