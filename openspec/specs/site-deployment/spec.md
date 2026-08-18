# site-deployment Specification

## Purpose

Defines how the site becomes a published artifact: what the publish directory contains and what it must exclude, why the build fails rather than shipping incomplete data, the single definition of the data base path, the requirement that local preview and CI run the same build so local success is evidence of deployed success, automated deployment from the default branch, and the licensing check that must clear before the repository is made public — including that terms are read from the platform that served each file, and that a decision by this project to redistribute is recorded separately from the provider's grant.

## Requirements

### Requirement: Publish directory contains only site assets and the data the site reads

The build script SHALL assemble a publish directory at `_site/` containing the contents of `site/` at its root and, under `_site/data/`, only the data files the site actually fetches: `data/sources.json`, every `.json` under `data/processed/`, and every `.geojson` under `data/geo/`. The publish directory SHALL NOT contain `data/raw/` or any file under it.

The build script SHALL delete any existing `_site/` before assembling, so that files from a previous build cannot survive into the current one.

#### Scenario: raw data is excluded

- **WHEN** the build script runs against a repository whose `data/raw/` contains files
- **THEN** `_site/data/raw` does not exist and no file originating from `data/raw/` appears anywhere under `_site/`

#### Scenario: every fetched data file is present

- **WHEN** the build script completes successfully
- **THEN** `_site/data/sources.json` exists, `_site/data/processed/` contains the same number of `.json` files as `data/processed/`, and `_site/data/geo/` contains `counties.geojson` plus the same number of `.geojson` files under `townships/` as `data/geo/townships/`

#### Scenario: stale output is removed

- **GIVEN** a previous build left a file under `_site/` that no longer has a counterpart in the source tree
- **WHEN** the build script runs again
- **THEN** that file is absent from the new `_site/`

---
### Requirement: Build fails loudly when a required data source is missing

The build script SHALL hold an explicit list of required data sources and SHALL verify each one exists before assembling. When any required source is absent, the script SHALL exit with a non-zero status code, SHALL name the missing path on stderr, and SHALL NOT leave a partially assembled `_site/` behind.

The script SHALL NOT silently skip a missing source and produce a publish directory whose panels have no data.

#### Scenario: missing processed data aborts the build

- **GIVEN** a required file under `data/processed/` has been removed
- **WHEN** the build script runs
- **THEN** the script exits with a non-zero status code, stderr names the missing path, and no `_site/` directory is left behind

#### Scenario: successful build reports what it produced

- **WHEN** the build script completes successfully
- **THEN** the script exits with status code 0 and prints to stdout the number of files copied and the total size of `_site/`

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
### Requirement: Local preview and CI publish share one build path

The build script SHALL be the only supported way to produce a runnable site, and both local preview and the deployment workflow SHALL invoke that same script with the same output layout. The project SHALL NOT provide an alternative path that serves `site/` directly with a different data base resolution.

#### Scenario: serving the publish directory renders every panel

- **WHEN** a static server serves `_site/` and its root URL is opened
- **THEN** the population, election, land, and map panels and the seat simulator all render, and every resource the page requests returns a success status — a browser-initiated probe for a file the page never references, such as `/favicon.ico`, is not a page request and does not count

#### Scenario: the workflow builds rather than publishing the source tree

- **WHEN** the deployment workflow runs
- **THEN** it executes the build script and publishes the resulting `_site/`, and does not upload the repository root or `site/` as the site artifact

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

---
### Requirement: Redistribution licensing is settled before the repository is made public

Making the repository public also publishes `data/raw/`. Every file under `data/raw/` SHALL have a source record in `data/sources.json` stating its redistribution terms before the repository is pushed publicly.

Terms SHALL be read from the document that actually governs the site the file was served from. Terms published by one platform SHALL NOT be applied to a file obtained from a different platform, even when both are operated by the same agency.

