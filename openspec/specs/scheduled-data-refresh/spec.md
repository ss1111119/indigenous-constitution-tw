# scheduled-data-refresh Specification

## Purpose

Defines how the site picks up newly published household registration periods without a human polling the source: a recurring check that reads period availability from the response payload rather than the HTTP status code and that clears a backlog of more than one period, conversion committed only after the existing self-validation passes and the national indigenous total stays within a one-percent change band (which yields in exactly two ways — the named human override below, or the absence of a usable baseline to compare against — neither of them a loosening of the threshold itself), and an explicit invocation of the existing deployment workflow because a commit pushed by the automation's own credentials raises no push event. Also covers the manual run for rebuilding any chosen period, which skips only discovery and, when the chosen period is the one already recorded, reproduces the repository's files byte for byte without creating a commit, and the named human override that releases a period outside the change band — available only on a manual run, requiring an acceptance flag and a stated reason together, recording the reason in the commit message, and offering no way to raise or disable the band itself.

## Requirements

### Requirement: A scheduled job discovers newly published source periods

The system SHALL check on a recurring schedule whether the household registration API has published a period newer than the one currently recorded in the source registry. Period availability SHALL be determined from the response payload's own status message and row count, and SHALL NOT be inferred from the HTTP status code. The check SHALL evaluate every period from the one after the recorded period through the current calendar month, so that a backlog of more than one unpublished period is still discovered.

#### Scenario: A newer period is available

- **WHEN** the scheduled check runs and the API returns data for a period newer than the recorded one
- **THEN** the newest such period is selected for conversion

##### Example: backlog of two periods

| Recorded period | 11507 response | 11508 response | 11509 response | Selected |
| --------------- | -------------- | -------------- | -------------- | -------- |
| 11506 | data, 2000 rows | data, 2000 rows | no data | 11508 |
| 11506 | no data | no data | no data | none |
| 11506 | no data | data, 2000 rows | no data | 11508 |

#### Scenario: No newer period is available

- **WHEN** every candidate period reports that no data exists
- **THEN** the job ends successfully, creates no commit, and does not trigger a publish

#### Scenario: The source is unreachable

- **WHEN** the check fails with a network error or a response that matches neither the data nor the no-data shape
- **THEN** the job fails visibly rather than treating the condition as "no new period"


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

---
### Requirement: Refreshed data is committed only after validation passes

The system SHALL run the existing conversion self-validation before committing refreshed data, and SHALL additionally reject a period whose national indigenous total differs from the previous period by more than one percent. The change-band comparison requires a usable baseline: the national indigenous total derived from the processed county-level population file already present in the repository. When no usable baseline exists — that file is absent, or the total derived from it is not greater than zero — the system SHALL skip the change-band comparison rather than aborting, and SHALL state in the job output that the comparison was skipped and why. Skipping the comparison SHALL NOT skip the conversion self-validation. When any validation fails, the job SHALL fail, SHALL NOT commit, and SHALL leave the repository unchanged.

#### Scenario: Validation passes

- **WHEN** conversion succeeds and the population change is within the accepted band
- **THEN** the regenerated data files and the updated source registry entry are committed

#### Scenario: Population change exceeds the accepted band

- **WHEN** the newly converted period reports a national indigenous total more than one percent away from the previous period
- **THEN** the job fails and no commit is created

##### Example: change band

| Previous total | New total | Change | Outcome |
| -------------- | --------- | ------ | ------- |
| 637,620 | 639,000 | +0.22% | committed |
| 637,620 | 643,500 | +0.92% | committed |
| 637,620 | 645,000 | +1.16% | rejected |
| 637,620 | 63,762 | −90% | rejected |

#### Scenario: No usable baseline for the change band

- **WHEN** conversion runs with no processed county-level population file in the repository, or with one whose derived national indigenous total is not greater than zero
- **THEN** the change-band comparison is skipped, the job output states that it was skipped and which condition caused it, and the conversion self-validation alone decides whether the job proceeds

##### Example: baseline conditions

| Processed county file | Derived previous total | Change-band comparison |
| --------------------- | ---------------------- | ---------------------- |
| absent (first build on a clean repository) | none | skipped, reason stated |
| present | 0 | skipped, reason stated |
| present | 637,620 | compared against 637,620 |

#### Scenario: Conversion self-validation fails

- **WHEN** the conversion script aborts because its own totals do not reconcile
- **THEN** the job fails, no commit is created, and no partial output files remain


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

---
### Requirement: A successful refresh republishes the site

The system SHALL cause the site to be rebuilt and republished after a refresh commit, without duplicating the build or publish logic that already exists for deployment. The refresh job SHALL explicitly invoke the existing deployment workflow, because a commit pushed by the automation's own credentials does not raise the push event that would otherwise start it.

#### Scenario: Refresh commit is published

- **WHEN** the refresh job commits new data
- **THEN** the existing deployment workflow is invoked and the published site serves the new period

#### Scenario: No commit means no publish

- **WHEN** the refresh job ends without committing
- **THEN** no deployment is invoked


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

---
### Requirement: The refresh job can be run manually for a chosen period

