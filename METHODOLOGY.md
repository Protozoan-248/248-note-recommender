# Methodology

## Principles

This plugin is designed around:
- local processing
- deterministic outputs
- explainable heuristics
- configurable scopes instead of hidden automatic filtering

It does not rely on online AI services.

## Source data

The plugin can use:
- created timestamps from frontmatter
- updated timestamps from frontmatter
- frontmatter tags
- note body text

The exact frontmatter keys are configurable.

## Word count

Word count follows the plugin's parsing cleanup rules.

Important rule:
- raw wikilinks like `[[note]]` count as zero words
- aliased wikilinks like `[[note|alias text]]` count only the alias text

Reading time is derived from the resulting word counts.

## Dates and precision

Timestamp precision matters.

Examples:
- `2021-11-05` means date known, time unknown
- `2024-09-11T17:49` means date and time known

The plugin treats date-only values as date-precision values, not as real `00:00` times.

Implications:
- chronology metrics can still use the date
- hour-of-day metrics require explicit time precision
- date-only notes do not contribute to hour-of-day analysis

## Core structural metrics

The structural layer combines metadata-derived signals such as:
- writing cadence
- burstiness
- gap topology
- writing concentration
- revision lag
- tag structure
- text-aware change signals when body-text analysis is enabled

These are heuristic analytical summaries, not psychological diagnoses.

## Tag metrics

Tag outputs are based on normalized frontmatter tags.

The plugin supports:
- ignore rules
- alias rules
- hierarchical normalization
- time-scoped tag metrics

Tag-driven outputs include:
- frequency and baseline deltas
- pair lifts
- bridge tags
- weekday semantic bias
- tag text profiles

## Body-text analysis

The first body-text layer works on parsed note text and derives:
- lexical richness
- novelty rate
- recurring phrase families
- sentence climate
- opening signatures

These are local feature calculations, not external NLP calls.

## Czech-normalized deep text

The deep-text layer is separate from the core body-text layer and is disabled by default.

Current status:
- Czech-aware normalization
- stopword filtering
- conservative suffix trimming
- scoped analysis by year and optional tags

Important:
- this is not full lemmatization
- this is not a full Czech morphological analyzer

Practical consequence:
- outputs are useful and often insightful
- but some inflectional and orthographic variants can still remain split

## Period signature

Period signature compares one selected period against:
- earlier scoped years
- or all other scoped years

It operates only inside the current deep-text scope.

The current implementation uses:
- normalized content-token frequencies
- smoothed frequency contrast
- selected-period and comparison-period token shares

It is meant to answer:
- what is distinctive for this period
- what emerges in this period
- what fades relative to the comparison basis

It requires:
- at least one usable note in the selected period
- at least one usable note on the comparison side
- enough surviving candidate terms after normalization and support filtering

## Entity candidates and relationships

The entity layer is currently heuristic.

It extracts recurring capitalized candidates such as:
- names
- places
- titles
- other entity-like phrases

Then it aggregates:
- support entries
- first and last year
- active years
- average return gap
- co-occurring pairs

Important limitations:
- this is not full named-entity recognition
- Czech inflection and spelling variants can still fragment one real entity into multiple candidates
- sentence-start false positives are reduced, but not impossible

This is why the UI and export use the term `entity candidates`.

## Records and structural examples

These sections are evidence-driven convenience layers built on top of the existing analysis results.

They do not introduce new raw data sources. They expose:
- extreme notes
- illustrative examples
- representative links back into the vault

## Visual analytics

Charts and heatmaps are derived from already computed summary data.

Turning off visual analytics hides the chart layer but does not change the underlying calculations.

## Known analytical limits

### Not currently implemented

- true Czech lemmatization
- full Czech named-entity recognition
- lexicon-based emotion and stance analysis
- motif-field clustering
- AI-based interpretation

### Why this matters

The current deep-text branch is good enough for scoped exploratory reading, but it still works closer to a strong normalization layer than to full linguistic analysis.

That is deliberate: it keeps the plugin local, deterministic, and maintainable.
