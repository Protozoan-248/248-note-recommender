import type { DiaryAnalysisResult, PerYearTagAnalysisSection, RecordsMode, TagAnalysisSection } from "../types";
import { formatTagMetricScopeSummary } from "../analysis/tag-scope";

const MAX_MARKDOWN_OVERALL_TAG_ROWS = 20;
const MAX_MARKDOWN_PER_YEAR_TAG_ROWS = 10;
const MAX_MARKDOWN_PAIR_ROWS = 5;
const MAX_MARKDOWN_REGIME_SHIFT_ROWS = 5;
const MAX_MARKDOWN_DATE_ISSUES = 10;
const SIMPLE_MARKDOWN_RECORD_SECTION_IDS = new Set([
	"longest-notes",
	"shortest-notes",
	"most-tags",
	"longest-revision-lags",
	"highest-lexical-richness",
]);

export interface MarkdownReportOptions {
	includeStructuralExamples: boolean;
	structuralExamplesLimit: number;
	recurringPhraseDisplayLimit: number;
	periodSignatureDisplayLimit: number;
	entityDisplayLimit: number;
	recordsDisplayLimit: number;
	recordsMode: RecordsMode;
}

export function buildMarkdownReport(
	result: DiaryAnalysisResult,
	options: MarkdownReportOptions = {
		includeStructuralExamples: false,
		structuralExamplesLimit: 0,
		recurringPhraseDisplayLimit: 5,
		periodSignatureDisplayLimit: 10,
		entityDisplayLimit: 10,
		recordsDisplayLimit: 20,
		recordsMode: "simple",
	},
): string {
	const lines: string[] = [];

	lines.push("# Diary statistics report");
	lines.push("");

	appendCallout(lines, "summary", "Snapshot", [
		`- **Generated:** ${new Date(result.finishedAt).toLocaleString()}`,
		`- **Entries:** ${result.aggregate.totalEntries}`,
		`- **Words:** ${result.aggregate.totalWords}`,
		`- **Years written:** ${formatYearList(result.aggregate.yearsWritten)}`,
		`- **Read whole diary:** ${result.aggregate.totalReadingTimeLabel}`,
		`- **Analysis duration:** ${result.durationLabel}`,
	]);

	if (result.aggregate.entriesWithCreatedFallback > 0 || result.aggregate.entriesWithUpdatedFallback > 0) {
		appendCallout(lines, "warning", "Fallback dates used", [
			`- **Created fallback:** ${result.aggregate.entriesWithCreatedFallback}`,
			`- **Updated fallback:** ${result.aggregate.entriesWithUpdatedFallback}`,
			"- These entries remain included, but any chronology or revision interpretation should be treated cautiously.",
		]);
	}

	lines.push("## Overview");
	lines.push("");
	appendMetricTable(lines, [
		["Years written", formatYearList(result.aggregate.yearsWritten)],
		["Total entries", result.aggregate.totalEntries.toString()],
		["Total words", result.aggregate.totalWords.toString()],
		["Mean words per entry", formatNumber(result.aggregate.averageWordsPerEntry)],
		["Median words per entry", formatNumber(result.aggregate.medianWordsPerEntry)],
		["Read whole diary", result.aggregate.totalReadingTimeLabel],
		[
			"Average-length entry",
			`${result.aggregate.averageEntryReadingTimeLabel} (${formatNumber(result.aggregate.selectedAverageEntryWords)} words, ${result.aggregate.selectedAverageEntryMethod})`,
		],
		["Reading speed", `${result.aggregate.readingWordsPerMinute} words per minute`],
	]);
	lines.push("");

	lines.push("### Per-year summary");
	lines.push("");
	appendMarkdownTable(
		lines,
		["Year", "Entries", "Words", "Reading time", "Created fallback", "Updated fallback"],
		result.aggregate.yearSummaries.length > 0
			? result.aggregate.yearSummaries.map((yearSummary) => [
					yearSummary.year.toString(),
					yearSummary.entryCount.toString(),
					yearSummary.wordCount.toString(),
					yearSummary.readingTimeLabel,
					yearSummary.createdFallbackCount.toString(),
					yearSummary.updatedFallbackCount.toString(),
			  ])
			: [["(none)", "0", "0", "0 min", "0", "0"]],
		["left", "right", "right", "left", "right", "right"],
	);
	lines.push("");

	lines.push("## Scope");
	lines.push("");
	appendMetricTable(lines, [
		["Folder mode", result.scope.appliedScopeMode],
		["Scope folders", formatPathList(result.scope.appliedScopeFolders)],
		["Include subfolders", result.scope.includeSubfolders ? "Yes" : "No"],
		["Ignore hidden folders", result.scope.ignoreHiddenFolders ? "Yes" : "No"],
		["Ignored folder rules", formatPathList(result.scope.ignoreFolderRules)],
		["Matched markdown files", result.scope.matchedFileCount.toString()],
		["Ignored by scope", result.scope.ignoredByScope.toString()],
		["Ignored by folder rules", result.scope.ignoredByFolderRules.toString()],
		["Ignored by hidden folders", result.scope.ignoredByHiddenFolders.toString()],
	]);
	lines.push("");
	appendBlockQuote(lines, [result.scope.scopeInterpretation]);
	lines.push("");

	appendTagAnalyticsSection(lines, result);
	appendStructuralPatternsSection(lines, result, options);
	appendRecordsSection(lines, result, options);
	appendExtraMetricsSection(lines, result);
	appendDateQualitySection(lines, result);
	appendRunAndCacheSection(lines, result);

	return lines.join("\n");
}

function appendTagAnalyticsSection(lines: string[], result: DiaryAnalysisResult): void {
	lines.push("## Tag analytics");
	lines.push("");

	appendCallout(lines, "info", "Tag analysis basis", [
		"- Frontmatter tags only.",
		"- Case-insensitive normalization plus alias and ignore rules.",
		`- Time scope: ${formatTagMetricScopeSummary({
			tagMetricTimeScope: result.tagAnalysis.timeScopeMode,
			tagMetricFromYear: result.tagAnalysis.timeScopeFromYear,
			tagMetricToYear: result.tagAnalysis.timeScopeToYear,
		})}`,
		`- Additional year filters: ${formatYearFilterSummary(result.tagAnalysis.includedYears, result.tagAnalysis.excludedYears)}`,
	]);
	appendCollapsedCallout(lines, "help", "How to read tag analytics", [
		"→ Measures: how normalized frontmatter tags relate to note length and temporal placement.",
		"• Mean delta vs baseline: tagged-note average words minus the overall average words in the current filtered set.",
		"• Median delta vs baseline: tagged-note median words minus the overall median words in the current filtered set.",
		"• Most common weekday: shows the strongest weekday share and, when relevant, the second strongest share.",
		"→ Example: `Monday (50%) / Sunday (50%)` means the tag is evenly split across those weekdays in the current filtered set.",
	]);

	appendMetricTable(lines, [
		["Minimum frequency", result.tagAnalysis.minimumFrequency.toString()],
		["Combination depth", formatCombinationMode(result.tagAnalysis.combinationMode)],
		["Hierarchy mode", result.tagAnalysis.hierarchicalTagMode],
		[
			"Tag metric time scope",
			result.tagAnalysis.timeScopeMode === "year-range" ? "Restrict to year range" : "All eligible years",
		],
		[
			"Tag metric range",
			formatTagMetricScopeSummary({
				tagMetricTimeScope: result.tagAnalysis.timeScopeMode,
				tagMetricFromYear: result.tagAnalysis.timeScopeFromYear,
				tagMetricToYear: result.tagAnalysis.timeScopeToYear,
			}),
		],
		["Additional year filters", formatYearFilterSummary(result.tagAnalysis.includedYears, result.tagAnalysis.excludedYears)],
		["Alias rules", result.tagAnalysis.aliasCount.toString()],
		["Ignored tags", result.tagAnalysis.ignoredTagCount.toString()],
		["Mean tags per note", formatNumber(result.tagAnalysis.meanTagsPerNote)],
		["Median tags per note", formatNumber(result.tagAnalysis.medianTagsPerNote)],
	]);
	lines.push("");

	if (result.tagAnalysis.overall) {
		lines.push("### All years combined");
		lines.push("");
		appendTagTable(lines, result.tagAnalysis.overall, MAX_MARKDOWN_OVERALL_TAG_ROWS, "Most common month/year");
		lines.push("");
	} else if (result.tagAnalysis.combinedEnabled) {
		appendCallout(lines, "note", "All years combined", [
			"No tags or tag combinations reached the current threshold.",
		]);
	} else {
		appendCallout(lines, "note", "All years combined", ["Combined tag analysis is disabled in Settings."]);
	}

	if (result.tagAnalysis.perYearEnabled) {
		appendPerYearTagTables(lines, result.tagAnalysis.perYear);
	} else {
		appendCallout(lines, "note", "Per-year tag analytics", ["Per-year tag analysis is disabled in Settings."]);
	}
}

