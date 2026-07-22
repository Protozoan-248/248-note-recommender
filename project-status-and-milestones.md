# Project status and milestones

As of 2026-03-20, this plugin is a working desktop-only Obsidian community plugin with a manual analysis workflow, persistent settings, cached per-file analysis, a full-tab results view, Markdown and CSV export, advanced metadata-driven analytics, and optional body-text analysis.

Current plugin metadata:
- Plugin id: `248-deniky-statistika`
- Plugin name: `248 Deniky statistika`
- Current manifest version: `0.0.1`
- Desktop only: yes

Current overall milestone position:
- Formal Milestones 1 through 8 are complete.
- Approved post-Milestone-8 Sub-milestone A is implemented.
- Approved post-Milestone-8 Sub-milestone B is implemented.
- Approved post-Milestone-8 Sub-milestone C is implemented.
- The current refinement milestone, `Visual polish and first-pass Markdown export polish`, is implemented.
- There is no currently active new numbered milestone beyond Milestone 8.
- The project is now in a post-Milestone-8 refinement state, with the core analytical layers already implemented and recent work focused on dashboard clarity, usability, tag-analysis semantics, dashboard navigation, and report presentation.

## What is working now

Core plugin surface:
- Full-tab custom view: `Diary statistics`
- Manual analysis command: `Run diary analysis`
- Optional debug command: `Inspect active note word count`
- Export commands: `Export last analysis as Markdown`, `Export last analysis as CSV`
- Utility command: `Clear analysis cache`

Current settings and control surface:
- Include mode and exclude mode for folder scope
- Optional inclusion of subfolders
- Ignored folder rules
- Ignore hidden-folder / dotfolder rule
- Configurable frontmatter keys for created and updated timestamps
- Configurable word-count cleanup rules
- Configurable reading speed
- Configurable median/mean rule for average-length entry
- Configurable heatmap colors
- Configurable tag-analysis thresholds and filters
- Configurable dashboard tag-row limit
- Hidden-by-default word-count debug tools toggle
- Optional body-text analysis toggle

Current dashboard sections:
- Overview
- Heatmaps
- Tag analytics
- Structural patterns
- Per-year summary
- Scope
- Date quality
- Performance
- Sample matched files
- Optional active-note word-count debug section

Current export surface:
- Markdown report written into the vault
- CSV export written into the vault

Current data and analysis layers:
- Scope filtering over `.md` files only
- Frontmatter-first chronology with cautious filesystem fallback
- Per-file cache for unchanged notes
- Core yearly aggregation
- Heatmap generation
- Frontmatter tag normalization and analytics
- Advanced metadata-driven structural metrics
- Optional body-text feature extraction and text-aware metrics

## Formal milestone map

### Milestone 1 - foundation and minimal scan

Status: complete

Delivered:
- Replaced the sample plugin shell with a clean desktop-only plugin shell.
- Added persistent settings for scope mode, scope folders, subfolder handling, ignored folder rules, hidden-folder handling, and frontmatter key defaults.
- Added the manual command to run analysis.
- Added the first custom results tab.
- Added the initial roadmap file (`TODO.md`).

Outcome:
- The plugin could load without demo/sample behavior.
- A manual run could scan matching markdown files and show a minimal results view.

### Milestone 2 - core parsing and aggregation engine

Status: complete

Delivered:
- Built the core parsing and aggregation pipeline.
- Added configurable word counting with cleanup rules.
- Added cautious fallback handling for missing or invalid frontmatter dates.
- Added a report for files with missing or invalid date data.
- Added per-file cache reuse for unchanged notes.

Outcome:
- The plugin moved from "file scanner" to "actual analysis engine."

Milestone-2 stabilization work that was completed later during testing:
- Stripped blockquote markers from word counting.
- Stripped headings, list markers, task markers, callout markers, table pipes, and horizontal rules from word counting.
- Stopped counting standalone dash-like separator tokens as words.
- Added the active-note word-count inspection tool to debug tokenization differences.
- Hid that debug tool behind a setting by default.

### Milestone 3 - first real dashboard and exports

Status: complete

Delivered:
- Built the first real dashboard tab with the required core v1 metrics.
- Added reading-time metrics.
- Added progress display during analysis.
- Added Markdown export into the vault.
- Added CSV export.

Outcome:
- The plugin became usable as a real reporting tool rather than only an internal analysis test surface.

### Milestone 4 - charts, heatmaps, and performance utilities

Status: complete

Delivered:
- Integrated Apache ECharts.
- Added the monthly entry-count heatmap.
- Added the weekday activity heatmap.
- Added tooltip support and basic visual configuration.
- Added analysis duration.
- Added cache clearing.

Outcome:
- The dashboard gained the first visual analytics layer and the first explicit performance-maintenance control.

### Milestone 5 - tag analytics

Status: complete

Delivered:
- Added frontmatter-tag analytics.
- Added case-insensitive normalization, ignored-tag rules, alias rules, and hierarchical handling.
- Added configurable minimum frequency threshold.
- Added single-tag plus optional pair/triplet analysis.
- Added all-years and per-year tag correlation views.
- Added live elapsed time during runs.

Outcome:
- Tag structure moved from a planned feature to a working analytical subsystem in the dashboard and exports.

### Milestone 6 - advanced metadata-driven structural metrics

Status: complete

Delivered:
- Added temporal rhythm metrics such as burstiness, silence topology, streak fragility, weekday-bias stability, and seasonal asymmetry.
- Added writing-volume structure metrics such as distribution shape, compression vs expansion, and concentration.
- Added revision-structure metrics such as revision lag distribution, revisit ratio, half-life approximation, and revision-weighted words.
- Added advanced tag-structure metrics and lightweight hidden-structure detection.
- Added the `Structural patterns` dashboard section and compact export support.

