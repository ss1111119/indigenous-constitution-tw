## MODIFIED Requirements

### Requirement: The publish build performs exactly one kind of substitution

The publish build SHALL substitute the dataset's baseline period into every page declared to carry the period placeholder, and SHALL perform no other transformation of site sources. It SHALL NOT gain a general templating mechanism, SHALL NOT bundle, minify, or otherwise rewrite site assets, and SHALL continue to depend only on the standard library. Local preview and continuous integration SHALL continue to run the same build, so that the substituted output is exercised before it is published.

The pages required to carry the placeholder SHALL be named in an explicit list, and the build SHALL fail when any listed page lacks it, naming the page that is missing it. The list SHALL NOT be replaced by a scan of the published output: a count taken across whatever pages happen to exist can be satisfied by a page other than the one that matters, so a page that silently lost its placeholder would still leave the build reporting success.

A page that presents no single baseline period SHALL NOT appear in that list. A catalogue of many sources, each with its own baseline date, has no single period to state, and inventing one would assert a currency the page does not have.

#### Scenario: Period text is substituted

- **WHEN** the publish build runs
- **THEN** every period placeholder in the listed pages carries the baseline period resolved from the source registry, and every other byte of the site sources is copied unchanged

#### Scenario: A listed page lost its placeholder

- **WHEN** the publish build runs against a site in which a page named in the list carries no period placeholder
- **THEN** the build exits with a non-zero status, names that page, and leaves no publish directory behind

#### Scenario: An unlisted page carries no placeholder

- **WHEN** the site contains a page presenting many sources with differing baseline dates, and that page is absent from the list
- **THEN** the build succeeds and substitutes only in the listed pages

#### Scenario: Placeholder cannot be resolved

- **WHEN** the period placeholder's dataset names a source identifier absent from the source registry
- **THEN** the build exits with a non-zero status, names the unresolved identifier, and leaves no publish directory behind

#### Scenario: Local preview exercises the substitution

- **WHEN** the build is run locally and the publish directory is served
- **THEN** the previewed page shows the substituted period, matching what continuous integration publishes

##### Example: what the build is and is not allowed to change

| Site source | Build behavior |
| ----------- | -------------- |
| period placeholder in a listed page | replaced with the resolved baseline period |
| a page absent from the list | copied unchanged, does not fail the build |
| a listed page missing the placeholder | build fails, naming that page |
| any other page text | copied unchanged |
| stylesheets and scripts | copied unchanged, not minified or bundled |
| vendored libraries | copied unchanged |

---

### Requirement: The data base path has exactly one definition

The site SHALL resolve all data requests from a single exported constant defining the data base path relative to the page. No module other than the one declaring that constant SHALL contain a literal data base path, and the site SHALL NOT contain the parent-relative literal `../data` in any script or in the page markup.

The check on page markup SHALL cover every page the site publishes rather than one page named in the requirement, so that it keeps holding when pages are added or renamed.

#### Scenario: no module hardcodes the data path

- **WHEN** the full contents of `site/js/` are searched for the string `../data`
- **THEN** there are no matches

#### Scenario: the page markup uses a site-relative link

- **WHEN** every page under `site/` is searched for the string `../data`
- **THEN** there are no matches, and the provenance link resolves to the sources registry within the published site

#### Scenario: map geometry resolves through the shared constant

- **WHEN** a county is selected and the map requests township geometry
- **THEN** the request path is derived from the shared data base constant, and the geometry loads without a 404

---

### Requirement: Deployment is automated from the default branch

The repository SHALL contain a GitHub Actions workflow that builds and deploys the site to GitHub Pages when a commit is pushed to `master`, and that can also be triggered manually. The workflow SHALL grant only the permissions Pages deployment requires. When the build script fails, the workflow SHALL fail and SHALL NOT deploy.

#### Scenario: push to master deploys the site

- **WHEN** a commit is pushed to `master`
- **THEN** the workflow runs the build script and deploys `_site/` to GitHub Pages, and the Pages root URL serves the catalogue without a `/site/` path segment

#### Scenario: a failed build blocks deployment

- **GIVEN** the build script exits with a non-zero status code
- **WHEN** the workflow runs
- **THEN** the workflow fails and no deployment occurs

#### Scenario: the workflow can be triggered manually

- **WHEN** a maintainer triggers the workflow from the Actions interface without pushing a commit
- **THEN** the workflow runs and deploys the current state of `master`

## ADDED Requirements

### Requirement: The site's entry page presents the data catalogue

The site's root address SHALL serve the catalogue of sources and gaps, because the project's claim is the inventory of indigenous open data and the panels are an analysis built from part of it. The panels SHALL remain reachable at their own address, and neither page SHALL require passing through the other to be used.

The entry page SHALL carry a prominent link to the panels, placed where a reader sees it without scrolling and stating what the panels are. The root address previously served the panels and static hosting offers no redirect, so a returning visitor who finds different content and no visible route onward would reasonably conclude the panels were withdrawn.

Each page SHALL declare its own canonical address and sharing metadata matching where it actually resides, so that neither page claims the other's address. The entry page SHALL carry the sharing image metadata that a shared link requires.

#### Scenario: Root address serves the catalogue

- **WHEN** a visitor opens the site's root address
- **THEN** the catalogue of sources and gaps is presented

#### Scenario: Returning visitor finds the panels

- **WHEN** a visitor who expected the panels opens the root address
- **THEN** a link to the panels is visible without scrolling and states what they are

#### Scenario: Panels remain reachable

- **WHEN** a visitor opens the panels' own address directly, without first visiting the root
- **THEN** the panels work as they did before, including region switching and the simulator

#### Scenario: Each page claims its own address

- **WHEN** either page is inspected
- **THEN** its canonical address and sharing metadata name that page's own address, and the entry page declares a sharing image

---

### Requirement: A missing address leads back into the site

The site SHALL publish its own not-found page, so that a visitor reaching an address the site no longer serves is offered a route to the catalogue and to the panels rather than the host's default error page.

This is not a redirect: the retired address does not resume working, and no page claims to stand in for it.

The links on that page SHALL resolve correctly from any address the visitor may have arrived at, including nested paths the site never served. A page-relative link would resolve against the missing address's own directory and lead nowhere, and the site is published under a path prefix rather than at a domain root, so a link beginning at the server root would leave the site entirely.

The response SHALL keep its not-found status; presenting a page that merely looks like an error while reporting success would tell crawlers the address exists.

#### Scenario: Retired address is opened

- **WHEN** a visitor opens an address the site does not serve
- **THEN** the site's own not-found page is shown, linking to the catalogue and to the panels

#### Scenario: Nested missing address

- **WHEN** a visitor opens a nested address the site never served
- **THEN** the same page is shown and its links still reach the catalogue and the panels

#### Scenario: Status is preserved

- **WHEN** an address the site does not serve is requested
- **THEN** the response carries a not-found status rather than a success status