function appendStructuralPatternsSection(
	lines: string[],
	result: DiaryAnalysisResult,
	options: MarkdownReportOptions,
): void {
	lines.push("## Structural patterns");
	lines.push("");

	appendCallout(lines, "tip", "How to read this section", [
		"- Headline findings are quick orientation points, not absolute judgments.",
		"- Advanced scores are comparative signals inside this corpus.",
		"- Body-text metrics remain lightweight and heuristic rather than NLP-heavy.",
	]);
	appendCollapsedCallout(lines, "help", "How to read structural patterns", [
		"→ Measures: the latent rhythm, concentration, revision, tag, and text-aware structure of the diary corpus.",
		"• Compare values inside this corpus first: many advanced metrics are relative rather than absolute.",
		"• Year profiles help you locate where a pattern becomes strongest, weakest, or begins to drift.",
		"• Headline findings are entry points; the tables below provide the stronger evidence.",
		"→ Example: a year can be the `most bursty year` even when its value is still only moderately bursty in absolute terms.",
	]);

	appendCallout(
		lines,
		"abstract",
		"Headline findings",
		result.advancedMetrics.headlineCards.map(
			(headline) => `- **${headline.label}:** ${headline.value}. ${headline.detail}`,
		),
	);

	lines.push("### Overall advanced metrics");
	lines.push("");
	appendMetricTable(lines, [
		["Burstiness index", formatNumber(result.advancedMetrics.temporalRhythm.burstinessIndex)],
		["Longest silence gap", `${formatNumber(result.advancedMetrics.temporalRhythm.longestSilenceGapDays)} d`],
		["Weekday bias stability", formatPercent(result.advancedMetrics.temporalRhythm.weekdayBiasStability)],
		["Seasonal asymmetry", formatNumber(result.advancedMetrics.temporalRhythm.seasonalAsymmetry)],
		["Length skewness", formatNumber(result.advancedMetrics.volumeStructure.lengthSkewness)],
		["Tail heaviness", formatNumber(result.advancedMetrics.volumeStructure.tailHeaviness)],
		["Compression vs expansion", formatNumber(result.advancedMetrics.volumeStructure.compressionExpansionRatio)],
		["Revisit ratio", formatPercent(result.advancedMetrics.revisionStructure.revisitRatio)],
		["Revision half-life", `${formatNumber(result.advancedMetrics.revisionStructure.revisionHalfLifeDays)} d`],
		["Revision-weighted words index", formatNumber(result.advancedMetrics.revisionStructure.revisionWeightedWordsIndex)],
		["Tag entropy", formatNumber(result.advancedMetrics.tagStructure.overallEntropy)],
		["Tag concentration", formatNumber(result.advancedMetrics.tagStructure.overallConcentration)],
		["Cadence vs note depth", formatOptionalNumber(result.advancedMetrics.hiddenStructure.cadenceDepthCorrelation)],
		["Revision vs final length", formatOptionalNumber(result.advancedMetrics.hiddenStructure.revisionLengthCorrelation)],
		["Predominant productivity mode", result.advancedMetrics.hiddenStructure.predominantMode ?? "(none)"],
		["Body-text entries", result.advancedMetrics.bodyText.enabled ? result.advancedMetrics.bodyText.analyzedEntryCount.toString() : "Disabled"],
		[
			"Overall lexical richness",
			result.advancedMetrics.bodyText.enabled
				? formatOptionalNumber(result.advancedMetrics.bodyText.overallLexicalRichness)
				: "Disabled",
		],
		[
			"Dominant opening style",
			result.advancedMetrics.bodyText.enabled
				? formatOpeningSignature(result.advancedMetrics.bodyText.dominantOpeningSignature)
				: "Disabled",
		],
	]);
	lines.push("");

	lines.push("### Year profiles");
	lines.push("");
	appendMarkdownTable(
		lines,
		["Year", "Entries", "Avg words", "Burstiness", "Concentration", "Revisit ratio", "Tag entropy", "Mode", "Shift from previous"],
		result.advancedMetrics.yearProfiles.length > 0
			? result.advancedMetrics.yearProfiles.map((profile) => [
					profile.year.toString(),
					profile.entryCount.toString(),
					formatNumber(profile.averageWords),
					formatNumber(profile.burstinessIndex),
					formatNumber(profile.writingConcentrationIndex),
					formatPercent(profile.revisitRatio),
					formatOptionalNumber(profile.tagEntropy),
					profile.productivityMode,
					formatOptionalNumber(profile.regimeShiftFromPrevious),
			  ])
			: [["(none)", "0", "0", "0", "0", "0%", "(none)", "(none)", "(none)"]],
		["right", "right", "right", "right", "right", "right", "right", "left", "right"],
	);
	lines.push("");

	lines.push("### Tag structures");
	lines.push("");
	appendMetricTable(lines, [
		["Fastest-returning tag", formatTagInterval(result.advancedMetrics.tagStructure.fastestReturningTag)],
		["Most persistent tag", formatTagPersistence(result.advancedMetrics.tagStructure.mostPersistentTag)],
		["Longest-lived tag", formatTagPersistence(result.advancedMetrics.tagStructure.longestLifespanTag)],
		["Strongest positive tag-length coupling", formatTagCoupling(result.advancedMetrics.tagStructure.strongestPositiveCoupling)],
		["Strongest negative tag-length coupling", formatTagCoupling(result.advancedMetrics.tagStructure.strongestNegativeCoupling)],
	]);
	lines.push("");
	appendMarkdownTable(
		lines,
		["Pair", "Support", "Lift"],
		result.advancedMetrics.tagStructure.topPairLifts.length > 0
			? result.advancedMetrics.tagStructure.topPairLifts.slice(0, MAX_MARKDOWN_PAIR_ROWS).map((pair) => [
					pair.label,
					pair.support.toString(),
					formatNumber(pair.lift),
			  ])
			: [["(none)", "0", "(none)"]],
		["left", "right", "right"],
	);
	lines.push("");

	lines.push("### Text-aware patterns");
	lines.push("");
	appendBodyTextSection(lines, result, options);
	lines.push("");

	lines.push("### Hidden structures");
	lines.push("");
	appendCollapsedCallout(lines, "help", "How to read hidden structures", [
		"→ Measures: composite structural shifts that combine multiple weaker signals into more interpretable findings.",
		"• Regime shifts compare neighboring years and combine tag, text, volume, revision, and cadence change.",
		"• Productivity modes are rule-based summaries, not machine-learning clusters.",
		"• These findings are best treated as prompts for interpretation, not hard proof on their own.",
		"→ Example: a sharp regime shift means the target year differs strongly from the previous year across several signals at once.",
	]);
	if (result.advancedMetrics.hiddenStructure.structuralReadings.length > 0) {
		appendCallout(
			lines,
			"abstract",
			"Structural readings",
			result.advancedMetrics.hiddenStructure.structuralReadings.map(
				(reading) => `- **${reading.label}:** ${reading.value}. ${reading.detail}`,
			),
		);
	}
	appendAdvancedRegimeShiftTable(lines, result);
	lines.push("");

	if (options.includeStructuralExamples && options.structuralExamplesLimit > 0) {
		appendStructuralExamplesSection(lines, result, options.structuralExamplesLimit);
		lines.push("");
	}

	appendStructuralGlossarySection(lines, result.advancedMetrics.bodyText.enabled);
	lines.push("");
}

