import { ItemView, Scope, SearchComponent, WorkspaceLeaf } from "obsidian";
import type {
	AdvancedHeadline,
	AverageEntryLengthMethod,
	AnalysisProgressState,
	DateIssueReportEntry,
	DiaryAnalysisResult,
	PerYearTagAnalysisSection,
	RecordsMode,
	TagAnalysisSection,
	WordCountDebugResult,
	YearAggregate,
} from "../types";
import { formatTagMetricScopeSummary } from "../analysis/tag-scope";
import { renderRevisionLagHistogramChart, renderWordCountHistogramChart } from "./distribution-charts";
import type { DisposableChart, HeatmapPalette } from "./heatmap-charts";
import {
	renderMonthlyHeatmapChart,
	renderMonthlyWordsHeatmapChart,
	renderTagFrequencyHeatmapChart,
	renderWeekdayHeatmapChart,
} from "./heatmap-charts";
import { renderInternalLinkList, renderInternalNoteLink, type InternalLinkRenderContext } from "./internal-links";
import {
	renderHourlyActivityChart,
	renderMonthLengthProfileChart,
	renderTagCoverageChart,
	renderStructuralTrendsChart,
	renderTextAwareStyleChart,
	renderTextAwareVocabularyChart,
	renderYearlyReadingDepthChart,
	renderYearlyTotalsChart,
} from "./trend-charts";

export const VIEW_TYPE_DIARY_STATS_RESULTS = "diary-stats-results";
const MAX_DISPLAYED_DATE_ISSUES = 25;
const MAX_ADVANCED_LIST_ROWS = 5;
const SIMPLE_RECORD_SECTION_IDS = new Set([
	"longest-notes",
	"shortest-notes",
	"most-tags",
	"longest-revision-lags",
	"highest-lexical-richness",
]);

interface DiaryStatsViewOptions extends HeatmapPalette {
	showVisualAnalytics: boolean;
	yearlyEntryLengthTrendMethod: AverageEntryLengthMethod;
	tagRowsDisplayLimit: number;
	recurringPhraseDisplayLimit: number;
	periodSignatureDisplayLimit: number;
	entityDisplayLimit: number;
	advancedRowsDisplayLimit: number;
	tagPairLiftDisplayLimit: number | null;
	bridgeTagDisplayLimit: number | null;
	weekdaySemanticBiasDisplayLimit: number | null;
	tagTextProfileDisplayLimit: number | null;
	recordsMode: RecordsMode;
	recordsDisplayLimit: number;
	enableStructuralExamples: boolean;
	structuralExamplesLimit: number;
}

type SearchMode = "filter" | "highlight";
type MetricGridRow = [label: string, value: string] | { label: string; value: string; tooltip?: string };
type SortDirection = "asc" | "desc";

interface SortableTableColumn<Row> {
	key: string;
	label: string;
	render: (row: Row) => string;
	sortValue: (row: Row) => number | string | null;
	initialDirection?: SortDirection;
}

interface SortableTableOptions<Row> {
	id: string;
	title: string;
	columns: SortableTableColumn<Row>[];
	rows: Row[];
	emptyMessage: string;
	defaultSortKey: string;
	defaultSortDirection: SortDirection;
	totalRowCount?: number;
}

interface TableSortState {
	columnKey: string;
	direction: SortDirection;
}

function buildStructuredTooltip(
	title: string,
	measures: string,
	scaleLines: string[],
	example?: string,
): string {
	const lines = [title.toUpperCase(), `→ Measures: ${measures}`];
	for (const line of scaleLines) {
		lines.push(`• ${line}`);
	}

	if (example) {
		lines.push(`→ Example: ${example}`);
	}

	return lines.join("\n");
}

function buildSectionTooltip(title: string, description: string, guidanceLines: string[], example?: string): string {
	const lines = [title.toUpperCase(), `→ What it is: ${description}`];
	for (const line of guidanceLines) {
		lines.push(`• ${line}`);
	}

	if (example) {
		lines.push(`→ Example: ${example}`);
	}

	return lines.join("\n");
}

function getYearlyReadingDepthChartTitle(method: AverageEntryLengthMethod): string {
	return method === "median"
		? "Reading time and median entry length by year"
		: "Reading time and mean entry length by year";
}

const SECTION_TOOLTIP_TEXT: Record<string, string> = {
	"Diary statistics": "Interactive dashboard for the currently analyzed diary scope, including core totals, charts, structural patterns, exports, cache behavior, and optional body-text analysis.",
	"Analysis progress": "Live status of the current manual analysis run, including processed files and elapsed time.",
	Overview: "Top-level totals, reading-time estimates, and basic quality indicators for the current analysis scope.",
	Heatmaps: "Visual overviews of writing activity across months, weekdays, and years.",
	"Monthly entry count through years": "Each cell shows how many diary entries fall in that month of that year.",
	"Monthly words written through years": "Each cell shows the total words written in that month of that year, with tooltip context for entries and average note length.",
	"Monday-Sunday average activity by year": "Each cell shows the average number of entries for that weekday within the given year.",
	"Yearly trends": "Year-level trend charts showing how entry volume, word volume, reading time, and typical entry size evolve across the diary.",
	"Entries and words per year": "Combined chart of yearly entry counts and yearly total word counts.",
	"Reading time and mean entry length by year": "Combined chart of yearly reading-time totals and yearly arithmetic mean words per entry.",
	"Reading time and median entry length by year": "Combined chart of yearly reading-time totals and yearly median words per entry.",
	Distributions: "Distribution charts showing how note length and revision lag are spread across the analyzed entries.",
	"Note-length distribution": "Histogram showing how many entries fall into each word-count range.",
	"Revision-lag distribution": "Histogram showing how many revised entries fall into each lag-in-days range.",
	"Structural trend lines": "Trend charts for advanced year-level signals such as burstiness, concentration, entropy, and year-to-year structural shifts.",
	"Structural year signals": "Combined chart of advanced year-level structural signals across the chronology years.",
	"Tag coverage diagnostics": "Charts showing how consistently notes are tagged across years, so tag-driven metrics can be interpreted in the context of changing tagging habits.",
	"Tagged-note coverage by year": "Shows the share of notes with at least one normalized frontmatter tag, alongside mean and median tags per note.",
	"Text-aware trends": "Year-level body-text trend charts showing vocabulary variety, novelty, sentence climate, and recurring-phrase behavior.",
	"Vocabulary and novelty by year": "Shows how lexical richness and vocabulary novelty shift across years with body-text analysis enabled.",
	"Sentence climate and phrase recurrence by year": "Shows how sentence length and recurring phrase share shift across years with body-text analysis enabled.",
	"Extra metrics": "Deferred follow-up metrics that add streak, month-length, tag-frequency, and hour-of-day structure on top of the current core dashboard.",
	"Month length by calendar month": "Shows which calendar months tend to have longer or shorter entries, alongside how many entries contributed to each month.",
	"Tag frequency over years": "Heatmap of the top qualifying normalized tags across years after the current tag time-scope filters are applied.",
	"Hour-of-day activity": "Shows when entries tend to be created during the day, using only notes whose created timestamp includes an explicit time.",
	Records: "Ranked note-level extremes such as the longest notes, most-tagged notes, and other edge-case records from the current analysis result.",
	"Longest notes": "Notes with the highest current word counts after the current cleanup rules.",
	"Shortest notes": "Notes with the lowest non-zero current word counts after the current cleanup rules.",
	"Most tags on one note": "Notes carrying the highest number of normalized frontmatter tags.",
	"Longest revision lags": "Notes with the longest positive lag between their resolved created and updated timestamps.",
	"Highest lexical richness notes": "Notes whose body text shows the highest vocabulary variety for their token count.",
	"Fewest tags on one note": "Notes carrying the lowest number of normalized frontmatter tags.",
	"Longest average-sentence notes": "Notes with the highest average words per sentence in the cleaned body text.",
	"Most repetitive-phrase notes": "Notes carrying the largest number of phrase candidates that recur elsewhere in the corpus.",
	"Most unique-word notes": "Notes with the highest count of unique normalized body-text tokens.",
	"Highest tag-density notes": "Notes with the highest number of normalized tags relative to their word count.",
	"Tag analytics": "Correlation tables based only on normalized frontmatter tags after aliasing and ignored-tag filtering.",
	"Structural patterns": buildSectionTooltip(
		"Structural patterns",
		"advanced metadata and text-aware metrics that surface rhythms, concentrations, revisions, tag structures, and corpus shifts.",
		[
			"Start with the headline cards for the strongest findings.",
			"Open the detail groups below to see the underlying year, tag, text, and regime-shift tables.",
			"Most values are comparative signals rather than absolute good-or-bad scores.",
		],
		"A high-scoring year here is structurally distinctive relative to the rest of the diary, not automatically better or worse.",
	),
	"Year profiles": buildSectionTooltip(
		"Year profiles",
		"per-year advanced summaries combining cadence, concentration, revision, tag diversity, and the assigned productivity mode.",
		[
			"Each row represents one chronology year.",
			"Read across a row to compare rhythm, volume structure, revision behavior, and tag diversity in the same year.",
			"'Shift from previous' highlights how different that year looks from the previous one.",
		],
		"A year with high burstiness and high concentration usually means writing clustered into fewer active periods.",
	),
	"Text-aware patterns": buildSectionTooltip(
		"Text-aware patterns",
		"body-text metrics derived from cleaned note text, such as vocabulary variety, novelty, recurring phrases, sentence climate, and opening styles.",
		[
			"These metrics appear only when body-text analysis is enabled in Settings.",
			"They reuse the current text-cleaning rules rather than doing heavy NLP.",
			"Use them to compare style, recurrence, and language variety across years, months, and tags.",
		],
		"A year can be textually rich even if it does not have the most entries.",
	),
	"Tag structures": buildSectionTooltip(
		"Tag structures",
		"higher-level relationships among qualifying tags, including strong pairs, bridge tags, return intervals, and weekday associations.",
		[
			"These metrics use normalized frontmatter tags after alias and ignore rules are applied.",
			"Pair lift highlights tags that recur together more often than chance would suggest.",
			"Bridge tags connect multiple tag neighborhoods instead of staying inside one tight cluster.",
		],
		"A tag can be common but still not be a strong bridge if it mostly co-occurs inside one small motif.",
	),
	"Hidden structures": buildSectionTooltip(
		"Hidden structures",
		"combined findings that surface the strongest non-obvious patterns across rhythm, revision, tags, and optional body-text signals.",
		[
			"These are interpretive summaries built from the metrics above.",
			"Use them as a reading guide, then verify them in the tables below.",
			"Scores here are heuristic and meant for comparison inside this corpus.",
		],
		"A 'sharpest structural shift' points to the year where multiple signals changed together most strongly.",
	),
	"Structural examples": buildSectionTooltip(
		"Structural examples",
		"concrete note-backed examples that make the strongest structural metrics easier to inspect and verify.",
		[
			"Each table points back to real notes from the analyzed scope.",
			"These examples are meant as evidence anchors, not full drill-down navigation.",
			"When page preview is available, hovering the note links can help you inspect them quickly.",
		],
		"A long silence-gap row shows the two notes that surround that gap inside the analyzed scope.",
	),
	"Per-year tag analytics": "Separate year-specific tag-correlation tables after the current include and exclude year filters are applied.",
	"All years combined": "One tag-correlation table using all currently included years together.",
	"Top tag pair lifts": buildSectionTooltip(
		"Top tag pair lifts",
		"the strongest qualifying tag pairs ranked by how much more often they co-occur than their separate frequencies would predict.",
		[
			"Higher lift means a tighter motif, not necessarily a more frequent one.",
			"Support tells you how many entries actually carry the pair.",
			"Read lift and support together before trusting a motif.",
		],
		"A rare pair can have very high lift, but a low support count makes it less stable.",
	),
	"Bridge tags": buildSectionTooltip(
		"Bridge tags",
		"tags that link otherwise less-connected parts of the tag co-occurrence graph.",
		[
			"Higher bridge score means the tag behaves more like a connector across tag neighborhoods.",
			"Degree shows how many distinct qualifying tags it touches.",
			"A good bridge tag often feels like a cross-cutting theme rather than a narrow topic label.",
		],
		"A frequent tag is not automatically a bridge if it mostly stays inside one cluster.",
	),
	"Day-of-week semantic bias": buildSectionTooltip(
		"Day-of-week semantic bias",
		"tags that appear unusually often on one weekday compared with the overall weekday baseline.",
		[
			"Higher lift means a stronger weekday-specific association.",
			"Support tells you how many entries back the association.",
			"Use this as a bias signal, not as proof of causation.",
		],
		"A tag with high lift on Sunday suggests it is overrepresented on Sundays compared with the corpus average.",
	),
	"Body-text year profiles": buildSectionTooltip(
		"Body-text year profiles",
		"year-by-year text summaries combining vocabulary variety, novelty, sentence climate, opening style, and phrase recurrence.",
		[
			"Each row represents one chronology year with usable body-text features.",
			"Lexical richness and novelty describe vocabulary behavior.",
			"Sentence and opening columns describe stylistic climate rather than subject matter.",
		],
		"A year can be lexically rich but still stylistically repetitive if recurring phrase share is high.",
	),
	"Czech-normalized text": buildSectionTooltip(
		"Czech-normalized text",
		"an optional Czech-aware normalization layer that compares content vocabulary after stopword filtering and conservative suffix trimming.",
		[
			"This layer is separate from the ordinary body-text metrics and appears only when enabled in Settings.",
			"It is deterministic and local, but still heuristic rather than full lemmatization.",
			"Use it to compare scoped vocabulary behavior across one era or one tagged subset.",
		],
		"A high content-token share suggests the scoped notes devote more of their cleaned tokens to content-like vocabulary after filtering.",
	),
	"Czech-normalized year profiles": buildSectionTooltip(
		"Czech-normalized year profiles",
		"year-by-year summaries of the optional Czech-normalized deep-text layer.",
		[
			"Each row represents one year inside the active deep-text scope.",
			"Vocabulary and lexical richness describe the filtered Czech-aware content vocabulary, not raw token counts alone.",
			"Novelty is relative only to earlier scoped years.",
		],
		"A year can have fewer entries but still rank highly if its scoped content vocabulary stays varied and new.",
	),
	"Period signature": buildSectionTooltip(
		"Period signature",
		"an optional comparison layer that identifies which Czech-normalized terms are most characteristic of one selected period.",
		[
			"The selected period is compared either with earlier scoped years or with all other scoped years.",
			"Scores are explainable frequency-contrast signals, not AI interpretation.",
			"Use the tables as evidence of what distinguishes, emerges, or fades in the chosen period.",
		],
		"A term can be distinctive because it is much more concentrated in the selected period than in the comparison set, even if it is not globally frequent.",
	),
	"Distinctive terms": buildSectionTooltip(
		"Distinctive terms",
		"terms whose Czech-normalized content frequencies are most characteristic of the selected period compared with the chosen comparison set.",
		[
			"Higher positive score means the term is more concentrated in the selected period.",
			"Read score together with the selected and comparison counts.",
			"This is a keyness-like contrast, not a claim about semantic importance.",
		],
		"A term with a high score and solid selected support is a strong clue to what makes the chosen period linguistically distinctive.",
	),
	"Emergent terms": buildSectionTooltip(
		"Emergent terms",
		"terms that appear in the selected period but not in the chosen comparison set.",
		[
			"These are the cleanest 'new arrivals' under the current normalized layer.",
			"Higher selected share means the term is more central inside the selected period.",
			"Because this is not full lemmatization, near-variants can still survive separately.",
		],
		"A term listed here did not appear in the comparison period at all under the current normalized vocabulary rules.",
	),
	"Fading terms": buildSectionTooltip(
		"Fading terms",
		"terms that are much less characteristic of the selected period than of the chosen comparison set.",
		[
			"More negative score means the term is relatively stronger outside the selected period.",
			"These help surface vocabulary that recedes rather than emerges.",
			"Read them as contrastive absence, not literal disappearance from the diary forever.",
		],
		"A strongly fading term may still appear in the selected period, but much less densely than in the comparison years.",
	),
	"Entity candidates and relationships": buildSectionTooltip(
		"Entity candidates and relationships",
		"an optional heuristic layer that extracts recurring capitalized names, titles, places, and other entity-like candidates from the current deep-text scope.",
		[
			"This is a conservative local heuristic, not full Czech named-entity recognition.",
			"Treat the rows as evidence-oriented candidates that help surface who, what, or where recurs over time.",
			"Persistent candidates show recurrence, bridge candidates reward spread across years, and pairs highlight strong co-occurrence.",
		],
		"A candidate can be useful here even if it is really a recurring title or project name rather than a person.",
	),
	"Most persistent entity candidates": buildSectionTooltip(
		"Most persistent entity candidates",
		"recurring entity-like candidates ranked by how many scoped entries they appear in.",
		[
			"Support is the strongest persistence signal here.",
			"Active years and gap length help you see whether recurrence is concentrated or spread out.",
			"Read bridge score as a secondary spread signal, not as proof of importance.",
		],
		"A candidate appearing in many notes across several years will usually rise to the top.",
	),
	"Bridge entity candidates": buildSectionTooltip(
		"Bridge entity candidates",
		"entity-like candidates ranked by how broadly they connect different years inside the scoped corpus.",
		[
			"Bridge score rewards support, active years, and span together.",
			"These candidates often behave like recurring anchors rather than one-period bursts.",
			"Use this table to find names or titles that bridge diary phases.",
		],
		"A candidate seen steadily from 2022 through 2026 will often outrank a denser but short-lived burst.",
	),
	"Strongest entity pairs": buildSectionTooltip(
		"Strongest entity pairs",
		"pairs of entity-like candidates that recur in the same scoped entries often enough to suggest a stable relationship context.",
		[
			"Support counts how many scoped entries contain both candidates.",
			"Active years and score help distinguish one-year bursts from longer-running pairings.",
			"This is co-occurrence evidence, not a claim about relationship type.",
		],
		"A pair recurring together across several years is usually more structurally interesting than a one-month cluster.",
	),
	"Recurring phrase families": buildSectionTooltip(
		"Recurring phrase families",
		"repeated cleaned phrase patterns detected from lightweight local phrase windows in note body text.",
		[
			"These are repeated formulations, not full semantic paraphrases.",
			"Score combines recurrence strength, support, and spread across time.",
			"Year span and average gap help you see whether a phrase is persistent or clustered.",
		],
		"A phrase found in many entries across distant years is usually more structurally interesting than one short local burst.",
	),
	"Month climate": buildSectionTooltip(
		"Month climate",
		"month-of-year style summaries based on lexical richness and sentence-length behavior.",
		[
			"Each row pools all entries that fall in that calendar month across years.",
			"Use it to compare how January tends to read versus July, for example.",
			"These are stylistic climate signals, not topic labels.",
		],
		"A month with longer average sentences and higher variation usually reads more syntactically expansive.",
	),
	"Tag text profiles": buildSectionTooltip(
		"Tag text profiles",
		"text-aware summaries for qualifying tags, including note length, vocabulary variety, sentence climate, and revision lag.",
		[
			"Each row pools entries carrying that normalized tag.",
			"Read lexical richness, sentence length, and revision lag together to see how that tag tends to behave.",
			"These are association profiles, not definitions of the tag's meaning.",
		],
		"A tag can skew toward long and revised entries even if it is not one of the most frequent tags.",
	),
	"Regime shifts": buildSectionTooltip(
		"Regime shifts",
		"adjacent-year comparisons showing where the corpus changed most strongly across tags, text, volume, revision, and cadence.",
		[
			"Each row compares one year with the next year after it.",
			"Higher score means more signals moved together between those years.",
			"Component columns show which layer contributed most to the shift.",
		],
		"A high text value with low volume value means style changed more than output size.",
	),
	"Productivity modes by year": buildSectionTooltip(
		"Productivity modes by year",
		"heuristic labels summarizing the dominant writing pattern in each year.",
		[
			"These are interpretive labels, not hard categories.",
			"Read the rationale column to see which signals triggered the mode.",
			"Use them as a quick orientation layer over the year profiles.",
		],
		"A year labeled 'bursty' usually combines clustered cadence with less even temporal spread.",
	),
	"Longest silence gap examples": "Concrete before-and-after note pairs for the largest writing gaps detected inside the analyzed scope.",
	"Largest revision lags": "Concrete notes with the longest positive lag between Created at and Last updated at.",
	"Recurring phrase example notes": "Recurring phrase rows linked back to example notes that carry those phrase families.",
	"Tag-pair lift example notes": "Strong tag-pair motifs linked back to example notes where those pairs occur together.",
	"Bridge tag example notes": "Bridge-tag rows linked back to example notes carrying those cross-cutting tags.",
	"Regime shift example notes": "Representative note links from the years on both sides of the strongest regime shifts.",
	"Per-year summary": "Compact yearly totals for entries, words, reading time, and fallback-date usage.",
	Scope: "How the current include or exclude folder rules shaped the set of analyzed files.",
	"Date quality": "Where configured frontmatter dates were missing, invalid, unresolved, or replaced by filesystem fallback.",
	"Files with missing or invalid frontmatter dates": "Notes whose configured created or updated frontmatter values were missing or could not be parsed, with the fallback source shown when available.",
	Performance: "Cache and runtime information describing how much work the latest manual run had to perform.",
	"Sample matched files": "Small verification list showing which files matched the current scope settings.",
	"Active note word count debug": "Debug panel showing the exact cleaned text and token list used to count words in the active note.",
	"Cleaned text": "The active note body after the current word-count cleanup rules were applied.",
};

const ADVANCED_HEADLINE_DETAIL_TOOLTIP_LABELS: Record<string, string[]> = {
	"Most bursty year": ["Burstiness index"],
	"Most revision-heavy year": ["Revision intensity"],
	"Most thematically concentrated year": ["Tag concentration"],
	"Most semantically diverse year": ["Tag entropy"],
	"Strongest recurring motif": ["Lift", "Support"],
	"Sharpest regime shift year": ["Score"],
	"Most concentrated writing year": ["Concentration"],
	"Most revisited year": ["Revisit ratio"],
	"Richest vocabulary year": ["Lexical richness"],
	"Most repetitive phrasing year": ["Recurring phrase share"],
	"Sharpest opening-style shift": ["Score"],
};

