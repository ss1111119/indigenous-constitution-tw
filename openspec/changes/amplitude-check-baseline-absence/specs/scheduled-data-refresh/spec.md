## MODIFIED Requirements

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
