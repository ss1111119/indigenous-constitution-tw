## ADDED Requirements

### Requirement: Tribe composition statements name what they cover

The population panel presents plains-indigenous groups in a block of their own rather than as bars, including when their population is non-zero. Any statement that the displayed components sum to the indigenous total SHALL name the plains-indigenous block as one of the summed parts, so that the statement stays true while those people are not among the bars.

The panel SHALL NOT claim that a period is the first in which plains-indigenous registrations appear. The panel loads a single period and holds no earlier period to compare against, so such a claim cannot be derived from the data and would remain on screen for every later period.

#### Scenario: Sum statement with non-zero plains groups

- **WHEN** the loaded period reports a non-zero plains-indigenous population
- **THEN** the sum statement names the bars, the undeclared count, and the plains-indigenous block as its parts, and the stated total equals the indigenous total

#### Scenario: Sum statement with zero plains groups

- **WHEN** the loaded period reports zero for every plains-indigenous group
- **THEN** the sum statement remains true and the stated total still equals the indigenous total

#### Scenario: No primacy claim

- **WHEN** the panel renders a period with registered plains-indigenous people
- **THEN** the accompanying text describes the registrations without asserting that this period is the first to contain them

##### Example: what the sum statement covers

| Bars shown | Undeclared | Plains block | Stated total | Indigenous total |
| ---------- | ---------- | ------------ | ------------ | ---------------- |
| 16 recognised tribes | 7,727 | 0 | 637,620 | 637,620 |
| 16 recognised tribes | 7,727 | 846 | 638,466 | 638,466 |