const METRIC_TOOLTIP_TEXT: Record<string, string> = {
	"Years written": "How many distinct chronology years were detected from the resolved created-date data.",
	"Total entries": "How many markdown diary notes matched the current scope and were included in the analysis.",
	"Total words": "The summed word count after the current parsing and cleanup rules were applied.",
	"Read whole diary": "Estimated reading time for all counted words at the configured reading speed.",
	"Average-length entry": "Estimated reading time for one typical entry, based on the selected median or mean rule.",
	"Analysis duration": "How long the last manual analysis run took from start to finish.",
	"Reading speed": "The words-per-minute setting currently used for all reading-time estimates.",
	"Mean words per entry": "Arithmetic average note length across all included entries.",
	"Median words per entry": "Middle note length across all included entries, which is usually less affected by outliers.",
	"Created fallback used": "Entries whose created date came from filesystem metadata because frontmatter was missing or invalid.",
	"Updated fallback used": "Entries whose updated date came from filesystem metadata because frontmatter was missing or invalid.",
	"Minimum frequency": "Only tags or tag combinations appearing at least this many times are shown.",
	"Combination depth": "Whether the analysis considers only single tags, or also pairs and triplets.",
	"Hierarchy mode": "Full keeps the whole hierarchical tag. Leaf keeps only the last segment.",
	"Tag metric time scope": "Whether tag-driven metrics use all eligible years or only a chosen year range before any extra year filters are applied.",
	"Tag metric range": "The active year-range window for tag-driven metrics when the restricted time-scope mode is enabled.",
	"Additional year filters": "Optional extra include/exclude year filters applied after the main tag metric time scope.",
	"Alias rules": "How many alias-normalization rules were applied before tags were counted.",
	"Ignored tags": "How many ignored-tag rules are active for this analysis run.",
	"Year filters": "Included years are applied first, then excluded years are removed from tag-based analysis.",
	"Mean tags per note": "Average number of normalized frontmatter tags per eligible note in the current tag-analysis scope.",
	"Median tags per note": "Middle number of normalized frontmatter tags per eligible note in the current tag-analysis scope.",
	"Longest writing streak": "The longest run of consecutive calendar days with at least one entry in the analyzed scope.",
	"Streak entries": "How many entries fall inside the longest detected streak window.",
	"Most verbose month": "Calendar month-of-year with the highest average words per entry across all years in the current scope.",
	"Shortest month": "Calendar month-of-year with the lowest average words per entry across all years in the current scope.",
	"Most active hour": "Hour-of-day with the highest number of entries among notes that have an explicit created-time component.",
	"Quietest active hour": "Least-used hour-of-day that still has at least one timed entry.",
	"Timed entries": "How many entries had an explicit hour and minute available for hour-of-day analysis.",
	"Hour metric scope": "Which chronology years are currently eligible for hour-of-day analysis before the explicit-time requirement is applied.",
	"Qualifying tags in scope": "How many normalized tags reached the current minimum frequency inside the current tag metric time scope.",
	"Displayed heatmap tags": "How many of those qualifying tags are shown in the heatmap after the display cap is applied.",
	"Top tag in scope": "Most frequent qualifying normalized tag inside the current tag metric time scope.",
	"Filtered entries": "How many entries remained eligible for the specific tag table after year filters were applied.",
	"Qualifying tags": "How many tags or tag combinations met the minimum frequency threshold for the table.",
	"Rows shown": "How many qualifying rows are visible here. Set the dashboard row limit to 0 to show all.",
	"Records mode": "Simple shows the most intuitive extreme-note lists. Expanded adds more body-text and tag-density records.",
	"Record rows": "How many rows are shown inside each record table.",
	"Most bursty year": buildStructuredTooltip(
		"Most bursty year",
		"which year had the most uneven spacing of active writing days.",
		[
			"Read it together with the burstiness index shown in the supporting detail.",
			"Higher means more clustered writing bursts separated by longer quiet periods.",
			"Lower means a steadier, more regular rhythm.",
		],
		"A year can win here even with fewer entries if those entries arrived in tighter clusters.",
	),
	"Most revision-heavy year": buildStructuredTooltip(
		"Most revision-heavy year",
		"which year shows the strongest combined revision behavior.",
		[
			"This headline is driven by revisit ratio and lag intensity together.",
			"Higher means more entries were revisited or revised after longer delays.",
			"Lower means entries were more often left close to their initial version.",
		],
		"A year with many positive revision lags and long update gaps will rank highly here.",
	),
	"Most thematically concentrated year": buildStructuredTooltip(
		"Most thematically concentrated year",
		"which year's qualifying tags were concentrated into fewer dominant themes.",
		[
			"Higher concentration means fewer tags dominate the year's tag distribution.",
			"Lower concentration means themes are spread more evenly.",
			"Read alongside tag entropy for the opposite angle on variety.",
		],
		"A year dominated by only a few recurring tags will tend to surface here.",
	),
	"Most semantically diverse year": buildStructuredTooltip(
		"Most semantically diverse year",
		"which year had the most even and varied qualifying tag distribution.",
		[
			"This headline uses tag entropy rather than raw tag count.",
			"Higher means the year's tags were more evenly distributed.",
			"Lower means a few tags dominated the year more strongly.",
		],
		"A year with many active tags can still score low if most entries use only one or two tags.",
	),
	"Strongest recurring motif": buildStructuredTooltip(
		"Strongest recurring motif",
		"which qualifying tag pair co-occurred more strongly than expected from its separate tag frequencies.",
		[
			"The detail value is the pair-lift signal.",
			"Higher lift means the pair behaves like a tighter recurring motif.",
			"Always read lift with support, because a rare pair can look strong numerically.",
		],
		"A pair seen together much more often than chance predicts can outrank a more common but weaker pair.",
	),
	"Sharpest regime shift year": buildStructuredTooltip(
		"Sharpest regime shift year",
		"which later year sits at the strongest adjacent-year structural change in the corpus.",
		[
			"The detail score combines changes in tags, text, volume, revision, and cadence.",
			"Higher means more layers changed together between two neighboring years.",
			"This is a comparative heuristic, not a formal change-point model.",
		],
		"If 2019 follows a very different 2018 across several signals, 2019 may surface here.",
	),
	"Most concentrated writing year": buildStructuredTooltip(
		"Most concentrated writing year",
		"which year packed its writing volume into fewer months instead of spreading it evenly.",
		[
			"Higher concentration means output clustered into a smaller part of the year.",
			"Lower concentration means the year was more seasonally even.",
			"Read this alongside total entries so a sparse year does not mislead you.",
		],
		"A year with heavy spring activity and little else will usually be more concentrated than a year with steady monthly output.",
	),
	"Most revisited year": buildStructuredTooltip(
		"Most revisited year",
		"which year had the highest share of entries later updated after their created time.",
		[
			"This headline uses revisit ratio rather than total words or entry count.",
			"Higher means more entries had a positive revision lag.",
			"Lower means entries were more often left unchanged after creation.",
		],
		"A year where many notes were reopened even briefly can beat a year with fewer but longer revisions.",
	),
	"Revision intensity": buildStructuredTooltip(
		"Revision intensity",
		"how strongly revision behavior weighs in this year after combining revisit share with revision-lag size.",
		[
			"Higher means more entries were revisited or revised after longer delays.",
			"Lower means revision behavior is lighter or closer to one-pass writing.",
			"Use it comparatively across years rather than as a calendar unit.",
		],
		"0.60 means the year is more revision-heavy than a year scoring 0.20, but not '60 percent revised.'",
	),
	"Tag concentration": buildStructuredTooltip(
		"Tag concentration",
		"how strongly a year's qualifying tag usage is concentrated into fewer dominant tags.",
		[
			"Higher means fewer tags dominate the year more strongly.",
			"Lower means the year's tags are spread more evenly.",
			"Read it together with tag entropy for the opposite perspective on thematic spread.",
		],
		"A highly concentrated year may revolve around one or two strong motifs even if several other tags are present.",
	),
	"Burstiness index": buildStructuredTooltip(
		"Burstiness index",
		"how unevenly entries are distributed over time.",
		[
			"Scale: roughly -1 to +1.",
			"Near -1: very regular writing rhythm.",
			"Near 0: mixed, neither strongly regular nor strongly bursty.",
			"Near +1: clustered bursts separated by longer gaps.",
		],
		"-0.4 = somewhat regular, not strongly bursty.",
	),
	"Longest silence gap": buildStructuredTooltip(
		"Longest silence gap",
		"the longest run of inactive days between consecutive active writing days.",
		[
			"Unit: days.",
			"Higher means there was at least one much longer pause in writing.",
			"Lower means the corpus has fewer extreme silent stretches.",
		],
		"42 days means there was one gap of about six weeks between active writing days.",
	),
	"Weekday bias stability": buildStructuredTooltip(
		"Weekday bias stability",
		"how consistently the weekday distribution stays similar from year to year.",
		[
			"Scale: 0 to 1 in practice.",
			"Higher means less weekday drift across years.",
			"Lower means the preferred writing weekdays changed more over time.",
		],
		"0.8 suggests a relatively stable weekday habit; 0.2 suggests stronger drift.",
	),
	"Seasonal asymmetry": buildStructuredTooltip(
		"Seasonal asymmetry",
		"how unevenly writing and revision activity are distributed across seasons.",
		[
			"Lower means activity is spread more evenly through the year.",
			"Higher means one season dominates more strongly.",
			"Read it as a relative imbalance score, not a calendar count.",
		],
		"A diary with strong autumn peaks and quiet summers will show more asymmetry than one with steady seasonal output.",
	),
	"Tail heaviness": buildStructuredTooltip(
		"Tail heaviness",
		"how large the long-entry tail is relative to the median note length.",
		[
			"Formula: roughly p90 divided by median.",
			"Around 1 means the long-note tail is close to the typical entry length.",
			"Higher values mean unusually long entries stretch the distribution more strongly.",
			"This metric is open-ended rather than capped.",
		],
		"2.9 means the 90th-percentile entry is about 2.9 times the median length.",
	),
	"Compression vs expansion": buildStructuredTooltip(
		"Compression vs expansion",
		"whether shorter or longer entries dominate around the median note length.",
		[
			"Above 1: shorter entries dominate.",
			"Around 1: shorter and longer sides are more balanced.",
			"Below 1: longer entries dominate.",
		],
		"1.8 means short entries are noticeably more common than long ones in this corpus.",
	),
	"Revisit ratio": buildStructuredTooltip(
		"Revisit ratio",
		"the share of entries whose updated time is later than their created time.",
		[
			"Scale: 0% to 100%.",
			"Higher means more entries were revisited after creation.",
			"Lower means more entries stayed close to a one-pass draft.",
		],
		"35% means about one in three entries was updated later.",
	),
	"Revision half-life": buildStructuredTooltip(
		"Revision half-life",
		"the approximate weighted median number of days it takes for revised entries to reach half of the corpus's revision lag mass.",
		[
			"Unit: days.",
			"Higher means revisions tend to happen after longer delays.",
			"Lower means revisions cluster closer to the creation date.",
			"This is an approximation, not a full edit-history reconstruction.",
		],
		"7 days suggests revisions tend to happen within about a week rather than months later.",
	),
	"Tag entropy": buildStructuredTooltip(
		"Tag entropy",
		"how evenly or diversely qualifying tags are distributed.",
		[
			"Higher means tag usage is more evenly spread across themes.",
			"Lower means a few tags dominate more strongly.",
			"Read it comparatively across years rather than as an absolute score.",
		],
		"A higher-entropy year usually feels thematically broader than a year dominated by one motif cluster.",
	),
	"Cadence vs note depth": buildStructuredTooltip(
		"Cadence vs note depth",
		"how the gap before an entry relates to that entry's depth proxy.",
		[
			"Scale: correlation from about -1 to +1.",
			"Positive: longer gaps tend to precede deeper entries.",
			"Negative: shorter gaps tend to precede deeper entries.",
			"Near 0: little consistent relationship.",
		],
		"0.3 suggests a mild tendency for longer pauses to lead into deeper entries.",
	),
	"Revision vs final length": buildStructuredTooltip(
		"Revision vs final length",
		"how positive revision lag relates to final word count.",
		[
			"Scale: correlation from about -1 to +1.",
			"Positive: longer revision lags tend to end in longer notes.",
			"Negative: longer lags tend to end in shorter notes.",
			"Near 0: little consistent relationship.",
		],
		"0.5 suggests a noticeable link between delayed revision and longer final notes.",
	),
	"Predominant mode": buildStructuredTooltip(
		"Predominant mode",
		"the most common heuristic productivity label across year profiles.",
		[
			"This summarizes the dominant yearly pattern, not every year at once.",
			"Use the productivity-modes table below for year-specific rationale.",
			"Think of it as the corpus's most common writing posture.",
		],
		"If several years are labeled 'steady,' that mode will likely appear here.",
	),
	"Body-text entries": buildStructuredTooltip(
		"Body-text entries",
		"how many entries currently contribute to the optional body-text analysis layer.",
		[
			"Higher counts make the text-aware summary more representative.",
			"Lower counts mean the text-aware layer rests on a smaller usable subset.",
			"This count can be smaller than total entries when usable text or chronology data is missing.",
		],
		"180 means the body-text layer is drawing its corpus-level signals from 180 entries.",
	),
	"Overall lexical richness": buildStructuredTooltip(
		"Overall lexical richness",
		"overall vocabulary variety across normalized body-text tokens.",
		[
			"This is a corrected richness score rather than a raw type-token ratio.",
			"Higher means more vocabulary variety for the amount of text.",
			"It is most useful for comparison across years, tags, or corpora inside this dashboard.",
		],
		"0.90 is not '90% rich'; it means the corpus is relatively lexically varied under this normalized measure.",
	),
	"Dominant opening style": buildStructuredTooltip(
		"Dominant opening style",
		"the most common heuristic category for how entries begin.",
		[
			"Categories are lightweight and rule-based rather than AI-inferred.",
			"Use this as a stylistic tendency, not a hard classification truth.",
			"Check opening-style shifts to see how this tendency changes over time.",
		],
		"If 'temporal' dominates, many entries likely begin by placing the moment in time first.",
	),
	"Body-text scope": buildStructuredTooltip(
		"Body-text scope",
		"which chronology years are currently included in the text-aware analysis layer.",
		[
			"'All eligible years' means every usable year contributes.",
			"A restricted range means only that slice of chronology contributes to body-text metrics.",
			"This affects text-aware profiles, recurring phrases, and text-driven hidden structures.",
		],
		"2023 to 2026 means earlier years stay in the diary analysis, but not in body-text-derived summaries.",
	),
	"Entries with body-text features": buildStructuredTooltip(
		"Entries with body-text features",
		"how many entries had usable cleaned body text and chronology data for text-aware analysis.",
		[
			"Higher counts make the text-aware metrics more stable.",
			"Lower counts mean the text layer rests on a smaller usable subset.",
			"This number can be lower than total entries if dates or usable text are missing.",
		],
		"250 means the text-aware section is drawing from 250 analyzed entries, not necessarily the whole corpus.",
	),
	"Richest vocabulary year": buildStructuredTooltip(
		"Richest vocabulary year",
		"which year has the highest lexical-richness score after token normalization.",
		[
			"This focuses on vocabulary variety, not raw word count.",
			"Higher means the year's language is more varied for its size.",
			"Read it together with novelty and recurring phrase share for balance.",
		],
		"A shorter year can outrank a longer year if its vocabulary is more varied and less repetitive.",
	),
	"Most novel year": buildStructuredTooltip(
		"Most novel year",
		"which year introduced the highest share of vocabulary not seen in earlier analyzed years.",
		[
			"Novelty is relative to earlier periods only.",
			"Higher means the year's wording brought in more new vocabulary.",
			"Later years often have lower novelty simply because more vocabulary has already appeared.",
		],
		"A year after a long thematic shift may score highly if it introduces many previously unseen terms.",
	),
	"Most repetitive phrasing year": buildStructuredTooltip(
		"Most repetitive phrasing year",
		"which year had the highest share of entries participating in recurring phrase families.",
		[
			"Higher means more entries reuse recurring cleaned phrase patterns.",
			"Lower means phrasing is less tied to repeated formulations.",
			"This says nothing about quality; it only reflects recurrence.",
		],
		"A year can be lexically rich overall and still show strong phrase recurrence in openings or favorite formulations.",
	),
	"Strongest phrase family": buildStructuredTooltip(
		"Strongest phrase family",
		"which recurring phrase cluster has the highest recurrence score.",
		[
			"The ranking considers support, recurrence, and spread across time.",
			"Higher means the phrase family is both recurrent and structurally persistent.",
			"Read the phrase-family table below for year span and average gap.",
		],
		"A phrase appearing across distant years usually ranks more strongly than one brief local cluster with similar support.",
	),
	"Longest-sentence month": buildStructuredTooltip(
		"Longest-sentence month",
		"which calendar month tends to have the highest average sentence length.",
		[
			"The number shown is words per sentence after the current text-cleaning rules.",
			"Higher means sentences in that month tend to run longer.",
			"Read together with variation to see whether that month is consistently long or wildly mixed.",
		],
		"Jul (5.6) means July entries average about 5.6 words per sentence under the current sentence splitter.",
	),
	"Shortest-sentence month": buildStructuredTooltip(
		"Shortest-sentence month",
		"which calendar month tends to have the lowest average sentence length.",
		[
			"The number shown is words per sentence after the current text-cleaning rules.",
			"Lower means sentences in that month tend to be shorter.",
			"Read together with variation to see whether the short style is stable or mixed.",
		],
		"Feb (3.8) means February entries average about 3.8 words per sentence under the current sentence splitter.",
	),
	"Richest tag": buildStructuredTooltip(
		"Richest tag",
		"which qualifying tag's entries have the highest average lexical-richness score.",
		[
			"This compares tag-associated entries rather than whole years.",
			"Higher means entries with that tag use more varied vocabulary for their size.",
			"Read it with support so a tiny tag subset does not mislead you.",
		],
		"A rare tag can top this list if its notes are unusually varied in wording.",
	),
	"Most revised tag": buildStructuredTooltip(
		"Most revised tag",
		"which qualifying tag's entries have the highest average positive revision lag.",
		[
			"Unit: days.",
			"Higher means entries with that tag tend to be revisited later or for longer.",
			"Read it with support, because a few long-lag notes can dominate a small tag.",
		],
		"A tag averaging 14 revision days tends to live in notes revisited much later than a tag averaging 2 days.",
	),
	"Deep-text scope": buildStructuredTooltip(
		"Deep-text scope",
		"which notes are eligible for the optional Czech-normalized deep-text layer.",
		[
			"'Analyze everything' means all dated notes with deep-text features are eligible.",
			"'Use defined scope' applies the chosen year range and included or excluded normalized tags.",
			"This scope affects only the Czech-normalized subsection, not the rest of the dashboard.",
		],
		"2022 to 2023 means the deep-text layer is reading only that era even while the main dashboard still covers the full corpus.",
	),
	"Deep-text tags": buildStructuredTooltip(
		"Deep-text tags",
		"which normalized tag filters narrow the optional Czech-normalized deep-text scope.",
		[
			"'No tag filter' means the deep-text layer uses every note inside its year scope.",
			"Included tags require at least one matching normalized tag.",
			"Excluded tags remove notes after the include filter is applied.",
		],
		"'Include therapy | exclude work' means only scoped notes tagged therapy and not tagged work enter this layer.",
	),
	"Czech-normalized entries": buildStructuredTooltip(
		"Czech-normalized entries",
		"how many dated notes contributed to the optional Czech-normalized deep-text layer after its own scope filters were applied.",
		[
			"Higher counts make the deep-text layer more stable.",
			"Lower counts mean the scoped vocabulary metrics rest on a smaller subset.",
			"This can be much lower than the main body-text entry count if the deep-text scope is narrow.",
		],
		"48 means the Czech-normalized subsection is drawing from 48 scoped entries, not the full diary.",
	),
	"Scoped content tokens": buildStructuredTooltip(
		"Scoped content tokens",
		"how many filtered content-like tokens remain after Czech-aware normalization, stopword removal, and conservative suffix trimming.",
		[
			"This is the token pool used for the deep-text vocabulary metrics.",
			"Higher means more content vocabulary material is available inside the chosen deep-text scope.",
			"It is a scale anchor, not a quality score.",
		],
		"12,000 means the deep-text layer is working with about twelve thousand scoped content tokens after filtering.",
	),
	"Scoped vocabulary size": buildStructuredTooltip(
		"Scoped vocabulary size",
		"how many unique content-vocabulary forms remain inside the chosen deep-text scope.",
		[
			"This is based on Czech-aware normalized content tokens, not raw word forms.",
			"Higher means a broader scoped vocabulary after filtering.",
			"Read it together with content-token count so size and variety stay in context.",
		],
		"1,800 means the scoped notes produced about 1,800 distinct filtered vocabulary forms.",
	),
	"Normalized lexical richness": buildStructuredTooltip(
		"Normalized lexical richness",
		"overall vocabulary variety inside the Czech-normalized deep-text layer.",
		[
			"This uses the filtered Czech-aware content token pool rather than the raw token stream.",
			"Higher means more varied content vocabulary for the amount of scoped text.",
			"It is comparative, not a direct percentage.",
		],
		"0.88 means the scoped content vocabulary is relatively varied under this normalized measure.",
	),
	"Content-token share": buildStructuredTooltip(
		"Content-token share",
		"the share of cleaned tokens that remain as content-like vocabulary after Czech-aware normalization and filtering.",
		[
			"Scale: 0% to 100%.",
			"Higher means more of the scoped token stream survives the content filter.",
			"Lower means the text contains relatively more function words, short tokens, or filtered forms.",
		],
		"42% means roughly two out of five scoped cleaned tokens remain in the deep-text content vocabulary pool.",
	),
	"Richest normalized year": buildStructuredTooltip(
		"Richest normalized year",
		"which scoped year has the highest lexical-richness score inside the Czech-normalized deep-text layer.",
		[
			"This uses the filtered Czech-aware content vocabulary, not raw forms.",
			"Higher means the year's scoped content vocabulary is more varied for its size.",
			"Read it together with novelty and content share for balance.",
		],
		"A scoped year can top this even with fewer entries if its filtered content vocabulary stays broad and less repetitive.",
	),
	"Most novel normalized year": buildStructuredTooltip(
		"Most novel normalized year",
		"which scoped year introduced the highest share of filtered content vocabulary not seen in earlier scoped years.",
		[
			"Novelty is relative to earlier scoped years only.",
			"Higher means the year brought in more new normalized content vocabulary.",
			"Later years often have lower novelty because more vocabulary has already appeared earlier in scope.",
		],
		"A year after a thematic change can surface here if it introduces many previously unseen filtered vocabulary forms.",
	),
	"Densest content year": buildStructuredTooltip(
		"Densest content year",
		"which scoped year kept the highest share of content-like tokens after Czech-aware filtering.",
		[
			"Higher means a larger share of cleaned tokens survived as content vocabulary.",
			"Lower means the year contains relatively more function words or filtered material.",
			"This is a density signal, not a quality judgment.",
		],
		"A year with dense descriptive or topic-heavy wording can outrank a more conversational year here.",
	),
	"Selected period": buildStructuredTooltip(
		"Selected period",
		"the year span whose Czech-normalized vocabulary is being contrasted against the chosen comparison set.",
		[
			"If both period years are blank in Settings, the latest scoped year is used by default.",
			"A range like 2022-2023 pools those two years together.",
			"This period sits inside the existing deep-text scope rather than replacing it.",
		],
		"2025 means the keyness tables are reading 2025 against the selected comparison basis inside the current deep-text scope.",
	),
	"Comparison basis": buildStructuredTooltip(
		"Comparison basis",
		"the reference set used to decide whether a term is distinctive, emergent, or fading.",
		[
			"'Earlier scoped years' compares the selected period only with what came before it.",
			"'All other scoped years' compares the selected period with the rest of the scoped corpus.",
			"Changing this basis can change which terms look distinctive.",
		],
		"A term may be distinctive against earlier years but less distinctive against the whole rest of the corpus.",
	),
	"Selected period entries": buildStructuredTooltip(
		"Selected period entries",
		"how many scoped notes contribute to the chosen period in the period-signature comparison.",
		[
			"Higher counts make the comparison more stable.",
			"Lower counts make distinctive-term rankings noisier.",
			"This count uses the existing deep-text scope first, then the selected period filter.",
		],
		"12 means the selected period is represented by twelve scoped entries in the term comparison.",
	),
	"Comparison entries": buildStructuredTooltip(
		"Comparison entries",
		"how many scoped notes contribute to the reference side of the period-signature comparison.",
		[
			"This is the baseline the selected period is being contrasted against.",
			"Very small comparison counts make the keyness layer less stable.",
			"If this is zero, the comparison tables cannot be built.",
		],
		"0 means the selected period has no usable reference set under the chosen comparison mode.",
	),
	"Selected content tokens": buildStructuredTooltip(
		"Selected content tokens",
		"how many Czech-normalized content tokens belong to the chosen period.",
		[
			"This is the token pool behind the selected-period term rates.",
			"Higher totals make the period signature more stable.",
			"It is a scale anchor rather than a quality score.",
		],
		"8,000 means the selected period contributes about eight thousand filtered content tokens to the comparison.",
	),
	"Comparison content tokens": buildStructuredTooltip(
		"Comparison content tokens",
		"how many Czech-normalized content tokens belong to the comparison side of the period-signature analysis.",
		[
			"This is the baseline token pool behind the comparison rates.",
			"The selected and comparison token pools do not have to be similar in size.",
			"Scores are smoothed so one side is not punished only for being smaller.",
		],
		"20,000 means the comparison period provides a larger baseline token pool than the selected period.",
	),
	"Candidate terms": buildStructuredTooltip(
		"Candidate terms",
		"how many normalized content terms had enough support to enter the period-signature scoring step.",
		[
			"Very low-support terms are filtered out to reduce noise.",
			"Higher counts mean the comparison is drawing from a broader vocabulary contrast.",
			"This is the candidate pool before the top tables are sliced for display.",
		],
		"450 means the keyness layer scored about 450 supported terms before ranking them.",
	),
	"Strongest distinctive term": buildStructuredTooltip(
		"Strongest distinctive term",
		"the top-ranked term whose score most strongly favors the selected period over the comparison set.",
		[
			"This is a quick headline, not the whole evidence base.",
			"Read the distinctive-terms table below for counts and shares.",
			"A strong term is usually both concentrated and sufficiently supported.",
		],
		"A top term here is often a strong clue to the selected period's linguistic signature.",
	),
	"Strongest emergent term": buildStructuredTooltip(
		"Strongest emergent term",
		"the highest-share term that appears in the selected period but not in the comparison set.",
		[
			"This highlights new arrivals under the current normalized layer.",
			"Read the emergent-terms table for the broader set.",
			"Near-variants can still split because this is not full lemmatization.",
		],
		"A term here is absent from the comparison period, not just rarer there.",
	),
	"Strongest fading term": buildStructuredTooltip(
		"Strongest fading term",
		"the term whose score most strongly favors the comparison set over the selected period.",
		[
			"This is the opposite pole of distinctiveness.",
			"It helps identify vocabulary that recedes in the chosen period.",
			"Read the fading-terms table for supporting counts and shares.",
		],
		"A strongly fading term often marks an older motif or vocabulary field that weakens in the selected period.",
	),
	"Entity candidates": buildStructuredTooltip(
		"Entity candidates",
		"how many recurring heuristic entity candidates survived the current support threshold inside the active deep-text scope.",
		[
			"These candidates come from capitalized words and multi-word spans in cleaned note text.",
			"Support is counted by scoped entries, not by raw mention frequency.",
			"This is a recurring-candidate pool, not a claim of true named entities.",
		],
		"18 means eighteen recurring candidates survived the current support filter.",
	),
	"Entity pairs": buildStructuredTooltip(
		"Entity pairs",
		"how many recurring co-occurring entity-candidate pairs survived the current support threshold inside the active deep-text scope.",
		[
			"Pairs are built from candidates appearing in the same scoped entries.",
			"Support is counted by shared entries, not token distance within one note.",
			"This is relationship context evidence, not a semantic role model.",
		],
		"7 means seven candidate pairs co-occur often enough to appear in the current summary.",
	),
	"Most persistent entity candidate": buildStructuredTooltip(
		"Most persistent entity candidate",
		"the recurring candidate that appears in the highest number of scoped entries.",
		[
			"Support is the main ranking driver here.",
			"Active years help distinguish long presence from one-period bursts.",
			"Read this as recurrence inside the current deep-text scope.",
		],
		"A candidate seen in 20 scoped notes is more persistent than one seen in 5.",
	),
	"Newest entity candidate": buildStructuredTooltip(
		"Newest entity candidate",
		"the recurring candidate whose first appearance is latest inside the active deep-text scope.",
		[
			"This highlights new arrivals, not necessarily the strongest or most common ones.",
			"Ties are broken by support and active years.",
			"Use it to spot who or what enters the corpus later.",
		],
		"A candidate first appearing in 2026 is newer than one first appearing in 2024.",
	),
	"Longest-lived entity candidate": buildStructuredTooltip(
		"Longest-lived entity candidate",
		"the recurring candidate with the widest first-year to last-year span inside the active deep-text scope.",
		[
			"This rewards lifespan span rather than raw support alone.",
			"Active years help distinguish steady recurrence from sparse distant returns.",
			"Use it to spot long-running anchors in the diary.",
		],
		"A candidate spanning 2022-2026 is longer-lived than one spanning only 2025-2026.",
	),
	"Bridge entity candidate": buildStructuredTooltip(
		"Bridge entity candidate",
		"the recurring candidate with the strongest spread across support, active years, and lifespan span under the current heuristic.",
		[
			"Higher bridge score means the candidate behaves more like a cross-period anchor.",
			"This is a spread signal, not a semantic judgment.",
			"Read it together with support and active years.",
		],
		"A candidate returning across many years will often outrank a denser but short-lived burst.",
	),
	"Strongest entity pair": buildStructuredTooltip(
		"Strongest entity pair",
		"the co-occurring candidate pair with the strongest relationship score under the current local heuristic.",
		[
			"Support counts shared scoped entries.",
			"Active years and span help distinguish durable pairings from one-period bursts.",
			"This is co-occurrence evidence, not a claim about relation type.",
		],
		"A pair recurring together across several years is usually stronger than a one-month-only pair with similar support.",
	),
	"Sharpest opening-style shift": buildStructuredTooltip(
		"Sharpest opening-style shift",
		"which adjacent-year transition shows the strongest change in opening-line signature distribution.",
		[
			"Higher means the way entries begin changed more strongly between those years.",
			"This is about opening-style mix, not about vocabulary or tags directly.",
			"Read it as a stylistic transition signal.",
		],
		"If one year opens mostly with temporal frames and the next year shifts toward fragments or scene-setting, this score rises.",
	),
	"Fastest-returning tag": buildStructuredTooltip(
		"Fastest-returning tag",
		"which qualifying tag tends to reappear after the shortest average gap between active days.",
		[
			"Unit: days.",
			"Lower average gap means the motif comes back more quickly.",
			"This highlights recurrence tempo, not total frequency alone.",
		],
		"A tag returning every few days on average is more cyclic than one that returns every few weeks.",
	),
	"Most persistent tag": buildStructuredTooltip(
		"Most persistent tag",
		"which tag has the strongest consecutive-year persistence relative to its overall lifespan.",
		[
			"Higher persistence means the tag tends to survive year after year without large breaks.",
			"This differs from lifespan: a tag can live long overall but still appear sporadically.",
			"Use it to find motifs that stay continuously present.",
		],
		"A tag appearing in six consecutive years is more persistent than one appearing in six scattered years.",
	),
	"Longest-lived tag": buildStructuredTooltip(
		"Longest-lived tag",
		"which tag spans the greatest number of distinct years.",
		[
			"This measures breadth across years, not continuity inside them.",
			"Higher lifespan means the motif stays present across a longer historical range.",
			"Read it with persistence to distinguish steady motifs from intermittent returns.",
		],
		"A tag seen in 2010, 2012, 2016, and 2024 has a long lifespan even if it is not continuous.",
	),
	"Strongest positive tag-length coupling": buildStructuredTooltip(
		"Strongest positive tag-length coupling",
		"which tag is most associated with longer-than-baseline entries.",
		[
			"Positive coupling means entries with that tag tend to be longer than the corpus baseline.",
			"The stronger the positive delta, the more the tag skews toward longer notes.",
			"Read it with support so a few unusual notes do not dominate the story.",
		],
		"A strongly positive tag-length coupling suggests that motif tends to bring longer entries with it.",
	),
	"Strongest negative tag-length coupling": buildStructuredTooltip(
		"Strongest negative tag-length coupling",
		"which tag is most associated with shorter-than-baseline entries.",
		[
			"Negative coupling means entries with that tag tend to be shorter than the corpus baseline.",
			"The stronger the negative delta, the more that tag skews toward brief notes.",
			"Read it with support before drawing conclusions.",
		],
		"A strongly negative coupling suggests that motif tends to appear in short or compressed entries.",
	),
	"Sharpest structural shift": buildStructuredTooltip(
		"Sharpest structural shift",
		"the strongest adjacent-year corpus change across the combined structural signals.",
		[
			"This reading summarizes the regime-shift table into one headline.",
			"Higher means more layers changed together between those years.",
			"Use the regime-shift table below to see which layers drove it.",
		],
		"A structural shift can be driven more by text and tags than by total entry count.",
	),
	"Strongest recurring tag motif": buildStructuredTooltip(
		"Strongest recurring tag motif",
		"the most strongly lifted recurring tag pair in the current qualifying set.",
		[
			"It is ranked by pair lift, not only by raw frequency.",
			"Higher lift means the pair forms a tighter motif than expected.",
			"Support still matters for confidence.",
		],
		"A pair with moderate support but very strong lift can beat a common but loosely associated pair.",
	),
	"Richest vocabulary period": buildStructuredTooltip(
		"Richest vocabulary period",
		"the highlighted year where lexical richness and novelty together look especially strong.",
		[
			"This reading combines text-aware vocabulary signals.",
			"Higher richness with meaningful novelty suggests a more textually expansive period.",
			"Use it as an interpretive prompt, not as a literary verdict.",
		],
		"A year with varied wording and many newly introduced terms is a likely candidate here.",
	),
	"Most persistent recurrent phrase": buildStructuredTooltip(
		"Most persistent recurrent phrase",
		"the recurring phrase family that stays structurally present across the widest and strongest time span.",
		[
			"This emphasizes persistence over time, not only support count.",
			"Year span and gap help distinguish brief repetition from long-lived recurrence.",
			"These are cleaned phrase windows, not semantic paraphrase families.",
		],
		"A phrase reappearing across several distant years is more persistent than one packed into one month.",
	),
	"Most revision-heavy tag": buildStructuredTooltip(
		"Most revision-heavy tag",
		"the tag whose associated entries show the highest average positive revision lag.",
		[
			"Unit: days.",
			"Higher means notes with this tag tend to be revisited later or more often.",
			"Read it with support before treating it as a stable pattern.",
		],
		"A tag averaging 20 revision days is more revision-heavy than one averaging 3 days.",
	),
	"Sharpest opening-style drift": buildStructuredTooltip(
		"Sharpest opening-style drift",
		"the strongest adjacent-year change in how entries tend to begin.",
		[
			"This is the hidden-structure reading version of opening-style shift.",
			"Higher means the opening-signature mix changed more strongly between two years.",
			"Use it as a stylistic-drift clue rather than a topic change signal.",
		],
		"A shift from declarative openings to fragmentary or scene-setting openings would raise this score.",
	),
	"Folder mode": "Whether the configured folders are the only eligible folders, or are the folders to skip.",
	"Configured folders": "How many folder paths are currently listed in the scope settings.",
	"Matched files": "How many markdown files survived all scope, ignore, and hidden-folder checks.",
	"Ignored by scope": "Files excluded because they did not satisfy the include or exclude folder rule.",
	"Ignored by folder rules": "Files excluded by the ignored-folder-rule list such as Resources or attachments.",
	"Ignored by hidden folders": "Files skipped because they live inside dotfolders and the hidden-folder rule is enabled.",
	"Created key missing": "Entries where the configured created-date frontmatter key was not present.",
	"Created key invalid": "Entries where the created-date key existed but the value could not be parsed.",
	"Updated key missing": "Entries where the configured updated-date frontmatter key was not present.",
	"Updated key invalid": "Entries where the updated-date key existed but the value could not be parsed.",
	"Unresolved chronology": "Entries that still could not be assigned to a chronology year even after fallback handling.",
	"Date issues listed": "How many files appear in the missing-or-invalid frontmatter date report below.",
	"Reused cached files": "Files whose previously cached analysis could be reused without rereading the note.",
	"Refreshed files": "Files that had to be re-read and re-analyzed during this run.",
	"Dropped deleted files": "Cache entries removed because the source file no longer exists in the vault.",
	"Current cache entries": "How many per-file analysis records are currently stored in the plugin cache.",
	"Active note tokens": "The exact token count produced by the current word-count cleanup logic for the active note.",
	"Active note path": "The vault-relative path of the note currently shown in the debug section.",
};

