import type {
	BodyTextFeatures,
	BodyTextMetricsSummary,
	BodyTextMonthClimate,
	BodyTextOpeningShift,
	BodyTextOpeningSignature,
	BodyTextOpeningSignatureDistribution,
	BodyTextRecurringPhrase,
	BodyTextTagProfile,
	BodyTextYearProfile,
	DiaryFileAnalysis,
	DiaryStatsSettings,
} from "../types";
import { buildCzechNormalizedMetricsSummary } from "./czech-text-metrics";
import { formatBodyTextMetricScopeSummary, isYearIncludedInBodyTextMetricScope } from "./body-text-scope";

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const OPENING_SIGNATURE_ORDER: BodyTextOpeningSignature[] = [
	"declarative",
	"fragmentary",
	"descriptive",
	"temporal",
	"emotional",
	"scene-setting",
	"other",
];

interface TextEntry {
	path: string;
	year: number;
	month: number;
	epochDay: number;
	wordCount: number;
	revisionLagDays: number | null;
	tags: string[];
	features: BodyTextFeatures;
	lexicalRichness: number | null;
}

interface PhraseAggregateDraft {
	phrase: string;
	entryPaths: Set<string>;
	years: Set<number>;
	epochDays: number[];
}

interface RecurringPhraseBuildResult {
	topRecurringPhrases: BodyTextRecurringPhrase[];
	recurringEntryPaths: Set<string>;
}

export function buildBodyTextMetricsSummary(
	files: DiaryFileAnalysis[],
	settings: Pick<
		DiaryStatsSettings,
		| "enableBodyTextAnalysis"
		| "enableCzechNormalizedDeepTextAnalysis"
		| "minimumTagFrequency"
		| "bodyTextMetricTimeScope"
		| "bodyTextMetricFromYear"
		| "bodyTextMetricToYear"
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
): BodyTextMetricsSummary {
	if (!settings.enableBodyTextAnalysis) {
		return createEmptyBodyTextMetricsSummary(false, settings);
	}

	const entries = toTextEntries(files);
	const scopedEntries = entries.filter((entry) => isYearIncluded(entry.year, settings));
	if (scopedEntries.length === 0) {
		return createEmptyBodyTextMetricsSummary(true, settings);
	}

	const recurringPhrases = buildRecurringPhraseResult(scopedEntries);
	const yearProfiles = buildYearProfiles(scopedEntries, recurringPhrases.recurringEntryPaths);
	const monthClimateProfiles = buildMonthClimateProfiles(scopedEntries);
	const openingSignatureDistribution = buildOpeningSignatureDistribution(scopedEntries);
	const tagProfiles = buildTagProfiles(scopedEntries, settings);
	const overallLexicalRichness = computeGroupLexicalRichness(scopedEntries);
	const dominantOpeningSignature = openingSignatureDistribution[0]?.signature ?? null;
	const sentenceMonthProfiles = monthClimateProfiles.filter((profile) => profile.averageSentenceLength !== null);

	return {
		enabled: true,
		analyzedEntryCount: scopedEntries.length,
		timeScopeMode: settings.bodyTextMetricTimeScope,
		timeScopeFromYear: settings.bodyTextMetricFromYear,
		timeScopeToYear: settings.bodyTextMetricToYear,
		timeScopeLabel: formatBodyTextMetricScopeSummary(settings),
		overallLexicalRichness,
		dominantOpeningSignature,
		richestVocabularyYear: getTopBy(yearProfiles, (profile) => profile.lexicalRichness ?? Number.NEGATIVE_INFINITY),
		mostNovelYear: getTopBy(yearProfiles, (profile) => profile.noveltyRate ?? Number.NEGATIVE_INFINITY),
		mostRepetitiveYear: getTopBy(yearProfiles, (profile) => profile.recurringPhraseShare ?? Number.NEGATIVE_INFINITY),
		strongestPhraseFamily: recurringPhrases.topRecurringPhrases[0] ?? null,
		longestSentenceMonth: getTopBy(
			sentenceMonthProfiles,
			(profile) => profile.averageSentenceLength ?? Number.NEGATIVE_INFINITY,
		),
		shortestSentenceMonth: getTopBy(sentenceMonthProfiles, (profile) =>
			profile.averageSentenceLength === null ? Number.POSITIVE_INFINITY : -profile.averageSentenceLength,
		),
		richestTag: getTopBy(tagProfiles, (profile) => profile.averageLexicalRichness ?? Number.NEGATIVE_INFINITY),
		longestEntryTag: getTopBy(tagProfiles, (profile) => profile.averageWords),
		shortestEntryTag: getTopBy(tagProfiles, (profile) => -profile.averageWords),
		mostRevisedTag: getTopBy(tagProfiles, (profile) => profile.averageRevisionLagDays ?? Number.NEGATIVE_INFINITY),
		sharpestOpeningShift: buildOpeningShift(entries),
		yearProfiles,
		monthClimateProfiles,
		topRecurringPhrases: recurringPhrases.topRecurringPhrases,
		openingSignatureDistribution,
		tagProfiles,
		czechNormalized: buildCzechNormalizedMetricsSummary(files, settings),
	};
}

