# data-catalogue Specification

## Purpose

TBD - created by archiving change 'open-data-catalogue-page'. Update Purpose after archive.

## Requirements

### Requirement: The catalogue is generated from the source registry

The site SHALL present a catalogue page whose entries are generated from the source registry at build or load time, and SHALL NOT restate any source's name, agency, licence or description in page markup. Adding or amending a registry entry SHALL change the page without any edit to page code, because a hand-written catalogue drifts from the registry silently and the registry is the project's single source of truth.

#### Scenario: Registry entry is added

- **WHEN** a new source is recorded in the registry and the site is rebuilt
- **THEN** the catalogue lists that source without any change to page code

#### Scenario: Entry count matches the registry

- **WHEN** the catalogue renders
- **THEN** the number of source entries shown equals the number recorded in the registry

#### Scenario: Registry cannot be loaded

- **WHEN** the registry file fails to load
- **THEN** the page states that loading failed and names the missing file, rather than rendering an empty catalogue

---
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

---
### Requirement: Sources that cannot be tracked automatically are identifiable without opening each entry

The catalogue SHALL let a reader see which sources offer a programmatic interface and which do not, without expanding individual entries. Where the catalogue does not carry a structured reason for the absence, it SHALL say that the reason is stated in the entry's own account rather than implying none exists.

#### Scenario: Reader scans for automatable sources

- **WHEN** the catalogue renders
- **THEN** each entry shows whether a programmatic interface is recorded, and the view states that reasons for absence are given in each entry

---
### Requirement: Data gaps are presented apart from usable sources

The catalogue SHALL present recorded data gaps in a section separate from the sources, so that data which does not exist or cannot be obtained is not mistaken for data that can be used. Each gap SHALL state why the data is absent and what must not be done in its place.

#### Scenario: Gap is not mistaken for a source

- **WHEN** the catalogue renders both sources and gaps
- **THEN** the two appear in separate sections and a gap is never listed among the sources

#### Scenario: Gap states its prohibition

- **WHEN** a gap records what must not be done in place of the missing data
- **THEN** that prohibition appears with the gap

---
### Requirement: Entry accounts are shown in full

The catalogue SHALL show each entry's recorded account in full, without truncation, summarisation or rewording, because those accounts carry the format traps, licence findings and rejection reasoning that the catalogue exists to convey. Accounts MAY be collapsed by default, and the collapse control SHALL be a native one that needs no scripting to operate, so that expanding an account never depends on a handler that may fail.

Because the entries themselves are generated from the registry, no entry exists when scripting is unavailable. In that case the page SHALL say so and SHALL point the reader to the registry file, which carries the same accounts.

#### Scenario: Long account is readable in full

- **WHEN** an entry's account runs to several thousand characters
- **THEN** the reader can expand it and read the recorded text in full

#### Scenario: Collapse does not depend on a script handler

- **WHEN** an account is collapsed
- **THEN** expanding it uses the browser's own control rather than a scripted toggle

#### Scenario: Scripting unavailable

- **WHEN** scripting is unavailable and therefore no entries are generated
- **THEN** the page states that the listing requires scripting and links to the registry file, whose content is the same