const TABLE_HEADER_TOOLTIP_TEXT: Record<string, string> = {
	Year: "Chronology year derived from the created-date data for this row.",
	Entries: "Number of entries contributing to this row or period.",
	Words: "Summed word count after the current cleanup rules.",
	"Reading time": "Estimated reading time at the configured words-per-minute setting.",
	"Created fallback": "How many entries in this row used filesystem created time instead of frontmatter.",
	"Updated fallback": "How many entries in this row used filesystem updated time instead of frontmatter.",
	Tag: "Normalized frontmatter tag used for this row.",
	"Avg words": "Arithmetic average words per entry after the current cleanup rules.",
	"Mean words": "Arithmetic mean words per entry for that year after the current cleanup rules.",
	"Median words": "Middle word-count value for the qualifying entries in this row or year, which is less affected by outliers than the mean.",
	"Content tokens": "Filtered content-like tokens remaining after Czech-aware normalization, stopword removal, and conservative suffix trimming.",
	Vocabulary: "Number of unique filtered content-vocabulary forms contributing to this row.",
	"Content share": "Share of cleaned tokens that remain in the Czech-normalized content vocabulary after filtering.",
	"Selected tokens": "How many normalized content tokens for this term come from the selected period.",
	"Comparison tokens": "How many normalized content tokens for this term come from the comparison side of the period-signature analysis.",
	"Selected share": "Share of the selected period's content-token pool occupied by this term.",
	"Comparison share": "Share of the comparison token pool occupied by this term.",
	Candidate: "Recurring heuristic entity-like label extracted from capitalized words or multi-word spans in the scoped cleaned text.",
	"First year": "Earliest scoped chronology year in which this candidate or pair appears.",
	"Last year": "Latest scoped chronology year in which this candidate or pair appears.",
	"Active years": "How many distinct scoped years this candidate or pair appears in.",
	"Relationship score": "Heuristic pair score combining support, active years, and lifespan span for co-occurring entity candidates.",
	"Mean delta vs baseline": "Difference between this row's mean word count and the overall mean word-count baseline for the current tag-analysis scope.",
	"Median delta vs baseline": "Difference between this row's median word count and the overall median word-count baseline for the current tag-analysis scope.",
	"Most common weekday": "The top one or two weekday shares for this row, shown as `Day (share%)` and separated by `|` when a second value is present.",
	"Most common month/year": "Month-year bucket that appears most often for this row, with its share shown in parentheses.",
	"Most common month": "Month that appears most often for this row, with its share shown in parentheses.",
	Burstiness: buildStructuredTooltip(
		"Burstiness",
		"the year-level burstiness score for this row.",
		[
			"Rough scale: -1 to +1.",
			"Lower means steadier spacing of active days.",
			"Higher means more clustered writing bursts separated by longer gaps.",
		],
		"A year with many entries can still have low burstiness if they were spread evenly.",
	),
	Concentration: buildStructuredTooltip(
		"Concentration",
		"how strongly the year's writing volume concentrates into fewer months.",
		[
			"Higher means volume is packed into fewer months.",
			"Lower means output is more evenly spread across the year.",
			"Read alongside entry count for context.",
		],
		"A concentrated year may be dominated by one season or a few intensive months.",
	),
	"Revisit ratio": buildStructuredTooltip(
		"Revisit ratio",
		"the share of entries in this row that were updated after creation.",
		[
			"Scale: 0% to 100%.",
			"Higher means more entries were revisited.",
			"Lower means the row is closer to one-pass writing.",
		],
		"40% means roughly two out of five entries in this row were updated later.",
	),
	"Tag entropy": buildStructuredTooltip(
		"Tag entropy",
		"how evenly qualifying tags are distributed within this row.",
		[
			"Higher means tags are more evenly spread.",
			"Lower means a few tags dominate more strongly.",
			"Best used comparatively across rows.",
		],
		"A row dominated by one motif cluster will usually have lower entropy.",
	),
	Mode: buildStructuredTooltip(
		"Mode",
		"the heuristic productivity label assigned to this year.",
		[
			"This is a summary interpretation, not a raw measurement.",
			"Read the productivity-modes table for the rationale behind each mode.",
			"Use it as a quick orientation aid when scanning year profiles.",
		],
		"A year marked 'steady' usually shows less concentration and less extreme burstiness.",
	),
	"Shift from previous": buildStructuredTooltip(
		"Shift from previous",
		"how strongly this row differs from the previous year across the combined structural signals.",
		[
			"Higher means a larger adjacent-year change.",
			"Lower means the year resembles the previous year more closely.",
			"Use the regime-shifts table for the component breakdown.",
		],
		"A high shift score does not tell you why by itself; the component table explains the drivers.",
	),
	Pair: buildStructuredTooltip(
		"Pair",
		"the paired items being measured in this row, such as a tag pair or an entity-candidate pair.",
		[
			"Order here is just a label, not a sequence.",
			"Different tables build pairs differently, so read the surrounding section title for context.",
			"Always read the pair together with support and the score or lift column.",
		],
		"A pair label can mean either two co-occurring tags or two recurring entity candidates that appear together in the same notes.",
	),
	Support: buildStructuredTooltip(
		"Support",
		"how many entries support the pair, phrase, or association in this row.",
		[
			"Higher support usually makes a pattern more stable.",
			"Low support can still be interesting, but it is easier for it to be noisy.",
			"Read support together with lift or score.",
		],
		"A row with lift 4.0 and support 2 is less stable than a row with lift 2.0 and support 40.",
	),
	Lift: buildStructuredTooltip(
		"Lift",
		"how much more strongly a pair or weekday association occurs than the baseline expectation.",
		[
			"1 means roughly baseline expectation.",
			"Above 1 means the association is stronger than expected.",
			"The further above 1, the tighter the association.",
		],
		"Lift 2.5 means the pair appears about 2.5 times as strongly as baseline would suggest.",
	),
	Frequency: buildStructuredTooltip(
		"Frequency",
		"how often the tag appears across the eligible entries used for this table.",
		[
			"Higher means the tag is more common in the analyzed subset.",
			"Frequency alone does not tell you whether the tag is structurally important.",
			"Read it together with degree and bridge score.",
		],
		"A tag can be frequent but still have a weak bridge role.",
	),
	Degree: buildStructuredTooltip(
		"Degree",
		"how many distinct qualifying tags this tag connects to in the co-occurrence graph.",
		[
			"Higher means the tag touches more different tag neighbors.",
			"Degree measures breadth of connection, not bridging quality by itself.",
			"Read it with bridge score for better interpretation.",
		],
		"A tag with degree 10 connects to more tag neighbors than one with degree 3.",
	),
	"Bridge score": buildStructuredTooltip(
		"Bridge score",
		"how strongly the current row behaves like a connector or spread anchor under the local heuristic used by that table.",
		[
			"In tag tables, this reflects connector behavior across tag neighborhoods.",
			"In entity tables, it reflects support, active-year spread, and lifespan span together.",
			"Read it with the other columns rather than as a standalone absolute value.",
		],
		"A row can have moderate frequency but high bridge score if it stays broadly connected across the current structure.",
	),
	Weekday: buildStructuredTooltip(
		"Weekday",
		"the weekday most strongly associated with the tag in this row.",
		[
			"This is the strongest weekday bias detected for that row.",
			"Read it with lift and support before trusting the association.",
			"It marks overrepresentation, not exclusivity.",
		],
		"If Monday appears here, it means the tag is more concentrated on Mondays than the baseline suggests.",
	),
	"Lexical richness": buildStructuredTooltip(
		"Lexical richness",
		"vocabulary variety after token normalization.",
		[
			"Higher means more varied wording for the amount of text.",
			"This is not a percentage and is best used comparatively.",
			"Read it beside novelty and recurring phrase share for context.",
		],
		"A row with higher lexical richness uses a wider vocabulary for its text volume.",
	),
	Novelty: buildStructuredTooltip(
		"Novelty",
		"the share of vocabulary in this row that had not appeared in earlier analyzed periods.",
		[
			"Higher means more newly introduced terms.",
			"Lower means the row leans more on previously seen vocabulary.",
			"This is inherently relative to earlier periods only.",
		],
		"A novelty value of 0.20 means about one fifth of the row's vocabulary was new relative to earlier periods.",
	),
	"Avg sentence": buildStructuredTooltip(
		"Average sentence length",
		"the average number of words per sentence after the current text-cleaning and sentence-splitting rules.",
		[
			"Unit: words per sentence.",
			"Higher means sentences tend to run longer.",
			"Lower means sentences tend to be shorter or more fragmented.",
		],
		"5.6 means the row averages about 5.6 words per sentence under the current heuristics.",
	),
	"Median sentence": buildStructuredTooltip(
		"Median sentence length",
		"the middle per-note average sentence length for the rows contributing to this table entry.",
		[
			"Unit: words per sentence.",
			"It is less affected by a few unusually long or unusually short notes than the mean.",
			"Read it alongside the average sentence length for a broader center-of-gravity view.",
		],
		"4.8 means the middle note-level sentence average in this row is about 4.8 words per sentence.",
	),
	Variation: buildStructuredTooltip(
		"Sentence variation",
		"how much sentence lengths vary around the row's average sentence length.",
		[
			"Higher means sentence lengths are more mixed or uneven.",
			"Lower means sentence lengths are more consistent.",
			"Read it with average sentence length for climate context.",
		],
		"A row can have short average sentences but high variation if it mixes fragments with occasional long sentences.",
	),
	Opening: buildStructuredTooltip(
		"Opening",
		"the most common heuristic opening-line signature for this row.",
		[
			"Categories are rule-based and lightweight.",
			"Read this as a dominant opening tendency, not a perfect classification.",
			"Use it comparatively across years or tags.",
		],
		"If 'descriptive' appears here, the row's entries often begin by describing a situation or scene.",
	),
	"Recurring phrase share": buildStructuredTooltip(
		"Recurring phrase share",
		"the share of entries in this row that participate in a recurring phrase family.",
		[
			"Scale: 0% to 100%.",
			"Higher means more entries reuse recurring cleaned phrase patterns.",
			"Lower means phrasing is less structurally repetitive.",
		],
		"30% means about three out of ten entries in the row contribute to a recurring phrase family.",
	),
	Phrase: "Recurring cleaned phrase detected by the local phrase matcher.",
	"Year span": buildStructuredTooltip(
		"Year span",
		"the first and last year in which the phrase or motif was detected.",
		[
			"A wider span usually means a longer-lived pattern.",
			"Span alone does not tell you whether the pattern is continuous.",
			"Read it with average gap and support for the full picture.",
		],
		"2018-2025 means the pattern appears at least once in that eight-year range.",
	),
	"Avg gap": buildStructuredTooltip(
		"Average gap",
		"the average number of days between repeated appearances of the current recurring item.",
		[
			"Unit: days.",
			"Lower means the item returns more quickly.",
			"Higher means it reappears after longer intervals.",
			"Read the surrounding table title to see whether the item is a phrase, candidate, or other recurring row type.",
		],
		"12 days means the item tends to come back every couple of weeks on average.",
	),
	Score: buildStructuredTooltip(
		"Score",
		"the composite heuristic score used to rank rows in this table.",
		[
			"Higher means a stronger signal under that table's ranking logic.",
			"Scores are mainly for comparison within the same table.",
			"They are not directly comparable across unrelated tables.",
		],
		"A phrase score of 4.2 only means it outranks lower-scoring phrase families in that table.",
	),
	Month: "Month-of-year bucket for the row.",
	"Avg revision lag": buildStructuredTooltip(
		"Average revision lag",
		"the average positive gap in days between created and updated timestamps for entries in this row.",
		[
			"Unit: days.",
			"Higher means entries in the row tend to be revisited later.",
			"Lower means revisions happen closer to the creation date.",
		],
		"9 days means entries in the row are typically updated about a week after creation.",
	),
	"Median revision lag": buildStructuredTooltip(
		"Median revision lag",
		"the middle positive revision lag in days for entries in this row.",
		[
			"Unit: days.",
			"It is less affected by a few extremely long revision lags than the mean.",
			"Read it next to average revision lag to see how skewed the revision pattern is.",
		],
		"3 days means half of the positive revision lags in this row are three days or shorter.",
	),
	From: "Earlier year in the adjacent-year comparison.",
	To: "Later year in the adjacent-year comparison.",
	Text: buildStructuredTooltip(
		"Text change",
		"how much the body-text signals changed between the two compared years.",
		[
			"Higher means stronger change in lexical richness, novelty, sentence climate, or phrase recurrence.",
			"Lower means the text layer stayed more similar.",
			"This component is available only when body-text analysis is enabled.",
		],
		"A high text value means style or wording shifted even if total output did not.",
	),
	Volume: buildStructuredTooltip(
		"Volume change",
		"how much total writing volume changed between the two compared years.",
		[
			"Higher means a stronger change in entries or word volume.",
			"Lower means output size stayed more similar.",
			"This says nothing by itself about style or tags.",
		],
		"A year pair can have low text change but high volume change if the same style continues at a much larger scale.",
	),
	Revision: buildStructuredTooltip(
		"Revision change",
		"how much revision behavior changed between the two compared years.",
		[
			"Higher means revisit ratio or lag structure shifted more strongly.",
			"Lower means revision behavior stayed more similar.",
			"Read it with cadence and text for a fuller structural picture.",
		],
		"A high revision component suggests the corpus became more or less revision-heavy across those years.",
	),
	Cadence: buildStructuredTooltip(
		"Cadence change",
		"how much temporal rhythm or burstiness changed between the two compared years.",
		[
			"Higher means the spacing of writing activity changed more strongly.",
			"Lower means the cadence stayed more similar.",
			"This component focuses on timing, not volume or text style.",
		],
		"A pair with high cadence change may reflect a move from steady writing to clustered bursts.",
	),
	Rationale: buildStructuredTooltip(
		"Rationale",
		"the short human-readable explanation for why the heuristic productivity mode was assigned.",
		[
			"This column explains which signals drove the label.",
			"Use it to verify the mode instead of treating the label alone as self-evident.",
			"The wording is interpretive, not mathematically complete.",
		],
		"A rationale mentioning concentration and burstiness means those signals helped trigger the assigned mode.",
	),
	Path: "Vault-relative file path.",
	"Created issue": "Whether the created-date frontmatter value was missing, invalid, or successfully resolved.",
	"Created source": "Where the created-date value ultimately came from: frontmatter or filesystem fallback.",
	"Updated issue": "Whether the updated-date frontmatter value was missing, invalid, or successfully resolved.",
	"Updated source": "Where the updated-date value ultimately came from: frontmatter or filesystem fallback.",
};

export class DiaryStatsResultsView extends ItemView {
	private result: DiaryAnalysisResult | null = null;
	private debugResult: WordCountDebugResult | null = null;
	private progress: AnalysisProgressState | null = null;
	private readonly getViewOptions: () => DiaryStatsViewOptions;
	private readonly getPersistedDetailState: (detailKey: string) => boolean | undefined;
	private readonly persistDetailState: (detailKey: string, isOpen: boolean) => void;
	private readonly runAnalysis: () => void;
	private readonly clearCache: () => void;
	private readonly exportMarkdown: () => void;
	private readonly exportCsv: () => void;
	private chartDisposables: DisposableChart[] = [];
	private searchQuery = "";
	private searchMode: SearchMode = "filter";
	private searchInputEl: HTMLInputElement | null = null;
	private searchModeSelectEl: HTMLSelectElement | null = null;
	private searchEmptyStateEl: HTMLElement | null = null;
	private searchMatchCountEl: HTMLElement | null = null;
	private searchPreviousButtonEl: HTMLButtonElement | null = null;
	private searchNextButtonEl: HTMLButtonElement | null = null;
	private searchHighlights: HTMLElement[] = [];
	private activeSearchHighlightIndex = -1;
	private readonly tableSortState = new Map<string, TableSortState>();
	private isApplyingSearchState = false;
	private readonly contentsLinkEls = new Map<string, HTMLButtonElement>();
	private trackedSectionEls: HTMLElement[] = [];
	private domListenersRegistered = false;

	constructor(
		leaf: WorkspaceLeaf,
		getViewOptions: () => DiaryStatsViewOptions,
		getPersistedDetailState: (detailKey: string) => boolean | undefined,
		persistDetailState: (detailKey: string, isOpen: boolean) => void,
		runAnalysis: () => void,
		clearCache: () => void,
		exportMarkdown: () => void,
		exportCsv: () => void,
	) {
		super(leaf);
		this.getViewOptions = getViewOptions;
		this.getPersistedDetailState = getPersistedDetailState;
		this.persistDetailState = persistDetailState;
		this.runAnalysis = runAnalysis;
		this.clearCache = clearCache;
		this.exportMarkdown = exportMarkdown;
		this.exportCsv = exportCsv;
		this.scope = new Scope(this.app.scope);
		this.scope.register(["Mod"], "f", () => {
			if (this.focusSearchInput()) {
				return false;
			}

			return undefined;
		});
	}

	getViewType(): string {
		return VIEW_TYPE_DIARY_STATS_RESULTS;
	}

	getDisplayText(): string {
		return "Diary statistics";
	}

	getIcon(): string {
		return "bar-chart-3";
	}

	async onOpen(): Promise<void> {
		if (!this.domListenersRegistered) {
			this.registerDomEvent(this.contentEl, "scroll", () => {
				this.updateActiveContentsLink();
			});
			this.registerDomEvent(window, "resize", () => {
				this.updateActiveContentsLink();
			});
			this.domListenersRegistered = true;
		}
		this.render();
	}

	async onClose(): Promise<void> {
		this.disposeCharts();
		this.contentEl.empty();
	}

