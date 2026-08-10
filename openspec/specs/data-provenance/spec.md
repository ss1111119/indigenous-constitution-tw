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

### Requirement: Reject unknown source identifiers

The pipeline SHALL abort when the source identifier it is about to write does not exist in data/sources.json.

#### Scenario: Source identifier absent from registry

- **WHEN** a build script is configured with an identifier that has no matching entry in the sources registry
- **THEN** the script aborts and reports the unknown identifier

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

### Requirement: Every displayed number is traceable

Each numeric value shown in a panel SHALL be attributable to a source entry, and the interface SHALL expose that entry's agency, data date, and nature on demand.

#### Scenario: User inspects a number

- **WHEN** a user activates a displayed number
- **THEN** the interface shows the providing agency, the data date, and the nature label for that number

### Requirement: Record data gaps in the registry

Data absences that matter to the site SHALL be recorded in the gaps array of data/sources.json, each naming what is missing, why, what surrogate exists if any, and what must not be done to fill it.

#### Scenario: Gap entry drives rendering

- **WHEN** a gap entry declares a surrogate value and its nature
- **THEN** the interface renders the surrogate distinguishably from official values rather than substituting it silently
