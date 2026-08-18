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

The catalogue SHALL present the provider's licence declaration and this project's own judgement about reuse as two distinct statements, and SHALL NOT merge them into a single verdict. When the two do not agree — a licence that is not an open-data grant alongside a reuse judgement of permitted — the catalogue SHALL show both and SHALL direct the reader to the entry's own account of the reasoning.

A reuse judgement SHALL NOT be presented as permission granted to the reader. The judgement records what this project concluded about its own use, whose scope may be narrower than the reader's intended use.

The three states of the reuse judgement — permitted, not permitted, and undetermined — SHALL be presented distinguishably from one another. Undetermined SHALL NOT be rendered as either of the other two.

#### Scenario: Licence and judgement disagree

- **WHEN** an entry records a licence that is not an open-data grant together with a reuse judgement of permitted
- **THEN** the catalogue shows both statements and points the reader to that entry's stated reasoning

#### Scenario: Reuse is undetermined

- **WHEN** an entry's reuse judgement is undetermined
- **THEN** the catalogue shows it as undetermined, distinct from both permitted and not permitted

##### Example: how each combination is presented

| Licence declaration | Reuse judgement | Presentation |
| ------------------- | --------------- | ------------ |
| open-data grant | permitted | both shown, agreeing |
| not an open-data grant | permitted | both shown, reader directed to the entry's reasoning |
| no licence declared | not permitted | both shown, entry marked as not reusable |
| open-source licence | undetermined | both shown, judgement marked undetermined |

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