function createEmptyBodyTextMetricsSummary(
	enabled: boolean,
	settings: Pick<
		DiaryStatsSettings,
		| "bodyTextMetricTimeScope"
		| "bodyTextMetricFromYear"
		| "bodyTextMetricToYear"
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
): BodyTextMetricsSummary {
	return {
		enabled,
		analyzedEntryCount: 0,
		timeScopeMode: settings.bodyTextMetricTimeScope,
		timeScopeFromYear: settings.bodyTextMetricFromYear,
		timeScopeToYear: settings.bodyTextMetricToYear,
		timeScopeLabel: formatBodyTextMetricScopeSummary(settings),
		overallLexicalRichness: null,
		dominantOpeningSignature: null,
		richestVocabularyYear: null,
		mostNovelYear: null,
		mostRepetitiveYear: null,
		strongestPhraseFamily: null,
		longestSentenceMonth: null,
		shortestSentenceMonth: null,
		richestTag: null,
		longestEntryTag: null,
		shortestEntryTag: null,
		mostRevisedTag: null,
		sharpestOpeningShift: null,
		yearProfiles: [],
		monthClimateProfiles: [],
		topRecurringPhrases: [],
		openingSignatureDistribution: [],
		tagProfiles: [],
		czechNormalized: buildCzechNormalizedMetricsSummary([], settings),
	};
}

function toTextEntries(files: DiaryFileAnalysis[]): TextEntry[] {
	return files
		.filter((file) => file.createdAt.value !== null && file.bodyTextFeatures !== null)
		.map((file) => {
			const createdAt = file.createdAt.value!;
			const features = file.bodyTextFeatures!;

			return {
				path: file.path,
				year: createdAt.year,
				month: createdAt.month,
				epochDay: Math.floor(createdAt.epochMillis / (24 * 60 * 60 * 1000)),
				wordCount: file.wordCount,
				revisionLagDays:
					file.updatedAt.value && file.updatedAt.value.epochMillis >= createdAt.epochMillis
						? Math.floor((file.updatedAt.value.epochMillis - createdAt.epochMillis) / (24 * 60 * 60 * 1000))
						: null,
				tags: file.normalizedTags,
				features,
				lexicalRichness: computeLexicalRichness(
					features.normalizedTokenCount,
					features.uniqueNormalizedTokenCount,
				),
			};
		});
}

function buildRecurringPhraseResult(entries: TextEntry[]): RecurringPhraseBuildResult {
	const phraseMap = new Map<string, PhraseAggregateDraft>();

	for (const entry of entries) {
		for (const phrase of entry.features.phraseCandidates) {
			const existing = phraseMap.get(phrase);
			if (existing) {
				existing.entryPaths.add(entry.path);
				existing.years.add(entry.year);
				existing.epochDays.push(entry.epochDay);
				continue;
			}

			phraseMap.set(phrase, {
				phrase,
				entryPaths: new Set([entry.path]),
				years: new Set([entry.year]),
				epochDays: [entry.epochDay],
			});
		}
	}

	const recurringPhrases = [...phraseMap.values()]
		.filter((phrase) => phrase.entryPaths.size >= 2)
		.map((phrase) => {
			const years = [...phrase.years].sort((left, right) => left - right);
			const firstYear = years[0] ?? 0;
			const lastYear = years[years.length - 1] ?? firstYear;
			const averageGapDays = computeAverageGapDays(phrase.epochDays);
			const spanYears = Math.max(0, lastYear - firstYear);
			const recurrenceScore =
				phrase.entryPaths.size * Math.log2(2 + spanYears) * Math.log2(2 + (averageGapDays ?? 0));

			return {
				phrase: phrase.phrase,
				supportEntries: phrase.entryPaths.size,
				firstYear,
				lastYear,
				averageGapDays,
				recurrenceScore,
			} satisfies BodyTextRecurringPhrase;
		})
		.sort(
			(left, right) =>
				right.recurrenceScore - left.recurrenceScore ||
				right.supportEntries - left.supportEntries ||
				left.phrase.localeCompare(right.phrase),
		);

	const recurringEntryPaths = new Set<string>();
	for (const phrase of recurringPhrases) {
		const draft = phraseMap.get(phrase.phrase);
		if (!draft) {
			continue;
		}

		for (const path of draft.entryPaths) {
			recurringEntryPaths.add(path);
		}
	}

	return {
		topRecurringPhrases: recurringPhrases,
		recurringEntryPaths,
	};
}

