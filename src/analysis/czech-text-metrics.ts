import type {
	CzechNormalizedMetricsSummary,
	CzechNormalizedTextFeatures,
	CzechNormalizedYearProfile,
	DiaryFileAnalysis,
	DiaryStatsSettings,
} from "../types";
import {
	formatDeepTextScopeSummary,
	formatDeepTextTagFilterSummary,
	isFileIncludedInDeepTextScope,
	resolveDeepTextScope,
} from "./deep-text-scope";
import { buildEntityAnalysisSummary } from "./entities";
import { buildPeriodSignatureSummary } from "./period-signature";

interface CzechScopedEntry {
	year: number;
	createdEpochMillis: number;
	features: CzechNormalizedTextFeatures;
}

export function buildCzechNormalizedMetricsSummary(
	files: DiaryFileAnalysis[],
	settings: Pick<
		DiaryStatsSettings,
		| "enableCzechNormalizedDeepTextAnalysis"
		| "deepTextAnalysisScopeMode"
		| "deepTextAnalysisFromYear"
		| "deepTextAnalysisToYear"
		| "deepTextIncludedTags"
		| "deepTextExcludedTags"
		| "hierarchicalTagMode"
		| "ignoredTags"
		| "tagAliasMap"
		| "enablePeriodSignatureAnalysis"
		| "enableEntityRelationshipAnalysis"
		| "periodSignatureComparisonMode"
		| "periodSignatureFromYear"
		| "periodSignatureToYear"
	>,
): CzechNormalizedMetricsSummary {
	const scope = resolveDeepTextScope(settings);
	if (!settings.enableCzechNormalizedDeepTextAnalysis) {
		return createEmptyCzechNormalizedMetricsSummary(false, scope, settings);
	}

	const scopedEntries: CzechScopedEntry[] = files
		.filter(
			(file) =>
				file.createdAt.value !== null &&
				file.bodyTextFeatures?.czechNormalized !== null &&
				file.bodyTextFeatures?.czechNormalized !== undefined &&
				isFileIncludedInDeepTextScope(file, scope),
		)
		.map((file) => ({
			year: file.createdAt.value!.year,
			createdEpochMillis: file.createdAt.value!.epochMillis,
			features: file.bodyTextFeatures!.czechNormalized!,
		}));

	if (scopedEntries.length === 0) {
		return createEmptyCzechNormalizedMetricsSummary(true, scope, settings);
	}

	const overallVocabulary = collectVocabulary(scopedEntries);
	const overallNormalizedTokenCount = scopedEntries.reduce(
		(sum, entry) => sum + entry.features.normalizedTokenCount,
		0,
	);
	const overallContentTokenCount = scopedEntries.reduce((sum, entry) => sum + entry.features.contentTokenCount, 0);
	const yearProfiles = buildYearProfiles(scopedEntries);

	return {
		enabled: true,
		scopeMode: scope.mode,
		scopeFromYear: scope.fromYear,
		scopeToYear: scope.toYear,
		scopeLabel: formatDeepTextScopeSummary(scope),
		includedTags: scope.includedTags,
		excludedTags: scope.excludedTags,
		tagFilterLabel: formatDeepTextTagFilterSummary(scope),
		analyzedEntryCount: scopedEntries.length,
		overallVocabularySize: overallVocabulary.size,
		overallContentTokenCount,
		overallLexicalRichness: computeLexicalRichness(overallContentTokenCount, overallVocabulary.size),
		overallContentShare: computeContentShare(overallContentTokenCount, overallNormalizedTokenCount),
		richestYear: getTopBy(yearProfiles, (profile) => profile.lexicalRichness ?? Number.NEGATIVE_INFINITY),
		mostNovelYear: getTopBy(yearProfiles, (profile) => profile.noveltyRate ?? Number.NEGATIVE_INFINITY),
		densestContentYear: getTopBy(yearProfiles, (profile) => profile.contentShare ?? Number.NEGATIVE_INFINITY),
		yearProfiles,
		periodSignature: buildPeriodSignatureSummary(scopedEntries, settings),
		entities: buildEntityAnalysisSummary(scopedEntries, settings),
	};
}

