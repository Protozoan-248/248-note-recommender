# Manual

## Purpose

`248 Deniky statistika` is a desktop-only Obsidian plugin for analyzing diary-like note collections. It focuses on local, repeatable analysis rather than cloud processing or AI summarization.

The plugin is best suited for:
- one or more dedicated diary folders
- notes with frontmatter timestamps
- long-running corpora where yearly and structural comparisons matter

## Quick start

1. Open **Settings → Community plugins → 248 Deniky statistika**.
2. Configure the diary folder scope.
3. Verify the frontmatter keys for `Created at` and `Last updated at`.
4. Open the `Diary statistics` view.
5. Use `Run analysis` from the dashboard or the command palette.

## Commands

- `Run diary analysis`
- `Export last analysis as Markdown`
- `Export last analysis as CSV`
- `Clear analysis cache`
- `Inspect active note word count`
  This appears only when debug tools are enabled.

## Dashboard layout

### Overview

High-level corpus totals:
- entries
- words
- reading time
- first and last note dates
- analysis duration

### Visual analytics

Optional chart layer controlled by **Show visual analytics**:
- heatmaps
- yearly trend charts
- distributions
- selected text-aware and tag-aware visuals

### Tag analytics

Tag-centered metrics over the active tag scope:
- frequency
- baseline deltas
- weekday bias
- pair lifts
- bridge tags
- tag text profiles

### Structural patterns

Derived temporal and structural metrics such as:
- burstiness
- silence topology
- revision lag structure
- concentration
- regime shifts
- structural readings

### Text-aware patterns

Optional body-text layer:
- lexical richness
- novelty rate
- recurring phrase families
- sentence climate
- opening signatures

Optional Czech-normalized deep-text layer:
- scoped normalized vocabulary metrics
- period signature
- entity candidates and relationships

### Records

Ranked note-level extremes, controlled by:
- `Records mode`
- `Records shown`

### Extra metrics

Additional derived metrics such as:
- longest writing streak
- average note length by month
- tag frequency over years
- hour-of-day activity

### Scope, date quality, and performance

Support sections showing:
- scope configuration results
- date fallback quality
- timing and cache-related information

## Dashboard search

The dashboard search box supports two modes:

### Filter

Shows only matching content. This is useful for isolating a chart or one subsection.

### Highlight

Keeps the full page visible and highlights matches. Use `Previous` and `Next` to jump between them.

Other behavior:
- `Ctrl/Cmd+F` focuses the dashboard search box when the results view is active.
- `Esc` clears the current search text.

## Exports

### Markdown export

A readable report for Obsidian that includes:
- grouped sections
- callouts
- glossary/help blocks
- structural examples when enabled

### CSV export

A flatter machine-friendly export intended for filtering or external processing.

## Settings reference

### Scope

Controls which folders and years are included in the main corpus analysis.

### Parsing

Controls:
- timestamp frontmatter keys
- tag frontmatter keys
- word-count cleanup rules

Raw wikilinks like `[[note]]` count as zero words. Aliased links like `[[note|alias text]]` count only the alias text.

### Body-text analysis

Enables the first text-aware layer. This is required before the deeper Czech-normalized layer can be used.

### Tag metric scope

Applies only to tag-driven outputs. It does not change core corpus totals.

### Hour metric scope

Applies only to hour-based metrics and excludes date-only timestamps. Older notes without explicit time precision will not contribute to hour-of-day analysis.

### Body-text metric scope

Limits the first text-aware layer to a selected year range without changing the rest of the dashboard.

### Deep-text scope

Used only by the optional Czech-normalized deep-text layer.

Modes:
- `Analyze everything`
- `Use defined scope`

Defined scope supports:
- from year
- to year
- included tags
- excluded tags

Included and excluded tags follow the plugin's current tag normalization, alias, ignore, and hierarchy rules.

### Period signature analysis

Compares one selected period against:
- earlier scoped years
- or all other scoped years

Important:
- it works only inside the current deep-text scope
- both sides of the comparison must contain usable scoped notes
- `Selected period vs earlier scoped years` fails if the selected period is the earliest scoped year
- `Selected period vs all other scoped years` fails if the selected period covers the entire scoped corpus

Safe first test:
- deep-text scope: `Analyze everything`
- period comparison: `Selected period vs all other scoped years`
- selected period: one single year that is not the whole scoped corpus

### Entity and relationship analysis

Adds heuristic recurring entity candidates over the current deep-text scope. This is useful, but it is not full named-entity recognition.

### Visuals

Controls chart visibility and selected visual behavior:
- show or hide visual analytics
- heatmap colors
- mean vs median yearly entry-length line

### Records and row limits

Controls:
- records mode and row count
- structural example count
- dense advanced-table row limits

For advanced-row overrides:
- leave blank to inherit the shared default
- use `0` to show all rows

### Export

Controls the output folder for Markdown and CSV export.

## Common workflows

### Deep yearly reading

1. Run analysis.
2. Open `Visual analytics`, `Tag analytics`, and `Structural patterns`.
3. Use `Highlight` search mode to move through a concept like `revision`, `bridge`, or `entropy`.
4. Export Markdown for a portable report.

### Tag-era comparison

1. Set a `Tag metric time scope`.
2. Review tag coverage diagnostics.
3. Inspect `Bridge tags`, `Top tag pair lifts`, and `Tag text profiles`.

### Deep-text slice

1. Enable body-text analysis.
2. Enable Czech-normalized deep-text analysis.
3. Switch deep-text scope to `Use defined scope`.
4. Set years and optional include/exclude tags.
5. Optionally enable `Period signature analysis` and `Entity and relationship analysis`.

## Known limits

- Czech-normalized deep text is heuristic normalization, not true lemmatization.
- Entity candidates are conservative local heuristics, not full Czech NER.
- Hour-of-day metrics require explicit timestamp time values.
- Deep-text outputs can disappear if the current scope is too narrow.

For deeper calculation notes, see [METHODOLOGY.md](./METHODOLOGY.md). For practical problems, see [TROUBLESHOOTING.md](./TROUBLESHOOTING.md).