	setResult(result: DiaryAnalysisResult): void {
		this.result = result;
		this.render();
	}

	setDebugResult(result: WordCountDebugResult): void {
		this.debugResult = result;
		this.render();
	}

	setProgress(progress: AnalysisProgressState): void {
		this.progress = progress;
		this.render();
	}

	clearProgress(): void {
		this.progress = null;
		this.render();
	}

	private render(): void {
		this.disposeCharts();
		const { contentEl } = this;
		const viewOptions = this.getViewOptions();
		const linkContext: InternalLinkRenderContext = {
			app: this.app,
			leaf: this.leaf,
			source: VIEW_TYPE_DIARY_STATS_RESULTS,
			sourcePath: "",
		};
		contentEl.empty();
		contentEl.addClass("diary-stats-view");
		this.searchInputEl = null;
		this.searchModeSelectEl = null;
		this.searchEmptyStateEl = null;
		this.searchMatchCountEl = null;
		this.searchPreviousButtonEl = null;
		this.searchNextButtonEl = null;
		this.searchHighlights = [];
		this.activeSearchHighlightIndex = -1;
		this.contentsLinkEls.clear();
		this.trackedSectionEls = [];

		renderHeader(contentEl);
		this.renderActionBar(contentEl);
		this.renderSearchBar(contentEl);
		const contentsHostEl = contentEl.createDiv({ cls: "diary-stats-contents-host" });

		if (this.progress) {
			renderProgressSection(contentEl, this.progress);
		}

		if (!this.result && !this.debugResult && !this.progress) {
			const emptyStateEl = contentEl.createDiv({ cls: "diary-stats-empty-state" });
			emptyStateEl.createEl("p", {
				text: 'Run "Run diary analysis" for the dashboard. If debug tools are enabled in Settings, you can also inspect the active note tokenization.',
			});
			return;
		}

		if (this.result) {
			renderOverviewSection(contentEl, this.result);
			if (viewOptions.showVisualAnalytics) {
				this.renderHeatmapSection(contentEl, this.result);
				this.renderYearlyTrendSection(contentEl, this.result);
				this.renderDistributionSection(contentEl, this.result);
				this.renderStructuralTrendSection(contentEl, this.result);
				this.renderTagCoverageSection(contentEl, this.result);
				this.renderTextAwareTrendSection(contentEl, this.result);
			}
			renderTagAnalysisSection(contentEl, this.result, viewOptions, this);
			renderAdvancedMetricsSection(contentEl, this.result, viewOptions, linkContext, this);
			renderRecordsSection(contentEl, this.result, viewOptions, linkContext, this);
			this.renderExtraMetricsSection(contentEl, this.result, viewOptions);
			renderYearSection(contentEl, this.result.aggregate.yearSummaries);
			renderScopeSection(contentEl, this.result);
			renderDateQualitySection(contentEl, this.result, this);
			renderCacheSection(contentEl, this.result);
			renderSamplePathsSection(contentEl, this.result.scope.samplePaths, this);
		}

		if (this.debugResult) {
			renderWordCountDebugSection(contentEl, this.debugResult, this);
		}

		this.renderContentsNavigation(contentsHostEl);
		this.applySearchFilter();
		window.requestAnimationFrame(() => {
			this.updateActiveContentsLink();
		});
	}

	private renderSearchBar(containerEl: HTMLElement): void {
		const searchEnabled = this.result !== null || this.debugResult !== null;
		const searchBarEl = containerEl.createDiv({ cls: "diary-stats-search-bar" });
		searchBarEl.createEl("label", {
			text: "Search dashboard",
			cls: "diary-stats-search-label",
		});

		const modeSelectEl = searchBarEl.createEl("select", { cls: "diary-stats-search-mode-select" });
		modeSelectEl.createEl("option", { text: "Filter", value: "filter" });
		modeSelectEl.createEl("option", { text: "Highlight", value: "highlight" });
		modeSelectEl.value = this.searchMode;
		modeSelectEl.disabled = !searchEnabled;
		modeSelectEl.addEventListener("change", () => {
			this.searchMode = modeSelectEl.value === "highlight" ? "highlight" : "filter";
			this.applySearchFilter();
		});
		this.searchModeSelectEl = modeSelectEl;

		const searchControlEl = searchBarEl.createDiv({ cls: "diary-stats-search-control" });
		const searchComponent = new SearchComponent(searchControlEl);
		searchComponent.inputEl.addClass("diary-stats-search-input");
		searchComponent.clearButtonEl.addClass("diary-stats-search-clear-button");
		searchComponent.clearButtonEl.setAttr("aria-label", "Clear dashboard search");
		searchComponent.clearButtonEl.setAttr("title", "Clear dashboard search");
		searchComponent.setPlaceholder(this.getSearchPlaceholder(searchEnabled));
		searchComponent.setDisabled(!searchEnabled);
		searchComponent.setValue(this.searchQuery);
		searchComponent.onChange((value) => {
			this.searchQuery = value;
			this.applySearchFilter();
		});
		searchComponent.inputEl.addEventListener("keydown", (event) => {
			if (event.key !== "Escape") {
				return;
			}

			if (this.searchQuery.length > 0) {
				event.preventDefault();
				searchComponent.setValue("");
				this.searchQuery = "";
				this.applySearchFilter();
				return;
			}

			if (this.searchMode === "highlight") {
				event.preventDefault();
				this.searchMode = "filter";
				if (this.searchModeSelectEl) {
					this.searchModeSelectEl.value = "filter";
				}
				this.applySearchFilter();
			}
		});

		this.searchInputEl = searchComponent.inputEl;

		const navigationEl = searchBarEl.createDiv({ cls: "diary-stats-search-navigation" });
		const previousButtonEl = navigationEl.createEl("button", {
			text: "Previous",
			cls: "mod-muted",
		});
		previousButtonEl.type = "button";
		previousButtonEl.addEventListener("click", () => {
			this.navigateSearchHighlight(-1);
		});
		this.searchPreviousButtonEl = previousButtonEl;

		const nextButtonEl = navigationEl.createEl("button", {
			text: "Next",
			cls: "mod-muted",
		});
		nextButtonEl.type = "button";
		nextButtonEl.addEventListener("click", () => {
			this.navigateSearchHighlight(1);
		});
		this.searchNextButtonEl = nextButtonEl;

		this.searchMatchCountEl = navigationEl.createSpan({
			cls: "diary-stats-search-match-count diary-stats-muted",
		});
		this.updateSearchNavigationState();
	}

	private renderActionBar(containerEl: HTMLElement): void {
		const actionBarEl = containerEl.createDiv({ cls: "diary-stats-action-bar" });
		actionBarEl.createEl("div", {
			text: "Actions",
			cls: "diary-stats-action-label",
		});
		actionBarEl.createEl("span", {
			text: "Quick actions for recomputing the dashboard, clearing cache, and exporting the current analysis result.",
			cls: "diary-stats-muted",
		});

		const actionsEl = actionBarEl.createDiv({ cls: "diary-stats-action-buttons" });
		const isBusy = this.progress !== null;
		const canExport = this.result !== null;

		const runButtonEl = actionsEl.createEl("button", {
			text: "Run analysis",
			cls: "mod-cta",
		});
		runButtonEl.type = "button";
		runButtonEl.disabled = isBusy;
		runButtonEl.setAttr("title", isBusy ? "Analysis is already running." : "Recompute the dashboard from the current scope and settings.");
		runButtonEl.addEventListener("click", () => {
			if (isBusy) {
				return;
			}
			this.runAnalysis();
		});

		const clearCacheButtonEl = actionsEl.createEl("button", {
			text: "Clear cache",
			cls: "mod-warning",
		});
		clearCacheButtonEl.type = "button";
		clearCacheButtonEl.disabled = isBusy;
		clearCacheButtonEl.setAttr(
			"title",
			isBusy ? "Wait for the current run to finish before clearing the cache." : "Remove cached per-file analysis results so the next run rebuilds everything.",
		);
		clearCacheButtonEl.addEventListener("click", () => {
			if (isBusy) {
				return;
			}
			this.clearCache();
		});

		const markdownButtonEl = actionsEl.createEl("button", {
			text: "Export Markdown",
		});
		markdownButtonEl.type = "button";
		markdownButtonEl.disabled = !canExport;
		markdownButtonEl.setAttr(
			"title",
			canExport ? "Export the current analysis result as a Markdown report." : "Run analysis before exporting.",
		);
		markdownButtonEl.addEventListener("click", () => {
			if (!canExport) {
				return;
			}
			this.exportMarkdown();
		});

		const csvButtonEl = actionsEl.createEl("button", {
			text: "Export CSV",
		});
		csvButtonEl.type = "button";
		csvButtonEl.disabled = !canExport;
		csvButtonEl.setAttr("title", canExport ? "Export the current analysis result as CSV data." : "Run analysis before exporting.");
		csvButtonEl.addEventListener("click", () => {
			if (!canExport) {
				return;
			}
			this.exportCsv();
		});
	}

	private focusSearchInput(): boolean {
		if (!this.searchInputEl || this.searchInputEl.disabled) {
			return false;
		}

		this.searchInputEl.focus();
		this.searchInputEl.select();
		return true;
	}

	private getSearchPlaceholder(searchEnabled: boolean): string {
		if (!searchEnabled) {
			return "Run analysis to search the dashboard.";
		}

		return this.searchMode === "highlight"
			? "Highlight matches while keeping the full dashboard visible..."
			: "Filter headings, cards, tables, and lists...";
	}

	private applySearchFilter(): void {
		const query = normalizeSearchText(this.searchQuery);
		const hiddenClass = "diary-stats-hidden-by-search";
		this.isApplyingSearchState = true;
		removeSearchHighlights(this.contentEl);
		this.searchHighlights = [];
		this.activeSearchHighlightIndex = -1;
		const allHiddenElements = Array.from(this.contentEl.querySelectorAll<HTMLElement>(`.${hiddenClass}`));
		for (const element of allHiddenElements) {
			element.classList.remove(hiddenClass);
		}

		const detailsElements = Array.from(this.contentEl.querySelectorAll<HTMLDetailsElement>("details.diary-stats-details"));
		if (query.length === 0) {
			this.restoreSearchDetailsState(detailsElements);
			this.removeSearchEmptyState();
			this.isApplyingSearchState = false;
			this.updateSearchNavigationState();
			return;
		}

		for (const detailsEl of detailsElements) {
			if (detailsEl.dataset.searchOriginalOpen === undefined) {
				detailsEl.dataset.searchOriginalOpen = detailsEl.open ? "true" : "false";
			}
		}

		if (this.searchMode === "filter") {
			this.filterLeafElements(".diary-stats-metric-card", query);
			this.filterLeafElements(".diary-stats-chart-card", query);
			this.filterLeafElements(".diary-stats-debug-pre", query);
			this.filterLeafElements(".diary-stats-path-list > li", query);
			this.filterLeafElements(".diary-stats-token-list > li", query);
			this.filterTables(query);

			for (const detailsEl of detailsElements) {
				const matches = matchesSearchText(detailsEl, query);
				toggleSearchHidden(detailsEl, !matches);
				if (matches) {
					detailsEl.open = true;
				}
			}

			const sectionElements = Array.from(this.contentEl.querySelectorAll<HTMLElement>(".diary-stats-section"));
			let visibleSectionCount = 0;
			for (const sectionEl of sectionElements) {
				const matches = matchesSearchText(sectionEl, query);
				toggleSearchHidden(sectionEl, !matches);
				if (matches) {
					visibleSectionCount += 1;
				}
			}

			if (visibleSectionCount === 0) {
				this.renderSearchEmptyState();
			} else {
				this.removeSearchEmptyState();
			}
		} else {
			this.removeSearchEmptyState();
			for (const detailsEl of detailsElements) {
				const matches = matchesSearchText(detailsEl, query);
				const originalOpen = detailsEl.dataset.searchOriginalOpen === "true";
				detailsEl.open = matches || originalOpen;
			}
		}

		this.searchHighlights = applySearchHighlights(this.contentEl, query);
		if (this.searchMode === "highlight" && this.searchHighlights.length > 0) {
			this.setActiveSearchHighlight(0, true);
		}
		this.isApplyingSearchState = false;
		this.updateSearchNavigationState();
	}

	private restoreSearchDetailsState(detailsElements: HTMLDetailsElement[]): void {
		for (const detailsEl of detailsElements) {
			const originalOpen = detailsEl.dataset.searchOriginalOpen;
			if (originalOpen !== undefined) {
				detailsEl.open = originalOpen === "true";
				delete detailsEl.dataset.searchOriginalOpen;
			}
		}
	}

	private filterLeafElements(selector: string, query: string): void {
		const elements = Array.from(this.contentEl.querySelectorAll<HTMLElement>(selector));
		for (const element of elements) {
			toggleSearchHidden(element, !matchesSearchText(element, query));
		}
	}

	private filterTables(query: string): void {
		const tables = Array.from(this.contentEl.querySelectorAll<HTMLTableElement>("table.diary-stats-table"));
		for (const tableEl of tables) {
			const rows = Array.from(tableEl.querySelectorAll("tr")) as HTMLTableRowElement[];
			const headerRow = rows[0] ?? null;
			let visibleBodyRowCount = 0;

			for (const bodyRow of rows.slice(1)) {
				const matches = matchesSearchText(bodyRow, query);
				toggleSearchHidden(bodyRow, !matches);
				if (matches) {
					visibleBodyRowCount += 1;
				}
			}

			const headerMatches = headerRow ? matchesSearchText(headerRow, query) : false;
			toggleSearchHidden(tableEl, visibleBodyRowCount === 0 && !headerMatches);
		}
	}

	private renderSearchEmptyState(): void {
		if (this.searchEmptyStateEl) {
			return;
		}

		this.searchEmptyStateEl = this.contentEl.createDiv({
			cls: "diary-stats-empty-state diary-stats-search-empty-state",
		});
		this.searchEmptyStateEl.createEl("p", {
			text: `No dashboard content matches "${this.searchQuery}".`,
		});
	}

	private removeSearchEmptyState(): void {
		if (!this.searchEmptyStateEl) {
			return;
		}

		this.searchEmptyStateEl.remove();
		this.searchEmptyStateEl = null;
	}

	private navigateSearchHighlight(direction: -1 | 1): void {
		if (this.searchMode !== "highlight" || this.searchHighlights.length === 0) {
			return;
		}

		const nextIndex =
			this.activeSearchHighlightIndex < 0
				? 0
				: (this.activeSearchHighlightIndex + direction + this.searchHighlights.length) % this.searchHighlights.length;
		this.setActiveSearchHighlight(nextIndex, true);
	}

	private setActiveSearchHighlight(index: number, shouldScroll: boolean): void {
		const currentHighlight = this.searchHighlights[this.activeSearchHighlightIndex];
		currentHighlight?.removeClass("diary-stats-search-highlight-active");

		this.activeSearchHighlightIndex = index;
		const nextHighlight = this.searchHighlights[index];
		nextHighlight?.addClass("diary-stats-search-highlight-active");
		if (nextHighlight) {
			this.openHighlightAncestors(nextHighlight);
		}

		if (shouldScroll && nextHighlight) {
			nextHighlight.scrollIntoView({
				block: "center",
				inline: "nearest",
				behavior: "smooth",
			});
		}

		this.updateSearchNavigationState();
	}

	private updateSearchNavigationState(): void {
		if (!this.searchMatchCountEl) {
			return;
		}

		const query = normalizeSearchText(this.searchQuery);
		const isHighlightMode = this.searchMode === "highlight";
		const canNavigate = isHighlightMode && query.length > 0 && this.searchHighlights.length > 0;

		if (this.searchPreviousButtonEl) {
			this.searchPreviousButtonEl.disabled = !canNavigate;
		}

		if (this.searchNextButtonEl) {
			this.searchNextButtonEl.disabled = !canNavigate;
		}

		if (this.searchInputEl) {
			this.searchInputEl.setAttribute("placeholder", this.getSearchPlaceholder(!this.searchInputEl.disabled));
		}

		if (query.length === 0) {
			this.searchMatchCountEl.setText(
				this.searchMode === "highlight" ? "Full page visible." : "Filtering is off.",
			);
			return;
		}

		if (this.searchMode === "filter") {
			this.searchMatchCountEl.setText(`${this.searchHighlights.length} visible matches`);
			return;
		}

		if (this.searchHighlights.length === 0) {
			this.searchMatchCountEl.setText("0 matches");
			return;
		}

		const activeIndex = this.activeSearchHighlightIndex >= 0 ? this.activeSearchHighlightIndex + 1 : 1;
		const activeSectionTitle = this.resolveSearchHighlightSectionTitle(
			this.searchHighlights[Math.max(0, this.activeSearchHighlightIndex)],
		);
		this.searchMatchCountEl.setText(
			activeSectionTitle
				? `${activeIndex} of ${this.searchHighlights.length} • ${activeSectionTitle}`
				: `${activeIndex} of ${this.searchHighlights.length}`,
		);
	}

	private renderHeatmapSection(containerEl: HTMLElement, result: DiaryAnalysisResult): void {
		const sectionEl = containerEl.createDiv({ cls: "diary-stats-section" });
		markDashboardSection(sectionEl, "heatmaps", "Heatmaps");
		createTextElementWithTooltip(sectionEl, "h3", "Heatmaps");
		sectionEl.createEl("p", {
			text: "Monthly heatmap uses entry counts. Weekday heatmap uses average entries per weekday occurrence in each year.",
			cls: "diary-stats-section-lead",
		});
		sectionEl.createEl("p", {
			text: "Basis: compare the monthly entry-count and monthly words heatmaps together to distinguish frequent short-note periods from rarer deep-writing periods.",
			cls: "diary-stats-muted diary-stats-basis-summary",
		});

		const chartsGridEl = sectionEl.createDiv({ cls: "diary-stats-chart-grid" });

		const monthlyCardEl = chartsGridEl.createDiv({ cls: "diary-stats-chart-card" });
		createTextElementWithTooltip(monthlyCardEl, "h4", "Monthly entry count through years");
		setSearchKeywords(monthlyCardEl, ["entries", "entry count", "months", "years", "heatmap"]);
		const monthlyChartEl = monthlyCardEl.createDiv({ cls: "diary-stats-chart" });

		const monthlyWordsCardEl = chartsGridEl.createDiv({ cls: "diary-stats-chart-card" });
		createTextElementWithTooltip(monthlyWordsCardEl, "h4", "Monthly words written through years");
		setSearchKeywords(monthlyWordsCardEl, ["words", "entries", "average words", "months", "years", "heatmap"]);
		const monthlyWordsChartEl = monthlyWordsCardEl.createDiv({ cls: "diary-stats-chart" });

		const weekdayCardEl = chartsGridEl.createDiv({ cls: "diary-stats-chart-card" });
		createTextElementWithTooltip(weekdayCardEl, "h4", "Monday-Sunday average activity by year");
		setSearchKeywords(weekdayCardEl, ["weekdays", "monday", "sunday", "average activity", "entries", "heatmap"]);
		const weekdayChartEl = weekdayCardEl.createDiv({ cls: "diary-stats-chart" });

		const viewOptions = this.getViewOptions();
		this.chartDisposables.push(
			renderMonthlyHeatmapChart(monthlyChartEl, result.visuals.monthlyHeatmap, viewOptions),
			renderMonthlyWordsHeatmapChart(monthlyWordsChartEl, result.visuals.monthlyWordsHeatmap, viewOptions),
			renderWeekdayHeatmapChart(weekdayChartEl, result.visuals.weekdayHeatmap, viewOptions),
		);
	}

	private renderYearlyTrendSection(containerEl: HTMLElement, result: DiaryAnalysisResult): void {
		const viewOptions = this.getViewOptions();
		const sectionEl = containerEl.createDiv({ cls: "diary-stats-section" });
		markDashboardSection(sectionEl, "yearly-trends", "Yearly trends");
		createTextElementWithTooltip(sectionEl, "h3", "Yearly trends");
		sectionEl.createEl("p", {
			text: "These charts make the macro-shape of the diary easier to read: output volume, reading volume, and typical entry depth by year.",
			cls: "diary-stats-section-lead",
		});
		sectionEl.createEl("p", {
			text: "Basis: bars show yearly totals, while the entry-length line follows your current mean/median setting for the yearly depth chart.",
			cls: "diary-stats-muted diary-stats-basis-summary",
		});

		if (result.visuals.yearlyTrends.points.length === 0) {
			sectionEl.createEl("p", {
				text: "No resolved chronology years are available for yearly trend charts yet.",
				cls: "diary-stats-muted",
			});
			return;
		}

		const chartsGridEl = sectionEl.createDiv({ cls: "diary-stats-chart-grid" });
		const totalsCardEl = chartsGridEl.createDiv({ cls: "diary-stats-chart-card" });
		createTextElementWithTooltip(totalsCardEl, "h4", "Entries and words per year");
		setSearchKeywords(totalsCardEl, ["entries", "words", "yearly totals", "year trend"]);
		const totalsChartEl = totalsCardEl.createDiv({ cls: "diary-stats-chart" });

		const readingCardEl = chartsGridEl.createDiv({ cls: "diary-stats-chart-card" });
		createTextElementWithTooltip(
			readingCardEl,
			"h4",
			getYearlyReadingDepthChartTitle(viewOptions.yearlyEntryLengthTrendMethod),
		);
		setSearchKeywords(readingCardEl, [
			"reading time",
			"entry length",
			"mean",
			"median",
			"mean words",
			"median words",
			"average words",
			"year trend",
		]);
		const readingChartEl = readingCardEl.createDiv({ cls: "diary-stats-chart" });

		this.chartDisposables.push(
			renderYearlyTotalsChart(totalsChartEl, result.visuals.yearlyTrends),
			renderYearlyReadingDepthChart(
				readingChartEl,
				result.visuals.yearlyTrends,
				viewOptions.yearlyEntryLengthTrendMethod,
			),
		);
	}

	private renderDistributionSection(containerEl: HTMLElement, result: DiaryAnalysisResult): void {
		const sectionEl = containerEl.createDiv({ cls: "diary-stats-section" });
		markDashboardSection(sectionEl, "distributions", "Distributions");
		createTextElementWithTooltip(sectionEl, "h3", "Distributions");
		sectionEl.createEl("p", {
			text: "Distribution charts make length and revision behavior easier to grasp than a single abstract summary number.",
			cls: "diary-stats-section-lead",
		});
		sectionEl.createEl("p", {
			text: "Basis: the note-length histogram uses words and the revision-lag histogram uses days, so both distributions stay in intuitive units.",
			cls: "diary-stats-muted diary-stats-basis-summary",
		});

		const chartsGridEl = sectionEl.createDiv({ cls: "diary-stats-chart-grid" });
		const wordCountCardEl = chartsGridEl.createDiv({ cls: "diary-stats-chart-card" });
		createTextElementWithTooltip(wordCountCardEl, "h4", "Note-length distribution");
		setSearchKeywords(wordCountCardEl, ["word count", "note length", "distribution", "histogram"]);

		if (result.visuals.noteLengthHistogram.bins.length === 0) {
			wordCountCardEl.createEl("p", {
				text: "No word-count data is available yet for this scope.",
				cls: "diary-stats-muted",
			});
		} else {
			const wordCountChartEl = wordCountCardEl.createDiv({ cls: "diary-stats-chart" });
			this.chartDisposables.push(renderWordCountHistogramChart(wordCountChartEl, result.visuals.noteLengthHistogram));
		}

		const revisionCardEl = chartsGridEl.createDiv({ cls: "diary-stats-chart-card" });
		createTextElementWithTooltip(revisionCardEl, "h4", "Revision-lag distribution");
		setSearchKeywords(revisionCardEl, ["revision", "lag", "days", "distribution", "histogram"]);

		if (result.visuals.revisionLagHistogram.bins.length === 0) {
			revisionCardEl.createEl("p", {
				text: "No positive revision lags were available for the current scope.",
				cls: "diary-stats-muted",
			});
		} else {
			const revisionChartEl = revisionCardEl.createDiv({ cls: "diary-stats-chart" });
			this.chartDisposables.push(
				renderRevisionLagHistogramChart(revisionChartEl, result.visuals.revisionLagHistogram),
			);
		}
	}

	private renderStructuralTrendSection(containerEl: HTMLElement, result: DiaryAnalysisResult): void {
		const sectionEl = containerEl.createDiv({ cls: "diary-stats-section" });
		markDashboardSection(sectionEl, "structural-trends", "Structural trend lines");
		createTextElementWithTooltip(sectionEl, "h3", "Structural trend lines");
		sectionEl.createEl("p", {
			text: "These year-level signals make the advanced structural layer easier to compare visually across time.",
			cls: "diary-stats-section-lead",
		});
		sectionEl.createEl("p", {
			text: "Basis: each line is a year-level structural index, so the chart is best read as relative drift across years rather than as an absolute scale.",
			cls: "diary-stats-muted diary-stats-basis-summary",
		});

		if (result.visuals.structuralTrends.points.length === 0) {
			sectionEl.createEl("p", {
				text: "No year-level structural trend data is available yet.",
				cls: "diary-stats-muted",
			});
			return;
		}

		const chartsGridEl = sectionEl.createDiv({ cls: "diary-stats-chart-grid" });
		const structuralCardEl = chartsGridEl.createDiv({ cls: "diary-stats-chart-card" });
		createTextElementWithTooltip(structuralCardEl, "h4", "Structural year signals");
		setSearchKeywords(structuralCardEl, ["burstiness", "concentration", "tag entropy", "regime shift", "year trend"]);
		const structuralChartEl = structuralCardEl.createDiv({ cls: "diary-stats-chart" });

		this.chartDisposables.push(
			renderStructuralTrendsChart(structuralChartEl, result.visuals.structuralTrends),
		);
	}