function appendDateQualitySection(lines: string[], result: DiaryAnalysisResult): void {
	lines.push("## Date quality");
	lines.push("");

	appendCallout(lines, "warning", "Interpretation caveat", [
		"- Filesystem fallback means the configured frontmatter date was missing or invalid.",
		"- These entries remain included, but chronology and revision interpretations should be treated cautiously.",
	]);

	appendMetricTable(lines, [
		["Created key missing", result.aggregate.missingCreatedFrontmatterCount.toString()],
		["Created key invalid", result.aggregate.invalidCreatedFrontmatterCount.toString()],
		["Updated key missing", result.aggregate.missingUpdatedFrontmatterCount.toString()],
		["Updated key invalid", result.aggregate.invalidUpdatedFrontmatterCount.toString()],
		["Entries using created fallback", result.aggregate.entriesWithCreatedFallback.toString()],
		["Entries using updated fallback", result.aggregate.entriesWithUpdatedFallback.toString()],
		["Unresolved chronology", result.aggregate.unresolvedChronologyCount.toString()],
	]);
	lines.push("");

	if (result.dateIssues.length > 0) {
		lines.push("### Sample date issues");
		lines.push("");
		appendMarkdownTable(
			lines,
			["Path", "Created", "Updated"],
			result.dateIssues.slice(0, MAX_MARKDOWN_DATE_ISSUES).map((issue) => [
				issue.path,
				`${issue.createdAtIssue ?? "OK"} / ${issue.createdAtSource}`,
				`${issue.updatedAtIssue ?? "OK"} / ${issue.updatedAtSource}`,
			]),
			["left", "left", "left"],
		);
		lines.push("");
		lines.push(`_Showing the first ${Math.min(result.dateIssues.length, MAX_MARKDOWN_DATE_ISSUES)} issue rows._`);
		lines.push("");
	}
}

