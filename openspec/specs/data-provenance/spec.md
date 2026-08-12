# data-provenance Specification

## Purpose

Defines how every displayed number stays traceable to data/sources.json: build-time injection of a source identifier and field-level nature, rejection of unknown source identifiers, the three-way distinction between zero, absent data, and a field that did not yet exist, and the recording of data gaps in the registry.

## Requirements

### Requirement: Inject source identity and field nature at build time

Every JSON file produced by the pipeline SHALL carry a source identifier matching an entry in data/sources.json, and a field-level mapping from each data field name to its nature.

Nature values SHALL be drawn from the set defined in the sources schema: official-statistic, academic-estimate, derived-by-this-project, historical-record, compilation.

#### Scenario: Produced file carries provenance

- **WHEN** the population build script writes its output
- **THEN** the file contains a source identifier and a field-to-nature mapping covering every field in the data rows

##### Example: Field nature mapping

| Field | Nature |
| ----- | ------ |
| population | official-statistic |
| indigenous_total | official-statistic |
| ratio_pct | derived-by-this-project |

---
### Requirement: Reject unknown source identifiers

The pipeline SHALL abort when the source identifier it is about to write does not exist in data/sources.json.

#### Scenario: Source identifier absent from registry

- **WHEN** a build script is configured with an identifier that has no matching entry in the sources registry
- **THEN** the script aborts and reports the unknown identifier

---
### Requirement: Distinguish absent data from zero

The interface SHALL render three states differently: a value of zero, an absence of data for the selected scope, and a period during which the field did not exist.

#### Scenario: Zero is a fact

- **WHEN** a tribe column holds the value zero
- **THEN** the interface displays a phrase indicating no registrations have occurred, not a blank and not a not-available marker

#### Scenario: Scope has no data

- **WHEN** a county has no indigenous reserved land records
- **THEN** the land panel states that the county has no reserved land, rather than displaying blank or zero

#### Scenario: Field did not exist

- **WHEN** a time series covers periods before the plains indigenous columns were introduced
- **THEN** no point is plotted for those periods and no zero is plotted

##### Example: Plains indigenous series boundary

| Period | Field state | Rendering |
| ------ | ----------- | --------- |
| 2025-10 and earlier | column absent | no point plotted |
| 2025-11 onward, value 0 | column present, zero | plotted as zero with a no-registrations label |

---
### Requirement: Every displayed number is traceable

Each numeric value shown in a panel SHALL be attributable to a source entry, and the interface SHALL expose that entry's agency, data date, and nature on demand.

#### Scenario: User inspects a number

- **WHEN** a user activates a displayed number
- **THEN** the interface shows the providing agency, the data date, and the nature label for that number

---
### Requirement: Record data gaps in the registry

Data absences that matter to the site SHALL be recorded in the gaps array of data/sources.json, each naming what is missing, why, what surrogate exists if any, and what must not be done to fill it.

#### Scenario: Gap entry drives rendering

- **WHEN** a gap entry declares a surrogate value and its nature
- **THEN** the interface renders the surrogate distinguishably from official values rather than substituting it silently

---
### Requirement: Raw inputs are verifiable without being stored in the repository

Auditability requires that a reader can obtain the same source data the project used and confirm it is the same. Storing the bytes in version control is one way to achieve that; it is not the only way, and it does not scale for a source published monthly.

A raw input that can be obtained again from its publisher SHALL NOT be tracked in version control. A raw input that cannot be obtained again SHALL be tracked, and the record SHALL state why the general rule does not apply to it.

Every raw input SHALL carry a checksum in `data/sources.json`, whether or not it is tracked. The registry SHALL also record which of two things the checksum covers, because the two are not interchangeable:

- the **file bytes**, for inputs stored exactly as the publisher served them;
- the **normalised data content**, for inputs the project assembled — for example a paginated response merged into one document, or a document carrying a download timestamp. Byte checksums fail on every re-fetch for such inputs, which makes them a check that is always red and therefore worse than none.

Where the checksum covers normalised content, the registry SHALL describe the normalisation precisely enough that someone not using this project's scripts can reproduce the value.

#### Scenario: a re-obtainable input is not tracked

- **GIVEN** a raw input available from a stable publisher endpoint
- **WHEN** the repository is inspected
- **THEN** that input is absent from version control, and `data/sources.json` records its checksum and where to obtain it

#### Scenario: an input that cannot be re-obtained is kept, with a stated reason

- **GIVEN** a raw input whose publisher offers no stable way to obtain it again
- **WHEN** the ignore rules are read
- **THEN** that input is tracked as an explicit exception, and the exception states why the general rule does not apply

#### Scenario: checksum kind matches the input

- **WHEN** a raw input embeds a download timestamp, or is assembled from several responses
- **THEN** its checksum covers the normalised data content rather than the file bytes, and the registry says so

##### Example: which checksum kind applies

| Input | Assembled or timestamped | Checksum covers |
| --- | --- | --- |
| a CSV stored exactly as served | no | file bytes |
| a spreadsheet stored exactly as served | no | file bytes |
| an archive stored exactly as served | no | file bytes |
| a paginated API response merged into one document with a download date | yes | normalised data content |

#### Scenario: every raw input has a checksum

- **WHEN** the registry is checked against the raw inputs present on disk
- **THEN** each of them has a non-empty checksum and a stated checksum kind, including inputs that are not tracked in version control


<!-- @trace
source: raw-data-retention
updated: 2026-08-12
code:
  - data/raw/moi-odrp013-population-by-indigenous-status-11506.json
  - scripts/fetch-raw.py
  - docs/segis-check.md
  - data/sources.json
  - README.md
  - data/raw/moi-odrp018-population-by-tribe-11506.json
-->

---
### Requirement: Re-obtaining a raw input is an executable action

A claim that an input can be obtained again is only as good as the reader's ability to do it. Where an input is not tracked, the project SHALL provide a script that obtains it and verifies it against the recorded checksum.

The script SHALL retrieve the input completely. Where the publisher paginates, it SHALL follow the pagination to the end rather than returning the first page, because a partial result that looks well-formed is worse than a failure.

The script SHALL NOT overwrite an existing local copy when the checksum does not match. A mismatch most often means the publisher revised the data, which is a judgement for a person to make.

#### Scenario: pagination is followed to the end

- **GIVEN** a publisher that returns the data across several pages
- **WHEN** the script obtains that input
- **THEN** it returns the complete set of records, not the first page

#### Scenario: a matching checksum confirms the input

- **WHEN** the script obtains an input whose content matches the recorded checksum
- **THEN** it reports the match and exits successfully

#### Scenario: a mismatch stops and asks for a human

- **WHEN** the obtained content does not match the recorded checksum
- **THEN** the script exits with a failure status, reports both the expected and the actual value, and leaves the existing local copy untouched

#### Scenario: incomplete retrieval produces no output

- **GIVEN** the publisher reports more pages than the script managed to retrieve
- **WHEN** the script runs
- **THEN** it exits with a failure status and writes no output file

<!-- @trace
source: raw-data-retention
updated: 2026-08-12
code:
  - data/raw/moi-odrp013-population-by-indigenous-status-11506.json
  - scripts/fetch-raw.py
  - docs/segis-check.md
  - data/sources.json
  - README.md
  - data/raw/moi-odrp018-population-by-tribe-11506.json
-->