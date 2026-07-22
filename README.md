# 248 Deniky statistika

Desktop-only Obsidian plugin for deep diary analysis across one or more vault folders.

It scans diary notes, caches per-file results, and builds a dashboard with:
- corpus totals and yearly summaries
- heatmaps, trend charts, and selected distributions
- tag analytics and structural patterns
- optional body-text and Czech-normalized deep-text analysis
- records, structural examples, and exportable reports

The plugin runs locally inside the vault. It does not require any online service.

## Highlights

- Manual, cache-aware analysis runs
- Markdown and CSV export
- Search with `Filter` and `Highlight` modes
- Configurable metric scopes for tags, hours, body-text, and deep text
- Optional Czech-normalized text layers for period signature and entity-candidate analysis

## Commands

- `Run diary analysis`
- `Export last analysis as Markdown`
- `Export last analysis as CSV`
- `Clear analysis cache`
- `Inspect active note word count`
  Visible only when debug tools are enabled in Settings.

## Dashboard

The `Diary statistics` view includes:
- overview metrics
- optional visual analytics
- tag analytics
- structural patterns
- records
- extra metrics
- scope, date quality, and performance sections

The dashboard also supports:
- actions for running analysis, clearing cache, and exporting results
- search with `Filter` and `Highlight` modes
- contents navigation
- remembered expanded/collapsed state
- sortable advanced tables
- internal note links with Obsidian hover preview where supported

## Exports

Two export formats are available after a successful run:
- Markdown report
- CSV data export

The export folder is configurable in **Settings → Export**.

Markdown export is designed to stay readable inside Obsidian and includes:
- grouped sections
- callouts
- collapsed help blocks
- glossary-style explanations for advanced metrics

CSV export stays data-oriented and machine-friendly.

## Documentation

Additional project documentation lives in:
- [MANUAL.md](./MANUAL.md)
- [METHODOLOGY.md](./METHODOLOGY.md)
- [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)
- [RELEASE-CHECKLIST.md](./RELEASE-CHECKLIST.md)
- [TODO.md](./TODO.md)
- [project-status-and-milestones.md](./project-status-and-milestones.md)

## Development

Install dependencies:

```bash
npm install
```

Development build:

```bash
npm run dev
```

Production build:

```bash
npm run build
```

Release artifacts for Obsidian:
- `main.js`
- `manifest.json`
- `styles.css`

## Privacy and performance

- Local only
- No network calls
- No telemetry
- Cache-aware manual analysis
- Designed for desktop use

## Language-analysis note

The plugin currently includes a Czech-aware heuristic normalization layer for deep text analysis. It is useful, but it is not full lemmatization or full named-entity recognition. The exact limits are documented in [METHODOLOGY.md](./METHODOLOGY.md).
