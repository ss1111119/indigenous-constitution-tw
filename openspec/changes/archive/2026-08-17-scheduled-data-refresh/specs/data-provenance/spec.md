## ADDED Requirements

### Requirement: The displayed baseline period is derived from the data

The interface SHALL derive every statement of the data's baseline period from the loaded dataset's recorded source identifier resolved against the source registry, and SHALL NOT hold that period as fixed prose in the page markup. The baseline period SHALL remain visible when scripting is disabled.

#### Scenario: Baseline period follows the data

- **WHEN** the published dataset advances to a newer period
- **THEN** every place the page states the baseline period reflects the newer period without an edit to the page's prose

#### Scenario: Baseline period without scripting

- **WHEN** the page is opened with scripting disabled
- **THEN** the baseline period is still stated on the page

#### Scenario: Source identifier has no registry entry

- **WHEN** the loaded dataset names a source identifier that the registry does not contain
- **THEN** the publish build fails rather than emitting a page with an unresolved or blank period

### Requirement: Data state is determined by the data, not by the calendar

The interface SHALL select among the three rendering states from the content of the loaded dataset alone. The current date, the date a registration process opened, and any hard-coded flag SHALL NOT be used to decide which state is shown.

#### Scenario: Registration has opened but the period predates it

- **WHEN** a registration process has already opened in the real world while the loaded dataset is from an earlier period whose column holds zero
- **THEN** the interface states that no registrations have occurred, because that is what the loaded data records

#### Scenario: A non-zero value appears

- **WHEN** the loaded dataset's plains indigenous column holds a value greater than zero
- **THEN** the interface displays that value together with the period it belongs to, replacing the no-registrations phrasing

##### Example: state selection inputs

| Column present | Column value | Current date relative to opening | Rendered state |
| -------------- | ------------ | -------------------------------- | -------------- |
| no | not applicable | before | field did not exist |
| no | not applicable | after | field did not exist |
| yes | 0 | before | no registrations |
| yes | 0 | after | no registrations |
| yes | 51,204 | after | value shown with its period |