	private renderTagCoverageSection(containerEl: HTMLElement, result: DiaryAnalysisResult): void {
		const sectionEl = containerEl.createDiv({ cls: "diary-stats-section" });
		markDashboardSection(sectionEl, "tag-coverage", "Tag coverage diagnostics");
		createTextElementWithTooltip(sectionEl, "h3", "Tag coverage diagnostics");
		sectionEl.createEl("p", {
			text: "This diagnostic chart is meant to help you judge when tag-driven metrics become trustworthy as tagging habits evolve over time.",
			cls: "diary-stats-section-lead",
		});
		sectionEl.createEl("p", {
			text: "Basis: use this chart to decide whether a restricted tag-metric time scope would better reflect the era when tagging became systematic.",
			cls: "diary-stats-muted diary-stats-basis-summary",
		});

		if (result.visuals.tagCoverageTrends.points.length === 0) {
			sectionEl.createEl("p", {
				text: "No year-level tag coverage data is available yet.",
				cls: "diary-stats-muted",
			});
			return;
		}

		const chartsGridEl = sectionEl.createDiv({ cls: "diary-stats-chart-grid" });
		const coverageCardEl = chartsGridEl.createDiv({ cls: "diary-stats-chart-card" });
		createTextElementWithTooltip(coverageCardEl, "h4", "Tagged-note coverage by year");
		setSearchKeywords(coverageCardEl, [
			"tagged note share",
			"mean tags per note",
			"median tags per note",
			"mean",
			"median",
			"tag coverage",
			"tags",
		]);
		const coverageChartEl = coverageCardEl.createDiv({ cls: "diary-stats-chart" });

		this.chartDisposables.push(
			renderTagCoverageChart(coverageChartEl, result.visuals.tagCoverageTrends),
		);
	}

	private renderTextAwareTrendSection(containerEl: HTMLElement, result: DiaryAnalysisResult): void {
		const sectionEl = containerEl.createDiv({ cls: "diary-stats-section" });
		markDashboardSection(sectionEl, "text-aware-trends", "Text-aware trends");
		createTextElementWithTooltip(sectionEl, "h3", "Text-aware trends");
		sectionEl.createEl("p", {
			text: "These charts turn the text-aware layer into year-level visual trends, but they appear only when body-text analysis is enabled and usable.",
			cls: "diary-stats-section-lead",
		});
		sectionEl.createEl("p", {
			text: "Basis: these lines follow the current body-text metric scope, so they can intentionally focus on one writing era without changing non-text metrics.",
			cls: "diary-stats-muted diary-stats-basis-summary",
		});

		if (!result.advancedMetrics.bodyText.enabled || result.visuals.textAwareTrends.points.length === 0) {
			sectionEl.createEl("p", {
				text: "Body-text analysis is disabled or no text-aware year profiles are available for this scope.",
				cls: "diary-stats-muted",
			});
			return;
		}

		const chartsGridEl = sectionEl.createDiv({ cls: "diary-stats-chart-grid" });
		const vocabularyCardEl = chartsGridEl.createDiv({ cls: "diary-stats-chart-card" });
		createTextElementWithTooltip(vocabularyCardEl, "h4", "Vocabulary and novelty by year");
		setSearchKeywords(vocabularyCardEl, ["vocabulary", "lexical richness", "novelty rate", "text-aware", "year trend"]);
		const vocabularyChartEl = vocabularyCardEl.createDiv({ cls: "diary-stats-chart" });

		const styleCardEl = chartsGridEl.createDiv({ cls: "diary-stats-chart-card" });
		createTextElementWithTooltip(styleCardEl, "h4", "Sentence climate and phrase recurrence by year");
		setSearchKeywords(styleCardEl, [
			"sentence length",
			"average sentence length",
			"recurring phrase share",
			"phrase recurrence",
			"text-aware",
			"year trend",
		]);
		const styleChartEl = styleCardEl.createDiv({ cls: "diary-stats-chart" });

		this.chartDisposables.push(
			renderTextAwareVocabularyChart(vocabularyChartEl, result.visuals.textAwareTrends),
			renderTextAwareStyleChart(styleChartEl, result.visuals.textAwareTrends),
		);
	}

	private renderExtraMetricsSection(
		containerEl: HTMLElement,
		result: DiaryAnalysisResult,
		viewOptions: DiaryStatsViewOptions,
	): void {
		const sectionEl = containerEl.createDiv({ cls: "diary-stats-section" });
		markDashboardSection(sectionEl, "extra-metrics", "Extra metrics");
		createTextElementWithTooltip(sectionEl, "h3", "Extra metrics");
		sectionEl.createEl("p", {
			text: "These deferred follow-up metrics add streak, month-length, tag-frequency, and hour-of-day patterns without changing the existing core dashboard logic.",
			cls: "diary-stats-section-lead",
		});
		sectionEl.createEl("p", {
			text: "Basis: hour-of-day uses only explicitly timed created timestamps, while tag-frequency heatmaps still follow the current tag metric time scope.",
			cls: "diary-stats-muted diary-stats-basis-summary",
		});

		renderMetricGrid(sectionEl, [
			["Longest writing streak", formatWritingStreak(result.extraMetrics.longestWritingStreak)],
			{
				label: "Streak entries",
				value: result.extraMetrics.longestWritingStreak?.entryCount.toString() ?? "(none)",
			},
			["Most verbose month", formatMonthLengthProfilePoint(result.extraMetrics.mostVerboseMonth)],
			["Shortest month", formatMonthLengthProfilePoint(result.extraMetrics.shortestMonth)],
			["Most active hour", formatHourlyActivityPoint(result.extraMetrics.mostActiveHour)],
			["Quietest active hour", formatHourlyActivityPoint(result.extraMetrics.quietestActiveHour)],
			["Timed entries", result.extraMetrics.hourOfDayEntriesWithTime.toString()],
			["Hour metric scope", result.extraMetrics.hourMetricScopeLabel],
			["Qualifying tags in scope", result.extraMetrics.qualifyingTagCount.toString()],
			["Displayed heatmap tags", result.extraMetrics.displayedTagCount.toString()],
			[
				"Top tag in scope",
				result.extraMetrics.topTagByFrequency
					? `${result.extraMetrics.topTagByFrequency} (${result.extraMetrics.topTagFrequencyCount})`
					: "(none)",
			],
		]);

		if (!viewOptions.showVisualAnalytics) {
			return;
		}

		const chartsGridEl = sectionEl.createDiv({ cls: "diary-stats-chart-grid" });

		const monthCardEl = chartsGridEl.createDiv({ cls: "diary-stats-chart-card" });
		createTextElementWithTooltip(monthCardEl, "h4", "Month length by calendar month");
		setSearchKeywords(monthCardEl, ["months", "mean words", "median words", "entries", "calendar month"]);
		const monthChartEl = monthCardEl.createDiv({ cls: "diary-stats-chart" });
		this.chartDisposables.push(renderMonthLengthProfileChart(monthChartEl, result.extraMetrics.monthLengthProfile));

		const tagHeatmapCardEl = chartsGridEl.createDiv({ cls: "diary-stats-chart-card" });
		createTextElementWithTooltip(tagHeatmapCardEl, "h4", "Tag frequency over years");
		setSearchKeywords(tagHeatmapCardEl, ["tags", "frequency", "years", "heatmap", "tag scope"]);
		if (
			result.extraMetrics.tagFrequencyHeatmap.tags.length === 0 ||
			result.extraMetrics.tagFrequencyHeatmap.years.length === 0
		) {
			tagHeatmapCardEl.createEl("p", {
				text: "No tags reached the current minimum frequency inside the active tag metric time scope.",
				cls: "diary-stats-muted",
			});
		} else {
			const tagHeatmapEl = tagHeatmapCardEl.createDiv({ cls: "diary-stats-chart" });
			this.chartDisposables.push(
				renderTagFrequencyHeatmapChart(tagHeatmapEl, result.extraMetrics.tagFrequencyHeatmap, viewOptions),
			);
		}

		const hourlyCardEl = chartsGridEl.createDiv({ cls: "diary-stats-chart-card" });
		createTextElementWithTooltip(hourlyCardEl, "h4", "Hour-of-day activity");
		setSearchKeywords(hourlyCardEl, ["hours", "time", "entries", "mean words", "hour of day"]);
		if (result.extraMetrics.hourlyActivity.usableEntryCount === 0) {
			hourlyCardEl.createEl("p", {
				text: "No entries with explicit created-time values were available inside the active hour metric scope.",
				cls: "diary-stats-muted",
			});
		} else {
			const hourlyChartEl = hourlyCardEl.createDiv({ cls: "diary-stats-chart" });
			this.chartDisposables.push(renderHourlyActivityChart(hourlyChartEl, result.extraMetrics.hourlyActivity));
		}
	}

	private disposeCharts(): void {
		for (const chart of this.chartDisposables) {
			chart.dispose();
		}
		this.chartDisposables = [];
	}

	public createPersistentDetails(containerEl: HTMLElement, detailKey: string, summaryText: string): HTMLDetailsElement {
		const detailsEl = containerEl.createEl("details", { cls: "diary-stats-details" });
		const persistedOpen = this.getPersistedDetailState(detailKey);
		if (persistedOpen === true) {
			detailsEl.open = true;
		}

		detailsEl.dataset.detailKey = detailKey;
		createTextElementWithTooltip(detailsEl, "summary", summaryText);
		detailsEl.addEventListener("toggle", () => {
			if (this.isApplyingSearchState) {
				return;
			}

			this.persistDetailState(detailKey, detailsEl.open);
			if (detailsEl.dataset.searchOriginalOpen !== undefined) {
				detailsEl.dataset.searchOriginalOpen = detailsEl.open ? "true" : "false";
			}
		});

		return detailsEl;
	}

	public renderSortableAdvancedTable<Row>(containerEl: HTMLElement, options: SortableTableOptions<Row>): void {
		const headingEl = containerEl.createDiv({ cls: "diary-stats-table-heading" });
		createTextElementWithTooltip(headingEl, "h4", options.title);
		const actionsEl = headingEl.createDiv({ cls: "diary-stats-table-heading-actions" });
		const hostEl = containerEl.createDiv();
		const renderTable = () => {
			hostEl.empty();
			if (options.rows.length === 0) {
				hostEl.createEl("p", {
					text: options.emptyMessage,
					cls: "diary-stats-muted",
				});
				return;
			}

			const sortState = this.getTableSortState(
				options.id,
				options.defaultSortKey,
				options.defaultSortDirection,
			);
			const isDefaultSort =
				sortState.columnKey === options.defaultSortKey &&
				sortState.direction === options.defaultSortDirection;
			actionsEl.empty();
			const resetSortButtonEl = actionsEl.createEl("button", {
				text: "Reset sort",
				cls: "diary-stats-reset-sort-button mod-muted",
			});
			resetSortButtonEl.type = "button";
			resetSortButtonEl.disabled = isDefaultSort;
			resetSortButtonEl.setAttr("title", "Restore the default sort order for this table.");
			resetSortButtonEl.addEventListener("click", () => {
				this.tableSortState.delete(options.id);
				renderTable();
				this.applySearchFilter();
			});

			const sortedRows = [...options.rows].sort((leftRow, rightRow) =>
				compareSortableValues(
					this.getColumnSortValue(options.columns, sortState.columnKey, leftRow),
					this.getColumnSortValue(options.columns, sortState.columnKey, rightRow),
					sortState.direction,
				),
			);

			if (options.rows.length < (options.totalRowCount ?? options.rows.length)) {
				hostEl.createEl("p", {
					text: `Showing the first ${options.rows.length} rows. Set the relevant row limit to 0 to show all.`,
					cls: "diary-stats-muted",
				});
			}

			const tableEl = hostEl.createEl("table", { cls: "diary-stats-table" });
			const headerRow = tableEl.createEl("tr");
			for (const column of options.columns) {
				const headerCellEl = createTextElementWithTooltip(
					headerRow,
					"th",
					column.label,
					resolveTableHeaderTooltip(column.label),
				);
				headerCellEl.addClass("diary-stats-sortable-header");
				const isActive = sortState.columnKey === column.key;
				headerCellEl.toggleClass("is-active", isActive);
				headerCellEl.setAttr("role", "button");
				headerCellEl.setAttr("tabindex", "0");
				const indicatorEl = headerCellEl.createSpan({ cls: "diary-stats-sortable-indicator" });
				indicatorEl.setText(isActive ? (sortState.direction === "asc" ? "▲" : "▼") : "↕");
				const activateSort = () => {
					this.toggleTableSort(options.id, column.key, column.initialDirection ?? options.defaultSortDirection);
					renderTable();
					this.applySearchFilter();
				};
				headerCellEl.addEventListener("click", activateSort);
				headerCellEl.addEventListener("keydown", (event) => {
					if (event.key === "Enter" || event.key === " ") {
						event.preventDefault();
						activateSort();
					}
				});
			}

			for (const row of sortedRows) {
				const rowEl = tableEl.createEl("tr");
				for (const column of options.columns) {
					rowEl.createEl("td", { text: column.render(row) });
				}
			}
		};

		renderTable();
	}

	private renderContentsNavigation(containerEl: HTMLElement): void {
		containerEl.empty();
		const sections = Array.from(this.contentEl.querySelectorAll<HTMLElement>(".diary-stats-section[data-section-id]"));
		if (sections.length < 2) {
			return;
		}
		this.trackedSectionEls = sections;

		const contentsEl = containerEl.createDiv({ cls: "diary-stats-contents" });
		contentsEl.createEl("div", {
			text: "Contents",
			cls: "diary-stats-contents-title",
		});
		contentsEl.createEl("p", {
			text: "Jump to a section without losing your place in the dashboard.",
			cls: "diary-stats-muted diary-stats-basis-summary",
		});
		const linksEl = contentsEl.createDiv({ cls: "diary-stats-contents-links" });

		for (const sectionEl of sections) {
			const sectionId = sectionEl.dataset.sectionId;
			const sectionTitle = sectionEl.dataset.sectionTitle;
			if (!sectionId || !sectionTitle) {
				continue;
			}

			const linkEl = linksEl.createEl("button", {
				text: sectionTitle,
				cls: "diary-stats-contents-link",
			});
			linkEl.type = "button";
			this.contentsLinkEls.set(sectionId, linkEl);
			linkEl.addEventListener("click", () => {
				sectionEl.scrollIntoView({
					block: "start",
					inline: "nearest",
					behavior: "smooth",
				});
			});
		}
	}

	private updateActiveContentsLink(): void {
		if (this.contentsLinkEls.size === 0 || this.trackedSectionEls.length === 0) {
			return;
		}

		const visibleSections = this.trackedSectionEls.filter(
			(sectionEl) => !sectionEl.classList.contains("diary-stats-hidden-by-search"),
		);
		if (visibleSections.length === 0) {
			return;
		}

		const anchorOffset = this.contentEl.scrollTop + 180;
		const firstVisibleSection = visibleSections[0];
		if (!firstVisibleSection) {
			return;
		}
		let activeSection = firstVisibleSection;
		for (const sectionEl of visibleSections) {
			if (sectionEl.offsetTop <= anchorOffset) {
				activeSection = sectionEl;
			} else {
				break;
			}
		}

		const activeSectionId = activeSection.dataset.sectionId;
		for (const [sectionId, linkEl] of this.contentsLinkEls) {
			linkEl.toggleClass("is-active", sectionId === activeSectionId);
		}
	}

	private getTableSortState(
		tableId: string,
		defaultSortKey: string,
		defaultSortDirection: SortDirection,
	): TableSortState {
		return (
			this.tableSortState.get(tableId) ?? {
				columnKey: defaultSortKey,
				direction: defaultSortDirection,
			}
		);
	}

	private toggleTableSort(tableId: string, columnKey: string, initialDirection: SortDirection): void {
		const currentState = this.tableSortState.get(tableId);
		if (currentState?.columnKey === columnKey) {
			this.tableSortState.set(tableId, {
				columnKey,
				direction: currentState.direction === "asc" ? "desc" : "asc",
			});
			return;
		}

		this.tableSortState.set(tableId, {
			columnKey,
			direction: initialDirection,
		});
	}

	private getColumnSortValue<Row>(
		columns: SortableTableColumn<Row>[],
		columnKey: string,
		row: Row,
	): number | string | null {
		const column = columns.find((candidate) => candidate.key === columnKey);
		return column ? column.sortValue(row) : null;
	}

	private openHighlightAncestors(highlightEl: HTMLElement): void {
		this.isApplyingSearchState = true;
		let currentElement: HTMLElement | null = highlightEl.parentElement;
		while (currentElement) {
			if (currentElement instanceof HTMLDetailsElement && currentElement.classList.contains("diary-stats-details")) {
				currentElement.open = true;
			}
			currentElement = currentElement.parentElement;
		}
		this.isApplyingSearchState = false;
	}

	private resolveSearchHighlightSectionTitle(highlightEl: HTMLElement | undefined): string | null {
		if (!highlightEl) {
			return null;
		}

		const sectionEl = highlightEl.closest<HTMLElement>(".diary-stats-section[data-section-title]");
		return sectionEl?.dataset.sectionTitle ?? null;
	}
}

function renderHeader(containerEl: HTMLElement): void {
	const headerEl = containerEl.createDiv({ cls: "diary-stats-header" });
	createTextElementWithTooltip(headerEl, "h2", "Diary statistics");
	headerEl.createEl("p", {
		text: "The dashboard now covers core metrics, heatmaps, tag analytics, structural patterns, exports, cache-aware manual scans, and optional body-text analysis.",
		cls: "diary-stats-section-lead",
	});
	headerEl.createEl("p", {
		text: 'Use the commands "Export last analysis as Markdown" and "Export last analysis as CSV" after a successful run.',
		cls: "diary-stats-muted",
	});
	const badgesEl = headerEl.createDiv({ cls: "diary-stats-header-badges" });
	for (const badgeText of ["Desktop only", "Manual scan", "Cache-aware", "Markdown + CSV export"]) {
		badgesEl.createSpan({ text: badgeText, cls: "diary-stats-header-badge" });
	}
}

function markDashboardSection(sectionEl: HTMLElement, sectionId: string, sectionTitle: string): void {
	sectionEl.dataset.sectionId = sectionId;
	sectionEl.dataset.sectionTitle = sectionTitle;
	sectionEl.id = `diary-stats-section-${sectionId}`;
}

function createTextElementWithTooltip<K extends keyof HTMLElementTagNameMap>(
	containerEl: HTMLElement,
	tag: K,
	text: string,
	tooltip?: string,
): HTMLElementTagNameMap[K] {
	const element = containerEl.createEl(tag, { text });
	const resolvedTooltip = tooltip ?? resolveSectionTooltip(text);
	if (resolvedTooltip) {
		element.setAttribute("title", resolvedTooltip);
	}

	return element;
}

function setSearchKeywords(element: HTMLElement, keywords: string[]): void {
	const normalizedKeywords = keywords
		.map((keyword) => keyword.trim())
		.filter((keyword) => keyword.length > 0);

	if (normalizedKeywords.length === 0) {
		delete element.dataset.searchText;
		return;
	}

	element.dataset.searchText = normalizedKeywords.join(" ");
}

function createTableHeaderCells(headerRow: HTMLTableRowElement, headers: string[]): void {
	for (const header of headers) {
		createTextElementWithTooltip(headerRow, "th", header, resolveTableHeaderTooltip(header));
	}
}

function resolveSectionTooltip(text: string): string | undefined {
	if (text in SECTION_TOOLTIP_TEXT) {
		return SECTION_TOOLTIP_TEXT[text];
	}

	if (/^\d{4} tag correlations$/u.test(text)) {
		return "Year-specific tag correlation table using only the entries and qualifying tags from the shown year after current filters are applied.";
	}

	if (/^\d{4} \(\d+ qualifying tags, \d+ filtered entries\)$/u.test(text)) {
		return "Year-specific tag-analysis summary showing how many tags qualified and how many entries remained eligible for that year.";
	}

	if (/^Tokens \(\d+\)$/u.test(text)) {
		return "The exact token list counted for the active note after the current word-count cleanup rules were applied.";
	}

	return undefined;
}

function resolveMetricTooltip(label: string): string | undefined {
	return METRIC_TOOLTIP_TEXT[label];
}

function resolveTableHeaderTooltip(label: string): string | undefined {
	return TABLE_HEADER_TOOLTIP_TEXT[label];
}

function resolveAdvancedHeadlineCardTooltip(card: AdvancedHeadline): string | undefined {
	const tooltipSections = new Set<string>();
	const headlineTooltip = resolveMetricTooltip(card.label);
	if (headlineTooltip) {
		tooltipSections.add(headlineTooltip);
	}

	for (const detailLabel of ADVANCED_HEADLINE_DETAIL_TOOLTIP_LABELS[card.label] ?? []) {
		const detailTooltip = resolveMetricTooltip(detailLabel) ?? resolveTableHeaderTooltip(detailLabel);
		if (detailTooltip) {
			tooltipSections.add(detailTooltip);
		}
	}

	return tooltipSections.size > 0 ? [...tooltipSections].join("\n\n") : undefined;
}

function renderProgressSection(containerEl: HTMLElement, progress: AnalysisProgressState): void {
	const progressSectionEl = containerEl.createDiv({ cls: "diary-stats-section diary-stats-progress-section" });
	markDashboardSection(progressSectionEl, "analysis-progress", "Analysis progress");
	createTextElementWithTooltip(progressSectionEl, "h3", "Analysis progress");
	progressSectionEl.createEl("p", { text: progress.message });

	const barEl = progressSectionEl.createDiv({ cls: "diary-stats-progress-bar" });
	barEl.createDiv({
		cls: "diary-stats-progress-fill",
		attr: {
			style: `width: ${Math.max(0, Math.min(100, progress.percent))}%;`,
		},
	});

	progressSectionEl.createEl("p", {
		text:
			progress.totalFiles > 0
				? `${progress.processedFiles} / ${progress.totalFiles} files`
				: "Preparing scope...",
		cls: "diary-stats-muted",
	});
	progressSectionEl.createEl("p", {
		text: `Elapsed: ${progress.elapsedLabel}`,
		cls: "diary-stats-muted",
	});
}

function renderOverviewSection(containerEl: HTMLElement, result: DiaryAnalysisResult): void {
	const sectionEl = containerEl.createDiv({ cls: "diary-stats-section" });
	markDashboardSection(sectionEl, "overview", "Overview");
	createTextElementWithTooltip(sectionEl, "h3", "Overview");

	renderMetricGrid(sectionEl, [
		{
			label: "Years written",
			value: result.aggregate.yearsWritten.length.toString(),
			tooltip: "How many distinct chronology years were detected from the created-date data.",
		},
		{
			label: "Total entries",
			value: result.aggregate.totalEntries.toString(),
			tooltip: "How many markdown diary notes matched the current scope and were included in the analysis.",
		},
		{
			label: "Total words",
			value: result.aggregate.totalWords.toString(),
			tooltip: "The summed word count after the current parsing cleanup rules were applied.",
		},
		{
			label: "Read whole diary",
			value: result.aggregate.totalReadingTimeLabel,
			tooltip: "Estimated reading time for all counted words at the configured reading speed.",
		},
		{
			label: "Average-length entry",
			value: result.aggregate.averageEntryReadingTimeLabel,
			tooltip: "Estimated reading time for one typical entry, based on the selected median or mean rule.",
		},
		{
			label: "Analysis duration",
			value: result.durationLabel,
			tooltip: "How long the last manual analysis run took from start to finish.",
		},
		{
			label: "Reading speed",
			value: `${result.aggregate.readingWordsPerMinute} wpm`,
			tooltip: "The words-per-minute setting currently used for all reading-time estimates.",
		},
	]);

	sectionEl.createEl("p", {
		text: `Years detected: ${formatYearList(result.aggregate.yearsWritten)}`,
		cls: "diary-stats-muted",
	});
	sectionEl.createEl("p", {
		text: `Average-length entry is based on the ${result.aggregate.selectedAverageEntryMethod} note length: ${formatNumber(result.aggregate.selectedAverageEntryWords)} words.`,
	});

	renderMetricGrid(sectionEl, [
		{
			label: "Mean words per entry",
			value: formatNumber(result.aggregate.averageWordsPerEntry),
			tooltip: "Arithmetic average note length across all included entries.",
		},
		{
			label: "Median words per entry",
			value: formatNumber(result.aggregate.medianWordsPerEntry),
			tooltip: "Middle note length across all included entries, which is usually less affected by outliers.",
		},
		{
			label: "Created fallback used",
			value: result.aggregate.entriesWithCreatedFallback.toString(),
			tooltip: "Entries whose created date came from filesystem metadata because frontmatter was missing or invalid.",
		},
		{
			label: "Updated fallback used",
			value: result.aggregate.entriesWithUpdatedFallback.toString(),
			tooltip: "Entries whose updated date came from filesystem metadata because frontmatter was missing or invalid.",
		},
	]);
}

