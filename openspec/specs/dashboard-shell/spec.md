# dashboard-shell Specification

## Purpose

Defines the single-page layout that holds the four panels and the global region selector — the only state shared across panels. Covers scope declaration, county-to-township drill-down, deferred geometry loading, per-panel failure isolation, readability without scripting, and layout recalculation on panel activation — including that recalculation addresses the panel being shown rather than broadcasting a global event, and that a map whose container has no size does not measure itself.

## Requirements

### Requirement: Present four panels on one page

The site SHALL present four panels — population, election, land, and seat simulator — reachable without a page reload.

#### Scenario: Panels are present

- **WHEN** a user opens the site
- **THEN** all four panels are reachable from the initial view

---
### Requirement: Global region selector is the only shared state

The site SHALL provide one region selector whose value is the sole state shared across panels. No panel SHALL filter another panel by any other means.

#### Scenario: Selecting a county

- **WHEN** a user selects a county in the region selector
- **THEN** the population and land panels re-render for that county

#### Scenario: Panels that cannot follow the selector

- **WHEN** a user selects a county
- **THEN** the election and seat simulator panels continue to show national figures and state on the panel that they are national in scope

---
### Requirement: Declare geographic scope on every panel

Each panel SHALL state the geographic scope of the figures it displays.

#### Scenario: Scope is visible

- **WHEN** any panel renders
- **THEN** the panel states whether its figures are national or for the selected region

---
### Requirement: Support drill-down from county to township

The region selector SHALL allow narrowing from a county to a township within that county, and SHALL allow returning to the county and national levels.

#### Scenario: Drilling into townships

- **WHEN** a user selects a county and then requests township detail
- **THEN** the townships of that county become selectable and the panels re-render at township level

#### Scenario: Returning to national scope

- **WHEN** a user clears the region selection
- **THEN** all panels re-render with national figures

---
### Requirement: Load township geometry only when needed

The site SHALL load county geometry on first render and SHALL defer township geometry until a drill-down is requested.

#### Scenario: Deferred township load

- **WHEN** a user first opens the site
- **THEN** only county-level geometry is requested

---
### Requirement: Isolate panel data failures

A failure to load one panel's data SHALL NOT prevent the other panels from rendering.

#### Scenario: One data file unavailable

- **WHEN** the land data file fails to load
- **THEN** the land panel shows an error message naming its source, and the population, election, and simulator panels render normally

---
### Requirement: Remain readable without scripting

The page SHALL present its explanatory text and its data source list when scripting is unavailable.

#### Scenario: Scripting disabled

- **WHEN** a user opens the page with scripting disabled
- **THEN** the page shows readable explanatory text and the list of data sources

---
### Requirement: Layout recalculation targets only the panel being shown

Panels are switched with CSS display, so a chart or map built while its panel was hidden has a layout computed from a zero width. The shell SHALL recalculate the layout of the panel that has just become visible.

That recalculation SHALL address the affected components directly. The shell SHALL NOT dispatch a global `resize` event on `window` to achieve it, because such an event reaches every map instance on the page — including instances inside panels that are still hidden — and every unrelated `resize` listener, while the intent is limited to the components in the panel just shown.

#### Scenario: switching panels does not broadcast a window resize

- **WHEN** a user switches between any of the four panels
- **THEN** no `resize` event is dispatched on `window`

#### Scenario: a map is laid out correctly after its panel is shown again

- **GIVEN** the panel containing the map has been hidden while other panels were viewed
- **WHEN** the user switches back to it
- **THEN** the map fills its container and remains pannable and zoomable, matching how it renders when it was never hidden

#### Scenario: charts in other panels still recalculate

- **WHEN** a user switches to the election, land, or seat simulator panel
- **THEN** that panel's charts show their axes and data points aligned, with data points spread across the plot area rather than compressed at its left edge


<!-- @trace
source: targeted-map-resize
updated: 2026-08-11
code:
  - site/js/main.js
  - site/js/panel-map.js
-->

---
### Requirement: A hidden map does not measure itself

Measuring a map whose container has zero size writes that zero into the map's cached dimensions, and later layout work computed from a zero size is wrong. A map SHALL skip measurement and view fitting whenever its container has zero width or height, whether because its panel is hidden or because the container is momentarily detached during a re-render.

This condition SHALL be checked by the map itself rather than by callers, so that the protection covers every path that triggers measurement, not only panel switching.

A request to recalculate a map that has not been created yet SHALL do nothing and SHALL NOT raise an error, because the first render is asynchronous and a panel switch can precede it.

#### Scenario: measurement is skipped while the container has no size

- **GIVEN** a map whose container has zero width and height
- **WHEN** a recalculation of that map is requested
- **THEN** the map's cached dimensions keep the value they had before the container lost its size, and no error or warning is produced

#### Scenario: recalculating before the map exists is a no-op

- **GIVEN** the first render has not yet created the map
- **WHEN** a recalculation of the map is requested
- **THEN** nothing happens, and no error or warning is produced

#### Scenario: re-render does not write a zero size

- **GIVEN** a re-render that detaches and re-attaches the map container
- **WHEN** measurement is triggered while the container is detached
- **THEN** the measurement is skipped and the cached dimensions are not set to zero

<!-- @trace
source: targeted-map-resize
updated: 2026-08-11
code:
  - site/js/main.js
  - site/js/panel-map.js
-->