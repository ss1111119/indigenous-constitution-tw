## ADDED Requirements

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

### Requirement: Refreshed data is committed only after validation passes

The system SHALL run the existing conversion self-validation before committing refreshed data, and SHALL additionally reject a period whose national indigenous total differs from the previous period by more than one percent. When any validation fails, the job SHALL fail, SHALL NOT commit, and SHALL leave the repository unchanged.

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

#### Scenario: Conversion self-validation fails

- **WHEN** the conversion script aborts because its own totals do not reconcile
- **THEN** the job fails, no commit is created, and no partial output files remain

### Requirement: A successful refresh republishes the site

The system SHALL cause the site to be rebuilt and republished after a refresh commit, without duplicating the build or publish logic that already exists for deployment. The refresh job SHALL explicitly invoke the existing deployment workflow, because a commit pushed by the automation's own credentials does not raise the push event that would otherwise start it.

#### Scenario: Refresh commit is published

- **WHEN** the refresh job commits new data
- **THEN** the existing deployment workflow is invoked and the published site serves the new period

#### Scenario: No commit means no publish

- **WHEN** the refresh job ends without committing
- **THEN** no deployment is invoked

### Requirement: The refresh job can be run manually for a chosen period

The system SHALL allow an operator to start the refresh manually and to specify the period to convert, so that a rejected period can be released after human review and so that any published period can be rebuilt.

#### Scenario: Operator rebuilds a specific period

- **WHEN** an operator starts the job with an explicit period
- **THEN** that period is converted instead of the discovered one, and the same validations apply

#### Scenario: Rebuild of the current period is idempotent

- **WHEN** an operator rebuilds the period already recorded in the registry
- **THEN** the produced data files are byte-for-byte identical to those in the repository and no commit is created
