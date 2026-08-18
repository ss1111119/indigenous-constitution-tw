## MODIFIED Requirements

### Requirement: Present four panels on one page

The site SHALL present four panels — population, election, land, and seat simulator — reachable without a page reload from one another. The four SHALL live together on a single page, which is not the site's entry page; that page presents the data catalogue instead.

The panel page SHALL be usable when opened directly, without first visiting the entry page, and SHALL link back to the catalogue while stating what it is.

#### Scenario: Panels are present

- **WHEN** a user opens the panel page
- **THEN** all four panels are reachable from the initial view without a page reload

#### Scenario: Panel page opened directly

- **WHEN** a user opens the panel page's address without having visited the entry page
- **THEN** the panels load and behave the same as when reached from the entry page

#### Scenario: Way back to the catalogue

- **WHEN** a user is on the panel page
- **THEN** a link to the catalogue is present and describes it as the full inventory of sources rather than naming it alone


---

### Requirement: Global region selector is the only shared state

The panel page SHALL provide one region selector whose value is the sole state shared across panels. No panel SHALL filter another panel by any other means. The selector belongs to the panel page rather than to the site as a whole, because the site's entry page is the catalogue and carries no region state.

#### Scenario: Selecting a county

- **WHEN** a county is selected in the region selector
- **THEN** every panel that varies by region reflects that county, and no panel filters another by any other route

#### Scenario: Entry page carries no region state

- **WHEN** the catalogue is open
- **THEN** no region selector is present and no region state is shared from it

---

### Requirement: Load township geometry only when needed

The panel page SHALL load county geometry on first render and SHALL defer township geometry until a drill-down is requested.

#### Scenario: Deferred township load

- **WHEN** a user first opens the panel page
- **THEN** only county-level geometry is requested

#### Scenario: Entry page requests no geometry

- **WHEN** a user opens the site's entry page
- **THEN** no map geometry is requested, because the catalogue presents no map