function createEmptyCzechNormalizedMetricsSummary(
	enabled: boolean,
	scope: ReturnType<typeof resolveDeepTextScope>,
	settings: Pick<
		DiaryStatsSettings,
		| "enablePeriodSignatureAnalysis"
		| "enableEntityRelationshipAnalysis"
		| "periodSignatureComparisonMode"
		| "periodSignatureFromYear"
		| "periodSignatureToYear"
	>,
): CzechNormalizedMetricsSummary {
	return {
		enabled,
		scopeMode: scope.mode,
		scopeFromYear: scope.fromYear,
		scopeToYear: scope.toYear,
		scopeLabel: formatDeepTextScopeSummary(scope),
		includedTags: scope.includedTags,
		excludedTags: scope.excludedTags,
		tagFilterLabel: formatDeepTextTagFilterSummary(scope),
		analyzedEntryCount: 0,
		overallVocabularySize: 0,
		overallContentTokenCount: 0,
		overallLexicalRichness: null,
		overallContentShare: null,
		richestYear: null,
		mostNovelYear: null,
		densestContentYear: null,
		yearProfiles: [],
		periodSignature: buildPeriodSignatureSummary([], settings),
		entities: buildEntityAnalysisSummary([], settings),
	};
}

function buildYearProfiles(entries: CzechScopedEntry[]): CzechNormalizedYearProfile[] {
	const grouped = groupEntriesByYear(entries);
	const years = [...grouped.keys()].sort((left, right) => left - right);
	const seenVocabulary = new Set<string>();
	const profiles: CzechNormalizedYearProfile[] = [];

	for (const year of years) {
		const yearEntries = grouped.get(year) ?? [];
		const yearVocabulary = collectVocabulary(yearEntries);
		const normalizedTokenCount = yearEntries.reduce((sum, entry) => sum + entry.features.normalizedTokenCount, 0);
		const contentTokenCount = yearEntries.reduce((sum, entry) => sum + entry.features.contentTokenCount, 0);
		const newTermCount = [...yearVocabulary].filter((term) => !seenVocabulary.has(term)).length;

		for (const term of yearVocabulary) {
			seenVocabulary.add(term);
		}

		profiles.push({
			year,
			entryCount: yearEntries.length,
			contentTokenCount,
			vocabularySize: yearVocabulary.size,
			lexicalRichness: computeLexicalRichness(contentTokenCount, yearVocabulary.size),
			noveltyRate: yearVocabulary.size === 0 ? null : newTermCount / yearVocabulary.size,
			contentShare: computeContentShare(contentTokenCount, normalizedTokenCount),
		});
	}

	return profiles;
}

function groupEntriesByYear(entries: CzechScopedEntry[]): Map<number, CzechScopedEntry[]> {
	const grouped = new Map<number, CzechScopedEntry[]>();
	for (const entry of entries) {
		const existing = grouped.get(entry.year);
		if (existing) {
			existing.push(entry);
			continue;
		}

		grouped.set(entry.year, [entry]);
	}

	return grouped;
}

function collectVocabulary(entries: CzechScopedEntry[]): Set<string> {
	const vocabulary = new Set<string>();
	for (const entry of entries) {
		for (const token of entry.features.contentVocabulary) {
			vocabulary.add(token);
		}
	}

	return vocabulary;
}

function computeLexicalRichness(totalTokens: number, uniqueTokens: number): number | null {
	if (totalTokens < 2 || uniqueTokens < 2) {
		return null;
	}

	return Math.log(uniqueTokens) / Math.log(totalTokens);
}

function computeContentShare(contentTokens: number, normalizedTokens: number): number | null {
	if (normalizedTokens <= 0) {
		return null;
	}

	return contentTokens / normalizedTokens;
}

function getTopBy<T>(rows: T[], scoreSelector: (row: T) => number): T | null {
	let bestRow: T | null = null;
	let bestScore = Number.NEGATIVE_INFINITY;

	for (const row of rows) {
		const score = scoreSelector(row);
		if (!Number.isFinite(score) || score <= bestScore) {
			continue;
		}

		bestRow = row;
		bestScore = score;
	}

	return bestRow;
}
