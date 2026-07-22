# Project

I am developing an Obsidian plugin in TypeScript using VS Code.
This is NOT an AI project and NOT a research project.
It is a practical Obsidian plugin intended for long-term personal use.

The purpose is:

> Given the currently open note, recommend the ten most interesting next notes and explain why each recommendation was made.

The recommendations should balance relevance, novelty, and discovery.

---

# Existing foundation

I have another Obsidian plugin ("248 Deníky statistika") in a copied dev folder under a new name. It already implements:

- vault scanning
- incremental indexing
- caching
- tag-level statistical relationships (tag-pair correlation, bridge tags, hidden-structure detection)
- configurable scopes
- local processing

Do not assume a fixed percentage of this is reusable. Before any design or code, read through the existing codebase and produce a short inventory:

- Which modules are generic infrastructure (parsing, caching, tag normalization/alias/hierarchy rules, scope filtering) and can likely be reused close to as-is.
- Which modules are specific to the diary/temporal analysis (yearly aggregation, burstiness, silence topology, revision lag) and are not relevant here.
- Whether an actual note-to-note link graph (direct links, backlinks, shared neighbours as edges *between notes*) exists anywhere in the current code, even internally or unexposed. Based on the plugin's own documentation, it does not appear to — its existing "graph analysis" and "structural patterns" operate on tags and per-note temporal metrics, not on an explicit inter-note adjacency graph. If that's confirmed, the link graph is new work, not reuse, and should be scoped as such.
- Whether the existing scanning/caching code relies on Node.js `fs` APIs directly (common for desktop-only plugins) rather than Obsidian's Vault adapter API. This plugin is desktop-only; the new one needs to run on Android too (see UI section below), so this determines whether that layer can be reused as-is or needs to be rebuilt against the Vault adapter API for portability.

Report this inventory before proposing any architecture.

---

# Project Constitution

These are non-negotiable.

1. Never modify Markdown notes.
2. Never modify frontmatter.
3. Never modify links.
4. Never rename or move vault files.
5. All plugin data must live only inside `.obsidian/plugins/<plugin-id>/`.
6. Cache must always be rebuildable.
7. The plugin must work completely offline.
8. No external AI services.
9. Recommendations must always be explainable.
10. Every heuristic must be independently enabled, disabled, and weighted.
11. Failure of one heuristic must never stop the recommendation engine.
12. Deterministic behaviour by default.
13. Random exploration is optional and configurable.
14. Long-term scalability target: comfortable operation on vaults containing 30,000–50,000 notes. This is a future target, not an M0 constraint — tell me my actual current vault size before designing around this number, and don't let it justify complexity (worker threads, on-disk indexes, streaming) that a much smaller vault wouldn't need. If a design decision trades simplicity for this target, flag it explicitly and ask first.

---

# Design philosophy

I am NOT trying to build a universal knowledge engine.
I am building a high-quality Obsidian plugin.

Whenever there is a choice between:

- elegant but complicated architecture, and
- simpler architecture that is easier to maintain,

prefer the simpler solution. Avoid over-engineering.

---

# Development philosophy

Before proposing code:

- understand the existing architecture
- preserve existing working code
- minimize unnecessary refactoring
- keep changes incremental
- explain architectural decisions
- explain trade-offs
- ask questions when requirements are ambiguous

Do not redesign the project unless there is a compelling reason.

---

# Recommendation pipeline

Current Note
↓
Candidate Generation
↓
Heuristic Scoring
↓
Ranking
↓
Diversity
↓
Top 10 Recommendations
↓
Breakdown (optional, collapsed by default)

The Diversity stage needs a concrete mechanism, not just an emergent property of blended scores. A naive top-10-by-combined-score will produce the ten most similar notes and quietly drop "novelty" and "discovery" from the stated goal. Propose a specific approach as part of M0 — for example, reserving a fixed number of the ten slots for high-novelty/low-relevance candidates, or a re-ranking pass (e.g. maximal marginal relevance) that explicitly trades relevance against how different a candidate is from what's already been selected.

---

# Candidate sources

Initially:

- direct links
- backlinks
- shared tags
- same MOC
- shared neighbours
- specific outputs already computed by the existing plugin — name these explicitly rather than reusing them as a vague bucket: bridge tags, tag-pair lift, and any structural-example/hidden-structure findings that link to specific notes
- navigation history

Future versions may include semantic similarity.

Open question to resolve in M0, not before: should notes already directly linked from the current note, or already sharing its MOC, be excluded or down-weighted in the top 10? The premise of "recommend next notes" is surfacing what isn't already obviously connected — decide this deliberately rather than letting it fall out of the ranking by accident.

---

# UI

Desktop:
- sidebar

Android:
- floating panel — verify what Obsidian's mobile plugin API actually supports here before committing to this pattern; confirm feasibility during the M0 audit and adjust the spec if a true floating panel isn't practical on mobile.

Recommendation explanations are collapsed by default behind a "Breakdown" button. Consider instead reusing the hover-based explanation pattern already established in the existing plugin's dashboard, for consistency between the two plugins — not a hard requirement, just worth weighing.

---

# Storage

Plugin-owned JSON files only.
History, cache, and settings must never be stored inside vault notes.

---

# How I want you to work

Act as the project's lead software architect.
Your primary responsibility is to help design and evolve a clean, maintainable plugin.

Do not immediately generate code. First think about architecture.
When appropriate, challenge my assumptions and suggest simpler alternatives.
Keep the project grounded and appropriately scoped.

---

Our first task is to review the architecture — starting with the existing-codebase inventory above — and define Milestone M0.
