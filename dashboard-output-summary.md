# Dashboard output summary

This file lists the current outputs shown in the Obsidian dashboard view.

It describes what the dashboard can display after a manual analysis run.
It does not describe formulas in full detail. The new hover help in the dashboard is the place for the short in-app explanations.

## Dashboard-level states

- In-view dashboard filter
  - Search or filter box near the top of the view
  - Focusable with `Ctrl/Cmd+F` while the `Diary statistics` view is active
  - Filters visible headings, cards, tables, and lists locally without rerunning analysis

- Empty state before any analysis run
  - Instruction to run `Run diary analysis`
  - If debug tools are enabled, a note that active-note token inspection is also available

- Analysis progress state during a run
  - Section: `Analysis progress`
  - Status message
  - Progress bar
  - Processed files / total files
  - Elapsed time

## Main dashboard outputs after a run

### Overview

- Metric cards
  - Years written
  - Total entries
  - Total words
  - Read whole diary
  - Average-length entry
  - Analysis duration
  - Reading speed
  - Mean words per entry
  - Median words per entry
  - Created fallback used
  - Updated fallback used

- Supporting text
  - Years detected
  - Which rule is used for the average-length entry

### Heatmaps

- Chart: `Monthly entry count through years`
  - Heatmap of entry counts by year and month

- Chart: `Monday-Sunday average activity by year`
  - Heatmap of average entries per weekday occurrence by year

### Tag analytics

- Summary metric cards
  - Minimum frequency
  - Combination depth
  - Hierarchy mode
  - Alias rules
  - Ignored tags
  - Year filters

- Combined tag table
  - Shown when combined tag analysis is enabled
  - Columns
    - Tag
    - Entries
    - Avg words
    - Median words
    - Delta vs baseline
    - Most common weekday
    - Most common month/year

- Per-year tag analytics
  - Shown when per-year tag analysis is enabled
  - One collapsible section per year
  - Same columns as the combined table, except the last column is `Most common month`

### Structural patterns

- Headline cards
  - Most bursty year
  - Most revision-heavy year
  - Most thematically concentrated year
  - Most semantically diverse year
  - Strongest recurring motif
  - Sharpest regime shift year
  - Most concentrated writing year
  - Most revisited year
  - Richest vocabulary year
  - Most repetitive phrasing year
  - Sharpest opening-style shift

- Headline card detail strips
  - One supporting metric line inside each headline card

- Overall advanced metric cards
  - Burstiness index
  - Longest silence gap
  - Weekday bias stability
  - Seasonal asymmetry
  - Tail heaviness
  - Compression vs expansion
  - Revisit ratio
  - Revision half-life
  - Tag entropy
  - Cadence vs note depth
  - Revision vs final length
  - Predominant mode
  - Body-text entries
  - Overall lexical richness
  - Dominant opening style

#### Structural patterns → Year profiles

- Table columns
  - Year
  - Entries
  - Avg words
  - Burstiness
  - Concentration
  - Revisit ratio
  - Tag entropy
  - Mode
  - Shift from previous

#### Structural patterns → Text-aware patterns

- This subsection is active only when `Enable body-text analysis` is enabled

- Summary metric cards
  - Entries with body-text features
  - Richest vocabulary year
  - Most novel year
  - Most repetitive phrasing year
  - Strongest phrase family
  - Longest-sentence month
  - Shortest-sentence month
  - Richest tag
  - Most revised tag
  - Sharpest opening-style shift

- Table: `Body-text year profiles`
  - Columns
    - Year
    - Lexical richness
    - Novelty
    - Avg sentence
    - Variation
    - Opening
    - Recurring phrase share

- Table: `Recurring phrase families`
  - Columns
    - Phrase
    - Entries
    - Year span
    - Avg gap
    - Score

- Table: `Month climate`
  - Columns
    - Month
    - Entries
    - Lexical richness
    - Avg sentence
    - Variation

- Table: `Tag text profiles`
  - Columns
    - Tag
    - Entries
    - Avg words
    - Lexical richness
    - Avg sentence
    - Avg revision lag

#### Structural patterns → Tag structures

- Summary metric cards
  - Fastest-returning tag
  - Most persistent tag
  - Longest-lived tag
  - Strongest positive tag-length coupling
  - Strongest negative tag-length coupling

- Table: `Top tag pair lifts`
  - Columns
    - Pair
    - Support
    - Lift

- Table: `Bridge tags`
  - Columns
    - Tag
    - Frequency
    - Degree
    - Bridge score

- Table: `Day-of-week semantic bias`
  - Columns
    - Tag
    - Weekday
    - Support
    - Lift

#### Structural patterns → Hidden structures

- Structural readings list
  - Ranked interpretive findings combining metadata and, when enabled, body-text signals

- Table: `Regime shifts`
  - Columns
    - From
    - To
    - Score
    - Tag
    - Text
    - Volume
    - Revision
    - Cadence

- Table: `Productivity modes by year`
  - Columns
    - Year
    - Mode
    - Rationale

#### Structural patterns -> Structural examples

- This subsection is active only when `Enable structural examples` is enabled

- Table: `Longest silence gap examples`
  - Columns
    - Gap
    - Before note
    - Before date
    - After note
    - After date

- Table: `Largest revision lags`
  - Columns
    - Note
    - Lag
    - Created
    - Updated
    - Words

- Table: `Recurring phrase example notes`
  - Columns
    - Phrase
    - Entries
    - Avg gap
    - Score
    - Example notes

- Table: `Tag-pair lift example notes`
  - Columns
    - Pair
    - Support
    - Lift
    - Example notes

- Table: `Bridge tag example notes`
  - Columns
    - Tag
    - Frequency
    - Degree
    - Bridge score
    - Example notes

- Table: `Regime shift example notes`
  - Columns
    - From
    - To
    - Score
    - From-year notes
    - To-year notes

### Per-year summary

- Table columns
  - Year
  - Entries
  - Words
  - Reading time
  - Created fallback
  - Updated fallback

### Scope

- Metric cards
  - Folder mode
  - Configured folders
  - Matched files
  - Ignored by scope
  - Ignored by folder rules
  - Ignored by hidden folders

- Supporting text
  - Current scope interpretation
  - Scope folders
  - Ignored folder rules

### Date quality

- Metric cards
  - Created key missing
  - Created key invalid
  - Updated key missing
  - Updated key invalid
  - Unresolved chronology
  - Date issues listed

- Supporting text
  - Short caution about filesystem fallback

- Collapsible issue table
  - Section: `Files with missing or invalid frontmatter dates`
  - Columns
    - Path
    - Created issue
    - Created source
    - Updated issue
    - Updated source

### Performance

- Metric cards
  - Reused cached files
  - Refreshed files
  - Dropped deleted files
  - Current cache entries

- Supporting text
  - Started timestamp
  - Finished timestamp

### Sample matched files

- Collapsible ordered list of matched note paths
- Intended as a scope-verification preview

## Optional debug outputs

Shown only after using `Inspect active note word count`, and only when the debug setting is enabled.

- Section: `Active note word count debug`
  - Metric cards
    - Active note tokens
    - Active note path

- Collapsible subsection: `Cleaned text`
  - The exact cleaned note body used by the current word-count logic

- Collapsible subsection: `Tokens (N)`
  - The exact counted token list
