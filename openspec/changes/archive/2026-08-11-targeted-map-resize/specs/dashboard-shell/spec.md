## ADDED Requirements

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
