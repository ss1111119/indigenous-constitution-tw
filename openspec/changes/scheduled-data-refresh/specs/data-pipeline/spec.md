## ADDED Requirements

### Requirement: Conversion scripts have regression tests over recorded inputs

The system SHALL provide a single command that runs regression tests for the conversion scripts against recorded input samples held in the repository. The samples SHALL preserve the real field names and types of the upstream responses, and SHALL be internally consistent so that the scripts' own self-validation passes on the success samples. Full upstream responses SHALL NOT be committed as samples, because a single period of the tribe-level endpoint is approximately 40MB.

#### Scenario: Test command reports success

- **WHEN** the regression command runs against the success samples
- **THEN** it exits with status code zero

#### Scenario: Test command reports a failing assertion

- **WHEN** any assertion fails
- **THEN** the command exits with a non-zero status code and names the failing assertion in its output

### Requirement: Regression tests cover the self-validation failure paths

The system SHALL include recorded samples that deliberately violate the conversion scripts' self-validation, and SHALL assert that the scripts abort and produce no output files for those samples. Testing only the success path SHALL NOT be treated as covering the safety net, because the value of self-validation lies entirely in what it rejects.

#### Scenario: Tribe totals do not reconcile

- **WHEN** the regression command runs against a sample whose per-tribe figures do not sum to the recorded indigenous total
- **THEN** the conversion aborts, no output file is written, and the test asserts both conditions

#### Scenario: Parallel plains-indigenous structures are double counted

- **WHEN** the regression command runs against a sample constructed so that adding both parallel plains-indigenous structures would exceed the recorded indigenous total
- **THEN** the conversion aborts rather than producing a total that silently double counts

##### Example: what each sample asserts

| Sample | Violation | Expected exit | Expected output files |
| ------ | --------- | ------------- | --------------------- |
| success | none | zero | written |
| tribe-sum-mismatch | per-tribe sum does not equal the indigenous total | non-zero | none |
| pingpu-double-count | both parallel structures summed together exceed the total | non-zero | none |