function buildYearProfiles(entries: TextEntry[], recurringEntryPaths: Set<string>): BodyTextYearProfile[] {
	const entriesByYear = groupEntries(entries, (entry) => entry.year);
	const sortedYears = [...entriesByYear.keys()].sort((left, right) => left - right);
	const seenVocabulary = new Set<string>();
	const yearProfiles: BodyTextYearProfile[] = [];

	for (const year of sortedYears) {
		const yearEntries = entriesByYear.get(year) ?? [];
		const yearVocabulary = collectVocabulary(yearEntries);
		const noveltyRate =
			yearVocabulary.size === 0
				? null
				: [...yearVocabulary].filter((term) => !seenVocabulary.has(term)).length / yearVocabulary.size;

		for (const term of yearVocabulary) {
			seenVocabulary.add(term);
		}

		const openingDistribution = buildOpeningSignatureDistribution(yearEntries);
		const dominantOpeningSignature = openingDistribution[0] ?? null;
		const recurringEntryCount = yearEntries.filter((entry) => recurringEntryPaths.has(entry.path)).length;

		yearProfiles.push({
			year,
			entryCount: yearEntries.length,
			lexicalRichness: computeGroupLexicalRichness(yearEntries),
			noveltyRate,
			averageSentenceLength: computeAverageSentenceLength(yearEntries),
			sentenceLengthVariation: computeSentenceLengthVariation(yearEntries),
			dominantOpeningSignature: dominantOpeningSignature?.signature ?? null,
			dominantOpeningSignatureShare: dominantOpeningSignature?.share ?? null,
			recurringPhraseShare: yearEntries.length === 0 ? null : recurringEntryCount / yearEntries.length,
		});
	}

	return yearProfiles;
}

function buildMonthClimateProfiles(entries: TextEntry[]): BodyTextMonthClimate[] {
	const entriesByMonth = groupEntries(entries, (entry) => entry.month);
	const profiles: BodyTextMonthClimate[] = [];

	for (let month = 1; month <= 12; month += 1) {
		const monthEntries = entriesByMonth.get(month) ?? [];
		profiles.push({
			monthIndex: month,
			monthLabel: MONTH_LABELS[month - 1] ?? month.toString(),
			entryCount: monthEntries.length,
			lexicalRichness: monthEntries.length === 0 ? null : computeGroupLexicalRichness(monthEntries),
			averageSentenceLength: monthEntries.length === 0 ? null : computeAverageSentenceLength(monthEntries),
			sentenceLengthVariation: monthEntries.length === 0 ? null : computeSentenceLengthVariation(monthEntries),
		});
	}

	return profiles;
}

function buildOpeningSignatureDistribution(
	entries: TextEntry[],
): BodyTextOpeningSignatureDistribution[] {
	const counts = new Map<BodyTextOpeningSignature, number>();

	for (const entry of entries) {
		const signature = entry.features.openingSignature;
		if (!signature) {
			continue;
		}

		counts.set(signature, (counts.get(signature) ?? 0) + 1);
	}

	const total = [...counts.values()].reduce((sum, count) => sum + count, 0);
	if (total === 0) {
		return [];
	}

	return OPENING_SIGNATURE_ORDER.map((signature) => {
		const count = counts.get(signature) ?? 0;
		return {
			signature,
			count,
			share: count / total,
		};
	})
		.filter((row) => row.count > 0)
		.sort((left, right) => right.count - left.count || left.signature.localeCompare(right.signature));
}

