## ADDED Requirements

### Requirement: Regression tests cover a period with registered plains-indigenous people

The system SHALL include a recorded sample in which the plains-indigenous groups hold non-zero values, and SHALL assert that conversion succeeds, that the identities hold, and that the plains-indigenous figures reach the output files. Covering only the all-zero case SHALL NOT be treated as covering plains-indigenous handling, because every identity in the all-zero case holds no matter which of the two parallel plains structures the conversion reads.

The sample SHALL give the parallel plains-indigenous cross-tab structure values that differ from the main-list values, so that a conversion reading the wrong structure fails the sample instead of passing by coincidence.

#### Scenario: Non-zero plains groups convert successfully

- **WHEN** the regression command runs against a sample whose plains-indigenous groups hold non-zero values consistent with both source totals
- **THEN** the conversion exits zero, the output files are written, and the plains-indigenous figures appear in them

#### Scenario: Identities hold with non-zero plains groups

- **WHEN** that sample is converted
- **THEN** the recognised tribes, the plains-indigenous groups, and the undeclared count sum to the indigenous total, and the mountain, plain, and plains-indigenous figures sum to the same indigenous total

#### Scenario: Reading the cross-tab structure fails the sample

- **WHEN** a conversion sums the parallel plains-indigenous cross-tab structure instead of the main-list columns
- **THEN** the sample's identity assertions fail rather than passing by coincidence

##### Example: what the sample asserts

| Sample | Plains values | Expected exit | Expected output files | Identity asserted |
| ------ | ------------- | ------------- | --------------------- | ----------------- |
| success | all zero | zero | written | sums hold trivially |
| pingpu-registered | non-zero, consistent across both sources | zero | written | sums hold non-trivially |
| pingpu-double-count | both structures summed | non-zero | none | abort before output |
