## MODIFIED Requirements

### Requirement: Licence grant and this project's reuse judgement are shown as separate facts

The catalogue SHALL present the provider's licence declaration for every entry. Where that declaration is itself a plain grant of open reuse, the catalogue SHALL present it alone: the provider has already said what a reader may do, and a further statement from this project adds nothing a reader can act on while making the entries that do need care look like all the rest.

Where the declaration is not a plain grant of open reuse — it withholds reuse, declares none, covers the material under terms written for something other than data, or leaves the governing terms unsettled — the catalogue SHALL additionally state what this project did with the material: how it was obtained, whether it was altered, whether it was redistributed, and whether the source was credited.

That statement SHALL describe conduct, not permission. The catalogue SHALL NOT present any verdict of its own on whether the material may be reused, because a verdict is read as permission however it is captioned, and this project's conclusion covers only this project's use.

This constrains the wording the catalogue itself produces. It does not reach the recorded account reproduced with each entry: that account is the registry's own text, shown as evidence and required elsewhere to appear in full without rewording. An account may therefore recount how a conclusion was reached, including the words in which it was recorded. A reader must compare the stated conduct against the terms and reach their own conclusion; that comparison is the point at which the responsibility becomes theirs.

Whether a declaration is a plain grant SHALL be derived from the declaration itself rather than recorded as a separate flag, so the two cannot fall out of step. A declaration naming no recognised grant SHALL be treated as not plain, because mistaking an unclear licence for a clear one costs more than the reverse.

Entries carrying the additional statement SHALL be distinguishable in the listing without expanding them, so that a reader can see which sources need care.

#### Scenario: Licence is a plain grant

- **WHEN** an entry's declaration is a plain grant of open reuse
- **THEN** the catalogue shows that declaration alone, with no statement of this project's own use and no verdict

#### Scenario: Licence withholds or omits reuse

- **WHEN** an entry's declaration withholds reuse, declares none, or leaves the governing terms unsettled
- **THEN** the catalogue shows the declaration and a statement of what this project did with the material, and points the reader to that entry's own account

#### Scenario: No verdict of the catalogue's own

- **WHEN** any entry is rendered
- **THEN** none of the wording the catalogue produces states whether the material may or may not be reused

#### Scenario: An account recounting a conclusion

- **WHEN** an entry's recorded account describes how this project reached a conclusion, in the words it was recorded
- **THEN** that account is still shown in full, because it is evidence rather than the catalogue's own claim

#### Scenario: Conduct statement is absent

- **WHEN** an entry needs the additional statement but none is recorded
- **THEN** the catalogue shows the declaration alone and shows no placeholder, because on licensing an empty field is better left silent than announced

#### Scenario: Unrecognised licence wording

- **WHEN** an entry's declaration names no recognised grant
- **THEN** the entry is treated as needing care rather than as plainly granted

##### Example: how each declaration is presented

| Licence declaration | Presented |
| ------------------- | --------- |
| a plain open-data grant | declaration alone |
| terms written for software, applied to data | declaration plus this project's conduct |
| reuse withheld by the declaration | declaration plus this project's conduct |
| no declaration at all | declaration status plus this project's conduct |
| governing terms unsettled between two platforms | declaration plus this project's conduct |
