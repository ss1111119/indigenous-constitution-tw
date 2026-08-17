# seat-simulator Specification

## Purpose

Defines the reserved-seat allocation simulator: three controls (plains indigenous population included, number of reserved seats, reallocation versus addition), status-quo defaults, the arithmetic of each allocation method, declared slider reference points, stated fixed assumptions, neutral presentation, both population and elector bases, and the legal timeline that makes the question open.

## Requirements

### Requirement: Expose three controls

The simulator SHALL provide exactly three controls: a slider for the plains indigenous population to be included, a slider for the number of reserved seats, and a choice between reallocating within the fixed chamber size and adding seats beyond it.

#### Scenario: Controls are present

- **WHEN** the simulator renders
- **THEN** the two sliders and the allocation-method choice are available

---
### Requirement: Start from the status quo

The simulator SHALL open in a state that reproduces the official present figures: the plains population control set to the number of plains-indigenous people the loaded official statistics already count, reserved seats set to the current statutory number, and the allocation method set to reallocation within the fixed chamber size.

The indigenous population the simulator computes SHALL NOT count any person twice. Because the official indigenous total already includes registered plains-indigenous people, the simulator SHALL derive its base by removing the counted plains-indigenous population before applying the control's value.

The number of plains-indigenous people already counted SHALL be derived from the loaded data, and SHALL NOT be written into the interface as a constant.

#### Scenario: Initial state matches present figures

- **WHEN** the simulator first renders
- **THEN** the indigenous population it reports equals the official indigenous total in the same loaded data, and the seat share and population share are those of the status quo

#### Scenario: No registrations exist yet

- **WHEN** the loaded data reports zero plains-indigenous people
- **THEN** the control opens at zero and every computed figure is identical to what the simulator produced before registrations were possible

#### Scenario: Registrations exist

- **WHEN** the loaded data reports a non-zero plains-indigenous population
- **THEN** the control opens at that number, and the reported indigenous population still equals the official indigenous total rather than exceeding it

##### Example: base arithmetic with registrations

| Official indigenous total | Already-counted plains | Control value | Reported indigenous population |
| ------------------------- | ---------------------- | ------------- | ------------------------------ |
| 637,620 | 0 | 0 | 637,620 |
| 638,466 | 846 | 846 | 638,466 |
| 638,466 | 846 | 50,000 | 687,620 |
| 638,466 | 846 | 0 | 637,620 |

---
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

---
### Requirement: Population slider bounds are declared as reference points

The plains population slider SHALL have an upper bound equal to the current indigenous population, and SHALL mark the two sourced values — the number of plains-indigenous people the loaded official statistics already count, and the published first-year registration estimate — as labelled reference points.

The interface SHALL state that the upper bound is a reference point and not a claim about the size of the plains indigenous population.

The label for the officially counted reference point SHALL state the figure the loaded data reports, and SHALL NOT assert that no registrations exist unless the loaded data reports zero.

#### Scenario: Reference points are labelled

- **WHEN** the slider renders
- **THEN** the officially counted point is labelled as the current official figure and the estimate point is labelled as an academic estimate covering one group's first year only

#### Scenario: Unsourced range is marked

- **WHEN** the slider value falls in a range with no official or academic basis
- **THEN** the interface marks that range as having no published basis

#### Scenario: Official reference point follows the data

- **WHEN** the loaded data reports a non-zero plains-indigenous population
- **THEN** the officially counted reference point sits at that value and its label states that value, rather than stating that registrations stand at zero

---
### Requirement: Fixed assumptions are stated and inspectable

The simulator SHALL state the assumptions it holds fixed — that included persons are counted in the indigenous electoral roll, and that no separate seat category is created — and SHALL make them visible on demand.

#### Scenario: Assumptions available

- **WHEN** a user requests the assumptions
- **THEN** the interface lists the fixed assumptions and notes that the governing legislation does not yet determine them

---
### Requirement: Present outputs as arithmetic, not advocacy

The simulator SHALL present its outputs as the arithmetic consequence of the user's inputs, and SHALL NOT describe any configuration as recommended, correct, or expected.

#### Scenario: Neutral presentation

- **WHEN** any configuration is displayed
- **THEN** no configuration is labelled as recommended or expected

---
### Requirement: State that seat allocation for plains groups is undetermined

The simulator SHALL state that the governing legislation requires legislation on political participation within a stated deadline without specifying its form, and that reserved seats are one possible form among others.

#### Scenario: Legal status stated

- **WHEN** the simulator renders
- **THEN** it states that the form of political participation is not determined by the current legislation

---
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

---
### Requirement: Present the legal timeline that makes seat allocation an open question

The simulator SHALL present a timeline of the constitutional and legislative events that placed the question of plains indigenous political participation before the legislature, with each event carrying its date and a link to the primary source.

The timeline SHALL show the interval between each legislative milestone and its governing deadline, so that the reader can see whether legislation met its deadline and how long remains before the next one.

#### Scenario: Timeline accompanies the simulator

- **WHEN** the simulator renders
- **THEN** a timeline of the governing constitutional and legislative events is visible, each entry showing its date and linking to its primary source

#### Scenario: Deadlines are shown relative to milestones

- **WHEN** the timeline displays a milestone that is governed by a deadline
- **THEN** the interval between that milestone and its deadline is stated

##### Example: Timeline entries and deadline intervals

| Date | Event | Deadline relation |
| ---- | ----- | ----------------- |
| 2022-06-28 | Constitutional Court oral argument | — |
| 2022-10-28 | Judgment 111-Hsien-Pan-17 announced; three-year deadline begins | deadline 2025-10-28 |
| 2025-10-17 | Third reading of the Plains Indigenous Status Act | 11 days before deadline |
| 2025-10-23 | Promulgated and in force | 5 days before deadline |
| 2028-10-23 | Deadline for legislation on political participation under Article 23 | three years from entry into force |