Outcome:
- The plugin crossed from "statistics dashboard" into "structural reading" of the corpus using metadata only.

### Milestone 7 - body-text analysis and deeper hidden structures

Status: complete

Delivered:
- Added optional cached body-text feature extraction while preserving the existing word-count rules.
- Added lexical richness, novelty rate, phrase recurrence, sentence-length climate, and opening-signature metrics.
- Extended hidden structures with text-aware regime shifts and structural readings.
- Added body-text findings to the dashboard and exports.

Outcome:
- The plugin gained a second interpretive layer based on note body text, without adding heavyweight NLP or AI dependencies.

### Milestone 8 - dashboard explanation layer

Status: complete

Delivered:
- Added explanatory hover text across the rendered dashboard.
- Covered section headers, details summaries, metric cards, and table headers.
- Added interpretive help for advanced and text-aware metrics.

Outcome:
- The dashboard became much easier to test and interpret, especially in the advanced analytical areas.

## Post-Milestone-8 refinement work

These improvements were completed after the formal Milestone 8 work and are already present in the current plugin state:

- Reworked advanced and text-aware hover help into a structured multiline format.
  - Pattern used:
    - what the item is or measures
    - how to read the scale
    - one concrete example
- Extended the headline-card hover so it now combines:
  - the meaning of the headline itself
  - the meaning of the supporting metric shown in the detail line inside the same card
- Merged the `Structural patterns` headline tiles with their supporting metric detail into single richer cards.
- Removed the old redundant headline bullet list and kept the richer single-card layout.

These refinements did not change the analytical calculations. They changed interpretation and presentation only.

## Approved post-Milestone-8 sub-milestones

### Sub-milestone A - tag semantics and counting refinement

Status: implemented

Scope:
- Change word counting so raw wikilinks count as nothing.
- Make tag-analysis weekday fields show top-two shares rather than a single arbitrary winner in ties.
- Add both mean-based and median-based baseline delta columns to tag-analysis tables.
- Add mean and median tags-per-note metrics to tag analytics.
- Keep item 3 from the planning discussion unchanged.

### Sub-milestone B - dashboard search

Status: implemented

Scope:
- Add an in-view search or filter box.
- Focus it with Ctrl/Cmd+F while the results view is active.
- Filter visible dashboard text locally without rerunning analysis.

### Sub-milestone C - structural examples and note hover preview

Status: implemented

Scope:
- Add opt-in structural example sections plus configurable example count.
- Add note-linked examples for longest silence gaps, largest revision lags, strongest recurring phrases, strongest tag-pair lifts, bridge tags, and strongest regime shifts.
- Use Obsidian hover preview for those linked notes.

## Current refinement milestone

### Visual polish and first-pass Markdown export polish

Status: implemented

Delivered:
- Refined dashboard spacing, section rhythm, and section framing.
- Strengthened the dashboard header with clearer lead text and quick capability badges.
- Improved table/card cohesion and search-bar presentation.
- Applied light heatmap and chart framing polish without changing the analytical model.
- Reworked the Markdown export into a cleaner report with stronger heading hierarchy, grouped metric tables, callouts for caveats, richer `Structural patterns` presentation, and structural-example export support when enabled.

Outcome:
- The in-app dashboard now feels more cohesive and scannable.
- The Markdown export has moved closer to a readable report format rather than a plain analytical dump.

## Current analytical scope

The current plugin can now analyze:
- chronology years resolved from created timestamps
- entry counts
- word counts
- reading time
- frontmatter tags
- months and weekdays
- revision lag between created and updated timestamps
- year-level and corpus-level structural patterns
- optional body-text lexical and stylistic features

The current plugin does not yet do:
- heavyweight NLP
- AI inference
- full drill-down workflows
- always-on watch mode

## Current roadmap position

Numbered roadmap status:
- Milestone 1: complete
- Milestone 2: complete
- Milestone 3: complete
- Milestone 4: complete
- Milestone 5: complete
- Milestone 6: complete
- Milestone 7: complete
- Milestone 8: complete

Approved post-Milestone-8 sub-milestone status:
- Sub-milestone A: implemented
- Sub-milestone B: implemented
- Sub-milestone C: implemented

Current project position:
- The core v1 architecture is in place.
- The dashboard is already beyond a minimal MVP and includes advanced structural analysis, optional body-text analysis, and an opt-in Czech-normalized deep-text branch.
- The project is in the stabilization, documentation, and release-prep phase rather than blocked on foundational work.

This means future work can now focus on post-release analytical expansion without having to rebuild the core:
- deeper deterministic language analysis
- selective heuristic cleanup and trust improvements
- documentation maintenance that tracks future feature changes

The currently active milestone is:
- stabilization + documentation / manual + release prep

Additional forward roadmap now agreed for the post-release branch:
- Future deterministic Czech text-analysis track:
  - Czech normalization foundation for deep text analysis
  - period signature and keyness analysis for selected year spans
  - named-entity and relationship-context analysis
  - lexicon-based emotion and stance analysis
  - motif-field and semantic-cluster analysis from deterministic co-occurrence
  - deeper semantic regime-shift and life-phase synthesis without AI dependence

## Items still explicitly deferred to v2

According to the current roadmap file, there are no remaining explicitly deferred metrics from the original agreed list.

## Notes on exactness

This file reflects the actual current state of the plugin, including the post-Milestone-8 UI refinements and approved sub-milestones that go beyond the original numbered roadmap.