The system SHALL allow an operator to start the refresh manually and to specify the period to convert, so that any published period can be rebuilt. Specifying a period SHALL skip only the discovery step; every validation SHALL still apply. Releasing a period that the change-band check rejected is a separate capability, defined by the named-override requirement below, and SHALL NOT be achievable by re-running the same period.

#### Scenario: Operator rebuilds a specific period

- **WHEN** an operator starts the job with an explicit period
- **THEN** that period is converted instead of the discovered one, and the same validations apply

#### Scenario: Re-running a rejected period without an override

- **WHEN** an operator re-runs a period that the change-band check rejected, supplying no override
- **THEN** the job fails again for the same reason, and no commit is created

#### Scenario: Rebuild of the current period is idempotent

- **WHEN** an operator rebuilds the period already recorded in the registry
- **THEN** the produced data files are byte-for-byte identical to those in the repository and no commit is created


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

---
### Requirement: A legitimate large change is released by a named human override

The system SHALL provide a way for an operator to release a period whose national indigenous total falls outside the accepted change band, and that way SHALL require both an explicit acceptance flag and a non-empty stated reason. The override SHALL be available only on a manually started run and SHALL NOT be reachable from the scheduled run. When an override is in effect, the change-band comparison SHALL still be computed and reported, and the stated reason SHALL be recorded in the resulting commit message so that the decision remains attributable in version history. The system SHALL NOT offer any way to raise or disable the band itself.

The job SHALL determine whether a release occurred, and SHALL obtain the observed change percentage, from a machine-readable marker emitted by the conversion, and SHALL NOT derive either from the wording of any human-readable message. Conversion messages are written for people reading the run log and SHALL remain free to change wording without altering job behaviour.

This capability exists because a legitimate large change is expected: registration of the newly recognised Siraya people opens in August 2026, and a first cohort anywhere near the scale publicly attributed to academic estimates would move the national total by several percent in a single period.

#### Scenario: Operator releases a rejected period

- **WHEN** an operator manually starts the job for a rejected period, supplying both the acceptance flag and a reason
- **THEN** the conversion completes, the observed change percentage is reported, and the commit message contains the stated reason

#### Scenario: Acceptance without a reason is refused

- **WHEN** an operator supplies the acceptance flag but no reason, or a reason but no acceptance flag
- **THEN** the job fails before conversion, and no data files are produced

#### Scenario: The scheduled run cannot override

- **WHEN** the scheduled run encounters a period outside the accepted band
- **THEN** it fails without committing, and no configuration of the schedule can grant it the override

#### Scenario: All other validations still apply under override

- **WHEN** a period is released by override but its own totals do not reconcile
- **THEN** the conversion self-validation still aborts the job and no commit is created

#### Scenario: Release is detected from the marker, not the message

- **WHEN** the conversion's human-readable messages are reworded while the marker format is unchanged
- **THEN** the job still determines release state and change percentage correctly


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
### Requirement: The observed change is reported on every run that computes it

The system SHALL report the observed change percentage in the run's own summary whenever the change-band comparison is computed, whether or not the period was released. Reporting SHALL NOT depend on the comparison having failed or having been overridden, so that the code path obtaining the percentage runs on ordinary refreshes rather than for the first time during an exceptional one.

When no usable baseline exists and the comparison is therefore skipped, no percentage SHALL be reported, because no change was observed — reporting zero would be indistinguishable from an observed change of zero.

The commit message SHALL NOT carry the change percentage on runs that were not released, so that a released period remains distinguishable in version history from an ordinary one.

#### Scenario: Ordinary refresh reports its change

- **WHEN** a scheduled refresh converts a period whose change falls within the accepted band
- **THEN** the run summary states the observed percentage, and the commit message is unchanged from its ordinary form

#### Scenario: Released period reports in both places

- **WHEN** a period is released by named override
- **THEN** the run summary states the observed percentage and the commit message additionally carries that percentage and the stated reason

#### Scenario: Skipped comparison reports nothing

- **WHEN** the change-band comparison is skipped because no usable baseline exists
- **THEN** no percentage is reported, and the summary states that the comparison was skipped

##### Example: what each run reports

| Run | Comparison | Summary percentage | Commit message |
| --- | ---------- | ------------------ | -------------- |
| within band | computed | reported | ordinary form |
| released by override | computed | reported | ordinary form plus percentage and reason |
| rejected, no override | computed | reported | no commit created |
| no usable baseline | skipped | none | ordinary form |

---
### Requirement: The commit message is assembled whether or not a commit follows

The system SHALL assemble the commit message and record it in the run summary on every run that converts a period, and SHALL decide separately whether to create a commit. Assembly SHALL NOT be reachable only through the branch that creates a commit, because rebuilding a period already in the repository produces no commit and would otherwise leave the assembly unobserved until an exceptional run.

#### Scenario: Rebuild of an existing period still shows the message

- **WHEN** an operator rebuilds the period already recorded in the registry, producing files identical to those in the repository
- **THEN** the run summary shows the assembled commit message, and no commit is created and no deployment is invoked

#### Scenario: Assembly covers the released form

- **WHEN** assembly runs for a released period
- **THEN** the recorded message contains the observed percentage and the stated reason in full, including a reason that spans several lines
