## MODIFIED Requirements

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

## ADDED Requirements

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
