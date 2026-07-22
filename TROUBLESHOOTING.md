# Troubleshooting

## The dashboard shows no results

Check:
- folder scope settings
- include/exclude mode
- frontmatter key names
- whether matching files actually contain the configured created timestamp

If needed, run analysis and inspect the `Scope` and `Date quality` sections.

## Hour-of-day activity is empty

Hour-based metrics require explicit time precision in the created timestamp.

Examples:
- `2021-11-05` does not contribute
- `2024-09-11T17:49` does contribute

Also verify the current `Hour metric time scope`.

## Period signature says no usable comparison could be built

This feature works only inside the current deep-text scope.

Common causes:
- the selected period contains no usable scoped notes
- the comparison side contains no usable scoped notes
- the current deep-text scope is too narrow
- no candidate terms survived the current support filters

Important edge cases:
- `Selected period vs earlier scoped years` fails if the selected period is the earliest scoped year
- `Selected period vs all other scoped years` fails if the selected period covers the whole scoped corpus

Good first test:
- deep-text scope: `Analyze everything`
- selected period: one single year
- comparison: `Selected period vs all other scoped years`

## Czech-normalized or entity sections are missing

Check:
- `Enable body-text analysis`
- `Enable Czech-normalized deep text analysis`

Then check the deeper toggles:
- `Enable period signature analysis`
- `Enable entity and relationship analysis`

If the deep-text scope is too narrow, the sections can appear but contain no usable rows.

## Entity candidates look noisy

Current entity analysis is heuristic, not full named-entity recognition.

That means:
- some inflected forms can still remain split
- some sentence-start phrase fragments can still survive
- rare spelling variants can still appear as separate candidates

This is a known limitation of the current local no-lemmatization approach.

## Hour-of-day analysis used to show `00:00`

Older cached results may still reflect pre-fix behavior if you have not rerun analysis since the timestamp-precision fix.

Try:
1. `Clear cache`
2. `Run analysis`

## A section disappeared after changing Settings

This is often expected and scope-related.

Examples:
- turning off body-text analysis hides text-aware sections
- turning off visual analytics hides charts but not the underlying metrics
- narrowing a time scope can reduce rows to zero

## Search behaves differently in `Filter` and `Highlight`

This is expected:
- `Filter` hides non-matching content
- `Highlight` keeps the full page visible and just marks matches

Use `Filter` when isolating one chart or section. Use `Highlight` when navigating a long page without losing context.

## Export files look outdated

Exports reflect the last successful analysis run.

If you changed settings:
1. rerun analysis
2. export again

If results still look stale:
1. clear cache
2. rerun analysis
3. export again

## First run after an update is slow

This can be normal when:
- the cache schema changes
- the analysis algorithm version changes
- a new per-note feature layer was added

The next run should usually be faster because unchanged files are reused from cache.
