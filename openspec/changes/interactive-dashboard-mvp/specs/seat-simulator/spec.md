## ADDED Requirements

### Requirement: Expose three controls

The simulator SHALL provide exactly three controls: a slider for the plains indigenous population to be included, a slider for the number of reserved seats, and a choice between reallocating within the fixed chamber size and adding seats beyond it.

#### Scenario: Controls are present

- **WHEN** the simulator renders
- **THEN** the two sliders and the allocation-method choice are available

### Requirement: Start from the status quo

The simulator SHALL open with the plains population set to zero, reserved seats set to the current statutory number, and the allocation method set to reallocation within the fixed chamber size.

#### Scenario: Initial state matches present figures

- **WHEN** the simulator first renders
- **THEN** the seat share reads 5.31 percent and the population share reads 2.74 percent

##### Example: Status quo values

| Quantity | Value |
| -------- | ----- |
| Total seats | 113 |
| Indigenous seats | 6 |
| Seat share | 5.31% |
| Indigenous population | 637,620 |
| National population | 23,243,565 |
| Population share | 2.74% |

### Requirement: Two allocation methods produce different arithmetic

Under reallocation, increasing reserved seats SHALL decrease regional seats by the same amount and leave the chamber size unchanged. Under addition, increasing reserved seats SHALL increase the chamber size and leave regional seats unchanged.

#### Scenario: Reallocation is zero-sum

- **WHEN** the allocation method is reallocation and reserved seats increase by two
- **THEN** regional seats decrease by two and the chamber size is unchanged

#### Scenario: Addition enlarges the chamber

- **WHEN** the allocation method is addition and reserved seats increase by two
- **THEN** the chamber size increases by two and regional seats are unchanged

##### Example: Same input, two methods

| Method | Reserved seats | Regional seats | Chamber size | Seat share |
| ------ | -------------- | -------------- | ------------ | ---------- |
| Reallocation | 8 | 71 | 113 | 7.08% |
| Addition | 8 | 73 | 115 | 6.96% |

### Requirement: Population slider bounds are declared as reference points

The plains population slider SHALL have an upper bound equal to the current indigenous population, and SHALL mark the two sourced values — zero and the published first-year registration estimate — as labelled reference points.

The interface SHALL state that the upper bound is a reference point and not a claim about the size of the plains indigenous population.

#### Scenario: Reference points are labelled

- **WHEN** the slider renders
- **THEN** the zero point is labelled as the official current figure and the estimate point is labelled as an academic estimate covering one group's first year only

#### Scenario: Unsourced range is marked

- **WHEN** the slider value falls in a range with no official or academic basis
- **THEN** the interface marks that range as having no published basis

### Requirement: Fixed assumptions are stated and inspectable

The simulator SHALL state the assumptions it holds fixed — that included persons are counted in the indigenous electoral roll, and that no separate seat category is created — and SHALL make them visible on demand.

#### Scenario: Assumptions available

- **WHEN** a user requests the assumptions
- **THEN** the interface lists the fixed assumptions and notes that the governing legislation does not yet determine them

### Requirement: Present outputs as arithmetic, not advocacy

The simulator SHALL present its outputs as the arithmetic consequence of the user's inputs, and SHALL NOT describe any configuration as recommended, correct, or expected.

#### Scenario: Neutral presentation

- **WHEN** any configuration is displayed
- **THEN** no configuration is labelled as recommended or expected

### Requirement: State that seat allocation for plains groups is undetermined

The simulator SHALL state that the governing legislation requires legislation on political participation within a stated deadline without specifying its form, and that reserved seats are one possible form among others.

#### Scenario: Legal status stated

- **WHEN** the simulator renders
- **THEN** it states that the form of political participation is not determined by the current legislation

### Requirement: Report both population and elector bases

The simulator SHALL report the representation gap using population as the denominator, and SHALL offer the elector-based figure as an alternative view, stating that the two bases yield different results and that the choice is not neutral.

#### Scenario: Alternative basis available

- **WHEN** a user switches to the elector basis
- **THEN** the displayed gap recomputes and the interface states which basis is in use

##### Example: Two bases for 2024

| Basis | Indigenous share |
| ----- | ---------------- |
| Population | 2.51% |
| Electors | 2.25% |
