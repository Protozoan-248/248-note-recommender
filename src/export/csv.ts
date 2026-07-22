import type { DiaryAnalysisResult, TagAnalysisRow } from "../types";

const TAG_COLUMN_COUNT = 15;
const ADVANCED_COLUMN_COUNT = 5;

export interface CsvReportOptions {
	includeStructuralExamples: boolean;
	structuralExamplesLimit: number;
}

export function buildCsvReport(
	result: DiaryAnalysisResult,
	options: CsvReportOptions = {
		includeStructuralExamples: false,
		structuralExamplesLimit: 0,
	},
): string {
	const rows: string[][] = [
		[
			"row_type",
			"year",
			"label",
			"entries",
			"words",
			"reading_time_minutes",
			"reading_time_label",
			"average_entry_words",
			"average_entry_method",
			"average_entry_reading_minutes",
			"average_entry_reading_label",
			"analysis_duration_label",
			"created_fallback_count",
			"updated_fallback_count",
			"tag_entry_count",
			"tag_average_words",
			"tag_median_words",
			"tag_mean_word_delta",
			"tag_median_word_delta",
			"tag_primary_weekday",
			"tag_primary_weekday_share",
			"tag_secondary_weekday",
			"tag_secondary_weekday_share",
			"tag_dominant_month",
			"tag_dominant_month_share",
			"tag_filtered_entries",
			"tag_candidate_count",
			"tag_mean_tags_per_note",
			"tag_median_tags_per_note",
			"advanced_group",
			"advanced_name",
			"advanced_value",
			"advanced_detail",
			"advanced_score",
		],
		[
			"overall",
			"",
			"",
			result.aggregate.totalEntries.toString(),
			result.aggregate.totalWords.toString(),
			formatDecimal(result.aggregate.totalReadingTimeMinutes),
			result.aggregate.totalReadingTimeLabel,
			formatDecimal(result.aggregate.selectedAverageEntryWords),
			result.aggregate.selectedAverageEntryMethod,
			formatDecimal(result.aggregate.averageEntryReadingTimeMinutes),
			result.aggregate.averageEntryReadingTimeLabel,
			result.durationLabel,
			result.aggregate.entriesWithCreatedFallback.toString(),
			result.aggregate.entriesWithUpdatedFallback.toString(),
			...buildOverallTagSummaryColumns(result),
			...Array<string>(ADVANCED_COLUMN_COUNT).fill(""),
		],
	];

	for (const yearSummary of result.aggregate.yearSummaries) {
		rows.push([
			"year",
			yearSummary.year.toString(),
			"",
			yearSummary.entryCount.toString(),
			yearSummary.wordCount.toString(),
			formatDecimal(yearSummary.readingTimeMinutes),
			yearSummary.readingTimeLabel,
			"",
			"",
			"",
			"",
			"",
			yearSummary.createdFallbackCount.toString(),
			yearSummary.updatedFallbackCount.toString(),
			...Array<string>(TAG_COLUMN_COUNT).fill(""),
			...Array<string>(ADVANCED_COLUMN_COUNT).fill(""),
		]);
	}

	if (result.tagAnalysis.overall) {
		for (const row of result.tagAnalysis.overall.rows) {
			rows.push(buildTagCsvRow("tag_overall", "", row, result.tagAnalysis.overall.entryCountConsidered, result.tagAnalysis.overall.candidateCount));
		}
	}

	for (const section of result.tagAnalysis.perYear) {
		for (const row of section.rows) {
			rows.push(buildTagCsvRow("tag_year", section.year.toString(), row, section.entryCountConsidered, section.candidateCount));
		}
	}

	for (const headline of result.advancedMetrics.headlineCards) {
		rows.push(buildAdvancedCsvRow("advanced_headline", "", "headline", headline.label, headline.value, headline.detail, ""));
	}

	for (const profile of result.advancedMetrics.yearProfiles) {
		rows.push(
			buildAdvancedCsvRow(
				"advanced_year",
				profile.year.toString(),
				"year_profile",
				"productivity_mode",
				profile.productivityMode,
				`burstiness=${formatDecimal(profile.burstinessIndex)}; concentration=${formatDecimal(profile.writingConcentrationIndex)}; revisit_ratio=${formatDecimal(profile.revisitRatio)}`,
				formatDecimal(profile.regimeShiftFromPrevious ?? 0),
			),
		);
	}

	for (const profile of result.advancedMetrics.bodyText.yearProfiles) {
		rows.push(
			buildAdvancedCsvRow(
				"advanced_text_year",
				profile.year.toString(),
				"body_text",
				"year_profile",
				formatDecimal(profile.lexicalRichness ?? 0),
				`novelty=${formatDecimal(profile.noveltyRate ?? 0)}; avg_sentence=${formatDecimal(profile.averageSentenceLength ?? 0)}; opening=${profile.dominantOpeningSignature ?? ""}`,
				formatDecimal(profile.recurringPhraseShare ?? 0),
			),
		);
	}

	for (const phrase of result.advancedMetrics.bodyText.topRecurringPhrases) {
		rows.push(
			buildAdvancedCsvRow(
				"advanced_text_phrase",
				phrase.lastYear.toString(),
				"body_text",
				phrase.phrase,
				phrase.supportEntries.toString(),
				`first_year=${phrase.firstYear}; last_year=${phrase.lastYear}; avg_gap_days=${formatDecimal(phrase.averageGapDays ?? 0)}`,
				formatDecimal(phrase.recurrenceScore),
			),
		);
	}

	for (const profile of result.advancedMetrics.bodyText.tagProfiles) {
		rows.push(
			buildAdvancedCsvRow(
				"advanced_text_tag",
				"",
				"body_text",
				profile.label,
				profile.support.toString(),
				`avg_words=${formatDecimal(profile.averageWords)}; median_words=${formatDecimal(profile.medianWords ?? 0)}; lexical_richness=${formatDecimal(profile.averageLexicalRichness ?? 0)}; avg_sentence=${formatDecimal(profile.averageSentenceLength ?? 0)}; median_sentence=${formatDecimal(profile.medianSentenceLength ?? 0)}; avg_revision_lag=${formatDecimal(profile.averageRevisionLagDays ?? 0)}; median_revision_lag=${formatDecimal(profile.medianRevisionLagDays ?? 0)}`,
				formatDecimal(profile.averageLexicalRichness ?? 0),
			),
		);
	}

	rows.push(
		buildAdvancedCsvRow(
			"advanced_text_scope",
			"",
			"body_text",
			"time_scope",
			result.advancedMetrics.bodyText.timeScopeLabel,
			result.advancedMetrics.bodyText.timeScopeMode === "year-range"
				? `mode=${result.advancedMetrics.bodyText.timeScopeMode}; from=${result.advancedMetrics.bodyText.timeScopeFromYear ?? ""}; to=${result.advancedMetrics.bodyText.timeScopeToYear ?? ""}`
				: `mode=${result.advancedMetrics.bodyText.timeScopeMode}`,
			"",
		),
	);

	if (result.advancedMetrics.bodyText.czechNormalized.enabled) {
		const czechNormalized = result.advancedMetrics.bodyText.czechNormalized;
		rows.push(
			buildAdvancedCsvRow(
				"advanced_czech_scope",
				"",
				"czech_normalized_text",
				"scope",
				czechNormalized.scopeLabel,
				czechNormalized.scopeMode === "defined"
					? `mode=${czechNormalized.scopeMode}; from=${czechNormalized.scopeFromYear ?? ""}; to=${czechNormalized.scopeToYear ?? ""}; included=${czechNormalized.includedTags.join("|")}; excluded=${czechNormalized.excludedTags.join("|")}`
					: `mode=${czechNormalized.scopeMode}`,
				"",
			),
		);
		rows.push(
			buildAdvancedCsvRow(
				"advanced_czech_metric",
				"",
				"czech_normalized_text",
				"tag_filter",
				czechNormalized.tagFilterLabel,
				`entries=${czechNormalized.analyzedEntryCount}`,
				"",
			),
		);
		rows.push(
			buildAdvancedCsvRow(
				"advanced_czech_metric",
				"",
				"czech_normalized_text",
				"overall_vocabulary_size",
				czechNormalized.overallVocabularySize.toString(),
				"",
				formatDecimal(czechNormalized.overallVocabularySize),
			),
		);
		rows.push(
			buildAdvancedCsvRow(
				"advanced_czech_metric",
				"",
				"czech_normalized_text",
				"overall_content_tokens",
				czechNormalized.overallContentTokenCount.toString(),
				"",
				formatDecimal(czechNormalized.overallContentTokenCount),
			),
		);
		rows.push(
			buildAdvancedCsvRow(
				"advanced_czech_metric",
				"",
				"czech_normalized_text",
				"overall_lexical_richness",
				formatDecimal(czechNormalized.overallLexicalRichness ?? 0),
				"",
				formatDecimal(czechNormalized.overallLexicalRichness ?? 0),
			),
		);
		rows.push(
			buildAdvancedCsvRow(
				"advanced_czech_metric",
				"",
				"czech_normalized_text",
				"overall_content_share",
				formatDecimal(czechNormalized.overallContentShare ?? 0),
				"",
				formatDecimal(czechNormalized.overallContentShare ?? 0),
			),
		);

		for (const profile of czechNormalized.yearProfiles) {
			rows.push(
				buildAdvancedCsvRow(
					"advanced_czech_year",
					profile.year.toString(),
					"czech_normalized_text",
					"year_profile",
					formatDecimal(profile.lexicalRichness ?? 0),
					`entries=${profile.entryCount}; content_tokens=${profile.contentTokenCount}; vocabulary=${profile.vocabularySize}; novelty=${formatDecimal(profile.noveltyRate ?? 0)}; content_share=${formatDecimal(profile.contentShare ?? 0)}`,
					formatDecimal(profile.vocabularySize),
				),
			);
		}

		if (czechNormalized.periodSignature.enabled) {
			const periodSignature = czechNormalized.periodSignature;
			rows.push(
				buildAdvancedCsvRow(
					"advanced_period_signature_scope",
					"",
					"period_signature",
					"selected_period",
					periodSignature.selectedPeriodLabel,
					`comparison=${periodSignature.comparisonLabel}; mode=${periodSignature.comparisonMode}`,
					"",
				),
			);
			rows.push(
				buildAdvancedCsvRow(
					"advanced_period_signature_metric",
					"",
					"period_signature",
					"candidate_terms",
					periodSignature.candidateTermCount.toString(),
					`selected_entries=${periodSignature.selectedEntryCount}; comparison_entries=${periodSignature.comparisonEntryCount}; selected_tokens=${periodSignature.selectedContentTokenCount}; comparison_tokens=${periodSignature.comparisonContentTokenCount}`,
					formatDecimal(periodSignature.candidateTermCount),
				),
			);
			rows.push(
				buildAdvancedCsvRow(
					"advanced_period_signature_metric",
					"",
					"period_signature",
					"strongest_distinctive_term",
					periodSignature.strongestDistinctiveTerm?.term ?? "(none)",
					"",
					formatDecimal(periodSignature.strongestDistinctiveTerm?.score ?? 0),
				),
			);
			rows.push(
				buildAdvancedCsvRow(
					"advanced_period_signature_metric",
					"",
					"period_signature",
					"strongest_emergent_term",
					periodSignature.strongestEmergentTerm?.term ?? "(none)",
					"",
					formatDecimal(periodSignature.strongestEmergentTerm?.score ?? 0),
				),
			);
			rows.push(
				buildAdvancedCsvRow(
					"advanced_period_signature_metric",
					"",
					"period_signature",
					"strongest_fading_term",
					periodSignature.strongestFadingTerm?.term ?? "(none)",
					"",
					formatDecimal(periodSignature.strongestFadingTerm?.score ?? 0),
				),
			);

			for (const term of periodSignature.topDistinctiveTerms) {
				rows.push(
					buildAdvancedCsvRow(
						"advanced_period_signature_term",
						"",
						"period_signature",
						`distinctive:${term.term}`,
						term.term,
						`selected_count=${term.selectedCount}; comparison_count=${term.comparisonCount}; selected_rate=${formatDecimal(term.selectedRate)}; comparison_rate=${formatDecimal(term.comparisonRate)}`,
						formatDecimal(term.score),
					),
				);
			}

			for (const term of periodSignature.topEmergentTerms) {
				rows.push(
					buildAdvancedCsvRow(
						"advanced_period_signature_term",
						"",
						"period_signature",
						`emergent:${term.term}`,
						term.term,
						`selected_count=${term.selectedCount}; comparison_count=${term.comparisonCount}; selected_rate=${formatDecimal(term.selectedRate)}; comparison_rate=${formatDecimal(term.comparisonRate)}`,
						formatDecimal(term.score),
					),
				);
			}

			for (const term of periodSignature.topFadingTerms) {
				rows.push(
					buildAdvancedCsvRow(
						"advanced_period_signature_term",
						"",
						"period_signature",
						`fading:${term.term}`,
						term.term,
						`selected_count=${term.selectedCount}; comparison_count=${term.comparisonCount}; selected_rate=${formatDecimal(term.selectedRate)}; comparison_rate=${formatDecimal(term.comparisonRate)}`,
						formatDecimal(term.score),
					),
				);
			}
		}

		if (czechNormalized.entities.enabled) {
			const entities = czechNormalized.entities;
			rows.push(
				buildAdvancedCsvRow(
					"advanced_entity_metric",
					"",
					"entity_candidates",
					"candidate_count",
					entities.candidateCount.toString(),
					`pairs=${entities.pairCount}; scoped_entries=${entities.analyzedEntryCount}`,
					formatDecimal(entities.candidateCount),
				),
			);
			rows.push(
				buildAdvancedCsvRow(
					"advanced_entity_metric",
					"",
					"entity_candidates",
					"most_persistent_candidate",
					entities.mostPersistentCandidate?.label ?? "(none)",
					entities.mostPersistentCandidate
						? `support=${entities.mostPersistentCandidate.supportEntries}; first_year=${entities.mostPersistentCandidate.firstYear}; last_year=${entities.mostPersistentCandidate.lastYear}; active_years=${entities.mostPersistentCandidate.activeYears}`
						: "",
					formatDecimal(entities.mostPersistentCandidate?.supportEntries ?? 0),
				),
			);
			rows.push(
				buildAdvancedCsvRow(
					"advanced_entity_metric",
					"",
					"entity_candidates",
					"bridge_candidate",
					entities.bridgeCandidate?.label ?? "(none)",
					entities.bridgeCandidate
						? `support=${entities.bridgeCandidate.supportEntries}; first_year=${entities.bridgeCandidate.firstYear}; last_year=${entities.bridgeCandidate.lastYear}; active_years=${entities.bridgeCandidate.activeYears}`
						: "",
					formatDecimal(entities.bridgeCandidate?.bridgeScore ?? 0),
				),
			);
			rows.push(
				buildAdvancedCsvRow(
					"advanced_entity_metric",
					"",
					"entity_candidates",
					"strongest_pair",
					entities.strongestPair ? `${entities.strongestPair.leftLabel} + ${entities.strongestPair.rightLabel}` : "(none)",
					entities.strongestPair
						? `support=${entities.strongestPair.supportEntries}; first_year=${entities.strongestPair.firstYear}; last_year=${entities.strongestPair.lastYear}; active_years=${entities.strongestPair.activeYears}`
						: "",
					formatDecimal(entities.strongestPair?.strength ?? 0),
				),
			);

			for (const entity of entities.topPersistentCandidates) {
				rows.push(
					buildAdvancedCsvRow(
						"advanced_entity_candidate",
						"",
						"entity_candidates",
						`persistent:${entity.label}`,
						entity.label,
						`support=${entity.supportEntries}; first_year=${entity.firstYear}; last_year=${entity.lastYear}; active_years=${entity.activeYears}; avg_gap_days=${formatDecimal(entity.averageGapDays ?? 0)}`,
						formatDecimal(entity.bridgeScore),
					),
				);
			}

			for (const entity of entities.topBridgeCandidates) {
				rows.push(
					buildAdvancedCsvRow(
						"advanced_entity_candidate",
						"",
						"entity_candidates",
						`bridge:${entity.label}`,
						entity.label,
						`support=${entity.supportEntries}; first_year=${entity.firstYear}; last_year=${entity.lastYear}; active_years=${entity.activeYears}; avg_gap_days=${formatDecimal(entity.averageGapDays ?? 0)}`,
						formatDecimal(entity.bridgeScore),
					),
				);
			}

			for (const pair of entities.topEntityPairs) {
				rows.push(
					buildAdvancedCsvRow(
						"advanced_entity_pair",
						"",
						"entity_candidates",
						`${pair.leftLabel} + ${pair.rightLabel}`,
						pair.supportEntries.toString(),
						`left=${pair.leftLabel}; right=${pair.rightLabel}; first_year=${pair.firstYear}; last_year=${pair.lastYear}; active_years=${pair.activeYears}`,
						formatDecimal(pair.strength),
					),
				);
			}
		}
	}

	for (const pair of result.advancedMetrics.tagStructure.topPairLifts) {
		rows.push(
			buildAdvancedCsvRow(
				"advanced_tag_pair",
				"",
				"tag_structure",
				pair.label,
				pair.support.toString(),
				"pair_lift",
				formatDecimal(pair.lift),
			),
		);
	}

	for (const bridgeTag of result.advancedMetrics.tagStructure.bridgeTags) {
		rows.push(
			buildAdvancedCsvRow(
				"advanced_bridge_tag",
				"",
				"tag_structure",
				bridgeTag.label,
				bridgeTag.frequency.toString(),
				`degree=${bridgeTag.degree}`,
				formatDecimal(bridgeTag.bridgeScore),
			),
		);
	}

	for (const shift of result.advancedMetrics.hiddenStructure.regimeShifts) {
		rows.push(
			buildAdvancedCsvRow(
				"advanced_regime_shift",
				shift.toYear.toString(),
				"hidden_structure",
				`${shift.fromYear}->${shift.toYear}`,
				formatDecimal(shift.score),
				`tag=${formatDecimal(shift.tagChange)}; text=${formatDecimal(shift.textChange)}; volume=${formatDecimal(shift.volumeChange)}; revision=${formatDecimal(shift.revisionChange)}; cadence=${formatDecimal(shift.cadenceChange)}`,
				formatDecimal(shift.score),
			),
		);
	}

	for (const reading of result.advancedMetrics.hiddenStructure.structuralReadings) {
		rows.push(
			buildAdvancedCsvRow(
				"advanced_structural_reading",
				"",
				"hidden_structure",
				reading.label,
				reading.value,
				reading.detail,
				"",
			),
		);
	}

	if (result.extraMetrics.longestWritingStreak) {
		rows.push(
			buildAdvancedCsvRow(
				"extra_metric",
				"",
				"extra_metrics",
				"longest_writing_streak",
				result.extraMetrics.longestWritingStreak.dayCount.toString(),
				`start=${result.extraMetrics.longestWritingStreak.startDate}; end=${result.extraMetrics.longestWritingStreak.endDate}; entries=${result.extraMetrics.longestWritingStreak.entryCount}`,
				formatDecimal(result.extraMetrics.longestWritingStreak.dayCount),
			),
		);
	}

	rows.push(
		buildAdvancedCsvRow(
			"extra_metric",
			"",
			"extra_metrics",
			"hour_metric_scope",
			result.extraMetrics.hourMetricScopeLabel,
			"",
			"",
		),
	);
	rows.push(
		buildAdvancedCsvRow(
			"extra_metric",
			"",
			"extra_metrics",
			"timed_entries",
			result.extraMetrics.hourOfDayEntriesWithTime.toString(),
			"",
			formatDecimal(result.extraMetrics.hourOfDayEntriesWithTime),
		),
	);
	rows.push(
		buildAdvancedCsvRow(
			"extra_metric",
			"",
			"extra_metrics",
			"most_active_hour",
			formatHourlyLabel(result.extraMetrics.mostActiveHour?.hour ?? null),
			`entries=${result.extraMetrics.mostActiveHour?.entryCount ?? 0}; mean_words=${formatDecimal(result.extraMetrics.mostActiveHour?.averageWords ?? 0)}`,
			formatDecimal(result.extraMetrics.mostActiveHour?.entryCount ?? 0),
		),
	);
	rows.push(
		buildAdvancedCsvRow(
			"extra_metric",
			"",
			"extra_metrics",
			"quietest_active_hour",
			formatHourlyLabel(result.extraMetrics.quietestActiveHour?.hour ?? null),
			`entries=${result.extraMetrics.quietestActiveHour?.entryCount ?? 0}; mean_words=${formatDecimal(result.extraMetrics.quietestActiveHour?.averageWords ?? 0)}`,
			formatDecimal(result.extraMetrics.quietestActiveHour?.entryCount ?? 0),
		),
	);
	rows.push(
		buildAdvancedCsvRow(
			"extra_metric",
			"",
			"extra_metrics",
			"qualifying_tags_in_scope",
			result.extraMetrics.qualifyingTagCount.toString(),
			"",
			formatDecimal(result.extraMetrics.qualifyingTagCount),
		),
	);
	rows.push(
		buildAdvancedCsvRow(
			"extra_metric",
			"",
			"extra_metrics",
			"displayed_heatmap_tags",
			result.extraMetrics.displayedTagCount.toString(),
			"",
			formatDecimal(result.extraMetrics.displayedTagCount),
		),
	);
	rows.push(
		buildAdvancedCsvRow(
			"extra_metric",
			"",
			"extra_metrics",
			"top_tag_in_scope",
			result.extraMetrics.topTagByFrequency ?? "(none)",
			`count=${result.extraMetrics.topTagFrequencyCount}`,
			formatDecimal(result.extraMetrics.topTagFrequencyCount),
		),
	);

	for (const point of result.extraMetrics.monthLengthProfile.points) {
		rows.push(
			buildAdvancedCsvRow(
				"extra_month",
				"",
				"extra_metrics",
				point.monthLabel,
				point.entryCount.toString(),
				`mean_words=${formatDecimal(point.averageWords)}; median_words=${formatDecimal(point.medianWords)}`,
				formatDecimal(point.averageWords),
			),
		);
	}

	for (const point of result.extraMetrics.hourlyActivity.points) {
		if (point.entryCount === 0) {
			continue;
		}

		rows.push(
			buildAdvancedCsvRow(
				"extra_hour",
				"",
				"extra_metrics",
				`${point.hour.toString().padStart(2, "0")}:00`,
				point.entryCount.toString(),
				`mean_words=${formatDecimal(point.averageWords)}`,
				formatDecimal(point.entryCount),
			),
		);
	}

	for (const cell of result.extraMetrics.tagFrequencyHeatmap.cells) {
		if (cell.entryCount === 0) {
			continue;
		}

		const tagLabel = result.extraMetrics.tagFrequencyHeatmap.tags[cell.tagIndex] ?? "(unknown)";
		rows.push(
			buildAdvancedCsvRow(
				"extra_tag_frequency",
				cell.year.toString(),
				"extra_metrics",
				tagLabel,
				cell.entryCount.toString(),
				"tag_frequency_over_years",
				formatDecimal(cell.entryCount),
			),
		);
	}

	if (options.includeStructuralExamples && options.structuralExamplesLimit > 0) {
		appendStructuralExampleRows(rows, result, options.structuralExamplesLimit);
	}

	return rows.map((row) => row.map(escapeCsvCell).join(",")).join("\n");
}

