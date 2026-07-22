import type {
	CzechNormalizedTextFeatures,
	DiaryStatsSettings,
	PeriodSignatureSummary,
	PeriodSignatureTerm,
} from "../types";

const TERM_MIN_SUPPORT = 2;
const SMOOTHING_ALPHA = 0.5;

export interface PeriodSignatureEntry {
	year: number;
	features: Pick<CzechNormalizedTextFeatures, "contentTokenCount" | "contentFrequencies">;
}

export function buildPeriodSignatureSummary(
	entries: PeriodSignatureEntry[],
	settings: Pick<
		DiaryStatsSettings,
		| "enablePeriodSignatureAnalysis"
		| "periodSignatureComparisonMode"
		| "periodSignatureFromYear"
		| "periodSignatureToYear"
	>,
): PeriodSignatureSummary {
	if (!settings.enablePeriodSignatureAnalysis) {
		return createEmptyPeriodSignatureSummary(false, settings, "Latest scoped year", "Comparison unavailable");
	}

	if (entries.length === 0) {
		return createEmptyPeriodSignatureSummary(true, settings, "Latest scoped year", "Comparison unavailable");
	}

	const years = [...new Set(entries.map((entry) => entry.year))].sort((left, right) => left - right);
	const latestYear = years[years.length - 1] ?? null;
	const selectedFromYear =
		settings.periodSignatureFromYear ??
		settings.periodSignatureToYear ??
		latestYear;
	const selectedToYear =
		settings.periodSignatureToYear ??
		settings.periodSignatureFromYear ??
		latestYear;

	if (selectedFromYear === null || selectedToYear === null) {
		return createEmptyPeriodSignatureSummary(true, settings, "Latest scoped year", "Comparison unavailable");
	}

	const normalizedFromYear = Math.min(selectedFromYear, selectedToYear);
	const normalizedToYear = Math.max(selectedFromYear, selectedToYear);
	const selectedEntries = entries.filter(
		(entry) => entry.year >= normalizedFromYear && entry.year <= normalizedToYear,
	);
	const comparisonEntries =
		settings.periodSignatureComparisonMode === "vs-earlier"
			? entries.filter((entry) => entry.year < normalizedFromYear)
			: entries.filter((entry) => entry.year < normalizedFromYear || entry.year > normalizedToYear);
	const selectedPeriodLabel = formatYearSpanLabel(normalizedFromYear, normalizedToYear);
	const comparisonLabel =
		settings.periodSignatureComparisonMode === "vs-earlier"
			? normalizedFromYear === normalizedToYear
				? `Years before ${normalizedFromYear}`
				: `Years before ${normalizedFromYear}-${normalizedToYear}`
			: `All other scoped years outside ${selectedPeriodLabel}`;

	if (selectedEntries.length === 0 || comparisonEntries.length === 0) {
		return {
			...createEmptyPeriodSignatureSummary(true, settings, selectedPeriodLabel, comparisonLabel),
			selectedFromYear: normalizedFromYear,
			selectedToYear: normalizedToYear,
			selectedEntryCount: selectedEntries.length,
			comparisonEntryCount: comparisonEntries.length,
		};
	}

	const selectedTokenCount = selectedEntries.reduce((sum, entry) => sum + entry.features.contentTokenCount, 0);
	const comparisonTokenCount = comparisonEntries.reduce((sum, entry) => sum + entry.features.contentTokenCount, 0);
	const selectedCounts = buildTermCounts(selectedEntries);
	const comparisonCounts = buildTermCounts(comparisonEntries);
	const candidateTerms = [...new Set([...selectedCounts.keys(), ...comparisonCounts.keys()])].sort((left, right) =>
		left.localeCompare(right),
	);

	const scoredTerms: PeriodSignatureTerm[] = candidateTerms
		.map((term) =>
			buildPeriodSignatureTerm(
				term,
				selectedCounts.get(term) ?? 0,
				comparisonCounts.get(term) ?? 0,
				selectedTokenCount,
				comparisonTokenCount,
				candidateTerms.length,
			),
		)
		.filter((term) => term.selectedCount + term.comparisonCount >= TERM_MIN_SUPPORT);

	const topDistinctiveTerms = scoredTerms
		.filter((term) => term.score > 0)
		.sort(
			(left, right) =>
				right.score - left.score ||
				right.selectedCount - left.selectedCount ||
				left.term.localeCompare(right.term),
		);
	const topEmergentTerms = scoredTerms
		.filter((term) => term.comparisonCount === 0 && term.selectedCount >= TERM_MIN_SUPPORT)
		.sort(
			(left, right) =>
				right.selectedRate - left.selectedRate ||
				right.selectedCount - left.selectedCount ||
				left.term.localeCompare(right.term),
		);
	const topFadingTerms = scoredTerms
		.filter((term) => term.score < 0)
		.sort(
			(left, right) =>
				left.score - right.score ||
				right.comparisonCount - left.comparisonCount ||
				left.term.localeCompare(right.term),
		);

	return {
		enabled: true,
		comparisonMode: settings.periodSignatureComparisonMode,
		selectedFromYear: normalizedFromYear,
		selectedToYear: normalizedToYear,
		selectedPeriodLabel,
		comparisonLabel,
		selectedEntryCount: selectedEntries.length,
		comparisonEntryCount: comparisonEntries.length,
		selectedContentTokenCount: selectedTokenCount,
		comparisonContentTokenCount: comparisonTokenCount,
		candidateTermCount: scoredTerms.length,
		distinctiveTermCount: topDistinctiveTerms.length,
		emergentTermCount: topEmergentTerms.length,
		fadingTermCount: topFadingTerms.length,
		strongestDistinctiveTerm: topDistinctiveTerms[0] ?? null,
		strongestEmergentTerm: topEmergentTerms[0] ?? null,
		strongestFadingTerm: topFadingTerms[0] ?? null,
		topDistinctiveTerms,
		topEmergentTerms,
		topFadingTerms,
	};
}