function renderTagAnalysisSection(
	containerEl: HTMLElement,
	result: DiaryAnalysisResult,
	viewOptions: DiaryStatsViewOptions,
	view: DiaryStatsResultsView,
): void {
	const sectionEl = containerEl.createDiv({ cls: "diary-stats-section" });
	markDashboardSection(sectionEl, "tag-analytics", "Tag analytics");
	createTextElementWithTooltip(sectionEl, "h3", "Tag analytics");
	sectionEl.createEl("p", {
		text: "Tag analytics use frontmatter tags only, after case-insensitive normalization, alias handling, and ignored-tag filtering.",
		cls: "diary-stats-section-lead",
	});
	sectionEl.createEl("p", {
		text: `Basis: ${formatTagMetricScopeSummary({
			tagMetricTimeScope: result.tagAnalysis.timeScopeMode,
			tagMetricFromYear: result.tagAnalysis.timeScopeFromYear,
			tagMetricToYear: result.tagAnalysis.timeScopeToYear,
		})}; additional include/exclude year filters apply on top.`,
		cls: "diary-stats-muted diary-stats-basis-summary",
	});

	renderMetricGrid(sectionEl, [
		{
			label: "Minimum frequency",
			value: result.tagAnalysis.minimumFrequency.toString(),
			tooltip: "Only tags or tag combinations appearing at least this many times are shown.",
		},
		{
			label: "Combination depth",
			value: formatCombinationMode(result.tagAnalysis.combinationMode),
			tooltip: "Whether the analysis considers only single tags, or also pairs and triplets.",
		},
		{
			label: "Hierarchy mode",
			value: result.tagAnalysis.hierarchicalTagMode,
			tooltip: "Full keeps the whole hierarchical tag. Leaf keeps only the last segment.",
		},
		{
			label: "Tag metric time scope",
			value:
				result.tagAnalysis.timeScopeMode === "year-range"
					? "Restrict to year range"
					: "All eligible years",
			tooltip: "Whether tag-driven metrics use all eligible years or a restricted year range before extra filters are applied.",
		},
		{
			label: "Tag metric range",
			value: formatTagMetricScopeSummary({
				tagMetricTimeScope: result.tagAnalysis.timeScopeMode,
				tagMetricFromYear: result.tagAnalysis.timeScopeFromYear,
				tagMetricToYear: result.tagAnalysis.timeScopeToYear,
			}),
			tooltip: "The active year-range window for tag-driven metrics when the restricted time-scope mode is enabled.",
		},
		{
			label: "Alias rules",
			value: result.tagAnalysis.aliasCount.toString(),
			tooltip: "How many alias-normalization rules were applied before tags were counted.",
		},
		{
			label: "Ignored tags",
			value: result.tagAnalysis.ignoredTagCount.toString(),
			tooltip: "How many ignored-tag rules are active for this analysis run.",
		},
		{
			label: "Additional year filters",
			value: formatYearFilterSummary(result.tagAnalysis.includedYears, result.tagAnalysis.excludedYears),
			tooltip: "Included years are applied first, then excluded years are removed from tag correlation analysis.",
		},
		{
			label: "Mean tags per note",
			value: formatNumber(result.tagAnalysis.meanTagsPerNote),
			tooltip: "Average number of normalized frontmatter tags per eligible note in the current tag-analysis scope.",
		},
		{
			label: "Median tags per note",
			value: formatNumber(result.tagAnalysis.medianTagsPerNote),
			tooltip: "Middle number of normalized frontmatter tags per eligible note in the current tag-analysis scope.",
		},
	]);

	if (result.tagAnalysis.overall) {
		renderTagAnalysisTable(
			sectionEl,
			"All years combined",
			result.tagAnalysis.overall,
			viewOptions.tagRowsDisplayLimit,
			"Most common month/year",
		);
	} else if (result.tagAnalysis.combinedEnabled) {
		sectionEl.createEl("p", {
			text: "Combined tag analysis is enabled, but no tags reached the current threshold in the filtered years.",
			cls: "diary-stats-muted",
		});
	} else {
		sectionEl.createEl("p", {
			text: "Combined tag analysis is currently disabled in Settings.",
			cls: "diary-stats-muted",
		});
	}

	if (result.tagAnalysis.perYearEnabled) {
		renderPerYearTagAnalysis(sectionEl, result.tagAnalysis.perYear, viewOptions.tagRowsDisplayLimit, view);
	} else {
		sectionEl.createEl("p", {
			text: "Per-year tag analysis is currently disabled in Settings.",
			cls: "diary-stats-muted",
		});
	}
}

function renderAdvancedMetricsSection(
	containerEl: HTMLElement,
	result: DiaryAnalysisResult,
	viewOptions: DiaryStatsViewOptions,
	linkContext: InternalLinkRenderContext,
	view: DiaryStatsResultsView,
): void {
	const sectionEl = containerEl.createDiv({ cls: "diary-stats-section" });
	markDashboardSection(sectionEl, "structural-patterns", "Structural patterns");
	createTextElementWithTooltip(sectionEl, "h3", "Structural patterns");
	sectionEl.createEl("p", {
		text: "These advanced metrics stay within the current metadata model: dates, tags, word count, reading-time proxies, and revision lag.",
		cls: "diary-stats-section-lead",
	});
	sectionEl.createEl("p", {
		text: "Basis: headline cards summarize the strongest findings, and the detail groups below expose the year, text, tag, and hidden-structure layers behind them.",
		cls: "diary-stats-muted diary-stats-basis-summary",
	});

	renderAdvancedHeadlineCards(sectionEl, result.advancedMetrics.headlineCards);

	const overallMetricRows: MetricGridRow[] = [
		["Burstiness index", formatNumber(result.advancedMetrics.temporalRhythm.burstinessIndex)],
		["Longest silence gap", formatDays(result.advancedMetrics.temporalRhythm.longestSilenceGapDays)],
		["Weekday bias stability", formatPercent(result.advancedMetrics.temporalRhythm.weekdayBiasStability)],
		["Seasonal asymmetry", formatNumber(result.advancedMetrics.temporalRhythm.seasonalAsymmetry)],
		["Tail heaviness", formatNumber(result.advancedMetrics.volumeStructure.tailHeaviness)],
		["Compression vs expansion", formatNumber(result.advancedMetrics.volumeStructure.compressionExpansionRatio)],
		["Revisit ratio", formatPercent(result.advancedMetrics.revisionStructure.revisitRatio)],
		["Revision half-life", formatDays(result.advancedMetrics.revisionStructure.revisionHalfLifeDays)],
		["Tag entropy", formatNumber(result.advancedMetrics.tagStructure.overallEntropy)],
		["Cadence vs note depth", formatOptionalNumber(result.advancedMetrics.hiddenStructure.cadenceDepthCorrelation)],
		["Revision vs final length", formatOptionalNumber(result.advancedMetrics.hiddenStructure.revisionLengthCorrelation)],
		["Predominant mode", result.advancedMetrics.hiddenStructure.predominantMode ?? "(none)"],
	];

	if (result.advancedMetrics.bodyText.enabled) {
		overallMetricRows.push(
			["Body-text entries", result.advancedMetrics.bodyText.analyzedEntryCount.toString()],
			["Overall lexical richness", formatOptionalNumber(result.advancedMetrics.bodyText.overallLexicalRichness)],
			["Dominant opening style", formatOpeningSignature(result.advancedMetrics.bodyText.dominantOpeningSignature)],
		);
	}

	renderMetricGrid(sectionEl, overallMetricRows);

	const yearProfilesDetailsEl = view.createPersistentDetails(sectionEl, "advanced-year-profiles", "Year profiles");
	renderAdvancedYearProfilesTable(yearProfilesDetailsEl, result, view);

	const textStructuresDetailsEl = view.createPersistentDetails(sectionEl, "advanced-text-aware", "Text-aware patterns");
	renderBodyTextStructures(textStructuresDetailsEl, result, viewOptions, view);

	const tagStructuresDetailsEl = view.createPersistentDetails(sectionEl, "advanced-tag-structures", "Tag structures");
	renderAdvancedTagStructures(tagStructuresDetailsEl, result, viewOptions, view);

	const hiddenStructuresDetailsEl = view.createPersistentDetails(sectionEl, "advanced-hidden-structures", "Hidden structures");
	renderAdvancedHiddenStructures(hiddenStructuresDetailsEl, result, view);

	if (viewOptions.enableStructuralExamples && viewOptions.structuralExamplesLimit > 0) {
		const examplesDetailsEl = view.createPersistentDetails(sectionEl, "advanced-structural-examples", "Structural examples");
		renderStructuralExamplesSection(
			examplesDetailsEl,
			result,
			resolveStructuralExampleLimit(viewOptions.structuralExamplesLimit),
			linkContext,
		);
	}
}

function renderRecordsSection(
	containerEl: HTMLElement,
	result: DiaryAnalysisResult,
	viewOptions: DiaryStatsViewOptions,
	linkContext: InternalLinkRenderContext,
	view: DiaryStatsResultsView,
): void {
	if (viewOptions.recordsDisplayLimit <= 0) {
		return;
	}

	const visibleSections = getVisibleRecordSections(result.records.sections, viewOptions.recordsMode);
	if (visibleSections.length === 0) {
		return;
	}

	const sectionEl = containerEl.createDiv({ cls: "diary-stats-section" });
	markDashboardSection(sectionEl, "records", "Records");
	createTextElementWithTooltip(sectionEl, "h3", "Records");
	sectionEl.createEl("p", {
		text: "These ranked lists surface note-level extremes from the current analysis result and use real note links for quick inspection.",
		cls: "diary-stats-section-lead",
	});
	sectionEl.createEl("p", {
		text: `Basis: up to ${viewOptions.recordsDisplayLimit} rows per visible table, using the current ${viewOptions.recordsMode} records mode.`,
		cls: "diary-stats-muted diary-stats-basis-summary",
	});

	renderMetricGrid(sectionEl, [
		{
			label: "Records mode",
			value: viewOptions.recordsMode === "expanded" ? "Expanded" : "Simple",
		},
		{
			label: "Record rows",
			value: viewOptions.recordsDisplayLimit.toString(),
		},
		{
			label: "Visible record tables",
			value: visibleSections.length.toString(),
			tooltip: "How many record tables are currently visible after the selected records mode is applied.",
		},
	]);

	for (const recordSection of visibleSections) {
		const detailsEl = view.createPersistentDetails(sectionEl, `records-${recordSection.id}`, recordSection.title);
		renderRecordTable(detailsEl, recordSection.rows.slice(0, viewOptions.recordsDisplayLimit), linkContext);
	}
}

function renderPerYearTagAnalysis(
	containerEl: HTMLElement,
	sections: PerYearTagAnalysisSection[],
	tagRowsDisplayLimit: number,
	view: DiaryStatsResultsView,
): void {
	const detailsEl = view.createPersistentDetails(containerEl, "tag-analytics-per-year", "Per-year tag analytics");

	if (sections.length === 0) {
		detailsEl.createEl("p", {
			text: "No years qualified for per-year tag analysis after the current year filters were applied.",
			cls: "diary-stats-muted",
		});
		return;
	}

	for (const yearSection of sections) {
		const yearDetailsEl = view.createPersistentDetails(
			detailsEl,
			`tag-analytics-year-${yearSection.year}`,
			`${yearSection.year} (${yearSection.candidateCount} qualifying tags, ${yearSection.entryCountConsidered} filtered entries)`,
		);

		renderTagAnalysisTable(
			yearDetailsEl,
			`${yearSection.year} tag correlations`,
			yearSection,
			tagRowsDisplayLimit,
			"Most common month",
			false,
		);
	}
}

function renderTagAnalysisTable(
	containerEl: HTMLElement,
	title: string,
	section: TagAnalysisSection,
	rowLimit: number,
	monthColumnLabel: string,
	includeHeading = true,
): void {
	const sectionEl = includeHeading ? containerEl.createDiv({ cls: "diary-stats-section" }) : containerEl;
	const effectiveRowLimit = resolveTagRowLimit(rowLimit, section.rows.length);
	if (includeHeading) {
		createTextElementWithTooltip(sectionEl, "h4", title);
	}

	renderMetricGrid(sectionEl, [
		{
			label: "Filtered entries",
			value: section.entryCountConsidered.toString(),
			tooltip: "How many entries remained eligible for this specific tag table after year filters were applied.",
		},
		{
			label: "Qualifying tags",
			value: section.candidateCount.toString(),
			tooltip: "How many tags or tag combinations met the minimum frequency threshold for this table.",
		},
		{
			label: "Rows shown",
			value: effectiveRowLimit.toString(),
			tooltip: "How many qualifying rows are visible here. Set the dashboard row limit to 0 to show all.",
		},
	]);

	if (section.rows.length === 0) {
		sectionEl.createEl("p", {
			text: "No tags or tag combinations reached the current threshold.",
			cls: "diary-stats-muted",
		});
		return;
	}

	if (effectiveRowLimit < section.rows.length) {
		sectionEl.createEl("p", {
			text: `Showing the first ${effectiveRowLimit} rows. CSV export includes the full qualifying set.`,
			cls: "diary-stats-muted",
		});
	}

	const tableEl = sectionEl.createEl("table", { cls: "diary-stats-table" });
	const headerRow = tableEl.createEl("tr");
	createTableHeaderCells(headerRow, [
		"Tag",
		"Entries",
		"Avg words",
		"Median words",
		"Mean delta vs baseline",
		"Median delta vs baseline",
		"Most common weekday",
		monthColumnLabel,
	]);

	for (const row of section.rows.slice(0, effectiveRowLimit)) {
		const rowEl = tableEl.createEl("tr");
		rowEl.createEl("td", { text: row.label });
		rowEl.createEl("td", { text: row.entryCount.toString() });
		rowEl.createEl("td", { text: formatNumber(row.averageWords) });
		rowEl.createEl("td", { text: formatNumber(row.medianWords) });
		rowEl.createEl("td", { text: formatSignedNumber(row.averageWordDelta) });
		rowEl.createEl("td", { text: formatSignedNumber(row.medianWordDelta) });
		rowEl.createEl("td", {
			text: formatTopShareLabels(
				row.dominantWeekdayLabel,
				row.dominantWeekdayShare,
				row.secondaryWeekdayLabel,
				row.secondaryWeekdayShare,
			),
		});
		rowEl.createEl("td", { text: formatShareLabel(row.dominantMonthLabel, row.dominantMonthShare) });
	}
}

function renderAdvancedYearProfilesTable(
	containerEl: HTMLElement,
	result: DiaryAnalysisResult,
	view: DiaryStatsResultsView,
): void {
	if (result.advancedMetrics.yearProfiles.length === 0) {
		containerEl.createEl("p", {
			text: "No dated year profiles are available yet.",
			cls: "diary-stats-muted",
		});
		return;
	}

	containerEl.createEl("p", {
		text: `Basis: one row per chronology year. Click a column header to sort locally without changing the stored analysis result.`,
		cls: "diary-stats-muted diary-stats-basis-summary",
	});

	view.renderSortableAdvancedTable(containerEl, {
		id: "advanced-year-profiles",
		title: "Year profiles",
		columns: [
			{ key: "year", label: "Year", render: (profile) => profile.year.toString(), sortValue: (profile) => profile.year, initialDirection: "asc" },
			{ key: "entryCount", label: "Entries", render: (profile) => profile.entryCount.toString(), sortValue: (profile) => profile.entryCount },
			{ key: "averageWords", label: "Avg words", render: (profile) => formatNumber(profile.averageWords), sortValue: (profile) => profile.averageWords },
			{ key: "burstinessIndex", label: "Burstiness", render: (profile) => formatNumber(profile.burstinessIndex), sortValue: (profile) => profile.burstinessIndex },
			{ key: "writingConcentrationIndex", label: "Concentration", render: (profile) => formatNumber(profile.writingConcentrationIndex), sortValue: (profile) => profile.writingConcentrationIndex },
			{ key: "revisitRatio", label: "Revisit ratio", render: (profile) => formatPercent(profile.revisitRatio), sortValue: (profile) => profile.revisitRatio },
			{ key: "tagEntropy", label: "Tag entropy", render: (profile) => formatOptionalNumber(profile.tagEntropy), sortValue: (profile) => profile.tagEntropy },
			{ key: "productivityMode", label: "Mode", render: (profile) => profile.productivityMode, sortValue: (profile) => profile.productivityMode, initialDirection: "asc" },
			{ key: "regimeShiftFromPrevious", label: "Shift from previous", render: (profile) => formatOptionalNumber(profile.regimeShiftFromPrevious), sortValue: (profile) => profile.regimeShiftFromPrevious },
		],
		rows: result.advancedMetrics.yearProfiles,
		emptyMessage: "No dated year profiles are available yet.",
		defaultSortKey: "year",
		defaultSortDirection: "asc",
	});
}

function renderAdvancedTagStructures(
	containerEl: HTMLElement,
	result: DiaryAnalysisResult,
	viewOptions: DiaryStatsViewOptions,
	view: DiaryStatsResultsView,
): void {
	const tagPairLiftLimit = resolveConfiguredRowLimit(
		viewOptions.tagPairLiftDisplayLimit,
		viewOptions.advancedRowsDisplayLimit,
		result.advancedMetrics.tagStructure.topPairLifts.length,
	);
	const bridgeTagLimit = resolveConfiguredRowLimit(
		viewOptions.bridgeTagDisplayLimit,
		viewOptions.advancedRowsDisplayLimit,
		result.advancedMetrics.tagStructure.bridgeTags.length,
	);
	const weekdayBiasLimit = resolveConfiguredRowLimit(
		viewOptions.weekdaySemanticBiasDisplayLimit,
		viewOptions.advancedRowsDisplayLimit,
		result.advancedMetrics.tagStructure.weekdayBiases.length,
	);

	renderMetricGrid(containerEl, [
		["Fastest-returning tag", formatTagInterval(result.advancedMetrics.tagStructure.fastestReturningTag)],
		["Most persistent tag", formatTagPersistence(result.advancedMetrics.tagStructure.mostPersistentTag)],
		["Longest-lived tag", formatTagPersistence(result.advancedMetrics.tagStructure.longestLifespanTag)],
		["Strongest positive tag-length coupling", formatTagCoupling(result.advancedMetrics.tagStructure.strongestPositiveCoupling)],
		["Strongest negative tag-length coupling", formatTagCoupling(result.advancedMetrics.tagStructure.strongestNegativeCoupling)],
	]);
	containerEl.createEl("p", {
		text: `Basis: normalized frontmatter tags inside the active tag metric scope. Rows shown: pairs ${tagPairLiftLimit}/${result.advancedMetrics.tagStructure.topPairLifts.length}, bridges ${bridgeTagLimit}/${result.advancedMetrics.tagStructure.bridgeTags.length}, weekday bias ${weekdayBiasLimit}/${result.advancedMetrics.tagStructure.weekdayBiases.length}.`,
		cls: "diary-stats-muted diary-stats-basis-summary",
	});

	view.renderSortableAdvancedTable(containerEl, {
		id: "advanced-top-tag-pair-lifts",
		title: "Top tag pair lifts",
		columns: [
			{ key: "label", label: "Pair", render: (pair) => pair.label, sortValue: (pair) => pair.label, initialDirection: "asc" },
			{ key: "support", label: "Support", render: (pair) => pair.support.toString(), sortValue: (pair) => pair.support },
			{ key: "lift", label: "Lift", render: (pair) => formatNumber(pair.lift), sortValue: (pair) => pair.lift },
		],
		rows: result.advancedMetrics.tagStructure.topPairLifts.slice(0, tagPairLiftLimit),
		emptyMessage: "No qualifying tag pairs yet.",
		defaultSortKey: "lift",
		defaultSortDirection: "desc",
		totalRowCount: result.advancedMetrics.tagStructure.topPairLifts.length,
	});

	view.renderSortableAdvancedTable(containerEl, {
		id: "advanced-bridge-tags",
		title: "Bridge tags",
		columns: [
			{ key: "label", label: "Tag", render: (tag) => tag.label, sortValue: (tag) => tag.label, initialDirection: "asc" },
			{ key: "frequency", label: "Frequency", render: (tag) => tag.frequency.toString(), sortValue: (tag) => tag.frequency },
			{ key: "degree", label: "Degree", render: (tag) => tag.degree.toString(), sortValue: (tag) => tag.degree },
			{ key: "bridgeScore", label: "Bridge score", render: (tag) => formatNumber(tag.bridgeScore), sortValue: (tag) => tag.bridgeScore },
		],
		rows: result.advancedMetrics.tagStructure.bridgeTags.slice(0, bridgeTagLimit),
		emptyMessage: "No bridge-tag candidates yet.",
		defaultSortKey: "bridgeScore",
		defaultSortDirection: "desc",
		totalRowCount: result.advancedMetrics.tagStructure.bridgeTags.length,
	});

	renderSimpleAdvancedTable(
		containerEl,
		"Day-of-week semantic bias",
		["Tag", "Weekday", "Support", "Lift"],
		result.advancedMetrics.tagStructure.weekdayBiases.slice(0, weekdayBiasLimit).map((bias) => [
			bias.label,
			bias.weekdayLabel,
			bias.support.toString(),
			formatNumber(bias.lift),
		]),
		"No strong weekday semantic bias detected yet.",
		result.advancedMetrics.tagStructure.weekdayBiases.length,
	);
}

