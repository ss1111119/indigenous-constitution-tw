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

#### Scenario: no module hardcodes the data path

- **WHEN** the full contents of `site/js/` are searched for the string `../data`
- **THEN** there are no matches

#### Scenario: the page markup uses a site-relative link

- **WHEN** `site/index.html` is searched for the string `../data`
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
- **THEN** the workflow runs the build script and deploys `_site/` to GitHub Pages, and the Pages root URL serves the dashboard without a `/site/` path segment

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

The publish build SHALL substitute the dataset's baseline period into the page and SHALL perform no other transformation of site sources. It SHALL NOT gain a general templating mechanism, SHALL NOT bundle, minify, or otherwise rewrite site assets, and SHALL continue to depend only on the standard library. Local preview and continuous integration SHALL continue to run the same build, so that the substituted output is exercised before it is published.

#### Scenario: Period text is substituted

- **WHEN** the publish build runs
- **THEN** the period placeholder in the published page carries the baseline period resolved from the source registry, and every other byte of the site sources is copied unchanged

#### Scenario: Placeholder cannot be resolved

- **WHEN** the period placeholder's dataset names a source identifier absent from the source registry
- **THEN** the build exits with a non-zero status, names the unresolved identifier, and leaves no publish directory behind

#### Scenario: Local preview exercises the substitution

- **WHEN** the build is run locally and the publish directory is served
- **THEN** the previewed page shows the substituted period, matching what continuous integration publishes

##### Example: what the build is and is not allowed to change

| Site source | Build behavior |
| ----------- | -------------- |
| period placeholder in the page | replaced with the resolved baseline period |
| any other page text | copied unchanged |
| stylesheets and scripts | copied unchanged, not minified or bundled |
| vendored libraries | copied unchanged |

<!-- @trace
source: scheduled-data-refresh
updated: 2026-08-17
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