function createEmptyPeriodSignatureSummary(
	enabled: boolean,
	settings: Pick<
		DiaryStatsSettings,
		| "periodSignatureComparisonMode"
		| "periodSignatureFromYear"
		| "periodSignatureToYear"
	>,
	selectedPeriodLabel: string,
	comparisonLabel: string,
): PeriodSignatureSummary {
	return {
		enabled,
		comparisonMode: settings.periodSignatureComparisonMode,
		selectedFromYear: settings.periodSignatureFromYear,
		selectedToYear: settings.periodSignatureToYear,
		selectedPeriodLabel,
		comparisonLabel,
		selectedEntryCount: 0,
		comparisonEntryCount: 0,
		selectedContentTokenCount: 0,
		comparisonContentTokenCount: 0,
		candidateTermCount: 0,
		distinctiveTermCount: 0,
		emergentTermCount: 0,
		fadingTermCount: 0,
		strongestDistinctiveTerm: null,
		strongestEmergentTerm: null,
		strongestFadingTerm: null,
		topDistinctiveTerms: [],
		topEmergentTerms: [],
		topFadingTerms: [],
	};
}

function buildTermCounts(entries: PeriodSignatureEntry[]): Map<string, number> {
	const counts = new Map<string, number>();

	for (const entry of entries) {
		for (const [term, count] of Object.entries(entry.features.contentFrequencies)) {
			counts.set(term, (counts.get(term) ?? 0) + count);
		}
	}

	return counts;
}

function buildPeriodSignatureTerm(
	term: string,
	selectedCount: number,
	comparisonCount: number,
	selectedTokenCount: number,
	comparisonTokenCount: number,
	vocabularySize: number,
): PeriodSignatureTerm {
	const selectedRate =
		(selectedCount + SMOOTHING_ALPHA) /
		(selectedTokenCount + SMOOTHING_ALPHA * Math.max(1, vocabularySize));
	const comparisonRate =
		(comparisonCount + SMOOTHING_ALPHA) /
		(comparisonTokenCount + SMOOTHING_ALPHA * Math.max(1, vocabularySize));

	return {
		term,
		selectedCount,
		comparisonCount,
		selectedRate,
		comparisonRate,
		score: Math.log2(selectedRate / comparisonRate),
	};
}

function formatYearSpanLabel(fromYear: number, toYear: number): string {
	return fromYear === toYear ? fromYear.toString() : `${fromYear}-${toYear}`;
}