function renderBodyTextStructures(
	containerEl: HTMLElement,
	result: DiaryAnalysisResult,
	viewOptions: DiaryStatsViewOptions,
	view: DiaryStatsResultsView,
): void {
	const bodyText = result.advancedMetrics.bodyText;
	if (!bodyText.enabled) {
		containerEl.createEl("p", {
			text: "Body-text analysis is currently disabled in Settings.",
			cls: "diary-stats-muted",
		});
		return;
	}

	if (bodyText.analyzedEntryCount === 0) {
		containerEl.createEl("p", {
			text: "No dated notes with body-text features were available yet.",
			cls: "diary-stats-muted",
		});
		return;
	}

	const recurringPhraseLimit = resolveTagRowLimit(
		viewOptions.recurringPhraseDisplayLimit,
		bodyText.topRecurringPhrases.length,
	);
	const tagTextProfileLimit = resolveConfiguredRowLimit(
		viewOptions.tagTextProfileDisplayLimit,
		viewOptions.advancedRowsDisplayLimit,
		bodyText.tagProfiles.length,
	);
	const czechNormalized = bodyText.czechNormalized;
	const periodSignatureLimit = resolveTagRowLimit(
		viewOptions.periodSignatureDisplayLimit,
		Math.max(
			czechNormalized.periodSignature.topDistinctiveTerms.length,
			czechNormalized.periodSignature.topEmergentTerms.length,
			czechNormalized.periodSignature.topFadingTerms.length,
		),
	);
	const entityLimit = resolveTagRowLimit(
		viewOptions.entityDisplayLimit,
		Math.max(
			czechNormalized.entities.topPersistentCandidates.length,
			czechNormalized.entities.topBridgeCandidates.length,
			czechNormalized.entities.topEntityPairs.length,
		),
	);

	renderMetricGrid(containerEl, [
		["Entries with body-text features", bodyText.analyzedEntryCount.toString()],
		["Body-text scope", bodyText.timeScopeLabel],
		["Richest vocabulary year", bodyText.richestVocabularyYear ? bodyText.richestVocabularyYear.year.toString() : "(none)"],
		["Most novel year", bodyText.mostNovelYear ? bodyText.mostNovelYear.year.toString() : "(none)"],
		["Most repetitive phrasing year", bodyText.mostRepetitiveYear ? bodyText.mostRepetitiveYear.year.toString() : "(none)"],
		["Strongest phrase family", bodyText.strongestPhraseFamily?.phrase ?? "(none)"],
		["Longest-sentence month", formatMonthClimate(bodyText.longestSentenceMonth)],
		["Shortest-sentence month", formatMonthClimate(bodyText.shortestSentenceMonth)],
		["Richest tag", formatBodyTextTagProfile(bodyText.richestTag)],
		["Most revised tag", formatBodyTextTagProfile(bodyText.mostRevisedTag)],
		["Sharpest opening-style shift", formatOpeningShift(bodyText.sharpestOpeningShift)],
	]);
	const basisSummaryParts = [
		`Basis: body-text scope ${bodyText.timeScopeLabel}.`,
		`Recurring phrase families shown: ${recurringPhraseLimit}/${bodyText.topRecurringPhrases.length}.`,
		`Tag text profiles shown: ${tagTextProfileLimit}/${bodyText.tagProfiles.length}.`,
	];
	if (czechNormalized.enabled) {
		basisSummaryParts.push(
			`Czech-normalized deep text: ${czechNormalized.analyzedEntryCount} scoped entries (${czechNormalized.scopeLabel}; ${czechNormalized.tagFilterLabel}).`,
		);
	}
	containerEl.createEl("p", {
		text: basisSummaryParts.join(" "),
		cls: "diary-stats-muted diary-stats-basis-summary",
	});

	view.renderSortableAdvancedTable(containerEl, {
		id: "body-text-year-profiles",
		title: "Body-text year profiles",
		columns: [
			{ key: "year", label: "Year", render: (profile) => profile.year.toString(), sortValue: (profile) => profile.year, initialDirection: "asc" },
			{ key: "lexicalRichness", label: "Lexical richness", render: (profile) => formatOptionalNumber(profile.lexicalRichness), sortValue: (profile) => profile.lexicalRichness },
			{ key: "noveltyRate", label: "Novelty", render: (profile) => formatPercent(profile.noveltyRate ?? 0), sortValue: (profile) => profile.noveltyRate ?? -Infinity },
			{ key: "averageSentenceLength", label: "Avg sentence", render: (profile) => formatOptionalNumber(profile.averageSentenceLength), sortValue: (profile) => profile.averageSentenceLength },
			{ key: "sentenceLengthVariation", label: "Variation", render: (profile) => formatOptionalNumber(profile.sentenceLengthVariation), sortValue: (profile) => profile.sentenceLengthVariation },
			{ key: "opening", label: "Opening", render: (profile) => formatOpeningSignature(profile.dominantOpeningSignature), sortValue: (profile) => formatOpeningSignature(profile.dominantOpeningSignature), initialDirection: "asc" },
			{ key: "recurringPhraseShare", label: "Recurring phrase share", render: (profile) => formatPercent(profile.recurringPhraseShare ?? 0), sortValue: (profile) => profile.recurringPhraseShare ?? -Infinity },
		],
		rows: bodyText.yearProfiles,
		emptyMessage: "No body-text year profiles yet.",
		defaultSortKey: "year",
		defaultSortDirection: "asc",
	});

	renderSimpleAdvancedTable(
		containerEl,
		"Recurring phrase families",
		["Phrase", "Entries", "Year span", "Avg gap", "Score"],
		bodyText.topRecurringPhrases
			.slice(0, recurringPhraseLimit)
			.map((phrase) => [
			phrase.phrase,
			phrase.supportEntries.toString(),
			`${phrase.firstYear}-${phrase.lastYear}`,
			formatOptionalDays(phrase.averageGapDays),
			formatNumber(phrase.recurrenceScore),
		]),
		"No recurring phrase families yet.",
		bodyText.topRecurringPhrases.length,
	);

	renderSimpleAdvancedTable(
		containerEl,
		"Month climate",
		["Month", "Entries", "Lexical richness", "Avg sentence", "Variation"],
		bodyText.monthClimateProfiles.map((profile) => [
			profile.monthLabel,
			profile.entryCount.toString(),
			formatOptionalNumber(profile.lexicalRichness),
			formatOptionalNumber(profile.averageSentenceLength),
			formatOptionalNumber(profile.sentenceLengthVariation),
		]),
		"No month climate profiles yet.",
	);

	view.renderSortableAdvancedTable(containerEl, {
		id: "body-text-tag-profiles",
		title: "Tag text profiles",
		columns: [
			{ key: "label", label: "Tag", render: (profile) => profile.label, sortValue: (profile) => profile.label, initialDirection: "asc" },
			{ key: "support", label: "Entries", render: (profile) => profile.support.toString(), sortValue: (profile) => profile.support },
			{ key: "averageWords", label: "Avg words", render: (profile) => formatNumber(profile.averageWords), sortValue: (profile) => profile.averageWords },
			{ key: "medianWords", label: "Median words", render: (profile) => formatOptionalNumber(profile.medianWords), sortValue: (profile) => profile.medianWords },
			{ key: "averageLexicalRichness", label: "Lexical richness", render: (profile) => formatOptionalNumber(profile.averageLexicalRichness), sortValue: (profile) => profile.averageLexicalRichness },
			{ key: "averageSentenceLength", label: "Avg sentence", render: (profile) => formatOptionalNumber(profile.averageSentenceLength), sortValue: (profile) => profile.averageSentenceLength },
			{ key: "medianSentenceLength", label: "Median sentence", render: (profile) => formatOptionalNumber(profile.medianSentenceLength), sortValue: (profile) => profile.medianSentenceLength },
			{ key: "averageRevisionLagDays", label: "Avg revision lag", render: (profile) => formatOptionalDays(profile.averageRevisionLagDays), sortValue: (profile) => profile.averageRevisionLagDays },
			{ key: "medianRevisionLagDays", label: "Median revision lag", render: (profile) => formatOptionalDays(profile.medianRevisionLagDays), sortValue: (profile) => profile.medianRevisionLagDays },
		],
		rows: bodyText.tagProfiles.slice(0, tagTextProfileLimit),
		emptyMessage: "No qualifying tag text profiles yet.",
		defaultSortKey: "support",
		defaultSortDirection: "desc",
		totalRowCount: bodyText.tagProfiles.length,
	});

	if (!czechNormalized.enabled) {
		return;
	}

	createTextElementWithTooltip(containerEl, "h4", "Czech-normalized text");
	containerEl.createEl("p", {
		text: `Basis: ${czechNormalized.scopeLabel}. ${czechNormalized.tagFilterLabel}. This layer uses Czech-aware normalization, stopword filtering, and conservative suffix trimming rather than full lemmatization.`,
		cls: "diary-stats-muted diary-stats-basis-summary",
	});
	renderMetricGrid(containerEl, [
		["Deep-text scope", czechNormalized.scopeLabel],
		["Deep-text tags", czechNormalized.tagFilterLabel],
		["Czech-normalized entries", czechNormalized.analyzedEntryCount.toString()],
		["Scoped content tokens", formatNumber(czechNormalized.overallContentTokenCount)],
		["Scoped vocabulary size", formatNumber(czechNormalized.overallVocabularySize)],
		["Normalized lexical richness", formatOptionalNumber(czechNormalized.overallLexicalRichness)],
		[
			"Content-token share",
			czechNormalized.overallContentShare === null ? "(none)" : formatPercent(czechNormalized.overallContentShare),
		],
		["Richest normalized year", czechNormalized.richestYear?.year.toString() ?? "(none)"],
		["Most novel normalized year", czechNormalized.mostNovelYear?.year.toString() ?? "(none)"],
		["Densest content year", czechNormalized.densestContentYear?.year.toString() ?? "(none)"],
	]);
	view.renderSortableAdvancedTable(containerEl, {
		id: "body-text-czech-normalized-year-profiles",
		title: "Czech-normalized year profiles",
		columns: [
			{ key: "year", label: "Year", render: (profile) => profile.year.toString(), sortValue: (profile) => profile.year, initialDirection: "asc" },
			{ key: "entryCount", label: "Entries", render: (profile) => profile.entryCount.toString(), sortValue: (profile) => profile.entryCount },
			{ key: "contentTokenCount", label: "Content tokens", render: (profile) => formatNumber(profile.contentTokenCount), sortValue: (profile) => profile.contentTokenCount },
			{ key: "vocabularySize", label: "Vocabulary", render: (profile) => formatNumber(profile.vocabularySize), sortValue: (profile) => profile.vocabularySize },
			{ key: "lexicalRichness", label: "Lexical richness", render: (profile) => formatOptionalNumber(profile.lexicalRichness), sortValue: (profile) => profile.lexicalRichness },
			{ key: "noveltyRate", label: "Novelty", render: (profile) => formatPercent(profile.noveltyRate ?? 0), sortValue: (profile) => profile.noveltyRate ?? -Infinity },
			{ key: "contentShare", label: "Content share", render: (profile) => profile.contentShare === null ? "(none)" : formatPercent(profile.contentShare), sortValue: (profile) => profile.contentShare ?? -Infinity },
		],
		rows: czechNormalized.yearProfiles,
		emptyMessage: "No Czech-normalized scoped year profiles matched the current deep-text scope.",
		defaultSortKey: "year",
		defaultSortDirection: "asc",
	});

	if (czechNormalized.periodSignature.enabled) {
		const periodSignature = czechNormalized.periodSignature;
		createTextElementWithTooltip(containerEl, "h4", "Period signature");
		containerEl.createEl("p", {
			text: `Basis: selected period ${periodSignature.selectedPeriodLabel}; comparison ${periodSignature.comparisonLabel}. Rows shown: ${periodSignatureLimit}. Scores are smoothed frequency-contrast signals, not AI interpretation.`,
			cls: "diary-stats-muted diary-stats-basis-summary",
		});
		renderMetricGrid(containerEl, [
			["Selected period", periodSignature.selectedPeriodLabel],
			["Comparison basis", periodSignature.comparisonLabel],
			["Selected period entries", periodSignature.selectedEntryCount.toString()],
			["Comparison entries", periodSignature.comparisonEntryCount.toString()],
			["Selected content tokens", formatNumber(periodSignature.selectedContentTokenCount)],
			["Comparison content tokens", formatNumber(periodSignature.comparisonContentTokenCount)],
			["Candidate terms", periodSignature.candidateTermCount.toString()],
			["Strongest distinctive term", periodSignature.strongestDistinctiveTerm?.term ?? "(none)"],
			["Strongest emergent term", periodSignature.strongestEmergentTerm?.term ?? "(none)"],
			["Strongest fading term", periodSignature.strongestFadingTerm?.term ?? "(none)"],
		]);

		if (
			periodSignature.selectedEntryCount === 0 ||
			periodSignature.comparisonEntryCount === 0 ||
			periodSignature.candidateTermCount === 0
		) {
			const periodSignatureMessage =
				periodSignature.selectedEntryCount === 0
					? "No usable period-signature comparison could be built yet because the selected period contains no usable notes inside the current deep-text scope."
					: periodSignature.comparisonEntryCount === 0
						? "No usable period-signature comparison could be built yet because the comparison side is empty inside the current deep-text scope. Try a later year for the earlier-years mode, or a narrower selected period for the rest-of-scope mode."
						: "No usable period-signature comparison could be built yet because no supported candidate terms survived the current scope and support filters.";
			containerEl.createEl("p", {
				text: periodSignatureMessage,
				cls: "diary-stats-muted",
			});
		} else {
			renderSimpleAdvancedTable(
				containerEl,
				"Distinctive terms",
				["Term", "Selected tokens", "Comparison tokens", "Selected share", "Comparison share", "Score"],
				periodSignature.topDistinctiveTerms
					.slice(0, periodSignatureLimit)
					.map((term) => [
						term.term,
						formatNumber(term.selectedCount),
						formatNumber(term.comparisonCount),
						`${formatNumber(term.selectedRate * 100)}%`,
						`${formatNumber(term.comparisonRate * 100)}%`,
						formatNumber(term.score),
					]),
				"No distinctive terms met the current support threshold.",
				periodSignature.topDistinctiveTerms.length,
			);
			renderSimpleAdvancedTable(
				containerEl,
				"Emergent terms",
				["Term", "Selected tokens", "Comparison tokens", "Selected share", "Comparison share", "Score"],
				periodSignature.topEmergentTerms
					.slice(0, periodSignatureLimit)
					.map((term) => [
						term.term,
						formatNumber(term.selectedCount),
						formatNumber(term.comparisonCount),
						`${formatNumber(term.selectedRate * 100)}%`,
						`${formatNumber(term.comparisonRate * 100)}%`,
						formatNumber(term.score),
					]),
				"No emergent terms met the current support threshold.",
				periodSignature.topEmergentTerms.length,
			);
			renderSimpleAdvancedTable(
				containerEl,
				"Fading terms",
				["Term", "Selected tokens", "Comparison tokens", "Selected share", "Comparison share", "Score"],
				periodSignature.topFadingTerms
					.slice(0, periodSignatureLimit)
					.map((term) => [
						term.term,
						formatNumber(term.selectedCount),
						formatNumber(term.comparisonCount),
						`${formatNumber(term.selectedRate * 100)}%`,
						`${formatNumber(term.comparisonRate * 100)}%`,
						formatNumber(term.score),
					]),
				"No fading terms met the current support threshold.",
				periodSignature.topFadingTerms.length,
			);
		}
	}

	if (!czechNormalized.entities.enabled) {
		return;
	}

	renderCzechEntitySection(containerEl, czechNormalized.entities, entityLimit);
}

function renderCzechEntitySection(
	containerEl: HTMLElement,
	entities: DiaryAnalysisResult["advancedMetrics"]["bodyText"]["czechNormalized"]["entities"],
	entityLimit: number,
): void {
	createTextElementWithTooltip(containerEl, "h4", "Entity candidates and relationships");
	containerEl.createEl("p", {
		text: `Basis: recurring capitalized names, titles, places, and other entity-like candidates inside the current deep-text scope. Rows shown: ${entityLimit}. This is conservative local heuristic extraction, not full Czech named-entity recognition.`,
		cls: "diary-stats-muted diary-stats-basis-summary",
	});
	renderMetricGrid(containerEl, [
		["Entity candidates", entities.candidateCount.toString()],
		["Entity pairs", entities.pairCount.toString()],
		["Most persistent entity candidate", formatEntityCandidateMetric(entities.mostPersistentCandidate, "support")],
		["Newest entity candidate", formatEntityCandidateMetric(entities.newestCandidate, "newest")],
		["Longest-lived entity candidate", formatEntityCandidateMetric(entities.longestLivedCandidate, "span")],
		["Bridge entity candidate", formatEntityCandidateMetric(entities.bridgeCandidate, "bridge")],
		["Strongest entity pair", formatEntityPairMetric(entities.strongestPair)],
	]);

	if (entities.candidateCount === 0) {
		containerEl.createEl("p", {
			text: "No recurring entity candidates met the current support threshold inside the current deep-text scope yet.",
			cls: "diary-stats-muted",
		});
		return;
	}

	renderSimpleAdvancedTable(
		containerEl,
		"Most persistent entity candidates",
		["Candidate", "Entries", "Active years", "First year", "Last year", "Avg gap", "Bridge score"],
		entities.topPersistentCandidates
			.slice(0, entityLimit)
			.map((row) => [
				row.label,
				row.supportEntries.toString(),
				row.activeYears.toString(),
				row.firstYear.toString(),
				row.lastYear.toString(),
				formatOptionalDays(row.averageGapDays),
				formatNumber(row.bridgeScore),
			]),
		"No recurring entity candidates met the current support threshold.",
		entities.topPersistentCandidates.length,
	);
	renderSimpleAdvancedTable(
		containerEl,
		"Bridge entity candidates",
		["Candidate", "Entries", "Active years", "First year", "Last year", "Avg gap", "Bridge score"],
		entities.topBridgeCandidates
			.slice(0, entityLimit)
			.map((row) => [
				row.label,
				row.supportEntries.toString(),
				row.activeYears.toString(),
				row.firstYear.toString(),
				row.lastYear.toString(),
				formatOptionalDays(row.averageGapDays),
				formatNumber(row.bridgeScore),
			]),
		"No bridge-style entity candidates met the current support threshold.",
		entities.topBridgeCandidates.length,
	);
	renderSimpleAdvancedTable(
		containerEl,
		"Strongest entity pairs",
		["Pair", "Entries", "Active years", "First year", "Last year", "Relationship score"],
		entities.topEntityPairs
			.slice(0, entityLimit)
			.map((row) => [
				`${row.leftLabel} + ${row.rightLabel}`,
				row.supportEntries.toString(),
				row.activeYears.toString(),
				row.firstYear.toString(),
				row.lastYear.toString(),
				formatNumber(row.strength),
			]),
		"No recurring entity pairs met the current support threshold.",
		entities.topEntityPairs.length,
	);
}

function renderAdvancedHiddenStructures(
	containerEl: HTMLElement,
	result: DiaryAnalysisResult,
	view: DiaryStatsResultsView,
): void {
	containerEl.createEl("p", {
		text: "Basis: regime shifts compare adjacent chronology years, and the structural readings list is a heuristic guide built from the metrics above.",
		cls: "diary-stats-muted diary-stats-basis-summary",
	});
	if (result.advancedMetrics.hiddenStructure.structuralReadings.length > 0) {
		const listEl = containerEl.createEl("ul", { cls: "diary-stats-path-list" });
		for (const reading of result.advancedMetrics.hiddenStructure.structuralReadings) {
			const itemEl = listEl.createEl("li", {
				text: `${reading.label}: ${reading.value} (${reading.detail})`,
			});
			itemEl.setAttribute("title", resolveMetricTooltip(reading.label) ?? reading.detail);
		}
	}

	view.renderSortableAdvancedTable(containerEl, {
		id: "advanced-regime-shifts",
		title: "Regime shifts",
		columns: [
			{ key: "fromYear", label: "From", render: (shift) => shift.fromYear.toString(), sortValue: (shift) => shift.fromYear, initialDirection: "asc" },
			{ key: "toYear", label: "To", render: (shift) => shift.toYear.toString(), sortValue: (shift) => shift.toYear, initialDirection: "asc" },
			{ key: "score", label: "Score", render: (shift) => formatNumber(shift.score), sortValue: (shift) => shift.score },
			{ key: "tagChange", label: "Tag", render: (shift) => formatNumber(shift.tagChange), sortValue: (shift) => shift.tagChange },
			{ key: "textChange", label: "Text", render: (shift) => formatNumber(shift.textChange), sortValue: (shift) => shift.textChange },
			{ key: "volumeChange", label: "Volume", render: (shift) => formatNumber(shift.volumeChange), sortValue: (shift) => shift.volumeChange },
			{ key: "revisionChange", label: "Revision", render: (shift) => formatNumber(shift.revisionChange), sortValue: (shift) => shift.revisionChange },
			{ key: "cadenceChange", label: "Cadence", render: (shift) => formatNumber(shift.cadenceChange), sortValue: (shift) => shift.cadenceChange },
		],
		rows: result.advancedMetrics.hiddenStructure.regimeShifts.slice(0, MAX_ADVANCED_LIST_ROWS),
		emptyMessage: "No regime shifts could be computed yet.",
		defaultSortKey: "score",
		defaultSortDirection: "desc",
		totalRowCount: result.advancedMetrics.hiddenStructure.regimeShifts.length,
	});

	renderSimpleAdvancedTable(
		containerEl,
		"Productivity modes by year",
		["Year", "Mode", "Rationale"],
		result.advancedMetrics.hiddenStructure.productivityModes.map((mode) => [
			mode.year.toString(),
			mode.mode,
			mode.rationale,
		]),
		"No productivity modes are available yet.",
	);
}

function renderStructuralExamplesSection(
	containerEl: HTMLElement,
	result: DiaryAnalysisResult,
	rowLimit: number,
	linkContext: InternalLinkRenderContext,
): void {
	const examples = result.advancedMetrics.structuralExamples;
	const totalExampleCount =
		examples.silenceGaps.length +
		examples.revisionLags.length +
		examples.recurringPhrases.length +
		examples.tagPairLifts.length +
		examples.bridgeTags.length +
		examples.regimeShifts.length;

	if (totalExampleCount === 0) {
		containerEl.createEl("p", {
			text: "No structural examples were available for the current analysis result.",
			cls: "diary-stats-muted",
		});
		return;
	}

	containerEl.createEl("p", {
		text: `Showing up to ${rowLimit} example rows per table. These rows use real note links from the analyzed scope.`,
	});

	renderSilenceGapExamplesTable(containerEl, examples.silenceGaps.slice(0, rowLimit), linkContext);
	renderRevisionLagExamplesTable(containerEl, examples.revisionLags.slice(0, rowLimit), linkContext);
	renderRecurringPhraseExamplesTable(containerEl, examples.recurringPhrases.slice(0, rowLimit), linkContext);
	renderTagPairLiftExamplesTable(containerEl, examples.tagPairLifts.slice(0, rowLimit), linkContext);
	renderBridgeTagExamplesTable(containerEl, examples.bridgeTags.slice(0, rowLimit), linkContext);
	renderRegimeShiftExamplesTable(containerEl, examples.regimeShifts.slice(0, rowLimit), linkContext);
}

function renderSilenceGapExamplesTable(
	containerEl: HTMLElement,
	rows: DiaryAnalysisResult["advancedMetrics"]["structuralExamples"]["silenceGaps"],
	linkContext: InternalLinkRenderContext,
): void {
	createTextElementWithTooltip(containerEl, "h4", "Longest silence gap examples");
	if (rows.length === 0) {
		containerEl.createEl("p", {
			text: "No positive silence gaps were found in the current scope.",
			cls: "diary-stats-muted",
		});
		return;
	}

	const tableEl = containerEl.createEl("table", { cls: "diary-stats-table" });
	const headerRow = tableEl.createEl("tr");
	createTableHeaderCells(headerRow, ["Gap", "Before note", "Before date", "After note", "After date"]);

	for (const row of rows) {
		const rowEl = tableEl.createEl("tr");
		rowEl.createEl("td", { text: formatDays(row.gapDays) });
		const beforeCellEl = rowEl.createEl("td");
		renderInternalNoteLink(beforeCellEl, linkContext, row.before.path);
		rowEl.createEl("td", { text: row.before.timestampLabel ?? "(unknown)" });
		const afterCellEl = rowEl.createEl("td");
		renderInternalNoteLink(afterCellEl, linkContext, row.after.path);
		rowEl.createEl("td", { text: row.after.timestampLabel ?? "(unknown)" });
	}
}

function renderRevisionLagExamplesTable(
	containerEl: HTMLElement,
	rows: DiaryAnalysisResult["advancedMetrics"]["structuralExamples"]["revisionLags"],
	linkContext: InternalLinkRenderContext,
): void {
	createTextElementWithTooltip(containerEl, "h4", "Largest revision lags");
	if (rows.length === 0) {
		containerEl.createEl("p", {
			text: "No positive revision lags were found in the current scope.",
			cls: "diary-stats-muted",
		});
		return;
	}

	const tableEl = containerEl.createEl("table", { cls: "diary-stats-table" });
	const headerRow = tableEl.createEl("tr");
	createTableHeaderCells(headerRow, ["Note", "Lag", "Created", "Updated", "Words"]);

	for (const row of rows) {
		const rowEl = tableEl.createEl("tr");
		const noteCellEl = rowEl.createEl("td");
		renderInternalNoteLink(noteCellEl, linkContext, row.path);
		rowEl.createEl("td", { text: formatDays(row.lagDays) });
		rowEl.createEl("td", { text: row.createdAtLabel ?? "(unknown)" });
		rowEl.createEl("td", { text: row.updatedAtLabel ?? "(unknown)" });
		rowEl.createEl("td", { text: formatNumber(row.wordCount) });
	}
}

function renderRecurringPhraseExamplesTable(
	containerEl: HTMLElement,
	rows: DiaryAnalysisResult["advancedMetrics"]["structuralExamples"]["recurringPhrases"],
	linkContext: InternalLinkRenderContext,
): void {
	createTextElementWithTooltip(containerEl, "h4", "Recurring phrase example notes");
	if (rows.length === 0) {
		containerEl.createEl("p", {
			text: "No recurring phrase examples were available yet.",
			cls: "diary-stats-muted",
		});
		return;
	}

	const tableEl = containerEl.createEl("table", { cls: "diary-stats-table" });
	const headerRow = tableEl.createEl("tr");
	createTableHeaderCells(headerRow, ["Phrase", "Entries", "Avg gap", "Score", "Example notes"]);

	for (const row of rows) {
		const rowEl = tableEl.createEl("tr");
		rowEl.createEl("td", { text: row.phrase });
		rowEl.createEl("td", { text: row.supportEntries.toString() });
		rowEl.createEl("td", { text: formatOptionalDays(row.averageGapDays) });
		rowEl.createEl("td", { text: formatNumber(row.recurrenceScore) });
		const notesCellEl = rowEl.createEl("td", { cls: "diary-stats-example-note-cell" });
		renderInternalLinkList(notesCellEl, linkContext, row.examplePaths);
	}
}

function renderTagPairLiftExamplesTable(
	containerEl: HTMLElement,
	rows: DiaryAnalysisResult["advancedMetrics"]["structuralExamples"]["tagPairLifts"],
	linkContext: InternalLinkRenderContext,
): void {
	createTextElementWithTooltip(containerEl, "h4", "Tag-pair lift example notes");
	if (rows.length === 0) {
		containerEl.createEl("p", {
			text: "No qualifying tag-pair examples were available yet.",
			cls: "diary-stats-muted",
		});
		return;
	}

	const tableEl = containerEl.createEl("table", { cls: "diary-stats-table" });
	const headerRow = tableEl.createEl("tr");
	createTableHeaderCells(headerRow, ["Pair", "Support", "Lift", "Example notes"]);

	for (const row of rows) {
		const rowEl = tableEl.createEl("tr");
		rowEl.createEl("td", { text: row.label });
		rowEl.createEl("td", { text: row.support.toString() });
		rowEl.createEl("td", { text: formatNumber(row.lift) });
		const notesCellEl = rowEl.createEl("td", { cls: "diary-stats-example-note-cell" });
		renderInternalLinkList(notesCellEl, linkContext, row.examplePaths);
	}
}

function renderBridgeTagExamplesTable(
	containerEl: HTMLElement,
	rows: DiaryAnalysisResult["advancedMetrics"]["structuralExamples"]["bridgeTags"],
	linkContext: InternalLinkRenderContext,
): void {
	createTextElementWithTooltip(containerEl, "h4", "Bridge tag example notes");
	if (rows.length === 0) {
		containerEl.createEl("p", {
			text: "No bridge-tag examples were available yet.",
			cls: "diary-stats-muted",
		});
		return;
	}

	const tableEl = containerEl.createEl("table", { cls: "diary-stats-table" });
	const headerRow = tableEl.createEl("tr");
	createTableHeaderCells(headerRow, ["Tag", "Frequency", "Degree", "Bridge score", "Example notes"]);

	for (const row of rows) {
		const rowEl = tableEl.createEl("tr");
		rowEl.createEl("td", { text: row.label });
		rowEl.createEl("td", { text: row.frequency.toString() });
		rowEl.createEl("td", { text: row.degree.toString() });
		rowEl.createEl("td", { text: formatNumber(row.bridgeScore) });
		const notesCellEl = rowEl.createEl("td", { cls: "diary-stats-example-note-cell" });
		renderInternalLinkList(notesCellEl, linkContext, row.examplePaths);
	}
}

function renderRegimeShiftExamplesTable(
	containerEl: HTMLElement,
	rows: DiaryAnalysisResult["advancedMetrics"]["structuralExamples"]["regimeShifts"],
	linkContext: InternalLinkRenderContext,
): void {
	createTextElementWithTooltip(containerEl, "h4", "Regime shift example notes");
	if (rows.length === 0) {
		containerEl.createEl("p", {
			text: "No regime-shift examples were available yet.",
			cls: "diary-stats-muted",
		});
		return;
	}

	const tableEl = containerEl.createEl("table", { cls: "diary-stats-table" });
	const headerRow = tableEl.createEl("tr");
	createTableHeaderCells(headerRow, ["From", "To", "Score", "From-year notes", "To-year notes"]);

	for (const row of rows) {
		const rowEl = tableEl.createEl("tr");
		rowEl.createEl("td", { text: row.fromYear.toString() });
		rowEl.createEl("td", { text: row.toYear.toString() });
		rowEl.createEl("td", { text: formatNumber(row.score) });
		const fromCellEl = rowEl.createEl("td", { cls: "diary-stats-example-note-cell" });
		renderInternalLinkList(fromCellEl, linkContext, row.fromPaths);
		const toCellEl = rowEl.createEl("td", { cls: "diary-stats-example-note-cell" });
		renderInternalLinkList(toCellEl, linkContext, row.toPaths);
	}
}