function buildTagCsvRow(
	rowType: string,
	year: string,
	row: TagAnalysisRow,
	filteredEntries: number,
	candidateCount: number,
): string[] {
	return [
		rowType,
		year,
		row.label,
		"",
		"",
		"",
		"",
		"",
		"",
		"",
		"",
		"",
		"",
		"",
		row.entryCount.toString(),
		formatDecimal(row.averageWords),
		formatDecimal(row.medianWords),
		formatDecimal(row.averageWordDelta),
		formatDecimal(row.medianWordDelta),
		row.dominantWeekdayLabel,
		formatDecimal(row.dominantWeekdayShare),
		row.secondaryWeekdayLabel ?? "",
		row.secondaryWeekdayLabel ? formatDecimal(row.secondaryWeekdayShare) : "",
		row.dominantMonthLabel,
		formatDecimal(row.dominantMonthShare),
		filteredEntries.toString(),
		candidateCount.toString(),
		"",
		"",
		"",
		"",
		"",
		"",
		"",
	];
}

function buildAdvancedCsvRow(
	rowType: string,
	year: string,
	group: string,
	name: string,
	value: string,
	detail: string,
	score: string,
): string[] {
	return [
		rowType,
		year,
		...Array<string>(12).fill(""),
		...Array<string>(TAG_COLUMN_COUNT).fill(""),
		group,
		name,
		value,
		detail,
		score,
	];
}