function appendExtraMetricsSection(lines: string[], result: DiaryAnalysisResult): void {
	lines.push("## Extra metrics");
	lines.push("");

	appendCallout(lines, "info", "How to read extra metrics", [
		"- Longest writing streak counts consecutive calendar days with at least one entry.",
		"- Hour-of-day activity uses only entries whose created timestamp includes an explicit time.",
		"- Hour-of-day activity also respects the current hour metric year scope.",
		"- Tag frequency over years uses the current tag metric time scope and minimum tag frequency.",
	]);

	appendMetricTable(lines, [
		["Longest writing streak", formatWritingStreak(result.extraMetrics.longestWritingStreak)],
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
	lines.push("");

	lines.push("### Month length by calendar month");
	lines.push("");
	appendMarkdownTable(
		lines,
		["Month", "Entries", "Mean words", "Median words"],
		result.extraMetrics.monthLengthProfile.points.map((point) => [
			point.monthLabel,
			point.entryCount.toString(),
			formatNumber(point.averageWords),
			formatNumber(point.medianWords),
		]),
		["left", "right", "right", "right"],
	);
	lines.push("");

	lines.push("### Hour-of-day activity");
	lines.push("");
	if (result.extraMetrics.hourlyActivity.usableEntryCount === 0) {
		appendCallout(lines, "note", "Hour-of-day activity", [
			`No entries with explicit created-time values were available inside the active hour metric scope (${result.extraMetrics.hourMetricScopeLabel}).`,
		]);
	} else {
		appendMarkdownTable(
			lines,
			["Hour", "Entries", "Mean words"],
			result.extraMetrics.hourlyActivity.points
				.filter((point) => point.entryCount > 0)
				.map((point) => [
					`${point.hour.toString().padStart(2, "0")}:00`,
					point.entryCount.toString(),
					formatNumber(point.averageWords),
				]),
			["left", "right", "right"],
		);
	}
	lines.push("");

	lines.push("### Tag frequency over years");
	lines.push("");
	if (
		result.extraMetrics.tagFrequencyHeatmap.tags.length === 0 ||
		result.extraMetrics.tagFrequencyHeatmap.years.length === 0
	) {
		appendCallout(lines, "note", "Tag frequency over years", [
			"No tags reached the current minimum frequency inside the active tag metric time scope.",
		]);
		return;
	}

	appendMarkdownTable(
		lines,
		["Tag", ...result.extraMetrics.tagFrequencyHeatmap.years.map((year) => year.toString())],
		result.extraMetrics.tagFrequencyHeatmap.tags.map((tag, tagIndex) => [
			tag,
			...result.extraMetrics.tagFrequencyHeatmap.years.map((year) => {
				const matchingCell = result.extraMetrics.tagFrequencyHeatmap.cells.find(
					(cell) => cell.tagIndex === tagIndex && cell.year === year,
				);
				return (matchingCell?.entryCount ?? 0).toString();
			}),
		]),
		["left", ...result.extraMetrics.tagFrequencyHeatmap.years.map(() => "right" as const)],
	);
	lines.push("");
}

function appendRunAndCacheSection(lines: string[], result: DiaryAnalysisResult): void {
	lines.push("## Performance");
	lines.push("");
	appendCallout(lines, "info", "Performance basis", [
		"- These values reflect the last manual run, not a background watcher.",
		"- Cache reuse lowers rerun cost when notes and relevant settings stay unchanged.",
	]);
	appendMetricTable(lines, [
		["Started", new Date(result.startedAt).toLocaleString()],
		["Finished", new Date(result.finishedAt).toLocaleString()],
		["Analysis duration", result.durationLabel],
		["Reused cached files", result.cache.reusedEntries.toString()],
		["Refreshed files", result.cache.refreshedEntries.toString()],
		["Dropped deleted files", result.cache.droppedDeletedEntries.toString()],
		["Current cache entries", result.cache.currentCacheEntryCount.toString()],
	]);
}

function appendRecordsSection(lines: string[], result: DiaryAnalysisResult, options: MarkdownReportOptions): void {
	const visibleSections = getVisibleMarkdownRecordSections(result.records.sections, options.recordsMode);
	if (options.recordsDisplayLimit <= 0 || visibleSections.length === 0) {
		return;
	}

	lines.push("## Records");
	lines.push("");
	appendCallout(lines, "info", "Records basis", [
		`- Records mode: ${options.recordsMode === "expanded" ? "Expanded" : "Simple"}`,
		`- Rows shown per table: ${options.recordsDisplayLimit}`,
		"- These rows are note-level extremes from the current analysis result and use wiki links for direct inspection.",
	]);

	for (const section of visibleSections) {
		appendMarkdownTable(
			lines,
			["Note", "Value", "Detail"],
			section.rows.slice(0, options.recordsDisplayLimit).map((row) => [
				formatWikiLink(row.path),
				row.valueLabel,
				row.detailLabel,
			]),
			["left", "left", "left"],
			`### ${section.title}`,
		);
		lines.push("");
	}
}

function appendPerYearTagTables(lines: string[], sections: PerYearTagAnalysisSection[]): void {
	if (sections.length === 0) {
		appendCallout(lines, "note", "Per-year tag analytics", [
			"No years qualified for per-year tag analysis after the current filters.",
		]);
		return;
	}

	for (const section of sections) {
		lines.push(`### ${section.year}`);
		lines.push("");
		appendTagTable(lines, section, MAX_MARKDOWN_PER_YEAR_TAG_ROWS, "Most common month");
		lines.push("");
	}
}

function appendTagTable(
	lines: string[],
	section: TagAnalysisSection,
	rowLimit: number,
	monthColumnLabel: string,
): void {
	appendMetricTable(lines, [
		["Filtered entries", section.entryCountConsidered.toString()],
		["Qualifying tags", section.candidateCount.toString()],
	]);
	lines.push("");

	if (section.rows.length === 0) {
		lines.push("_No tags or tag combinations reached the current threshold._");
		return;
	}

	if (section.rows.length > rowLimit) {
		lines.push(`_Showing the first ${rowLimit} rows here. CSV export includes the full qualifying set._`);
		lines.push("");
	}

	appendMarkdownTable(
		lines,
		["Tag", "Entries", "Avg words", "Median words", "Mean delta vs baseline", "Median delta vs baseline", "Most common weekday", monthColumnLabel],
		section.rows.slice(0, rowLimit).map((row) => [
			row.label,
			row.entryCount.toString(),
			formatNumber(row.averageWords),
			formatNumber(row.medianWords),
			formatSignedNumber(row.averageWordDelta),
			formatSignedNumber(row.medianWordDelta),
			formatTopShareLabels(
				row.dominantWeekdayLabel,
				row.dominantWeekdayShare,
				row.secondaryWeekdayLabel,
				row.secondaryWeekdayShare,
			),
			formatShareLabel(row.dominantMonthLabel, row.dominantMonthShare),
		]),
		["left", "right", "right", "right", "right", "right", "left", "left"],
	);
}

function appendBodyTextSection(lines: string[], result: DiaryAnalysisResult, options: MarkdownReportOptions): void {
	const bodyText = result.advancedMetrics.bodyText;
	if (!bodyText.enabled) {
		appendCallout(lines, "note", "Body-text analysis", [
			"Body-text analysis is disabled in Settings.",
		]);
		return;
	}

	if (bodyText.analyzedEntryCount === 0) {
		appendCallout(lines, "note", "Body-text analysis", [
			"No dated notes with body-text features were available.",
		]);
		return;
	}

	appendCollapsedCallout(lines, "help", "How to read text-aware patterns", [
		"→ Measures: vocabulary variety, novelty, phrase recurrence, sentence climate, and opening-style tendencies in note bodies.",
		"• These are lightweight local heuristics built from cleaned note text, not full NLP interpretation.",
		"• The values are most useful comparatively across years, months, and tags.",
		"→ Example: a year can have high lexical richness even if it has fewer entries, as long as its vocabulary stays varied for its size.",
	]);

	appendMetricTable(lines, [
		["Entries with body-text features", bodyText.analyzedEntryCount.toString()],
		["Body-text scope", bodyText.timeScopeLabel],
		["Richest vocabulary year", bodyText.richestVocabularyYear?.year.toString() ?? "(none)"],
		["Most novel year", bodyText.mostNovelYear?.year.toString() ?? "(none)"],
		["Most repetitive phrasing year", bodyText.mostRepetitiveYear?.year.toString() ?? "(none)"],
		["Strongest phrase family", bodyText.strongestPhraseFamily?.phrase ?? "(none)"],
		["Longest-sentence month", formatMonthClimate(bodyText.longestSentenceMonth)],
		["Shortest-sentence month", formatMonthClimate(bodyText.shortestSentenceMonth)],
		["Richest tag", formatBodyTextTagProfile(bodyText.richestTag)],
		["Most revised tag", formatBodyTextTagProfile(bodyText.mostRevisedTag)],
		["Sharpest opening-style shift", formatOpeningShift(bodyText.sharpestOpeningShift)],
	]);
	lines.push("");

	appendMarkdownTable(
		lines,
		["Year", "Lexical richness", "Novelty", "Avg sentence", "Variation", "Opening", "Recurring phrase share"],
		bodyText.yearProfiles.length > 0
			? bodyText.yearProfiles.map((profile) => [
					profile.year.toString(),
					formatOptionalNumber(profile.lexicalRichness),
					formatPercent(profile.noveltyRate ?? 0),
					formatOptionalNumber(profile.averageSentenceLength),
					formatOptionalNumber(profile.sentenceLengthVariation),
					formatOpeningSignature(profile.dominantOpeningSignature),
					formatPercent(profile.recurringPhraseShare ?? 0),
			  ])
			: [["(none)", "(none)", "(none)", "(none)", "(none)", "(none)", "(none)"]],
		["right", "right", "right", "right", "right", "left", "right"],
	);
	lines.push("");

	appendMarkdownTable(
		lines,
		["Phrase", "Entries", "Year span", "Avg gap", "Score"],
		bodyText.topRecurringPhrases.length > 0
			? bodyText.topRecurringPhrases
					.slice(0, resolveMarkdownRowLimit(options.recurringPhraseDisplayLimit, bodyText.topRecurringPhrases.length))
					.map((phrase) => [
					phrase.phrase,
					phrase.supportEntries.toString(),
					`${phrase.firstYear}-${phrase.lastYear}`,
					formatOptionalDays(phrase.averageGapDays),
					formatNumber(phrase.recurrenceScore),
			  ])
			: [["(none)", "0", "(none)", "(none)", "(none)"]],
		["left", "right", "left", "right", "right"],
	);
	lines.push("");

	appendMarkdownTable(
		lines,
		[
			"Tag",
			"Entries",
			"Avg words",
			"Median words",
			"Lexical richness",
			"Avg sentence",
			"Median sentence",
			"Avg revision lag",
			"Median revision lag",
		],
		bodyText.tagProfiles.length > 0
			? bodyText.tagProfiles.slice(0, MAX_MARKDOWN_PAIR_ROWS).map((profile) => [
					profile.label,
					profile.support.toString(),
					formatNumber(profile.averageWords),
					formatOptionalNumber(profile.medianWords),
					formatOptionalNumber(profile.averageLexicalRichness),
					formatOptionalNumber(profile.averageSentenceLength),
					formatOptionalNumber(profile.medianSentenceLength),
					formatOptionalDays(profile.averageRevisionLagDays),
					formatOptionalDays(profile.medianRevisionLagDays),
			  ])
			: [["(none)", "0", "(none)", "(none)", "(none)", "(none)", "(none)", "(none)", "(none)"]],
		["left", "right", "right", "right", "right", "right", "right", "right", "right"],
		"#### Tag text profiles",
	);
	lines.push("");

	if (!bodyText.czechNormalized.enabled) {
		return;
	}

	lines.push("#### Czech-normalized text");
	lines.push("");
	appendCollapsedCallout(lines, "help", "How to read Czech-normalized text", [
		"→ Measures: an optional Czech-aware content-vocabulary layer built from stopword filtering and conservative suffix trimming.",
		"• This is deterministic and local, but still heuristic rather than full lemmatization.",
		"• The scope can analyze everything or a defined subset by year range and normalized tags.",
		"→ Example: a scoped year can rank highly even with fewer entries if its filtered content vocabulary stays varied and new.",
	]);
	appendMetricTable(lines, [
		["Deep-text scope", bodyText.czechNormalized.scopeLabel],
		["Deep-text tags", bodyText.czechNormalized.tagFilterLabel],
		["Czech-normalized entries", bodyText.czechNormalized.analyzedEntryCount.toString()],
		["Scoped content tokens", formatNumber(bodyText.czechNormalized.overallContentTokenCount)],
		["Scoped vocabulary size", formatNumber(bodyText.czechNormalized.overallVocabularySize)],
		["Normalized lexical richness", formatOptionalNumber(bodyText.czechNormalized.overallLexicalRichness)],
		[
			"Content-token share",
			bodyText.czechNormalized.overallContentShare === null
				? "(none)"
				: formatPercent(bodyText.czechNormalized.overallContentShare),
		],
		["Richest normalized year", bodyText.czechNormalized.richestYear?.year.toString() ?? "(none)"],
		["Most novel normalized year", bodyText.czechNormalized.mostNovelYear?.year.toString() ?? "(none)"],
		["Densest content year", bodyText.czechNormalized.densestContentYear?.year.toString() ?? "(none)"],
	]);
	lines.push("");
	appendMarkdownTable(
		lines,
		["Year", "Entries", "Content tokens", "Vocabulary", "Lexical richness", "Novelty", "Content share"],
		bodyText.czechNormalized.yearProfiles.length > 0
			? bodyText.czechNormalized.yearProfiles.map((profile) => [
					profile.year.toString(),
					profile.entryCount.toString(),
					formatNumber(profile.contentTokenCount),
					formatNumber(profile.vocabularySize),
					formatOptionalNumber(profile.lexicalRichness),
					formatPercent(profile.noveltyRate ?? 0),
					profile.contentShare === null ? "(none)" : formatPercent(profile.contentShare),
			  ])
			: [["(none)", "0", "0", "0", "(none)", "(none)", "(none)"]],
		["right", "right", "right", "right", "right", "right", "right"],
	);

	if (bodyText.czechNormalized.periodSignature.enabled) {
		lines.push("");
		lines.push("#### Period signature");
		lines.push("");
		appendCollapsedCallout(lines, "help", "How to read period signature", [
		"→ Measures: which Czech-normalized content terms are most characteristic of one selected period compared with a chosen reference set.",
		"• Distinctive terms favor the selected period.",
		"• Emergent terms appear in the selected period but not in the comparison set.",
		"• Fading terms favor the comparison set over the selected period.",
		"→ Example: a high score means the term is denser in the selected period than in the comparison basis, not that it is globally frequent.",
		]);
		appendMetricTable(lines, [
		["Selected period", bodyText.czechNormalized.periodSignature.selectedPeriodLabel],
		["Comparison basis", bodyText.czechNormalized.periodSignature.comparisonLabel],
		["Selected period entries", bodyText.czechNormalized.periodSignature.selectedEntryCount.toString()],
		["Comparison entries", bodyText.czechNormalized.periodSignature.comparisonEntryCount.toString()],
		["Selected content tokens", formatNumber(bodyText.czechNormalized.periodSignature.selectedContentTokenCount)],
		["Comparison content tokens", formatNumber(bodyText.czechNormalized.periodSignature.comparisonContentTokenCount)],
		["Candidate terms", bodyText.czechNormalized.periodSignature.candidateTermCount.toString()],
		["Strongest distinctive term", bodyText.czechNormalized.periodSignature.strongestDistinctiveTerm?.term ?? "(none)"],
		["Strongest emergent term", bodyText.czechNormalized.periodSignature.strongestEmergentTerm?.term ?? "(none)"],
		["Strongest fading term", bodyText.czechNormalized.periodSignature.strongestFadingTerm?.term ?? "(none)"],
		]);
		lines.push("");

	if (
		bodyText.czechNormalized.periodSignature.selectedEntryCount === 0 ||
		bodyText.czechNormalized.periodSignature.comparisonEntryCount === 0 ||
		bodyText.czechNormalized.periodSignature.candidateTermCount === 0
	) {
			const failureMessage =
				bodyText.czechNormalized.periodSignature.selectedEntryCount === 0
					? "No usable period-signature comparison could be built yet because the selected period contains no usable notes inside the current deep-text scope."
					: bodyText.czechNormalized.periodSignature.comparisonEntryCount === 0
						? "No usable period-signature comparison could be built yet because the comparison side is empty inside the current deep-text scope. Try a later year for the earlier-years mode, or a narrower selected period for the rest-of-scope mode."
						: "No usable period-signature comparison could be built yet because no supported candidate terms survived the current scope and support filters.";
			appendCallout(lines, "note", "Period signature", [
				failureMessage,
			]);
		} else {
			const periodSignatureRowLimit = resolveMarkdownRowLimit(
				options.periodSignatureDisplayLimit,
				Math.max(
					bodyText.czechNormalized.periodSignature.topDistinctiveTerms.length,
					bodyText.czechNormalized.periodSignature.topEmergentTerms.length,
					bodyText.czechNormalized.periodSignature.topFadingTerms.length,
				),
			);

			appendMarkdownTable(
				lines,
				["Term", "Selected tokens", "Comparison tokens", "Selected share", "Comparison share", "Score"],
				bodyText.czechNormalized.periodSignature.topDistinctiveTerms.length > 0
					? bodyText.czechNormalized.periodSignature.topDistinctiveTerms
							.slice(0, periodSignatureRowLimit)
							.map((term) => [
								term.term,
								formatNumber(term.selectedCount),
								formatNumber(term.comparisonCount),
								`${formatNumber(term.selectedRate * 100)}%`,
								`${formatNumber(term.comparisonRate * 100)}%`,
								formatNumber(term.score),
						  ])
					: [["(none)", "0", "0", "(none)", "(none)", "(none)"]],
				["left", "right", "right", "right", "right", "right"],
				"#### Distinctive terms",
			);
			lines.push("");
			appendMarkdownTable(
				lines,
				["Term", "Selected tokens", "Comparison tokens", "Selected share", "Comparison share", "Score"],
				bodyText.czechNormalized.periodSignature.topEmergentTerms.length > 0
					? bodyText.czechNormalized.periodSignature.topEmergentTerms
							.slice(0, periodSignatureRowLimit)
							.map((term) => [
								term.term,
								formatNumber(term.selectedCount),
								formatNumber(term.comparisonCount),
								`${formatNumber(term.selectedRate * 100)}%`,
								`${formatNumber(term.comparisonRate * 100)}%`,
								formatNumber(term.score),
						  ])
					: [["(none)", "0", "0", "(none)", "(none)", "(none)"]],
				["left", "right", "right", "right", "right", "right"],
				"#### Emergent terms",
			);
			lines.push("");
			appendMarkdownTable(
				lines,
				["Term", "Selected tokens", "Comparison tokens", "Selected share", "Comparison share", "Score"],
				bodyText.czechNormalized.periodSignature.topFadingTerms.length > 0
					? bodyText.czechNormalized.periodSignature.topFadingTerms
							.slice(0, periodSignatureRowLimit)
							.map((term) => [
								term.term,
								formatNumber(term.selectedCount),
								formatNumber(term.comparisonCount),
								`${formatNumber(term.selectedRate * 100)}%`,
								`${formatNumber(term.comparisonRate * 100)}%`,
								formatNumber(term.score),
						  ])
					: [["(none)", "0", "0", "(none)", "(none)", "(none)"]],
				["left", "right", "right", "right", "right", "right"],
				"#### Fading terms",
			);
		}
	}

	if (!bodyText.czechNormalized.entities.enabled) {
		return;
	}

	lines.push("");
	lines.push("#### Entity candidates and relationships");
	lines.push("");
	appendCollapsedCallout(lines, "help", "How to read entity candidates and relationships", [
		"→ Measures: recurring capitalized names, titles, places, and other entity-like candidates inside the current deep-text scope.",
		"• This is conservative local heuristic extraction, not full Czech named-entity recognition.",
		"• Persistent candidates are ranked by scoped entry support.",
		"• Bridge candidates reward support, active years, and lifespan span together.",
		"• Entity pairs show recurring co-occurrence, not relation type.",
	]);
	appendMetricTable(lines, [
		["Entity candidates", bodyText.czechNormalized.entities.candidateCount.toString()],
		["Entity pairs", bodyText.czechNormalized.entities.pairCount.toString()],
		["Most persistent entity candidate", formatEntityCandidateMetric(bodyText.czechNormalized.entities.mostPersistentCandidate, "support")],
		["Newest entity candidate", formatEntityCandidateMetric(bodyText.czechNormalized.entities.newestCandidate, "newest")],
		["Longest-lived entity candidate", formatEntityCandidateMetric(bodyText.czechNormalized.entities.longestLivedCandidate, "span")],
		["Bridge entity candidate", formatEntityCandidateMetric(bodyText.czechNormalized.entities.bridgeCandidate, "bridge")],
		["Strongest entity pair", formatEntityPairMetric(bodyText.czechNormalized.entities.strongestPair)],
	]);
	lines.push("");

	if (bodyText.czechNormalized.entities.candidateCount === 0) {
		appendCallout(lines, "note", "Entity candidates and relationships", [
			"No recurring entity candidates met the current support threshold inside the current deep-text scope yet.",
		]);
		return;
	}

	const entityRowLimit = resolveMarkdownRowLimit(
		options.entityDisplayLimit,
		Math.max(
			bodyText.czechNormalized.entities.topPersistentCandidates.length,
			bodyText.czechNormalized.entities.topBridgeCandidates.length,
			bodyText.czechNormalized.entities.topEntityPairs.length,
		),
	);
	appendMarkdownTable(
		lines,
		["Candidate", "Entries", "Active years", "First year", "Last year", "Avg gap", "Bridge score"],
		bodyText.czechNormalized.entities.topPersistentCandidates.length > 0
			? bodyText.czechNormalized.entities.topPersistentCandidates.slice(0, entityRowLimit).map((row) => [
					row.label,
					row.supportEntries.toString(),
					row.activeYears.toString(),
					row.firstYear.toString(),
					row.lastYear.toString(),
					formatOptionalDays(row.averageGapDays),
					formatNumber(row.bridgeScore),
			  ])
			: [["(none)", "0", "0", "(none)", "(none)", "(none)", "(none)"]],
		["left", "right", "right", "right", "right", "right", "right"],
		"#### Most persistent entity candidates",
	);
	lines.push("");
	appendMarkdownTable(
		lines,
		["Candidate", "Entries", "Active years", "First year", "Last year", "Avg gap", "Bridge score"],
		bodyText.czechNormalized.entities.topBridgeCandidates.length > 0
			? bodyText.czechNormalized.entities.topBridgeCandidates.slice(0, entityRowLimit).map((row) => [
					row.label,
					row.supportEntries.toString(),
					row.activeYears.toString(),
					row.firstYear.toString(),
					row.lastYear.toString(),
					formatOptionalDays(row.averageGapDays),
					formatNumber(row.bridgeScore),
			  ])
			: [["(none)", "0", "0", "(none)", "(none)", "(none)", "(none)"]],
		["left", "right", "right", "right", "right", "right", "right"],
		"#### Bridge entity candidates",
	);
	lines.push("");
	appendMarkdownTable(
		lines,
		["Pair", "Entries", "Active years", "First year", "Last year", "Relationship score"],
		bodyText.czechNormalized.entities.topEntityPairs.length > 0
			? bodyText.czechNormalized.entities.topEntityPairs.slice(0, entityRowLimit).map((row) => [
					`${row.leftLabel} + ${row.rightLabel}`,
					row.supportEntries.toString(),
					row.activeYears.toString(),
					row.firstYear.toString(),
					row.lastYear.toString(),
					formatNumber(row.strength),
			  ])
			: [["(none)", "0", "0", "(none)", "(none)", "(none)"]],
		["left", "right", "right", "right", "right", "right"],
		"#### Strongest entity pairs",
	);
}

function appendAdvancedRegimeShiftTable(lines: string[], result: DiaryAnalysisResult): void {
	appendMarkdownTable(
		lines,
		["From", "To", "Score", "Tag", "Text", "Volume", "Revision", "Cadence"],
		result.advancedMetrics.hiddenStructure.regimeShifts.length > 0
			? result.advancedMetrics.hiddenStructure.regimeShifts.slice(0, MAX_MARKDOWN_REGIME_SHIFT_ROWS).map((shift) => [
					shift.fromYear.toString(),
					shift.toYear.toString(),
					formatNumber(shift.score),
					formatNumber(shift.tagChange),
					formatNumber(shift.textChange),
					formatNumber(shift.volumeChange),
					formatNumber(shift.revisionChange),
					formatNumber(shift.cadenceChange),
			  ])
			: [["(none)", "(none)", "(none)", "(none)", "(none)", "(none)", "(none)", "(none)"]],
		["right", "right", "right", "right", "right", "right", "right", "right"],
	);
}

function appendStructuralExamplesSection(lines: string[], result: DiaryAnalysisResult, rowLimit: number): void {
	const examples = result.advancedMetrics.structuralExamples;
	const effectiveLimit = Math.max(1, rowLimit);

	lines.push("### Structural examples");
	lines.push("");
	appendCallout(lines, "tip", "Evidence anchors", [
		"- These example rows point back to concrete notes from the analyzed scope.",
		"- They are meant to support interpretation of the metrics above rather than replace the dashboard.",
	]);

	appendMarkdownTable(
		lines,
		["Gap", "Before note", "Before date", "After note", "After date"],
		examples.silenceGaps.length > 0
			? examples.silenceGaps.slice(0, effectiveLimit).map((row) => [
					`${formatNumber(row.gapDays)} d`,
					formatWikiLink(row.before.path),
					row.before.timestampLabel ?? "(unknown)",
					formatWikiLink(row.after.path),
					row.after.timestampLabel ?? "(unknown)",
			  ])
			: [["(none)", "(none)", "(none)", "(none)", "(none)"]],
		["left", "left", "left", "left", "left"],
		"#### Longest silence gap examples",
	);
	lines.push("");

	appendMarkdownTable(
		lines,
		["Note", "Lag", "Created", "Updated", "Words"],
		examples.revisionLags.length > 0
			? examples.revisionLags.slice(0, effectiveLimit).map((row) => [
					formatWikiLink(row.path),
					`${formatNumber(row.lagDays)} d`,
					row.createdAtLabel ?? "(unknown)",
					row.updatedAtLabel ?? "(unknown)",
					formatNumber(row.wordCount),
			  ])
			: [["(none)", "(none)", "(none)", "(none)", "(none)"]],
		["left", "right", "left", "left", "right"],
		"#### Largest revision lags",
	);
	lines.push("");

	appendMarkdownTable(
		lines,
		["Phrase", "Entries", "Avg gap", "Score", "Example notes"],
		examples.recurringPhrases.length > 0
			? examples.recurringPhrases.slice(0, effectiveLimit).map((row) => [
					row.phrase,
					row.supportEntries.toString(),
					formatOptionalDays(row.averageGapDays),
					formatNumber(row.recurrenceScore),
					formatWikiLinkList(row.examplePaths),
			  ])
			: [["(none)", "0", "(none)", "(none)", "(none)"]],
		["left", "right", "right", "right", "left"],
		"#### Recurring phrase example notes",
	);
	lines.push("");

	appendMarkdownTable(
		lines,
		["Pair", "Support", "Lift", "Example notes"],
		examples.tagPairLifts.length > 0
			? examples.tagPairLifts.slice(0, effectiveLimit).map((row) => [
					row.label,
					row.support.toString(),
					formatNumber(row.lift),
					formatWikiLinkList(row.examplePaths),
			  ])
			: [["(none)", "0", "(none)", "(none)"]],
		["left", "right", "right", "left"],
		"#### Tag-pair lift example notes",
	);
	lines.push("");

	appendMarkdownTable(
		lines,
		["Tag", "Frequency", "Degree", "Bridge score", "Example notes"],
		examples.bridgeTags.length > 0
			? examples.bridgeTags.slice(0, effectiveLimit).map((row) => [
					row.label,
					row.frequency.toString(),
					row.degree.toString(),
					formatNumber(row.bridgeScore),
					formatWikiLinkList(row.examplePaths),
			  ])
			: [["(none)", "0", "0", "(none)", "(none)"]],
		["left", "right", "right", "right", "left"],
		"#### Bridge tag example notes",
	);
	lines.push("");

	appendMarkdownTable(
		lines,
		["From", "To", "Score", "From-year notes", "To-year notes"],
		examples.regimeShifts.length > 0
			? examples.regimeShifts.slice(0, effectiveLimit).map((row) => [
					row.fromYear.toString(),
					row.toYear.toString(),
					formatNumber(row.score),
					formatWikiLinkList(row.fromPaths),
					formatWikiLinkList(row.toPaths),
			  ])
			: [["(none)", "(none)", "(none)", "(none)", "(none)"]],
		["right", "right", "right", "left", "left"],
		"#### Regime shift example notes",
	);
}

function appendCallout(lines: string[], type: string, title: string, bodyLines: string[]): void {
	lines.push(`> [!${type}] ${title}`);
	for (const bodyLine of bodyLines) {
		lines.push(`> ${bodyLine}`);
	}
	lines.push("");
}

function appendCollapsedCallout(lines: string[], type: string, title: string, bodyLines: string[]): void {
	lines.push(`> [!${type}]- ${title}`);
	for (const bodyLine of bodyLines) {
		lines.push(`> ${bodyLine}`);
	}
	lines.push("");
}

function appendBlockQuote(lines: string[], bodyLines: string[]): void {
	for (const bodyLine of bodyLines) {
		lines.push(`> ${bodyLine}`);
	}
}

function appendMetricTable(lines: string[], rows: Array<[string, string]>): void {
	appendMarkdownTable(
		lines,
		["Metric", "Value"],
		rows.map(([label, value]) => [label, value]),
		["left", "left"],
	);
}

function appendMarkdownTable(
	lines: string[],
	headers: string[],
	rows: string[][],
	alignments: Array<"left" | "right">,
	title?: string,
): void {
	if (title) {
		lines.push(title);
		lines.push("");
	}

	lines.push(`| ${headers.map((header) => escapeMarkdownCell(header)).join(" | ")} |`);
	lines.push(`| ${alignments.map((alignment) => (alignment === "right" ? "---:" : "---")).join(" | ")} |`);
	for (const row of rows) {
		lines.push(`| ${row.map((cell) => escapeMarkdownCell(cell)).join(" | ")} |`);
	}
}

function formatYearList(years: number[]): string {
	return years.length > 0 ? years.join(", ") : "(none)";
}

function formatPathList(paths: string[]): string {
	return paths.length > 0 ? paths.join(", ") : "(none)";
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

function resolveMarkdownRowLimit(configuredLimit: number, totalRows: number): number {
	if (configuredLimit <= 0) {
		return totalRows;
	}

	return Math.min(configuredLimit, totalRows);
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
	return labels.length > 0 ? labels.join(" / ") : "(none)";
}

function formatPercent(value: number): string {
	return `${Math.round(value * 100)}%`;
}

function formatOptionalNumber(value: number | null): string {
	return value === null ? "(none)" : formatNumber(value);
}

function formatOptionalDays(value: number | null): string {
	return value === null ? "(none)" : `${formatNumber(value)} d`;
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

function escapeMarkdownCell(value: string): string {
	return value.replace(/\|/gu, "\\|");
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
	return value ? `${value.dayCount} d (${value.startDate} -> ${value.endDate}, ${value.entryCount} entries)` : "(none)";
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

function formatEntityCandidateMetric(
	value: DiaryAnalysisResult["advancedMetrics"]["bodyText"]["czechNormalized"]["entities"]["mostPersistentCandidate"],
	mode: "support" | "newest" | "span" | "bridge",
): string {
	if (!value) {
		return "(none)";
	}

	if (mode === "support") {
		return `${value.label} (${value.supportEntries} entries)`;
	}

	if (mode === "newest") {
		return `${value.label} (first ${value.firstYear})`;
	}

	if (mode === "span") {
		return `${value.label} (${value.firstYear}-${value.lastYear})`;
	}

	return `${value.label} (${formatNumber(value.bridgeScore)})`;
}

function formatEntityPairMetric(
	value: DiaryAnalysisResult["advancedMetrics"]["bodyText"]["czechNormalized"]["entities"]["strongestPair"],
): string {
	return value ? `${value.leftLabel} + ${value.rightLabel} (${value.supportEntries} entries)` : "(none)";
}

function getVisibleMarkdownRecordSections(
	sections: DiaryAnalysisResult["records"]["sections"],
	mode: RecordsMode,
): DiaryAnalysisResult["records"]["sections"] {
	if (mode === "expanded") {
		return sections;
	}

	return sections.filter((section) => SIMPLE_MARKDOWN_RECORD_SECTION_IDS.has(section.id));
}

function formatWikiLink(path: string): string {
	const basename = path.split("/").pop()?.replace(/\.md$/iu, "") ?? path;
	const linkPath = path.replace(/\.md$/iu, "");
	return `[[${linkPath}|${basename}]]`;
}

function formatWikiLinkList(paths: string[]): string {
	return paths.length > 0 ? paths.map((path) => formatWikiLink(path)).join(", ") : "(none)";
}

function appendStructuralGlossarySection(lines: string[], includeBodyTextMetrics: boolean): void {
	lines.push("### Glossary");
	lines.push("");
	appendCollapsedCallout(lines, "help", "Burstiness index", [
		"→ Measures: how unevenly entries are distributed over time.",
		"• Scale: roughly `-1` to `+1`.",
		"• Near `-1`: very regular writing rhythm.",
		"• Near `0`: mixed / neither strongly regular nor strongly bursty.",
		"• Near `+1`: clustered bursts separated by longer gaps.",
		"→ Example: `-0.4` means somewhat regular, not strongly bursty.",
	]);
	appendCollapsedCallout(lines, "help", "Tail heaviness", [
		"→ Measures: how much the longest notes pull away from a typical note length.",
		"• Scale: open-ended ratio using `p90 / median`.",
		"• Near `1`: long notes are not much longer than a typical note.",
		"• Higher values: a stronger long-note tail.",
		"→ Example: `2.9` means the 90th-percentile note is about 2.9× the median note length.",
	]);
	appendCollapsedCallout(lines, "help", "Compression vs expansion", [
		"→ Measures: the balance between short-entry compression and long-entry expansion.",
		"• Scale: ratio around `1` means relatively balanced.",
		"• Above `1`: short notes outnumber long notes.",
		"• Below `1`: long notes outnumber short notes.",
		"→ Example: `2.0` means roughly twice as many short notes as long notes after smoothing.",
	]);
	appendCollapsedCallout(lines, "help", "Writing concentration index", [
		"→ Measures: how strongly word output concentrates into fewer time buckets.",
		"• Scale: roughly `0` to `1`.",
		"• Lower values: writing is spread more evenly through time.",
		"• Higher values: more of the writing clusters into fewer months.",
		"→ Example: a high value means a year was carried by a few heavy writing periods rather than a steady flow.",
	]);
	appendCollapsedCallout(lines, "help", "Revision half-life", [
		"→ Measures: the midpoint of positive revision lags.",
		"• Scale: days.",
		"• Lower values: revised notes tend to be revisited sooner.",
		"• Higher values: revised notes tend to stay open longer before later updates.",
		"→ Example: `14 d` means about half of revised notes were updated within two weeks.",
	]);
	appendCollapsedCallout(lines, "help", "Revision-weighted words index", [
		"→ Measures: how much writing volume remains tied to later revisits, weighting both note length and lag length.",
		"• Scale: open-ended and corpus-relative.",
		"• Higher values: more words sit inside notes that were revisited after longer delays.",
		"• Best read comparatively inside this diary, not as a universal benchmark.",
		"→ Example: many long notes revised months later will push this index upward.",
	]);
	appendCollapsedCallout(lines, "help", "Tag entropy", [
		"→ Measures: how evenly tag use is spread across different tags.",
		"• Scale: open-ended and dependent on how many qualifying tags exist.",
		"• Lower values: a few tags dominate the corpus.",
		"• Higher values: tag use is more thematically diverse and evenly spread.",
		"→ Example: entropy can be higher than average tags-per-note because it measures distribution, not tagging density.",
	]);
	appendCollapsedCallout(lines, "help", "Tag concentration", [
		"→ Measures: how strongly tag use is concentrated into a smaller subset of tags.",
		"• Scale: roughly `0` to `1`.",
		"• Near `0`: dispersed across many tags.",
		"• Near `1`: dominated by a small number of tags.",
		"→ Example: a high concentration means thematic labeling is pulled strongly toward a few recurring tags.",
	]);
	appendCollapsedCallout(lines, "help", "Cadence vs note depth", [
		"→ Measures: the correlation between gap length and note length.",
		"• Scale: roughly `-1` to `+1`.",
		"• Positive values: longer gaps tend to precede deeper notes.",
		"• Negative values: faster writing cadence tends to accompany deeper notes.",
		"→ Example: `0.4` means deeper notes somewhat tend to appear after longer pauses.",
	]);
	appendCollapsedCallout(lines, "help", "Revision vs final length", [
		"→ Measures: the correlation between revision lag and final word count among revised notes.",
		"• Scale: roughly `-1` to `+1`.",
		"• Positive values: longer-lived revisions tend to end up longer.",
		"• Negative values: longer revision lags tend to belong to shorter final notes.",
		"→ Example: `0.5` suggests a moderate link between long revision windows and longer finished notes.",
	]);
	appendCollapsedCallout(lines, "help", "Regime shift score", [
		"→ Measures: how strongly one year diverges from the previous year across multiple signals at once.",
		"• Scale: open-ended and corpus-relative.",
		"• Higher values: a sharper combined change in tags, text, volume, revision, and cadence.",
		"• Lower values: a smoother transition from year to year.",
		"→ Example: a top regime-shift year marks a structural break, not just one unusual single metric.",
	]);
	appendCollapsedCallout(lines, "help", "Bridge tags", [
		"→ Measures: tags that connect otherwise weaker or less tightly clustered tag neighborhoods.",
		"• Scale: open-ended bridge score using degree, low clustering, and frequency.",
		"• Higher values: a tag behaves more like a connector across themes.",
		"• Lower values: a tag stays more local to one tight motif cluster.",
		"→ Example: a bridge tag often appears in structurally mixed notes that tie together different recurring themes.",
	]);

	if (includeBodyTextMetrics) {
		appendCollapsedCallout(lines, "help", "Overall lexical richness", [
			"→ Measures: vocabulary variety using a size-corrected ratio `log(unique tokens) / log(total tokens)`.",
			"• Scale: usually between `0` and `1`.",
			"• Higher values: broader vocabulary for the amount of text.",
			"• Best read comparatively across periods rather than as a standalone quality score.",
			"→ Example: `0.9` suggests relatively varied vocabulary for the analyzed text volume.",
		]);
		appendCollapsedCallout(lines, "help", "Novelty rate", [
			"→ Measures: how much of a period's vocabulary is new relative to earlier periods.",
			"• Scale: `0` to `1`.",
			"• Near `0`: most vocabulary was already established earlier.",
			"• Near `1`: much of the vocabulary is newly introduced.",
			"→ Example: `0.3` means about 30% of that period's vocabulary had not appeared in earlier periods.",
		]);
		appendCollapsedCallout(lines, "help", "Recurring phrase share", [
			"→ Measures: how much of a period participates in repeated phrase families.",
			"• Scale: `0` to `1`.",
			"• Lower values: less repeated phrasing across entries.",
			"• Higher values: more entries reuse recurring formulations.",
			"→ Example: `0.4` means about 40% of entries in that period contain a tracked recurring phrase family.",
		]);
		appendCollapsedCallout(lines, "help", "Average sentence length", [
			"→ Measures: average words per sentence after the current text-cleaning rules.",
			"• Scale: words per sentence.",
			"• Lower values: shorter, more clipped sentence patterns.",
			"• Higher values: longer, more extended sentence patterns.",
			"→ Example: `5.6` means the period averages about 5.6 words per sentence.",
		]);
		appendCollapsedCallout(lines, "help", "Sentence-length variation", [
			"→ Measures: how uneven sentence lengths are inside the current period.",
			"• Scale: standard deviation in words per sentence.",
			"• Lower values: sentence lengths stay more even.",
			"• Higher values: sentence lengths vary more sharply.",
			"→ Example: a high value means brief and long sentences coexist more often in the same period.",
		]);
		appendCollapsedCallout(lines, "help", "Opening-style shift", [
			"→ Measures: how strongly dominant opening-line behavior changes between years.",
			"• Scale: open-ended and comparative.",
			"• Higher values: a larger shift in how entries tend to begin.",
			"• Lower values: opening style stays more stable from year to year.",
			"→ Example: a sharp shift can mark a move from scene-setting openings toward fragmentary or emotional openings.",
		]);
	}
}
