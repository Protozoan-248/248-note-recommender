# TODO

This file tracks only the agreed plugin scope.

## Milestone 1

- [x] Replace the sample plugin shell with a desktop-only diary plugin shell.
- [x] Add persistent scope settings for include/exclude mode and folder rules.
- [x] Add persistent parsing settings for the default frontmatter keys.
- [x] Add a manual analysis command.
- [x] Add a minimal results tab that confirms scope matching and frontmatter-key presence.

## Milestone 2

- [x] Build the core parsing and aggregation engine.
- [x] Add word counting with configurable cleanup rules.
- [x] Add cautious fallback handling for missing frontmatter dates.
- [x] Add a report for files with missing or invalid dates.
- [x] Add per-file cache for unchanged notes.

## Milestone 3

- [x] Build the first real dashboard tab with the core v1 metrics.
- [x] Add Markdown export into the vault.
- [x] Add CSV export.
- [x] Add visible analysis progress.

## Milestone 4

- [x] Integrate Apache ECharts.
- [x] Add the monthly heatmap.
- [x] Add the weekday heatmap.
- [x] Add hover tooltips and basic visual configuration.
- [x] Add analysis duration.
- [x] Add a cache-clear utility.

## Milestone 5

- [x] Add frontmatter-tag analytics with normalization and ignore rules.
- [x] Add configurable tag thresholds and optional pair/triplet analysis.
- [x] Add all-years and per-year tag correlation views.
- [x] Add elapsed time while analysis is running.

## Milestone 6

- [x] Add advanced temporal rhythm metrics based on existing created-date chronology.
- [x] Add advanced writing volume and concentration metrics from current word-count data.
- [x] Add revision-structure metrics from created-versus-updated lag.
- [x] Add advanced tag-structure metrics and lightweight hidden-structure detection.
- [x] Add a structural-patterns dashboard section and compact export support.

## Milestone 7

- [x] Add optional cached body-text feature extraction that preserves existing word-count rules.
- [x] Add lexical-richness, novelty-rate, phrase-recurrence, sentence-climate, and opening-signature metrics.
- [x] Extend hidden structures with text-aware regime shifts and structural readings.
- [x] Add body-text findings to the dashboard and compact exports.

## Milestone 8

- [x] Add explanatory hover text across the rendered dashboard.
- [x] Cover section headers, details summaries, metric cards, and table headers.
- [x] Add interpretive help for advanced and text-aware metrics without changing the underlying calculations.

## Approved post-Milestone-8 sub-milestones

### Sub-milestone A

- [x] Change word counting so raw wikilinks count as nothing.
- [x] Show top-two weekday shares in tag-analysis tables.
- [x] Add both mean-based and median-based baseline delta columns to tag-analysis tables.
- [x] Add mean and median tags-per-note metrics to tag analytics.
- [x] Update Markdown and CSV exports for the new tag-analysis fields.

### Sub-milestone B

- [x] Add an in-view dashboard search or filter box.
- [x] Focus that search box with Ctrl/Cmd+F while this view is active.
- [x] Filter visible dashboard text locally without rerunning analysis.

### Sub-milestone C

- [x] Add opt-in structural example sections plus configurable example count.
- [x] Add examples for longest silence gaps, largest revision lags, strongest recurring phrases, strongest tag-pair lifts, bridge tags, and strongest regime shifts.
- [x] Render note links in those example sections.
- [x] Use Obsidian hover preview on those linked notes.

## Current refinement milestone

### Visual polish and first-pass Markdown export polish

- [x] Refine dashboard spacing, section rhythm, and card/table cohesion.
- [x] Improve heatmap framing and chart readability without changing the underlying metrics.
- [x] Strengthen the dashboard header and section lead text for faster scanning.
- [x] Rework the Markdown export into a cleaner report with clearer hierarchy, callouts, grouped tables, and richer structural-pattern sections.
- [x] Add collapsed Markdown help callouts and a glossary so difficult export metrics stay interpretable without dashboard hover text.
- [x] Keep structural examples exportable when enabled in Settings.

## Post-polish refinements

- [x] Add a master `Show visual analytics` setting so chart-based dashboard sections can be shown or hidden without affecting analysis or exports.

## Optional extra-metrics and visuals track

- [x] Add the first wave of expanded visual analytics: yearly trend charts, note-length histogram, revision-lag histogram, and structural trend lines.