function buildTagProfiles(
	entries: TextEntry[],
	settings: Pick<
		DiaryStatsSettings,
		| "minimumTagFrequency"
	>,
): BodyTextTagProfile[] {
	const tagCounts = new Map<string, number>();

	for (const entry of entries) {
		for (const tag of entry.tags) {
			tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
		}
	}

	const qualifyingTags = [...tagCounts.entries()]
		.filter(([, count]) => count >= settings.minimumTagFrequency)
		.map(([tag]) => tag);

	return qualifyingTags
		.map((tag) => {
			const tagEntries = entries.filter((entry) => entry.tags.includes(tag));
			const revisionLagValues = tagEntries
				.map((entry) => entry.revisionLagDays)
				.filter((value): value is number => value !== null && value > 0);
			const sentenceLengthValues = tagEntries
				.map((entry) => getEntryAverageSentenceLength(entry))
				.filter((value): value is number => value !== null && value > 0);

			return {
				label: tag,
				support: tagEntries.length,
				averageWords: computeAverage(tagEntries.map((entry) => entry.wordCount)),
				medianWords: computeMedian(tagEntries.map((entry) => entry.wordCount)),
				averageLexicalRichness: computeAverageOptional(tagEntries.map((entry) => entry.lexicalRichness)),
				averageSentenceLength: computeAverageSentenceLength(tagEntries),
				medianSentenceLength: computeMedian(sentenceLengthValues),
				averageRevisionLagDays: revisionLagValues.length === 0 ? null : computeAverage(revisionLagValues),
				medianRevisionLagDays: computeMedian(revisionLagValues),
			} satisfies BodyTextTagProfile;
		})
		.sort(
			(left, right) =>
				right.support - left.support ||
				(right.averageLexicalRichness ?? Number.NEGATIVE_INFINITY) -
					(left.averageLexicalRichness ?? Number.NEGATIVE_INFINITY) ||
				left.label.localeCompare(right.label),
		);
}

function buildOpeningShift(entries: TextEntry[]): BodyTextOpeningShift | null {
	const entriesByYear = groupEntries(entries, (entry) => entry.year);
	const years = [...entriesByYear.keys()].sort((left, right) => left - right);
	let bestShift: BodyTextOpeningShift | null = null;

	for (let index = 1; index < years.length; index += 1) {
		const fromYear = years[index - 1];
		const toYear = years[index];
		if (fromYear === undefined || toYear === undefined) {
			continue;
		}

		const fromDistribution = distributionFromOpeningSignatures(entriesByYear.get(fromYear) ?? []);
		const toDistribution = distributionFromOpeningSignatures(entriesByYear.get(toYear) ?? []);
		const score = computeDistributionDistance(fromDistribution, toDistribution);

		if (!bestShift || score > bestShift.score) {
			bestShift = {
				fromYear,
				toYear,
				score,
			};
		}
	}

	return bestShift;
}

function collectVocabulary(entries: TextEntry[]): Set<string> {
	const vocabulary = new Set<string>();
	for (const entry of entries) {
		for (const term of entry.features.normalizedVocabulary) {
			vocabulary.add(term);
		}
	}

	return vocabulary;
}

function computeGroupLexicalRichness(entries: TextEntry[]): number | null {
	const totalTokens = entries.reduce((sum, entry) => sum + entry.features.normalizedTokenCount, 0);
	const vocabularySize = collectVocabulary(entries).size;
	return computeLexicalRichness(totalTokens, vocabularySize);
}

function computeLexicalRichness(totalTokens: number, uniqueTokens: number): number | null {
	if (totalTokens < 2 || uniqueTokens < 2) {
		return null;
	}

	return Math.log(uniqueTokens) / Math.log(totalTokens);
}

function computeAverageSentenceLength(entries: TextEntry[]): number | null {
	const sentenceCount = entries.reduce((sum, entry) => sum + entry.features.sentenceCount, 0);
	if (sentenceCount === 0) {
		return null;
	}

	const sentenceWordTotal = entries.reduce((sum, entry) => sum + entry.features.sentenceWordTotal, 0);
	return sentenceWordTotal / sentenceCount;
}

