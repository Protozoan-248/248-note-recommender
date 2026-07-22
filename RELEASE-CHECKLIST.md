# Release checklist

## Before version bump

- confirm the feature surface is intentionally frozen
- move new ideas to roadmap instead of implementing them late
- resolve any export-breaking or documentation-breaking issues

## Versioning

- bump `version` in [manifest.json](./manifest.json)
- update [versions.json](./versions.json) so the plugin version maps to the correct minimum Obsidian version

## Documentation

- review [README.md](./README.md)
- review [MANUAL.md](./MANUAL.md)
- review [METHODOLOGY.md](./METHODOLOGY.md)
- review [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)
- update [TODO.md](./TODO.md) and [project-status-and-milestones.md](./project-status-and-milestones.md)

## Build

Run:

```bash
npm run build
```

Verify that the release artifacts exist at the plugin root:
- `main.js`
- `manifest.json`
- `styles.css`

## Manual QA

### Core flow

- open the `Diary statistics` view
- run analysis
- verify overview metrics render
- verify search works in both modes
- verify dashboard action buttons work

### Exports

- export Markdown
- export CSV
- confirm both files land in the configured export folder

### Settings-sensitive sections

- body-text analysis
- Czech-normalized deep text
- period signature
- entity candidates
- visual analytics toggle

### Cache behavior

- clear cache
- rerun analysis
- confirm the dashboard rebuilds successfully

## Release packaging

- create a release tag that exactly matches `manifest.json` version
- attach:
  - `main.js`
  - `manifest.json`
  - `styles.css`

## After release

- record any discovered doc drift immediately
- keep behavioral changes and documentation changes in the same patch where possible