function buildOverallTagSummaryColumns(result: DiaryAnalysisResult): string[] {
	return [
		"",
		"",
		"",
		"",
		"",
		"",
		"",
		"",
		"",
		"",
		"",
		result.tagAnalysis.overall?.entryCountConsidered.toString() ?? "",
		result.tagAnalysis.overall?.candidateCount.toString() ?? "",
		formatDecimal(result.tagAnalysis.meanTagsPerNote),
		formatDecimal(result.tagAnalysis.medianTagsPerNote),
	];
}

function escapeCsvCell(value: string): string {
	if (/[",\n]/u.test(value)) {
		return `"${value.replace(/"/gu, '""')}"`;
	}

	return value;
}

function formatDecimal(value: number): string {
	return Number.isInteger(value) ? value.toString() : value.toFixed(2);
}

function formatHourlyLabel(hour: number | null): string {
	if (hour === null) {
		return "(none)";
	}

	return `${hour.toString().padStart(2, "0")}:00`;
}

function appendStructuralExampleRows(rows: string[][], result: DiaryAnalysisResult, rowLimit: number): void {
	const examples = result.advancedMetrics.structuralExamples;
	const effectiveLimit = Math.max(1, rowLimit);

	for (const row of examples.silenceGaps.slice(0, effectiveLimit)) {
		rows.push(
			buildAdvancedCsvRow(
				"structural_example_silence_gap",
				"",
				"structural_examples",
				"silence_gap",
				formatDecimal(row.gapDays),
				`before=${row.before.path}; before_date=${row.before.timestampLabel ?? ""}; after=${row.after.path}; after_date=${row.after.timestampLabel ?? ""}`,
				formatDecimal(row.gapDays),
			),
		);
	}

	for (const row of examples.revisionLags.slice(0, effectiveLimit)) {
		rows.push(
			buildAdvancedCsvRow(
				"structural_example_revision_lag",
				"",
				"structural_examples",
				row.path,
				formatDecimal(row.lagDays),
				`created=${row.createdAtLabel ?? ""}; updated=${row.updatedAtLabel ?? ""}; words=${formatDecimal(row.wordCount)}`,
				formatDecimal(row.lagDays),
			),
		);
	}

	for (const row of examples.recurringPhrases.slice(0, effectiveLimit)) {
		rows.push(
			buildAdvancedCsvRow(
				"structural_example_phrase",
				"",
				"structural_examples",
				row.phrase,
				row.supportEntries.toString(),
				`avg_gap_days=${formatDecimal(row.averageGapDays ?? 0)}; notes=${row.examplePaths.join(" | ")}`,
				formatDecimal(row.recurrenceScore),
			),
		);
	}

	for (const row of examples.tagPairLifts.slice(0, effectiveLimit)) {
		rows.push(
			buildAdvancedCsvRow(
				"structural_example_tag_pair",
				"",
				"structural_examples",
				row.label,
				row.support.toString(),
				`lift=${formatDecimal(row.lift)}; notes=${row.examplePaths.join(" | ")}`,
				formatDecimal(row.lift),
			),
		);
	}

	for (const row of examples.bridgeTags.slice(0, effectiveLimit)) {
		rows.push(
			buildAdvancedCsvRow(
				"structural_example_bridge_tag",
				"",
				"structural_examples",
				row.label,
				row.frequency.toString(),
				`degree=${row.degree}; notes=${row.examplePaths.join(" | ")}`,
				formatDecimal(row.bridgeScore),
			),
		);
	}

	for (const row of examples.regimeShifts.slice(0, effectiveLimit)) {
		rows.push(
			buildAdvancedCsvRow(
				"structural_example_regime_shift",
				row.toYear.toString(),
				"structural_examples",
				`${row.fromYear}->${row.toYear}`,
				formatDecimal(row.score),
				`from_notes=${row.fromPaths.join(" | ")}; to_notes=${row.toPaths.join(" | ")}`,
				formatDecimal(row.score),
			),
		);
	}
}