function computeSentenceLengthVariation(entries: TextEntry[]): number | null {
	const sentenceCount = entries.reduce((sum, entry) => sum + entry.features.sentenceCount, 0);
	if (sentenceCount === 0) {
		return null;
	}

	const sentenceWordTotal = entries.reduce((sum, entry) => sum + entry.features.sentenceWordTotal, 0);
	const sentenceWordSquareTotal = entries.reduce((sum, entry) => sum + entry.features.sentenceWordSquareTotal, 0);
	const mean = sentenceWordTotal / sentenceCount;
	const variance = Math.max(0, sentenceWordSquareTotal / sentenceCount - mean * mean);
	return Math.sqrt(variance);
}

function distributionFromOpeningSignatures(entries: TextEntry[]): number[] {
	const counts = new Map<BodyTextOpeningSignature, number>();
	for (const entry of entries) {
		const signature = entry.features.openingSignature;
		if (!signature) {
			continue;
		}

		counts.set(signature, (counts.get(signature) ?? 0) + 1);
	}

	const total = [...counts.values()].reduce((sum, count) => sum + count, 0);
	if (total === 0) {
		return OPENING_SIGNATURE_ORDER.map(() => 0);
	}

	return OPENING_SIGNATURE_ORDER.map((signature) => (counts.get(signature) ?? 0) / total);
}

function computeDistributionDistance(left: number[], right: number[]): number {
	const length = Math.max(left.length, right.length);
	let totalVariation = 0;

	for (let index = 0; index < length; index += 1) {
		totalVariation += Math.abs((left[index] ?? 0) - (right[index] ?? 0));
	}

	return totalVariation / 2;
}

function computeAverageGapDays(epochDays: number[]): number | null {
	const uniqueDays = [...new Set(epochDays)].sort((left, right) => left - right);
	if (uniqueDays.length < 2) {
		return null;
	}

	let totalGap = 0;
	for (let index = 1; index < uniqueDays.length; index += 1) {
		const previousDay = uniqueDays[index - 1];
		const currentDay = uniqueDays[index];
		if (previousDay === undefined || currentDay === undefined) {
			continue;
		}

		totalGap += currentDay - previousDay;
	}

	return totalGap / (uniqueDays.length - 1);
}

function isYearIncluded(
	year: number,
	settings: Pick<
		DiaryStatsSettings,
		| "bodyTextMetricTimeScope"
		| "bodyTextMetricFromYear"
		| "bodyTextMetricToYear"
	>,
): boolean {
	return isYearIncludedInBodyTextMetricScope(year, settings);
}

function groupEntries<TKey extends number>(entries: TextEntry[], keySelector: (entry: TextEntry) => TKey): Map<TKey, TextEntry[]> {
	const grouped = new Map<TKey, TextEntry[]>();

	for (const entry of entries) {
		const key = keySelector(entry);
		const existing = grouped.get(key);
		if (existing) {
			existing.push(entry);
			continue;
		}

		grouped.set(key, [entry]);
	}

	return grouped;
}

function computeAverage(values: number[]): number {
	return values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;
}

function computeMedian(values: number[]): number | null {
	if (values.length === 0) {
		return null;
	}

	const sortedValues = [...values].sort((left, right) => left - right);
	const middleIndex = Math.floor(sortedValues.length / 2);
	if (sortedValues.length % 2 === 1) {
		return sortedValues[middleIndex] ?? null;
	}

	const leftValue = sortedValues[middleIndex - 1];
	const rightValue = sortedValues[middleIndex];
	if (leftValue === undefined || rightValue === undefined) {
		return null;
	}

	return (leftValue + rightValue) / 2;
}

function computeAverageOptional(values: Array<number | null>): number | null {
	const numericValues = values.filter((value): value is number => value !== null);
	return numericValues.length === 0 ? null : computeAverage(numericValues);
}

function getEntryAverageSentenceLength(entry: TextEntry): number | null {
	if (entry.features.sentenceCount <= 0) {
		return null;
	}

	return entry.features.sentenceWordTotal / entry.features.sentenceCount;
}

function getTopBy<T>(items: T[], scoreSelector: (item: T) => number): T | null {
	let bestItem: T | null = null;
	let bestScore = Number.NEGATIVE_INFINITY;

	for (const item of items) {
		const score = scoreSelector(item);
		if (score > bestScore) {
			bestScore = score;
			bestItem = item;
		}
	}

	return bestItem;
}
