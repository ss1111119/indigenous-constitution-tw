## MODIFIED Requirements

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