## Current refinement milestone

- [x] Add units to the new chart hover tooltips where raw numbers were ambiguous.
- [x] Add a records section with configurable row count and `Simple` / `Expanded` modes.
- [x] Add note-level record tables for longest notes, shortest notes, most tags, revision lag, and selected expanded body-text/tag-density extremes.
- [x] Add a tag metric time-scope switch so tag-driven metrics can use all eligible years or a restricted year range.
- [x] Keep the older include/exclude year lists as additional filters on top of the new tag metric time scope.

## Current visual expansion milestone

- [x] Add tag coverage diagnostics to show tagged-note share plus mean and median tags per note by year.
- [x] Add text-aware trend charts for vocabulary novelty, lexical richness, sentence climate, and recurring phrase share by year.
- [x] Add a monthly words-written heatmap alongside the existing monthly entry-count heatmap.

## Current refinement milestone

- [x] Add a switch for the yearly entry-length trend so the chart can use mean or median words per entry.
- [x] Make dashboard search recognize chart series keywords such as mean, median, lexical richness, and tag coverage even when those words are not visible in the card title.

## Current optional extra-metrics milestone

- [x] Add longest writing streak.
- [x] Add average note length by month.
- [x] Add tag frequency over years.
- [x] Add hour-of-day activity.
- [x] Add selective visuals for month length, tag frequency, and hour-of-day activity.

## Current refinement milestone

- [x] Preserve timestamp precision so date-only frontmatter values are not treated as real `00:00` times.
- [x] Add an hour metric time scope so hour-of-day analysis can use all eligible years or a restricted year range.
- [x] Fix hour-of-day dashboard and export outputs so only explicitly timed entries contribute.
- [x] Add dual-mode dashboard search with both `Filter` and browser-like `Highlight` behavior.

## Current refinement milestone

- [x] Make yearly reading-time chart tooltips use adaptive time labels instead of raw minutes only.
- [x] Add explicit x-axis unit labels to note-length and revision-lag histograms.
- [x] Add a body-text metric time scope so text-aware outputs can use all eligible years or a restricted year range.
- [x] Add a configurable recurring phrase families display count.
- [x] Add median columns to tag text profiles alongside the existing mean columns.

## Next milestone roadmap

### Near-term refinement

- [x] Add configurable row limits for advanced structural tables, especially `Bridge tags`.
- [x] Extend the same tunable row-limit pattern to pair lifts, weekday semantic bias, and tag text profiles.
- [x] Add a sticky dashboard contents/jump menu for the main dashboard sections.
- [x] Remember expanded and collapsed state for major dashboard detail groups.
- [x] Add local sorting for key advanced tables such as year profiles, bridge tags, pair lifts, tag text profiles, and regime shifts.
- [x] Add clearer basis-summary lines for long analytical sections.
- [x] Add dashboard export buttons for Markdown and CSV.
- [x] Improve contents highlighting, sortable-table reset controls, sticky headers, and search navigation polish.
- [x] Improve dashboard/export parity with a records section in Markdown export and cleaner section naming.
- [x] Polish the settings entry screen and replace the sample README with real plugin documentation.

### Future deterministic Czech text-analysis track

- [x] Add Czech normalization foundation for deep text analysis, using Czech-aware normalized and stopword-filtered text features with conservative suffix trimming while preserving existing word-count behavior.
- [x] Add period signature and keyness analysis for user-selected year spans on top of the Czech-normalized foundation.
- [x] Add named-entity and relationship-context analysis over time.
- [ ] Add lexicon-based emotion and stance analysis.
- [ ] Add motif-field and semantic-cluster analysis from deterministic co-occurrence signals.
- [ ] Add deeper semantic regime-shift and life-phase synthesis without requiring AI analysis.

## Deferred to v2

- No remaining explicitly deferred metrics from the original agreed list.

## Stabilization and release-prep milestone

- [x] Do one final cleanup pass on heuristic entity-candidate canonicalization before documentation freeze.
- [x] Improve period-signature guidance in Settings, dashboard text, and Markdown export.
- [x] Replace the lightweight README with a release-facing project overview that links to the full documentation set.
- [x] Add `MANUAL.md`, `METHODOLOGY.md`, `TROUBLESHOOTING.md`, and `RELEASE-CHECKLIST.md`.
- [x] Update milestone and status documentation to reflect the documentation/release-prep phase.
