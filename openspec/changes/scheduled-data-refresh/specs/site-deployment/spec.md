## ADDED Requirements

### Requirement: The publish build performs exactly one kind of substitution

The publish build SHALL substitute the dataset's baseline period into the page and SHALL perform no other transformation of site sources. It SHALL NOT gain a general templating mechanism, SHALL NOT bundle, minify, or otherwise rewrite site assets, and SHALL continue to depend only on the standard library. Local preview and continuous integration SHALL continue to run the same build, so that the substituted output is exercised before it is published.

#### Scenario: Period text is substituted

- **WHEN** the publish build runs
- **THEN** the period placeholder in the published page carries the baseline period resolved from the source registry, and every other byte of the site sources is copied unchanged

#### Scenario: Placeholder cannot be resolved

- **WHEN** the period placeholder's dataset names a source identifier absent from the source registry
- **THEN** the build exits with a non-zero status, names the unresolved identifier, and leaves no publish directory behind

#### Scenario: Local preview exercises the substitution

- **WHEN** the build is run locally and the publish directory is served
- **THEN** the previewed page shows the substituted period, matching what continuous integration publishes

##### Example: what the build is and is not allowed to change

| Site source | Build behavior |
| ----------- | -------------- |
| period placeholder in the page | replaced with the resolved baseline period |
| any other page text | copied unchanged |
| stylesheets and scripts | copied unchanged, not minified or bundled |
| vendored libraries | copied unchanged |
