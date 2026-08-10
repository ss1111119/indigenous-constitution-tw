# data-pipeline Specification

## Purpose

Defines the conversion of raw government files under data/raw/ into aggregated JSON under data/processed/, at both county (5-digit) and township (8-digit) district-code levels. Covers build-time self-validation, election column-layout detection, gap preservation in time series, and rebuilding any published period.

## Requirements

### Requirement: Convert raw government files to aggregated JSON

The pipeline SHALL convert files under data/raw/ into JSON files under data/processed/, aggregated to both county level (5-digit district code) and township level (8-digit district code).

#### Scenario: Population data aggregated to two levels

- **WHEN** the population build script runs against the ODRP013 and ODRP018 snapshots
- **THEN** it produces one JSON keyed by 5-digit county codes and one JSON keyed by 8-digit township codes

##### Example: Village rows roll up to county

- **GIVEN** village rows 65000010001 and 65000010002 with populations 1623 and 1200
- **WHEN** aggregation runs at county level
- **THEN** county code 65000 includes both, contributing 2823 to its total

### Requirement: Self-validate before writing output

The pipeline SHALL verify arithmetic identities before writing any output file, and SHALL abort without writing when a check fails.

The checks are: male plus female equals total; indigenous plus non-indigenous equals total population; the sum of all tribe columns equals the indigenous total.

#### Scenario: Validation passes

- **WHEN** all arithmetic identities hold
- **THEN** the output file is written

#### Scenario: Validation fails

- **WHEN** male plus female does not equal the stated total
- **THEN** the script aborts, reports the differing values, and writes no output file

##### Example: Verified national totals for 2026-06

| Check | Expected |
| ----- | -------- |
| male + female | 11,427,972 + 11,815,593 = 23,243,565 |
| indigenous + non-indigenous | 637,620 + 22,605,945 = 23,243,565 |
| 16 tribe columns summed | 637,620 |

### Requirement: Detect election data column layout

The pipeline SHALL determine which column layout each election year uses by testing arithmetic relationships, and SHALL abort rather than fall back to a default layout when neither layout validates.

#### Scenario: Layout detected successfully

- **WHEN** candidate male plus candidate female equals the candidate total at one of the two known layouts
- **THEN** that layout is used and recorded in the output

#### Scenario: Neither layout validates

- **WHEN** neither known layout satisfies its arithmetic relationship
- **THEN** the script aborts and reports the failure without producing output

### Requirement: Preserve gaps in time series

The pipeline SHALL emit no data point for a period where the source has no record, and SHALL NOT interpolate values across missing periods.

#### Scenario: Land ownership series with missing years

- **WHEN** the land source contains records for ROC years 107, 110, 111, 112, and 113 but not 108 or 109
- **THEN** the output contains five data points and no entries for 108 or 109

### Requirement: Accept a period parameter

The population pipeline SHALL accept a ROC year-month value as a parameter so any published period can be rebuilt.

#### Scenario: Rebuilding an earlier period

- **WHEN** the script is invoked with period 11411
- **THEN** it fetches and converts that period rather than the most recent one
