# M0 architecture proposal for the note recommender plugin

## Goal

Build a small, deterministic, explainable recommendation engine for the currently open note. The first milestone should produce 10 recommendations with clear reasoning, using only local data and plugin-owned storage.

## Non-negotiables from the prompt

- Never modify Markdown notes.
- Never modify frontmatter or links.
- Do not rename or move vault files.
- Keep all plugin data under .obsidian/plugins/<plugin-id>/.
- Keep the plugin offline and deterministic by default.
- Every heuristic must be independently enableable, disableable, and weighted.
- Recommendation explanations must be explainable.

## M0 scope

### In scope
- Recommend 10 notes for the currently active note.
- Use a small set of heuristics:
  - direct links
  - backlinks
  - shared tags
  - shared neighbours
  - same MOC / folder context
  - navigation history
  - bridge-like signals from tag/structure context
- Provide a short explanation for each recommended note.
- Introduce a concrete diversity step so the results are not just the top 10 most similar notes.
- Store cache/index/settings in plugin-owned JSON files.

### Out of scope for M0
- semantic embeddings or external AI.
- large-scale indexing tricks.
- mobile floating-panel commitment.
- deep diary-specific analytics.

## Proposed architecture

### 1. Plugin entry

The plugin entry point should stay minimal and focus on lifecycle management, command registration, and view setup.

Responsibilities:
- load settings and persisted state
- register the recommendation UI view
- register commands
- trigger indexing/recommendation runs

### 2. Core modules

Suggested module layout:

- src/main.ts
  - plugin lifecycle
- src/settings.ts
  - settings interface, defaults, and UI
- src/types.ts
  - shared data structures
- src/analysis/
  - index.ts or pipeline.ts
  - vault-scan.ts
  - note-index.ts
  - link-graph.ts
  - heuristics.ts
  - ranking.ts
  - diversity.ts
  - cache.ts
- src/ui/
  - recommendations-view.ts
  - recommendation-item.ts
  - explanation.ts
- src/storage/
  - persisted-state.ts

## Data model

### Note record

Each note should be indexed into a normalized record:

- path
- title
- folder
- tags
- outgoingLinks
- incomingLinks
- mtime
- size
- lastOpenedAt
- previewText

### Graph data

A lightweight in-memory or persisted graph should represent:

- note-to-note edges for direct links and backlinks
- shared-tag relationships
- shared-neighbour relationships
- optional MOC/folder proximity signals

### Recommendation result

Each recommendation should include:

- candidateNotePath
- score
- explanation
- reasons[]
- confidence
- sourceSignals

## Heuristics for M0

Each heuristic should be independently configurable.

### Candidate generation heuristics
- direct link
- backlink
- shared tag
- shared neighbour
- same folder / MOC context
- navigation history

### Scoring heuristics
- relevance: how strongly the candidate relates to the current note
- novelty: how different the candidate is from what is already selected
- bridge value: whether the candidate connects the current note to other interesting notes
- tag affinity: how much tag overlap exists
- history signal: whether the candidate was recently visited near the current note

## Diversity strategy

A simple deterministic diversity step is required. The best fit for M0 is a re-ranking pass such as Maximal Marginal Relevance (MMR):

- start from the highest-scoring candidate
- keep adding candidates that improve overall usefulness while remaining sufficiently different from already selected items

This is preferable to a naive top-10-by-score approach because it preserves both relevance and discovery.

## Storage strategy

Use plugin-owned JSON files only.

Suggested files:
- data/settings.json
- data/index.json
- data/cache.json
- data/history.json

The plugin should avoid writing into the vault itself.

## UI plan

### Desktop
- sidebar or panel-based results view
- show the top 10 recommendations
- collapse explanations by default, with a breakdown button

### Mobile
- do not commit to a floating panel in M0
- validate Obsidian mobile API support before implementing a mobile-specific pattern

## Implementation sequence

1. Create the plugin skeleton and settings UI.
2. Implement vault scanning + note metadata indexing.
3. Build the note graph from direct links, backlinks, tags, and MOC/folder context.
4. Implement heuristic scoring and deterministic ranking.
5. Add explicit diversity re-ranking.
6. Implement the recommendation view and explanations.
7. Add persisted cache/index/history state.

## Recommendation for M0

Keep the first implementation intentionally simple and maintainable. Avoid a complicated graph database or overly abstract pipeline. A straightforward indexed graph plus a few explicit heuristics is the best fit for this milestone.