function renderSimpleAdvancedTable(
	containerEl: HTMLElement,
	title: string,
	headers: string[],
	rows: string[][],
	emptyMessage: string,
	totalRowCount = rows.length,
): void {
	createTextElementWithTooltip(containerEl, "h4", title);

	if (rows.length === 0) {
		containerEl.createEl("p", {
			text: emptyMessage,
			cls: "diary-stats-muted",
		});
		return;
	}

	if (rows.length < totalRowCount) {
		containerEl.createEl("p", {
			text: `Showing the first ${rows.length} rows. Set the relevant row limit to 0 to show all.`,
			cls: "diary-stats-muted",
		});
	}

	const tableEl = containerEl.createEl("table", { cls: "diary-stats-table" });
	const headerRow = tableEl.createEl("tr");
	createTableHeaderCells(headerRow, headers);

	for (const row of rows) {
		const rowEl = tableEl.createEl("tr");
		for (const value of row) {
			rowEl.createEl("td", { text: value });
		}
	}
}

function formatEntityCandidateMetric(
	row: DiaryAnalysisResult["advancedMetrics"]["bodyText"]["czechNormalized"]["entities"]["mostPersistentCandidate"],
	mode: "support" | "newest" | "span" | "bridge",
): string {
	if (!row) {
		return "(none)";
	}

	if (mode === "support") {
		return `${row.label} (${row.supportEntries} entries)`;
	}

	if (mode === "newest") {
		return `${row.label} (first ${row.firstYear})`;
	}

	if (mode === "span") {
		return `${row.label} (${row.firstYear}-${row.lastYear})`;
	}

	return `${row.label} (${formatNumber(row.bridgeScore)})`;
}

function formatEntityPairMetric(
	row: DiaryAnalysisResult["advancedMetrics"]["bodyText"]["czechNormalized"]["entities"]["strongestPair"],
): string {
	if (!row) {
		return "(none)";
	}

	return `${row.leftLabel} + ${row.rightLabel} (${row.supportEntries} entries)`;
}

function renderRecordTable(
	containerEl: HTMLElement,
	rows: DiaryAnalysisResult["records"]["sections"][number]["rows"],
	linkContext: InternalLinkRenderContext,
): void {
	if (rows.length === 0) {
		containerEl.createEl("p", {
			text: "No qualifying notes were available for this record table.",
			cls: "diary-stats-muted",
		});
		return;
	}

	const tableEl = containerEl.createEl("table", { cls: "diary-stats-table" });
	const headerRow = tableEl.createEl("tr");
	createTableHeaderCells(headerRow, ["Note", "Value", "Detail"]);

	for (const row of rows) {
		const rowEl = tableEl.createEl("tr");
		const noteCellEl = rowEl.createEl("td");
		renderInternalNoteLink(noteCellEl, linkContext, row.path);
		rowEl.createEl("td", { text: row.valueLabel });
		rowEl.createEl("td", { text: row.detailLabel });
	}
}

function resolveStructuralExampleLimit(value: number): number {
	return value > 0 ? value : 0;
}

function resolveConfiguredRowLimit(overrideValue: number | null, defaultValue: number, totalRows: number): number {
	return resolveTagRowLimit(overrideValue ?? defaultValue, totalRows);
}

function compareSortableValues(
	leftValue: number | string | null,
	rightValue: number | string | null,
	direction: SortDirection,
): number {
	if (leftValue === rightValue) {
		return 0;
	}

	if (leftValue === null) {
		return 1;
	}

	if (rightValue === null) {
		return -1;
	}

	if (typeof leftValue === "number" && typeof rightValue === "number") {
		return direction === "asc" ? leftValue - rightValue : rightValue - leftValue;
	}

	const comparison = String(leftValue).localeCompare(String(rightValue), undefined, {
		numeric: true,
		sensitivity: "base",
	});
	return direction === "asc" ? comparison : comparison * -1;
}

function getVisibleRecordSections(
	sections: DiaryAnalysisResult["records"]["sections"],
	mode: RecordsMode,
): DiaryAnalysisResult["records"]["sections"] {
	if (mode === "expanded") {
		return sections;
	}

	return sections.filter((section) => SIMPLE_RECORD_SECTION_IDS.has(section.id));
}

function renderYearSection(containerEl: HTMLElement, yearSummaries: YearAggregate[]): void {
	const sectionEl = containerEl.createDiv({ cls: "diary-stats-section" });
	markDashboardSection(sectionEl, "per-year-summary", "Per-year summary");
	createTextElementWithTooltip(sectionEl, "h3", "Per-year summary");

	if (yearSummaries.length === 0) {
		sectionEl.createEl("p", {
			text: "No years could be resolved from the created date data yet.",
		});
		return;
	}

	const tableEl = sectionEl.createEl("table", { cls: "diary-stats-table" });
	const headerRow = tableEl.createEl("tr");
	createTableHeaderCells(headerRow, ["Year", "Entries", "Words", "Reading time", "Created fallback", "Updated fallback"]);

	for (const summary of yearSummaries) {
		const rowEl = tableEl.createEl("tr");
		rowEl.createEl("td", { text: summary.year.toString() });
		rowEl.createEl("td", { text: summary.entryCount.toString() });
		rowEl.createEl("td", { text: summary.wordCount.toString() });
		rowEl.createEl("td", { text: summary.readingTimeLabel });
		rowEl.createEl("td", { text: summary.createdFallbackCount.toString() });
		rowEl.createEl("td", { text: summary.updatedFallbackCount.toString() });
	}
}

function renderScopeSection(containerEl: HTMLElement, result: DiaryAnalysisResult): void {
	const sectionEl = containerEl.createDiv({ cls: "diary-stats-section" });
	markDashboardSection(sectionEl, "scope", "Scope");
	createTextElementWithTooltip(sectionEl, "h3", "Scope");

	renderMetricGrid(sectionEl, [
		{
			label: "Folder mode",
			value: formatScopeMode(result.scope.appliedScopeMode),
			tooltip: "Whether the configured folders are the only eligible folders, or are the folders to skip.",
		},
		{
			label: "Configured folders",
			value: result.scope.appliedScopeFolders.length.toString(),
			tooltip: "How many folder paths are currently listed in the scope settings.",
		},
		{
			label: "Matched files",
			value: result.scope.matchedFileCount.toString(),
			tooltip: "How many markdown files survived all scope, ignore, and hidden-folder checks.",
		},
		{
			label: "Ignored by scope",
			value: result.scope.ignoredByScope.toString(),
			tooltip: "Files excluded because they did not satisfy the include or exclude folder rule.",
		},
		{
			label: "Ignored by folder rules",
			value: result.scope.ignoredByFolderRules.toString(),
			tooltip: "Files excluded by the ignored-folder-rule list such as Resources or attachments.",
		},
		{
			label: "Ignored by hidden folders",
			value: result.scope.ignoredByHiddenFolders.toString(),
			tooltip: "Files skipped because they live inside dotfolders and the hidden-folder rule is enabled.",
		},
	]);

	sectionEl.createEl("p", { text: result.scope.scopeInterpretation });
	sectionEl.createEl("p", {
		text: `Scope folders: ${formatPathList(result.scope.appliedScopeFolders)}`,
		cls: "diary-stats-muted",
	});
	sectionEl.createEl("p", {
		text: `Ignored folder rules: ${formatPathList(result.scope.ignoreFolderRules)}`,
		cls: "diary-stats-muted",
	});
}

function renderDateQualitySection(
	containerEl: HTMLElement,
	result: DiaryAnalysisResult,
	view: DiaryStatsResultsView,
): void {
	const sectionEl = containerEl.createDiv({ cls: "diary-stats-section" });
	markDashboardSection(sectionEl, "date-quality", "Date quality");
	createTextElementWithTooltip(sectionEl, "h3", "Date quality");
	sectionEl.createEl("p", {
		text: "Chronology, revision, and year-based patterns depend on these resolved timestamps, so fallback use should be read carefully.",
		cls: "diary-stats-section-lead",
	});

	renderMetricGrid(sectionEl, [
		{
			label: "Created key missing",
			value: result.aggregate.missingCreatedFrontmatterCount.toString(),
			tooltip: "Entries where the configured created-date frontmatter key was not present.",
		},
		{
			label: "Created key invalid",
			value: result.aggregate.invalidCreatedFrontmatterCount.toString(),
			tooltip: "Entries where the created-date key existed but the value could not be parsed.",
		},
		{
			label: "Updated key missing",
			value: result.aggregate.missingUpdatedFrontmatterCount.toString(),
			tooltip: "Entries where the configured updated-date frontmatter key was not present.",
		},
		{
			label: "Updated key invalid",
			value: result.aggregate.invalidUpdatedFrontmatterCount.toString(),
			tooltip: "Entries where the updated-date key existed but the value could not be parsed.",
		},
		{
			label: "Unresolved chronology",
			value: result.aggregate.unresolvedChronologyCount.toString(),
			tooltip: "Entries that still could not be assigned to a chronology year even after fallback handling.",
		},
		{
			label: "Date issues listed",
			value: result.dateIssues.length.toString(),
			tooltip: "How many files appear in the missing-or-invalid frontmatter date report below.",
		},
	]);

	sectionEl.createEl("p", {
		text: "Filesystem fallback means a frontmatter date was missing or invalid. Those entries remain included, but they should be interpreted cautiously.",
	});

	const issuesDetailsEl = view.createPersistentDetails(
		sectionEl,
		"date-quality-issues",
		"Files with missing or invalid frontmatter dates",
	);

	if (result.dateIssues.length === 0) {
		issuesDetailsEl.createEl("p", {
			text: "No missing or invalid created/updated frontmatter dates were found in the current scope.",
		});
		return;
	}

	issuesDetailsEl.createEl("p", {
		text: `Showing the first ${Math.min(result.dateIssues.length, MAX_DISPLAYED_DATE_ISSUES)} issue rows.`,
	});
	renderDateIssueTable(issuesDetailsEl, result.dateIssues.slice(0, MAX_DISPLAYED_DATE_ISSUES));
}

function renderCacheSection(containerEl: HTMLElement, result: DiaryAnalysisResult): void {
	const sectionEl = containerEl.createDiv({ cls: "diary-stats-section" });
	markDashboardSection(sectionEl, "performance", "Performance");
	createTextElementWithTooltip(sectionEl, "h3", "Performance");
	sectionEl.createEl("p", {
		text: "These run metrics show how much work the cache saved and how expensive the last manual rebuild was.",
		cls: "diary-stats-section-lead",
	});

	renderMetricGrid(sectionEl, [
		{
			label: "Reused cached files",
			value: result.cache.reusedEntries.toString(),
			tooltip: "Files whose previously cached analysis could be reused without rereading the note.",
		},
		{
			label: "Refreshed files",
			value: result.cache.refreshedEntries.toString(),
			tooltip: "Files that had to be re-read and re-analyzed during this run.",
		},
		{
			label: "Dropped deleted files",
			value: result.cache.droppedDeletedEntries.toString(),
			tooltip: "Cache entries removed because the source file no longer exists in the vault.",
		},
		{
			label: "Current cache entries",
			value: result.cache.currentCacheEntryCount.toString(),
			tooltip: "How many per-file analysis records are currently stored in the plugin cache.",
		},
	]);

	sectionEl.createEl("p", {
		text: `Started: ${formatTimestamp(result.startedAt)} | Finished: ${formatTimestamp(result.finishedAt)}`,
		cls: "diary-stats-muted",
	});
}

function renderSamplePathsSection(
	containerEl: HTMLElement,
	samplePaths: string[],
	view: DiaryStatsResultsView,
): void {
	const sectionEl = containerEl.createDiv({ cls: "diary-stats-section" });
	markDashboardSection(sectionEl, "sample-matched-files", "Sample matched files");
	const detailsEl = view.createPersistentDetails(sectionEl, "sample-matched-files", "Sample matched files");

	if (samplePaths.length === 0) {
		detailsEl.createEl("p", {
			text: "No files matched the current scope settings.",
		});
		return;
	}

	detailsEl.createEl("p", {
		text: "The list below is capped to the first 20 matched paths so you can quickly verify scope behavior.",
	});

	const listEl = detailsEl.createEl("ol", { cls: "diary-stats-path-list" });
	for (const filePath of samplePaths) {
		listEl.createEl("li", { text: filePath });
	}
}

function renderAdvancedHeadlineCards(containerEl: HTMLElement, cards: AdvancedHeadline[]): void {
	const gridEl = containerEl.createDiv({ cls: "diary-stats-metric-grid diary-stats-advanced-headline-grid" });

	for (const card of cards) {
		const cardEl = gridEl.createDiv({ cls: "diary-stats-metric-card diary-stats-advanced-headline-card" });
		const tooltip = resolveAdvancedHeadlineCardTooltip(card);
		if (tooltip) {
			cardEl.setAttribute("title", tooltip);
		}

		cardEl.createEl("div", { text: card.label, cls: "diary-stats-metric-label" });
		cardEl.createEl("div", { text: card.value, cls: "diary-stats-metric-value" });
		cardEl.createEl("div", { text: card.detail, cls: "diary-stats-advanced-headline-detail" });
	}
}

function renderMetricGrid(containerEl: HTMLElement, rows: MetricGridRow[]): void {
	const gridEl = containerEl.createDiv({ cls: "diary-stats-metric-grid" });

	for (const row of rows) {
		const label = Array.isArray(row) ? row[0] : row.label;
		const value = Array.isArray(row) ? row[1] : row.value;
		const tooltip = Array.isArray(row) ? resolveMetricTooltip(label) : row.tooltip ?? resolveMetricTooltip(label);
		const cardEl = gridEl.createDiv({ cls: "diary-stats-metric-card" });
		if (tooltip) {
			cardEl.setAttribute("title", tooltip);
		}
		cardEl.createEl("div", { text: label, cls: "diary-stats-metric-label" });
		cardEl.createEl("div", { text: value, cls: "diary-stats-metric-value" });
	}
}

function renderWordCountDebugSection(
	containerEl: HTMLElement,
	debugResult: WordCountDebugResult,
	view: DiaryStatsResultsView,
): void {
	const debugSectionEl = containerEl.createDiv({ cls: "diary-stats-section" });
	markDashboardSection(debugSectionEl, "word-count-debug", "Active note word count debug");
	const detailsEl = view.createPersistentDetails(debugSectionEl, "word-count-debug", "Active note word count debug");

	renderMetricGrid(detailsEl, [
		{
			label: "Active note tokens",
			value: debugResult.wordCount.toString(),
			tooltip: "The exact token count produced by the current word-count cleanup logic for the active note.",
		},
		{
			label: "Active note path",
			value: debugResult.path,
			tooltip: "The vault-relative path of the note currently shown in the debug section.",
		},
	]);

	detailsEl.createEl("p", {
		text: "This section shows the exact cleaned text and token list used by the current word-count logic for the active note.",
	});

	const cleanedDetailsEl = view.createPersistentDetails(detailsEl, "word-count-debug-cleaned-text", "Cleaned text");
	cleanedDetailsEl.createEl("pre", {
		text: debugResult.cleanedText.length > 0 ? debugResult.cleanedText : "(empty after cleanup)",
		cls: "diary-stats-debug-pre",
	});

	const tokenDetailsEl = view.createPersistentDetails(
		detailsEl,
		"word-count-debug-tokens",
		`Tokens (${debugResult.tokens.length})`,
	);

	if (debugResult.tokens.length === 0) {
		tokenDetailsEl.createEl("p", { text: "No tokens were counted." });
		return;
	}

	const listEl = tokenDetailsEl.createEl("ol", { cls: "diary-stats-token-list" });
	for (const token of debugResult.tokens) {
		listEl.createEl("li", { text: token });
	}
}

function renderDateIssueTable(containerEl: HTMLElement, issues: DateIssueReportEntry[]): void {
	const tableEl = containerEl.createEl("table", { cls: "diary-stats-table diary-stats-issues-table" });
	const headerRow = tableEl.createEl("tr");
	createTableHeaderCells(headerRow, ["Path", "Created issue", "Created source", "Updated issue", "Updated source"]);

	for (const issue of issues) {
		const rowEl = tableEl.createEl("tr");
		rowEl.createEl("td", { text: issue.path });
		rowEl.createEl("td", { text: formatIssue(issue.createdAtIssue, issue.resolvedCreatedAt) });
		rowEl.createEl("td", { text: issue.createdAtSource });
		rowEl.createEl("td", { text: formatIssue(issue.updatedAtIssue, issue.resolvedUpdatedAt) });
		rowEl.createEl("td", { text: issue.updatedAtSource });
	}
}

function formatIssue(issue: DateIssueReportEntry["createdAtIssue"], resolvedValue: string | null): string {
	if (!issue) {
		return "OK";
	}

	if (resolvedValue) {
		return `${issue} -> ${resolvedValue}`;
	}

	return issue;
}

function formatPathList(paths: string[]): string {
	return paths.length > 0 ? paths.join(", ") : "(none)";
}

function formatTimestamp(value: string): string {
	return new Date(value).toLocaleString();
}

function formatYearList(years: number[]): string {
	return years.length > 0 ? years.join(", ") : "(none)";
}

function formatNumber(value: number): string {
	return Number.isInteger(value) ? value.toString() : value.toFixed(1);
}

function formatSignedNumber(value: number): string {
	const formatted = formatNumber(Math.abs(value));
	if (value > 0) {
		return `+${formatted}`;
	}

	if (value < 0) {
		return `-${formatted}`;
	}

	return "0";
}

function formatShareLabel(label: string, share: number): string {
	return `${label} (${Math.round(share * 100)}%)`;
}

function removeSearchHighlights(rootEl: HTMLElement): void {
	const highlightElements = Array.from(rootEl.querySelectorAll<HTMLElement>("mark.diary-stats-search-highlight"));
	for (const highlightEl of highlightElements) {
		const parentNode = highlightEl.parentNode;
		if (!parentNode) {
			continue;
		}

		parentNode.replaceChild(document.createTextNode(highlightEl.textContent ?? ""), highlightEl);
		parentNode.normalize();
	}
}

function normalizeSearchText(value: string): string {
	return value.trim().toLocaleLowerCase();
}

function matchesSearchText(element: HTMLElement, query: string): boolean {
	const metadataParts = [
		element.dataset.searchText ?? "",
		...Array.from(element.querySelectorAll<HTMLElement>("[data-search-text]")).map(
			(descendant) => descendant.dataset.searchText ?? "",
		),
	];
	const searchableText = [element.textContent ?? "", ...metadataParts].join(" ");
	return normalizeSearchText(searchableText).includes(query);
}

function toggleSearchHidden(element: HTMLElement, shouldHide: boolean): void {
	element.classList.toggle("diary-stats-hidden-by-search", shouldHide);
}

function applySearchHighlights(rootEl: HTMLElement, query: string): HTMLElement[] {
	if (query.length === 0) {
		return [];
	}

	const textNodes: Text[] = [];
	const walker = document.createTreeWalker(
		rootEl,
		NodeFilter.SHOW_TEXT,
		{
			acceptNode: (node) => acceptSearchHighlightTextNode(node as Text, query),
		},
	);

	let currentNode = walker.nextNode();
	while (currentNode) {
		textNodes.push(currentNode as Text);
		currentNode = walker.nextNode();
	}

	for (const textNode of textNodes) {
		const highlightedFragment = buildSearchHighlightFragment(textNode.textContent ?? "", query);
		if (!highlightedFragment || !textNode.parentNode) {
			continue;
		}

		textNode.parentNode.replaceChild(highlightedFragment, textNode);
	}

	return Array.from(rootEl.querySelectorAll<HTMLElement>("mark.diary-stats-search-highlight"));
}

function acceptSearchHighlightTextNode(node: Text, query: string): number {
	const parentEl = node.parentElement;
	if (!parentEl) {
		return NodeFilter.FILTER_REJECT;
	}

	if (
		parentEl.closest(".diary-stats-search-bar") ||
		parentEl.closest(".diary-stats-search-empty-state") ||
		parentEl.closest(".diary-stats-hidden-by-search") ||
		parentEl.closest("mark.diary-stats-search-highlight")
	) {
		return NodeFilter.FILTER_REJECT;
	}

	const text = node.textContent ?? "";
	if (text.trim().length === 0) {
		return NodeFilter.FILTER_REJECT;
	}

	return normalizeSearchText(text).includes(query) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
}

function buildSearchHighlightFragment(text: string, query: string): DocumentFragment | null {
	const normalizedText = normalizeSearchText(text);
	let matchIndex = normalizedText.indexOf(query);
	if (matchIndex < 0) {
		return null;
	}

	const fragment = document.createDocumentFragment();
	let cursor = 0;
	while (matchIndex >= 0) {
		if (matchIndex > cursor) {
			fragment.append(text.slice(cursor, matchIndex));
		}

		const highlightEl = document.createElement("mark");
		highlightEl.addClass("diary-stats-search-highlight");
		highlightEl.textContent = text.slice(matchIndex, matchIndex + query.length);
		fragment.append(highlightEl);

		cursor = matchIndex + query.length;
		matchIndex = normalizedText.indexOf(query, cursor);
	}

	if (cursor < text.length) {
		fragment.append(text.slice(cursor));
	}

	return fragment;
}

function formatTopShareLabels(
	primaryLabel: string,
	primaryShare: number,
	secondaryLabel: string | null,
	secondaryShare: number,
): string {
	const labels: string[] = [];

	if (primaryShare > 0 && primaryLabel !== "(none)") {
		labels.push(formatShareLabel(primaryLabel, primaryShare));
	}

	if (secondaryLabel && secondaryShare > 0) {
		labels.push(formatShareLabel(secondaryLabel, secondaryShare));
	}

	return labels.length > 0 ? labels.join(" | ") : "(none)";
}

function formatPercent(value: number): string {
	return `${Math.round(value * 100)}%`;
}

function formatDays(value: number): string {
	return `${formatNumber(value)} d`;
}

function formatOptionalDays(value: number | null): string {
	return value === null ? "(none)" : formatDays(value);
}

function formatOptionalNumber(value: number | null): string {
	return value === null ? "(none)" : formatNumber(value);
}

function formatOpeningSignature(value: DiaryAnalysisResult["advancedMetrics"]["bodyText"]["dominantOpeningSignature"]): string {
	return value ?? "(none)";
}

function formatBodyTextTagProfile(value: DiaryAnalysisResult["advancedMetrics"]["bodyText"]["richestTag"]): string {
	return value ? `${value.label} (${value.support})` : "(none)";
}

function formatMonthClimate(value: DiaryAnalysisResult["advancedMetrics"]["bodyText"]["longestSentenceMonth"]): string {
	return value ? `${value.monthLabel} (${formatOptionalNumber(value.averageSentenceLength)})` : "(none)";
}

function formatWritingStreak(value: DiaryAnalysisResult["extraMetrics"]["longestWritingStreak"]): string {
	return value ? `${value.dayCount} d (${value.startDate} -> ${value.endDate})` : "(none)";
}

function formatMonthLengthProfilePoint(value: DiaryAnalysisResult["extraMetrics"]["mostVerboseMonth"]): string {
	return value ? `${value.monthLabel} (${formatNumber(value.averageWords)} words)` : "(none)";
}

function formatHourlyActivityPoint(value: DiaryAnalysisResult["extraMetrics"]["mostActiveHour"]): string {
	return value ? `${value.hour.toString().padStart(2, "0")}:00 (${value.entryCount} entries)` : "(none)";
}

function formatOpeningShift(value: DiaryAnalysisResult["advancedMetrics"]["bodyText"]["sharpestOpeningShift"]): string {
	return value ? `${value.fromYear} -> ${value.toYear} (${formatNumber(value.score)})` : "(none)";
}

function formatTagInterval(value: DiaryAnalysisResult["advancedMetrics"]["tagStructure"]["fastestReturningTag"]): string {
	return value ? `${value.label} (${formatNumber(value.averageGapDays)} d)` : "(none)";
}

function formatTagPersistence(
	value: DiaryAnalysisResult["advancedMetrics"]["tagStructure"]["mostPersistentTag"],
): string {
	return value ? `${value.label} (${value.consecutiveRunYears}/${value.lifespanYears} y)` : "(none)";
}

function formatTagCoupling(
	value: DiaryAnalysisResult["advancedMetrics"]["tagStructure"]["strongestPositiveCoupling"],
): string {
	return value ? `${value.label} (${formatSignedNumber(value.averageWordDelta)})` : "(none)";
}

function formatCombinationMode(value: DiaryAnalysisResult["tagAnalysis"]["combinationMode"]): string {
	switch (value) {
		case "single-pairs":
			return "Single tags and pairs";
		case "single-pairs-triplets":
			return "Single tags, pairs, and triplets";
		case "single":
		default:
			return "Single tags only";
	}
}

function formatScopeMode(value: DiaryAnalysisResult["scope"]["appliedScopeMode"]): string {
	return value === "include" ? "Only configured folders" : "Everything except configured folders";
}

function formatYearFilterSummary(includedYears: number[], excludedYears: number[]): string {
	if (includedYears.length === 0 && excludedYears.length === 0) {
		return "None";
	}

	const parts: string[] = [];
	if (includedYears.length > 0) {
		parts.push(`include ${includedYears.join(", ")}`);
	}
	if (excludedYears.length > 0) {
		parts.push(`exclude ${excludedYears.join(", ")}`);
	}

	return parts.join(" | ");
}

function resolveTagRowLimit(configuredLimit: number, totalRows: number): number {
	if (configuredLimit <= 0) {
		return totalRows;
	}

	return Math.min(configuredLimit, totalRows);
}