The registry SHALL distinguish three outcomes: terms verified as permitting redistribution, terms verified as prohibiting it, and terms located but whose scope does not determine the question. Where the scope is indeterminate, `reusable` SHALL remain `unknown`, the governing wording SHALL be quoted in the record, and any decision by this project to redistribute anyway SHALL be recorded as the project's own judgement, stated separately from the provider's grant so the two cannot be read as the same thing.

A file with no source record at all, or whose terms are verified as prohibiting redistribution, SHALL block the public push.

#### Scenario: terms come from the platform that served the file

- **GIVEN** an agency operates both an open-data platform and a general website with different terms
- **WHEN** a file is obtained from the general website
- **THEN** the record states the general website's terms, and does not cite the open-data platform's licence

##### Example: one agency, two platforms

| File origin | Governing document | reusable |
| --- | --- | --- |
| open-data platform of the agency | that platform's open-data terms | `true` |
| general website of the same agency | that site's copyright notice | `unknown` unless the notice settles redistribution |

#### Scenario: indeterminate scope is recorded, not resolved by inference

- **WHEN** the governing terms permit reuse only "within a reasonable scope" and do not state whether verbatim redistribution of a complete file qualifies
- **THEN** `reusable` remains `unknown`, the record quotes the wording, and no open-data licence is claimed for the file

#### Scenario: a project decision to redistribute is recorded as such

- **GIVEN** a file whose terms leave the question indeterminate and which this project decides to redistribute
- **WHEN** the decision is recorded in `data/sources.json`
- **THEN** the record states the decision, its basis, and that it is this project's judgement rather than the provider's authorisation, and `reusable` still reads `unknown`

#### Scenario: a missing source record blocks the public push

- **GIVEN** a file under `data/raw/` has no source record in `data/sources.json`
- **WHEN** a maintainer prepares to push the repository publicly
- **THEN** the absence stands as a blocker and the push does not proceed until the record is added

---
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


<!-- @trace
source: scheduled-data-refresh
updated: 2026-08-18
code:
  - data/processed/population-by-county.json
  - scripts/build-site.py
  - scripts/build-population.ps1
  - scripts/probe-odrp-period.ps1
  - tests/fixtures/pingpu-double-count/moi-odrp018-population-by-tribe-11506.json
  - tests/fixtures/success/moi-odrp018-population-by-tribe-11506.json
  - site/index.html
  - scripts/lib/odrp.py
  - data/processed/tribes-by-county.json
  - tests/fixtures/amplitude-jump/moi-odrp013-population-by-indigenous-status-11506.json
  - tests/fixtures/tribe-sum-mismatch/moi-odrp013-population-by-indigenous-status-11506.json
  - data/processed/land-ownership-by-county.json
  - tests/fixtures/amplitude-jump/moi-odrp018-population-by-tribe-11506.json
  - tests/run-regression.ps1
  - scripts/lib/provenance.ps1
  - data/raw/moi-odrp018-population-by-tribe-11506.json
  - data/processed/legislative-representation.json
  - site/js/panel-population.js
  - data/processed/population-by-township.json
  - tests/fixtures/success/previous/population-by-county.json
  - scripts/register-period.py
  - scripts/fetch-raw.py
  - docs/feasibility-study.md
  - tests/fixtures/amplitude-jump/previous/population-by-county.json
  - data/raw/moi-odrp013-population-by-indigenous-status-11506.json
  - data/sources.json
  - tests/fixtures/pingpu-double-count/moi-odrp013-population-by-indigenous-status-11506.json
  - tests/fixtures/success/moi-odrp013-population-by-indigenous-status-11506.json
  - tests/fixtures/tribe-sum-mismatch/moi-odrp018-population-by-tribe-11506.json
  - README.md
  - site/js/provenance.js
  - .github/workflows/refresh-data.yml
  - data/processed/tribes-by-township.json
  - data/processed/land-ownership-national.json
  - docs/segis-check.md
  - data/processed/election-by-category.json
-->

---
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
