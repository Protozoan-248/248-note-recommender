import type {
	AdvancedBridgeTag,
	AdvancedHeadline,
	AdvancedHiddenStructureSummary,
	AdvancedMetricsSummary,
	AdvancedProductivityMode,
	AdvancedRegimeShift,
	AdvancedRevisionStructureSummary,
	AdvancedTagCoupling,
	AdvancedTagInterval,
	AdvancedTagPairLift,
	AdvancedTagPersistence,
	AdvancedTagStructureSummary,
	AdvancedTagWeekdayBias,
	AdvancedTemporalRhythmSummary,
	AdvancedVolumeStructureSummary,
	AdvancedYearProfile,
	BodyTextMetricsSummary,
	DiaryFileAnalysis,
	DiaryStatsSettings,
} from "../types";
import { estimateReadingTimeMinutes } from "./reading-time";
import { isYearIncludedInTagMetricScope } from "./tag-scope";
import { buildBodyTextMetricsSummary } from "./text-metrics";

const DAY_MS = 24 * 60 * 60 * 1000;
const SEASON_LABELS = ["Winter", "Spring", "Summer", "Autumn"];
const WEEKDAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

interface AdvancedEntry {
	year: number;
	month: number;
	weekday: number;
	epochDay: number;
	wordCount: number;
	readingTimeMinutes: number;
	revisionLagDays: number | null;
	noteDepthScore: number;
	tags: string[];
}

interface DayActivity {
	year: number;
	month: number;
	weekday: number;
	epochDay: number;
	entryCount: number;
	wordCount: number;
	revisionEntryCount: number;
}

interface TemporalMetrics {
	burstinessIndex: number;
	longestSilenceGapDays: number;
	p90SilenceGapDays: number;
	longSilenceShare: number;
	streakFragility: number;
	seasonalAsymmetry: number;
	dominantSeason: string | null;
}

interface VolumeMetrics {
	lengthSkewness: number;
	tailHeaviness: number;
	compressionExpansionRatio: number;
	writingConcentrationIndex: number;
	averageWords: number;
}

interface RevisionMetrics {
	usableEntryCount: number;
	revisitedEntryCount: number;
	revisitRatio: number;
	medianLagDays: number;
	p90LagDays: number;
	maxLagDays: number;
	revisionHalfLifeDays: number;
	revisionWeightedWordsIndex: number;
	revisionIntensityNormalized: number;
}

interface TagDistribution {
	counts: Map<string, number>;
	totalOccurrences: number;
	entropy: number | null;
	concentration: number | null;
}

interface TagContext {
	filteredEntries: AdvancedEntry[];
	qualifiedEntries: AdvancedEntry[];
	qualifyingTags: Set<string>;
	yearDistributions: Map<number, TagDistribution>;
	topPairLifts: AdvancedTagPairLift[];
	bridgeTags: AdvancedBridgeTag[];
	weekdayBiases: AdvancedTagWeekdayBias[];
	fastestReturningTag: AdvancedTagInterval | null;
	mostPersistentTag: AdvancedTagPersistence | null;
	longestLifespanTag: AdvancedTagPersistence | null;
	strongestRecurringMotif: AdvancedTagPairLift | null;
	strongestPositiveCoupling: AdvancedTagCoupling | null;
	strongestNegativeCoupling: AdvancedTagCoupling | null;
	overallEntropy: number;
	overallConcentration: number;
}

interface YearProfileDraft {
	year: number;
	entryCount: number;
	totalWords: number;
	averageWords: number;
	burstinessIndex: number;
	longestSilenceGapDays: number;
	streakFragility: number;
	seasonalAsymmetry: number;
	writingConcentrationIndex: number;
	revisitRatio: number;
	medianRevisionLagDays: number;
	revisionWeightedWordsIndex: number;
	revisionIntensityNormalized: number;
	tagEntropy: number | null;
	tagConcentration: number | null;
	productivityMode: string;
	regimeShiftFromPrevious: number | null;
}

export function buildAdvancedMetricsSummary(
	files: DiaryFileAnalysis[],
	settings: Pick<
		DiaryStatsSettings,
		| "readingWordsPerMinute"
		| "minimumTagFrequency"
		| "tagMetricTimeScope"
		| "tagMetricFromYear"
		| "tagMetricToYear"
		| "tagAnalysisIncludedYears"
		| "tagAnalysisExcludedYears"
		| "enableBodyTextAnalysis"
		| "enableCzechNormalizedDeepTextAnalysis"
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
): Omit<AdvancedMetricsSummary, "structuralExamples"> {
	const entries = toAdvancedEntries(files, settings.readingWordsPerMinute);
	const yearEntries = groupEntriesByYear(entries);
	const temporalRhythmBase = buildTemporalMetrics(entries);
	const volumeStructureBase = buildVolumeMetrics(entries, false);
	const revisionStructureBase = buildRevisionMetrics(entries);
	const weekdayBiasStability = computeWeekdayBiasStability(yearEntries);
	const tagContext = buildTagContext(entries, settings);
	const bodyText = buildBodyTextMetricsSummary(files, settings);

	const yearProfileDrafts: YearProfileDraft[] = [...yearEntries.entries()]
		.sort(([left], [right]) => left - right)
		.map(([year, yearGroup]) => {
			const temporal = buildTemporalMetrics(yearGroup);
			const volume = buildVolumeMetrics(yearGroup, true);
			const revision = buildRevisionMetrics(yearGroup);
			const tagDistribution = tagContext.yearDistributions.get(year);

			return {
				year,
				entryCount: yearGroup.length,
				totalWords: yearGroup.reduce((sum, entry) => sum + entry.wordCount, 0),
				averageWords: volume.averageWords,
				burstinessIndex: temporal.burstinessIndex,
				longestSilenceGapDays: temporal.longestSilenceGapDays,
				streakFragility: temporal.streakFragility,
				seasonalAsymmetry: temporal.seasonalAsymmetry,
				writingConcentrationIndex: volume.writingConcentrationIndex,
				revisitRatio: revision.revisitRatio,
				medianRevisionLagDays: revision.medianLagDays,
				revisionWeightedWordsIndex: revision.revisionWeightedWordsIndex,
				revisionIntensityNormalized: revision.revisionIntensityNormalized,
				tagEntropy: tagDistribution?.entropy ?? null,
				tagConcentration: tagDistribution?.concentration ?? null,
				productivityMode: "mixed cadence",
				regimeShiftFromPrevious: null,
			} satisfies YearProfileDraft;
		});

	const productivityModes = classifyProductivityModes(yearProfileDrafts);
	const regimeShifts = buildRegimeShifts(yearProfileDrafts, tagContext.yearDistributions, bodyText);

	for (const productivityMode of productivityModes) {
		const matchingDraft = yearProfileDrafts.find((draft) => draft.year === productivityMode.year);
		if (matchingDraft) {
			matchingDraft.productivityMode = productivityMode.mode;
		}
	}

	for (const regimeShift of regimeShifts) {
		const matchingDraft = yearProfileDrafts.find((draft) => draft.year === regimeShift.toYear);
		if (matchingDraft) {
			matchingDraft.regimeShiftFromPrevious = regimeShift.score;
		}
	}

	const yearProfiles: AdvancedYearProfile[] = yearProfileDrafts.map((draft) => ({
		year: draft.year,
		entryCount: draft.entryCount,
		totalWords: draft.totalWords,
		averageWords: draft.averageWords,
		burstinessIndex: draft.burstinessIndex,
		longestSilenceGapDays: draft.longestSilenceGapDays,
		streakFragility: draft.streakFragility,
		seasonalAsymmetry: draft.seasonalAsymmetry,
		writingConcentrationIndex: draft.writingConcentrationIndex,
		revisitRatio: draft.revisitRatio,
		medianRevisionLagDays: draft.medianRevisionLagDays,
		revisionWeightedWordsIndex: draft.revisionWeightedWordsIndex,
		tagEntropy: draft.tagEntropy,
		tagConcentration: draft.tagConcentration,
		productivityMode: draft.productivityMode,
		regimeShiftFromPrevious: draft.regimeShiftFromPrevious,
	}));

	const temporalRhythm: AdvancedTemporalRhythmSummary = {
		...temporalRhythmBase,
		weekdayBiasStability,
	};
	const volumeStructure: AdvancedVolumeStructureSummary = {
		lengthSkewness: volumeStructureBase.lengthSkewness,
		tailHeaviness: volumeStructureBase.tailHeaviness,
		compressionExpansionRatio: volumeStructureBase.compressionExpansionRatio,
		writingConcentrationIndex: volumeStructureBase.writingConcentrationIndex,
	};
	const revisionStructure: AdvancedRevisionStructureSummary = {
		usableEntryCount: revisionStructureBase.usableEntryCount,
		revisitedEntryCount: revisionStructureBase.revisitedEntryCount,
		revisitRatio: revisionStructureBase.revisitRatio,
		medianLagDays: revisionStructureBase.medianLagDays,
		p90LagDays: revisionStructureBase.p90LagDays,
		maxLagDays: revisionStructureBase.maxLagDays,
		revisionHalfLifeDays: revisionStructureBase.revisionHalfLifeDays,
		revisionWeightedWordsIndex: revisionStructureBase.revisionWeightedWordsIndex,
	};
	const tagStructure: AdvancedTagStructureSummary = {
		overallEntropy: tagContext.overallEntropy,
		overallConcentration: tagContext.overallConcentration,
		fastestReturningTag: tagContext.fastestReturningTag,
		mostPersistentTag: tagContext.mostPersistentTag,
		longestLifespanTag: tagContext.longestLifespanTag,
		strongestRecurringMotif: tagContext.strongestRecurringMotif,
		strongestPositiveCoupling: tagContext.strongestPositiveCoupling,
		strongestNegativeCoupling: tagContext.strongestNegativeCoupling,
		topPairLifts: tagContext.topPairLifts,
		bridgeTags: tagContext.bridgeTags,
		weekdayBiases: tagContext.weekdayBiases,
	};
	const hiddenStructure: AdvancedHiddenStructureSummary = {
		sharpestRegimeShift: getTopBy(regimeShifts, (shift) => shift.score),
		cadenceDepthCorrelation: computeCadenceDepthCorrelation(entries),
		revisionLengthCorrelation: computeRevisionLengthCorrelation(entries),
		strongestWeekdaySemanticBias: tagContext.weekdayBiases[0] ?? null,
		productivityModes,
		regimeShifts,
		predominantMode: getMostCommonMode(productivityModes),
		structuralReadings: buildStructuralReadings(yearProfileDrafts, tagStructure, bodyText, regimeShifts),
	};

	return {
		headlineCards: buildHeadlineCards(yearProfileDrafts, tagStructure, bodyText, hiddenStructure),
		temporalRhythm,
		volumeStructure,
		revisionStructure,
		tagStructure,
		bodyText,
		hiddenStructure,
		yearProfiles,
	};
}

function toAdvancedEntries(
	files: DiaryFileAnalysis[],
	readingWordsPerMinute: number,
): AdvancedEntry[] {
	return files
		.filter((file) => file.createdAt.value !== null && file.chronologyYear !== null)
		.map((file) => {
			const createdAt = file.createdAt.value!;
			const updatedAt = file.updatedAt.value;
			const revisionLagDays =
				createdAt && updatedAt && updatedAt.epochMillis >= createdAt.epochMillis
					? (updatedAt.epochMillis - createdAt.epochMillis) / DAY_MS
					: null;
			const readingTimeMinutes = estimateReadingTimeMinutes(file.wordCount, readingWordsPerMinute);
			const noteDepthScore =
				readingTimeMinutes * (1 + Math.log1p(Math.max(0, revisionLagDays ?? 0)) / 4);

			return {
				year: createdAt.year,
				month: createdAt.month,
				weekday: createdAt.weekday,
				epochDay: toEpochDay(createdAt.year, createdAt.month, createdAt.day),
				wordCount: file.wordCount,
				readingTimeMinutes,
				revisionLagDays,
				noteDepthScore,
				tags: file.normalizedTags,
			} satisfies AdvancedEntry;
		})
		.sort((left, right) => left.epochDay - right.epochDay || left.wordCount - right.wordCount);
}

function groupEntriesByYear(entries: AdvancedEntry[]): Map<number, AdvancedEntry[]> {
	const yearMap = new Map<number, AdvancedEntry[]>();

	for (const entry of entries) {
		const existingEntries = yearMap.get(entry.year) ?? [];
		existingEntries.push(entry);
		yearMap.set(entry.year, existingEntries);
	}

	return yearMap;
}

function buildTemporalMetrics(entries: AdvancedEntry[]): TemporalMetrics {
	const dayActivities = buildDayActivities(entries);
	const intervalDays = buildIntervalDays(dayActivities);
	const silenceGaps = intervalDays.map((interval) => Math.max(0, interval - 1));
	const streakLengths = buildStreakLengths(intervalDays);
	const seasonSignals = buildSeasonSignals(entries);

	return {
		burstinessIndex: computeBurstiness(intervalDays),
		longestSilenceGapDays: getMax(silenceGaps),
		p90SilenceGapDays: getPercentile(silenceGaps, 0.9),
		longSilenceShare: computeShare(silenceGaps, (gap) => gap >= 30),
		streakFragility: streakLengths.length > 0 ? computeShare(streakLengths, (length) => length <= 2) : 0,
		seasonalAsymmetry: seasonSignals.maxShare - seasonSignals.minShare,
		dominantSeason: seasonSignals.dominantSeason,
	};
}

function buildVolumeMetrics(entries: AdvancedEntry[], byYear: boolean): VolumeMetrics {
	const wordCounts = entries.map((entry) => entry.wordCount).sort((left, right) => left - right);
	const averageWords = entries.length > 0 ? entries.reduce((sum, entry) => sum + entry.wordCount, 0) / entries.length : 0;
	const medianWords = getPercentile(wordCounts, 0.5);
	const stddevWords = getStandardDeviation(wordCounts, averageWords);
	const shortThreshold = medianWords * 0.5;
	const longThreshold = medianWords * 1.5;
	const shortCount = entries.filter((entry) => entry.wordCount <= shortThreshold).length;
	const longCount = entries.filter((entry) => entry.wordCount >= longThreshold).length;

	return {
		lengthSkewness: stddevWords > 0 ? (3 * (averageWords - medianWords)) / stddevWords : 0,
		tailHeaviness: medianWords > 0 ? getPercentile(wordCounts, 0.9) / medianWords : 0,
		compressionExpansionRatio: (shortCount + 1) / (longCount + 1),
		writingConcentrationIndex: buildWritingConcentrationIndex(entries, byYear),
		averageWords,
	};
}

function buildRevisionMetrics(entries: AdvancedEntry[]): RevisionMetrics {
	const usableEntries = entries.filter((entry) => entry.revisionLagDays !== null);
	const revisitedEntries = usableEntries.filter((entry) => (entry.revisionLagDays ?? 0) > 0);
	const lagDays = revisitedEntries
		.map((entry) => entry.revisionLagDays ?? 0)
		.filter((lag) => lag > 0)
		.sort((left, right) => left - right);
	const totalWords = entries.reduce((sum, entry) => sum + entry.wordCount, 0);
	const revisionWeightedWordsIndex = revisitedEntries.reduce(
		(sum, entry) => sum + entry.wordCount * Math.log1p(entry.revisionLagDays ?? 0),
		0,
	);

	return {
		usableEntryCount: usableEntries.length,
		revisitedEntryCount: revisitedEntries.length,
		revisitRatio: usableEntries.length > 0 ? revisitedEntries.length / usableEntries.length : 0,
		medianLagDays: getPercentile(lagDays, 0.5),
		p90LagDays: getPercentile(lagDays, 0.9),
		maxLagDays: getMax(lagDays),
		revisionHalfLifeDays: getWeightedMedian(
			revisitedEntries.map((entry) => ({
				value: entry.revisionLagDays ?? 0,
				weight: Math.max(1, entry.wordCount),
			})),
		),
		revisionWeightedWordsIndex,
		revisionIntensityNormalized: totalWords > 0 ? revisionWeightedWordsIndex / totalWords : 0,
	};
}

function computeWeekdayBiasStability(yearEntries: Map<number, AdvancedEntry[]>): number {
	const overallDistribution = normalizeDistribution(buildWeekdayCounts([...yearEntries.values()].flat()));
	let weightedDistanceTotal = 0;
	let weightTotal = 0;

	for (const entries of yearEntries.values()) {
		if (entries.length === 0) {
			continue;
		}

		const distribution = normalizeDistribution(buildWeekdayCounts(entries));
		const distance = computeJensenShannonDistance(distribution, overallDistribution);
		weightedDistanceTotal += distance * entries.length;
		weightTotal += entries.length;
	}

	if (weightTotal === 0) {
		return 0;
	}

	return Math.max(0, 1 - weightedDistanceTotal / weightTotal);
}

function buildTagContext(
	entries: AdvancedEntry[],
	settings: Pick<
		DiaryStatsSettings,
		| "minimumTagFrequency"
		| "tagMetricTimeScope"
		| "tagMetricFromYear"
		| "tagMetricToYear"
		| "tagAnalysisIncludedYears"
		| "tagAnalysisExcludedYears"
	>,
): TagContext {
	const filteredEntries = filterEntriesForTagMetrics(entries, settings);
	const baselineWordAverage =
		filteredEntries.length > 0 ? filteredEntries.reduce((sum, entry) => sum + entry.wordCount, 0) / filteredEntries.length : 0;
	const tagCounts = new Map<string, number>();

	for (const entry of filteredEntries) {
		for (const tag of new Set(entry.tags)) {
			tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
		}
	}

	const qualifyingTags = new Set(
		[...tagCounts.entries()]
			.filter(([, count]) => count >= settings.minimumTagFrequency)
			.map(([tag]) => tag),
	);

	const qualifiedEntries = filteredEntries
		.map((entry) => ({
			...entry,
			tags: entry.tags.filter((tag) => qualifyingTags.has(tag)),
		}))
		.filter((entry) => entry.tags.length > 0);

	const overallDistribution = buildTagDistribution(qualifiedEntries);
	const yearDistributions = new Map<number, TagDistribution>();
	for (const [year, yearEntries] of groupEntriesByYear(qualifiedEntries)) {
		yearDistributions.set(year, buildTagDistribution(yearEntries));
	}

	const pairCounts = new Map<string, number>();
	const adjacency = new Map<string, Set<string>>();
	for (const entry of qualifiedEntries) {
		const uniqueTags = [...new Set(entry.tags)].sort((left, right) => left.localeCompare(right));
		for (let leftIndex = 0; leftIndex < uniqueTags.length; leftIndex += 1) {
			const leftTag = uniqueTags[leftIndex];
			if (!leftTag) {
				continue;
			}
			for (let rightIndex = leftIndex + 1; rightIndex < uniqueTags.length; rightIndex += 1) {
				const rightTag = uniqueTags[rightIndex];
				if (!rightTag) {
					continue;
				}

				const pairKey = `${leftTag} + ${rightTag}`;
				pairCounts.set(pairKey, (pairCounts.get(pairKey) ?? 0) + 1);
				linkTags(adjacency, leftTag, rightTag);
			}
		}
	}

	const topPairLifts = buildTopPairLifts(qualifiedEntries.length, tagCounts, pairCounts, qualifyingTags);
	const bridgeTags = buildBridgeTags(adjacency, tagCounts, qualifyingTags);
	const weekdayBiases = buildWeekdaySemanticBiases(qualifiedEntries, tagCounts, qualifyingTags);
	const fastestReturningTag = buildFastestReturningTag(qualifiedEntries, qualifyingTags);
	const persistenceLeaders = buildPersistenceLeaders(qualifiedEntries, qualifyingTags);
	const tagCouplings = buildTagLengthCouplings(qualifiedEntries, tagCounts, qualifyingTags, baselineWordAverage);

	return {
		filteredEntries,
		qualifiedEntries,
		qualifyingTags,
		yearDistributions,
		topPairLifts,
		bridgeTags,
		weekdayBiases,
		fastestReturningTag,
		mostPersistentTag: persistenceLeaders.mostPersistentTag,
		longestLifespanTag: persistenceLeaders.longestLifespanTag,
		strongestRecurringMotif: topPairLifts[0] ?? null,
		strongestPositiveCoupling: tagCouplings.positive[0] ?? null,
		strongestNegativeCoupling: tagCouplings.negative[0] ?? null,
		overallEntropy: overallDistribution.entropy ?? 0,
		overallConcentration: overallDistribution.concentration ?? 0,
	};
}

function filterEntriesForTagMetrics(
	entries: AdvancedEntry[],
	settings: Pick<
		DiaryStatsSettings,
		| "tagMetricTimeScope"
		| "tagMetricFromYear"
		| "tagMetricToYear"
		| "tagAnalysisIncludedYears"
		| "tagAnalysisExcludedYears"
	>,
): AdvancedEntry[] {
	return entries.filter((entry) => isYearIncludedInTagMetricScope(entry.year, settings));
}

function buildTagDistribution(entries: AdvancedEntry[]): TagDistribution {
	const counts = new Map<string, number>();
	let totalOccurrences = 0;

	for (const entry of entries) {
		for (const tag of entry.tags) {
			counts.set(tag, (counts.get(tag) ?? 0) + 1);
			totalOccurrences += 1;
		}
	}

	return {
		counts,
		totalOccurrences,
		entropy: totalOccurrences > 0 ? computeEntropy([...counts.values()]) : null,
		concentration: totalOccurrences > 0 ? computeHerfindahlIndex([...counts.values()], totalOccurrences) : null,
	};
}

function buildTopPairLifts(
	totalEntries: number,
	tagCounts: Map<string, number>,
	pairCounts: Map<string, number>,
	qualifyingTags: Set<string>,
): AdvancedTagPairLift[] {
	if (totalEntries <= 0) {
		return [];
	}

	return [...pairCounts.entries()]
		.map(([pairKey, support]) => {
			const [leftTag, rightTag] = pairKey.split(" + ");
			if (!leftTag || !rightTag || !qualifyingTags.has(leftTag) || !qualifyingTags.has(rightTag) || support < 2) {
				return null;
			}

			const leftProbability = (tagCounts.get(leftTag) ?? 0) / totalEntries;
			const rightProbability = (tagCounts.get(rightTag) ?? 0) / totalEntries;
			const pairProbability = support / totalEntries;
			const lift =
				leftProbability > 0 && rightProbability > 0
					? pairProbability / (leftProbability * rightProbability)
					: 0;

			return {
				label: pairKey,
				support,
				lift,
			} satisfies AdvancedTagPairLift;
		})
		.filter((pair): pair is AdvancedTagPairLift => pair !== null)
		.sort((left, right) => right.lift - left.lift || right.support - left.support || left.label.localeCompare(right.label))
		.slice(0, 10);
}

function buildBridgeTags(
	adjacency: Map<string, Set<string>>,
	tagCounts: Map<string, number>,
	qualifyingTags: Set<string>,
): AdvancedBridgeTag[] {
	return [...qualifyingTags]
		.map((tag) => {
			const neighbors = adjacency.get(tag) ?? new Set<string>();
			const degree = neighbors.size;
			const clustering = computeClusteringCoefficient(tag, adjacency);
			const frequency = tagCounts.get(tag) ?? 0;

			return {
				label: tag,
				frequency,
				degree,
				bridgeScore: degree * (1 - clustering) * Math.log1p(frequency),
			} satisfies AdvancedBridgeTag;
		})
		.sort(
			(left, right) =>
				right.bridgeScore - left.bridgeScore ||
				right.degree - left.degree ||
				right.frequency - left.frequency ||
				left.label.localeCompare(right.label),
		)
		.slice(0, 10);
}

function buildWeekdaySemanticBiases(
	entries: AdvancedEntry[],
	tagCounts: Map<string, number>,
	qualifyingTags: Set<string>,
): AdvancedTagWeekdayBias[] {
	const baselineDistribution = normalizeDistribution(buildWeekdayCounts(entries));
	const tagWeekdayCounts = new Map<string, number[]>();

	for (const entry of entries) {
		for (const tag of new Set(entry.tags)) {
			if (!qualifyingTags.has(tag)) {
				continue;
			}

			const counts = tagWeekdayCounts.get(tag) ?? Array<number>(7).fill(0);
			counts[entry.weekday] = (counts[entry.weekday] ?? 0) + 1;
			tagWeekdayCounts.set(tag, counts);
		}
	}

	const biases: AdvancedTagWeekdayBias[] = [];
	for (const [tag, weekdayCounts] of tagWeekdayCounts.entries()) {
		const tagCount = tagCounts.get(tag) ?? 0;
		if (tagCount <= 0) {
			continue;
		}

		for (let weekdayIndex = 0; weekdayIndex < weekdayCounts.length; weekdayIndex += 1) {
			const support = weekdayCounts[weekdayIndex] ?? 0;
			if (support < 2) {
				continue;
			}

			const tagDayShare = support / tagCount;
			const baselineShare = baselineDistribution[weekdayIndex] ?? 0;
			biases.push({
				label: tag,
				weekdayLabel: WEEKDAY_LABELS[weekdayIndex] ?? "Unknown",
				support,
				lift: baselineShare > 0 ? tagDayShare / baselineShare : 0,
			});
		}
	}

	return biases
		.sort((left, right) => right.lift - left.lift || right.support - left.support || left.label.localeCompare(right.label))
		.slice(0, 10);
}

function buildFastestReturningTag(
	entries: AdvancedEntry[],
	qualifyingTags: Set<string>,
): AdvancedTagInterval | null {
	const tagDays = new Map<string, Set<number>>();

	for (const entry of entries) {
		for (const tag of new Set(entry.tags)) {
			if (!qualifyingTags.has(tag)) {
				continue;
			}

			const existingDays = tagDays.get(tag) ?? new Set<number>();
			existingDays.add(entry.epochDay);
			tagDays.set(tag, existingDays);
		}
	}

	return [...tagDays.entries()]
		.map(([tag, days]) => {
			const sortedDays = [...days].sort((left, right) => left - right);
			const gaps: number[] = [];
			for (let index = 1; index < sortedDays.length; index += 1) {
				const previousDay = sortedDays[index - 1];
				const currentDay = sortedDays[index];
				if (previousDay === undefined || currentDay === undefined) {
					continue;
				}

				gaps.push(currentDay - previousDay);
			}

			if (gaps.length === 0) {
				return null;
			}

			return {
				label: tag,
				support: gaps.length,
				averageGapDays: getAverage(gaps),
			} satisfies AdvancedTagInterval;
		})
		.filter((item): item is AdvancedTagInterval => item !== null)
		.sort((left, right) => left.averageGapDays - right.averageGapDays || right.support - left.support || left.label.localeCompare(right.label))[0] ?? null;
}

function buildPersistenceLeaders(
	entries: AdvancedEntry[],
	qualifyingTags: Set<string>,
): { mostPersistentTag: AdvancedTagPersistence | null; longestLifespanTag: AdvancedTagPersistence | null } {
	const tagYears = new Map<string, Set<number>>();

	for (const entry of entries) {
		for (const tag of new Set(entry.tags)) {
			if (!qualifyingTags.has(tag)) {
				continue;
			}

			const years = tagYears.get(tag) ?? new Set<number>();
			years.add(entry.year);
			tagYears.set(tag, years);
		}
	}

	const candidates = [...tagYears.entries()]
		.map(([tag, years]) => {
			const sortedYears = [...years].sort((left, right) => left - right);
			const consecutiveRunYears = getLongestConsecutiveRun(sortedYears);

			return {
				label: tag,
				lifespanYears: sortedYears.length,
				consecutiveRunYears,
				persistenceScore: sortedYears.length > 0 ? consecutiveRunYears / sortedYears.length : 0,
			} satisfies AdvancedTagPersistence;
		});

	return {
		mostPersistentTag:
			candidates
				.slice()
				.sort(
					(left, right) =>
						right.persistenceScore - left.persistenceScore ||
						right.consecutiveRunYears - left.consecutiveRunYears ||
						right.lifespanYears - left.lifespanYears ||
						left.label.localeCompare(right.label),
				)[0] ?? null,
		longestLifespanTag:
			candidates
				.slice()
				.sort(
					(left, right) =>
						right.lifespanYears - left.lifespanYears ||
						right.consecutiveRunYears - left.consecutiveRunYears ||
						right.persistenceScore - left.persistenceScore ||
						left.label.localeCompare(right.label),
				)[0] ?? null,
	};
}

function buildTagLengthCouplings(
	entries: AdvancedEntry[],
	tagCounts: Map<string, number>,
	qualifyingTags: Set<string>,
	baselineWordAverage: number,
): { positive: AdvancedTagCoupling[]; negative: AdvancedTagCoupling[] } {
	const tagWordCounts = new Map<string, number[]>();

	for (const entry of entries) {
		for (const tag of new Set(entry.tags)) {
			if (!qualifyingTags.has(tag)) {
				continue;
			}

			const wordCounts = tagWordCounts.get(tag) ?? [];
			wordCounts.push(entry.wordCount);
			tagWordCounts.set(tag, wordCounts);
		}
	}

	const couplings: AdvancedTagCoupling[] = [...tagWordCounts.entries()].map(([tag, wordCounts]) => ({
		label: tag,
		support: tagCounts.get(tag) ?? 0,
		averageWordDelta: getAverage(wordCounts) - baselineWordAverage,
	}));

	return {
		positive: couplings
			.filter((coupling) => coupling.averageWordDelta > 0)
			.sort((left, right) => right.averageWordDelta - left.averageWordDelta || right.support - left.support)
			.slice(0, 10),
		negative: couplings
			.filter((coupling) => coupling.averageWordDelta < 0)
			.sort((left, right) => left.averageWordDelta - right.averageWordDelta || right.support - left.support)
			.slice(0, 10),
	};
}

function classifyProductivityModes(yearProfiles: YearProfileDraft[]): AdvancedProductivityMode[] {
	const medianEntryCount = getPercentile(yearProfiles.map((profile) => profile.entryCount).sort((left, right) => left - right), 0.5);
	const medianAverageWords = getPercentile(
		yearProfiles.map((profile) => profile.averageWords).sort((left, right) => left - right),
		0.5,
	);
	const medianConcentration = getPercentile(
		yearProfiles.map((profile) => profile.writingConcentrationIndex).sort((left, right) => left - right),
		0.5,
	);
	const medianRevisionIntensity = getPercentile(
		yearProfiles.map((profile) => profile.revisionIntensityNormalized).sort((left, right) => left - right),
		0.5,
	);

	return yearProfiles.map((profile) => {
		if (profile.revisitRatio >= 0.25 && profile.revisionIntensityNormalized >= Math.max(0.05, medianRevisionIntensity * 1.2)) {
			return {
				year: profile.year,
				mode: "revision-heavy layering",
				rationale: "Revisits and delayed revision carry more weight than in a typical year.",
			};
		}

		if (profile.burstinessIndex >= 0.2 && profile.averageWords <= medianAverageWords) {
			return {
				year: profile.year,
				mode: "bursty short-form",
				rationale: "Entry timing is clustered while note depth stays relatively short.",
			};
		}

		if (
			profile.writingConcentrationIndex >= medianConcentration * 1.15 &&
			profile.averageWords >= medianAverageWords
		) {
			return {
				year: profile.year,
				mode: "concentrated deep-writing",
				rationale: "Writing concentrates into fewer periods while entries remain comparatively deep.",
			};
		}

		if (profile.entryCount >= medianEntryCount && profile.averageWords >= medianAverageWords) {
			return {
				year: profile.year,
				mode: "steady prolific",
				rationale: "The year combines above-median cadence with above-median depth.",
			};
		}

		if (profile.entryCount < medianEntryCount && profile.averageWords >= medianAverageWords) {
			return {
				year: profile.year,
				mode: "sparse deep-writing",
				rationale: "Entries are less frequent, but the average note remains comparatively deep.",
			};
		}

		return {
			year: profile.year,
			mode: "mixed cadence",
			rationale: "No single rhythm or revision pattern dominates the year strongly enough to define it.",
		};
	});
}

function buildRegimeShifts(
	yearProfiles: YearProfileDraft[],
	yearDistributions: Map<number, TagDistribution>,
	bodyText: BodyTextMetricsSummary,
): AdvancedRegimeShift[] {
	const shifts: AdvancedRegimeShift[] = [];
	const textYearProfiles = new Map(bodyText.yearProfiles.map((profile) => [profile.year, profile]));

	for (let index = 1; index < yearProfiles.length; index += 1) {
		const previousProfile = yearProfiles[index - 1];
		const currentProfile = yearProfiles[index];
		if (!previousProfile || !currentProfile) {
			continue;
		}

		const previousDistribution = normalizeDistributionFromTagDistribution(yearDistributions.get(previousProfile.year));
		const currentDistribution = normalizeDistributionFromTagDistribution(yearDistributions.get(currentProfile.year));
		const tagChange =
			previousDistribution.length > 0 && currentDistribution.length > 0
				? computeJensenShannonDistance(previousDistribution, currentDistribution)
				: 0;
		const volumeChange = Math.min(
			1,
			Math.abs(Math.log((currentProfile.totalWords + 1) / (previousProfile.totalWords + 1))),
		);
		const revisionChange = Math.min(1, Math.abs(currentProfile.revisitRatio - previousProfile.revisitRatio));
		const cadenceChange = Math.min(
			1,
			Math.abs(currentProfile.burstinessIndex - previousProfile.burstinessIndex) * 2,
		);
		const previousTextProfile = textYearProfiles.get(previousProfile.year) ?? null;
		const currentTextProfile = textYearProfiles.get(currentProfile.year) ?? null;
		const hasTextProfiles = previousTextProfile !== null && currentTextProfile !== null;
		const textChange = hasTextProfiles
			? computeTextChange(previousTextProfile, currentTextProfile)
			: 0;
		const score = hasTextProfiles
			? tagChange * 0.35 + textChange * 0.2 + volumeChange * 0.2 + revisionChange * 0.125 + cadenceChange * 0.125
			: tagChange * 0.45 + volumeChange * 0.25 + revisionChange * 0.15 + cadenceChange * 0.15;

		shifts.push({
			fromYear: previousProfile.year,
			toYear: currentProfile.year,
			score,
			tagChange,
			textChange,
			volumeChange,
			revisionChange,
			cadenceChange,
		});
	}

	return shifts.sort((left, right) => right.score - left.score || left.toYear - right.toYear);
}

function computeCadenceDepthCorrelation(entries: AdvancedEntry[]): number | null {
	if (entries.length < 2) {
		return null;
	}

	const cadenceGaps: number[] = [];
	const noteDepths: number[] = [];

	for (let index = 1; index < entries.length; index += 1) {
		const previousEntry = entries[index - 1];
		const currentEntry = entries[index];
		if (!previousEntry || !currentEntry) {
			continue;
		}

		cadenceGaps.push(Math.max(0, currentEntry.epochDay - previousEntry.epochDay));
		noteDepths.push(currentEntry.noteDepthScore);
	}

	return computePearsonCorrelation(cadenceGaps, noteDepths);
}

function computeRevisionLengthCorrelation(entries: AdvancedEntry[]): number | null {
	const lagDays: number[] = [];
	const wordCounts: number[] = [];

	for (const entry of entries) {
		if (entry.revisionLagDays === null || entry.revisionLagDays <= 0) {
			continue;
		}

		lagDays.push(entry.revisionLagDays);
		wordCounts.push(entry.wordCount);
	}

	return computePearsonCorrelation(lagDays, wordCounts);
}

function buildHeadlineCards(
	yearProfiles: YearProfileDraft[],
	tagStructure: AdvancedTagStructureSummary,
	bodyText: BodyTextMetricsSummary,
	hiddenStructure: AdvancedHiddenStructureSummary,
): AdvancedHeadline[] {
	const mostBurstyYear = getTopBy(yearProfiles, (profile) => profile.burstinessIndex);
	const mostRevisionHeavyYear = getTopBy(yearProfiles, (profile) => profile.revisionIntensityNormalized);
	const mostThematicallyConcentratedYear = getTopBy(
		yearProfiles.filter((profile) => profile.tagConcentration !== null),
		(profile) => profile.tagConcentration ?? 0,
	);
	const mostSemanticallyDiverseYear = getTopBy(
		yearProfiles.filter((profile) => profile.tagEntropy !== null),
		(profile) => profile.tagEntropy ?? 0,
	);
	const mostConcentratedWritingYear = getTopBy(yearProfiles, (profile) => profile.writingConcentrationIndex);
	const mostRevisitedYear = getTopBy(yearProfiles, (profile) => profile.revisitRatio);

	const cards: AdvancedHeadline[] = [
		{
			label: "Most bursty year",
			value: mostBurstyYear ? mostBurstyYear.year.toString() : "(none)",
			detail: mostBurstyYear ? `Burstiness ${formatMetric(mostBurstyYear.burstinessIndex)}` : "Not enough dated entries.",
		},
		{
			label: "Most revision-heavy year",
			value: mostRevisionHeavyYear ? mostRevisionHeavyYear.year.toString() : "(none)",
			detail: mostRevisionHeavyYear
				? `Revision intensity ${formatMetric(mostRevisionHeavyYear.revisionIntensityNormalized)}`
				: "No usable revision data.",
		},
		{
			label: "Most thematically concentrated year",
			value: mostThematicallyConcentratedYear ? mostThematicallyConcentratedYear.year.toString() : "(none)",
			detail: mostThematicallyConcentratedYear
				? `Tag concentration ${formatMetric(mostThematicallyConcentratedYear.tagConcentration ?? 0)}`
				: "No qualifying tag distribution.",
		},
		{
			label: "Most semantically diverse year",
			value: mostSemanticallyDiverseYear ? mostSemanticallyDiverseYear.year.toString() : "(none)",
			detail: mostSemanticallyDiverseYear
				? `Tag entropy ${formatMetric(mostSemanticallyDiverseYear.tagEntropy ?? 0)}`
				: "No qualifying tag distribution.",
		},
		{
			label: "Strongest recurring motif",
			value: tagStructure.strongestRecurringMotif?.label ?? "(none)",
			detail: tagStructure.strongestRecurringMotif
				? `Lift ${formatMetric(tagStructure.strongestRecurringMotif.lift)}, support ${tagStructure.strongestRecurringMotif.support}`
				: "No qualifying tag pair.",
		},
		{
			label: "Sharpest regime shift year",
			value: hiddenStructure.sharpestRegimeShift?.toYear.toString() ?? "(none)",
			detail: hiddenStructure.sharpestRegimeShift
				? `From ${hiddenStructure.sharpestRegimeShift.fromYear}, score ${formatMetric(hiddenStructure.sharpestRegimeShift.score)}`
				: "Not enough adjacent years.",
		},
		{
			label: "Most concentrated writing year",
			value: mostConcentratedWritingYear ? mostConcentratedWritingYear.year.toString() : "(none)",
			detail: mostConcentratedWritingYear
				? `Concentration ${formatMetric(mostConcentratedWritingYear.writingConcentrationIndex)}`
				: "Not enough dated entries.",
		},
		{
			label: "Most revisited year",
			value: mostRevisitedYear ? mostRevisitedYear.year.toString() : "(none)",
			detail: mostRevisitedYear ? `Revisit ratio ${formatMetric(mostRevisitedYear.revisitRatio)}` : "No usable revision data.",
		},
	];

	if (bodyText.enabled) {
		cards.push(
			{
				label: "Richest vocabulary year",
				value: bodyText.richestVocabularyYear ? bodyText.richestVocabularyYear.year.toString() : "(none)",
				detail: bodyText.richestVocabularyYear
					? `Lexical richness ${formatMetric(bodyText.richestVocabularyYear.lexicalRichness ?? 0)}`
					: "No body-text year profile.",
			},
			{
				label: "Most repetitive phrasing year",
				value: bodyText.mostRepetitiveYear ? bodyText.mostRepetitiveYear.year.toString() : "(none)",
				detail: bodyText.mostRepetitiveYear
					? `Recurring phrase share ${formatMetric(bodyText.mostRepetitiveYear.recurringPhraseShare ?? 0)}`
					: "No recurring phrase profile.",
			},
			{
				label: "Sharpest opening-style shift",
				value: bodyText.sharpestOpeningShift ? bodyText.sharpestOpeningShift.toYear.toString() : "(none)",
				detail: bodyText.sharpestOpeningShift
					? `From ${bodyText.sharpestOpeningShift.fromYear}, score ${formatMetric(bodyText.sharpestOpeningShift.score)}`
					: "No consecutive opening-style shift.",
			},
		);
	}

	return cards;
}

function buildStructuralReadings(
	yearProfiles: YearProfileDraft[],
	tagStructure: AdvancedTagStructureSummary,
	bodyText: BodyTextMetricsSummary,
	regimeShifts: AdvancedRegimeShift[],
): AdvancedHeadline[] {
	const readings: AdvancedHeadline[] = [];
	const sharpestRegimeShift = getTopBy(regimeShifts, (shift) => shift.score);
	const mostConcentratedWritingYear = getTopBy(yearProfiles, (profile) => profile.writingConcentrationIndex);

	if (sharpestRegimeShift) {
		readings.push({
			label: "Sharpest structural shift",
			value: sharpestRegimeShift.toYear.toString(),
			detail: `From ${sharpestRegimeShift.fromYear}; combined score ${formatMetric(sharpestRegimeShift.score)}.`,
		});
	}

	if (mostConcentratedWritingYear) {
		readings.push({
			label: "Most concentrated writing year",
			value: mostConcentratedWritingYear.year.toString(),
			detail: `Writing concentration ${formatMetric(mostConcentratedWritingYear.writingConcentrationIndex)}.`,
		});
	}

	if (tagStructure.strongestRecurringMotif) {
		readings.push({
			label: "Strongest recurring tag motif",
			value: tagStructure.strongestRecurringMotif.label,
			detail: `Lift ${formatMetric(tagStructure.strongestRecurringMotif.lift)} across ${tagStructure.strongestRecurringMotif.support} entries.`,
		});
	}

	if (bodyText.enabled && bodyText.richestVocabularyYear) {
		readings.push({
			label: "Richest vocabulary period",
			value: bodyText.richestVocabularyYear.year.toString(),
			detail: `Lexical richness ${formatMetric(bodyText.richestVocabularyYear.lexicalRichness ?? 0)} with novelty ${formatMetric(bodyText.richestVocabularyYear.noveltyRate ?? 0)}.`,
		});
	}

	if (bodyText.enabled && bodyText.strongestPhraseFamily) {
		readings.push({
			label: "Most persistent recurrent phrase",
			value: bodyText.strongestPhraseFamily.phrase,
			detail: `${bodyText.strongestPhraseFamily.supportEntries} entries from ${bodyText.strongestPhraseFamily.firstYear} to ${bodyText.strongestPhraseFamily.lastYear}.`,
		});
	}

	if (bodyText.enabled && bodyText.mostRevisedTag) {
		readings.push({
			label: "Most revision-heavy tag",
			value: bodyText.mostRevisedTag.label,
			detail: `Average revision lag ${formatMetric(bodyText.mostRevisedTag.averageRevisionLagDays ?? 0)} days.`,
		});
	}

	if (bodyText.enabled && bodyText.sharpestOpeningShift) {
		readings.push({
			label: "Sharpest opening-style drift",
			value: bodyText.sharpestOpeningShift.toYear.toString(),
			detail: `Shift from ${bodyText.sharpestOpeningShift.fromYear} with score ${formatMetric(bodyText.sharpestOpeningShift.score)}.`,
		});
	}

	return readings;
}

function computeTextChange(
	previousProfile: BodyTextMetricsSummary["yearProfiles"][number],
	currentProfile: BodyTextMetricsSummary["yearProfiles"][number],
): number {
	const lexicalChange = Math.min(
		1,
		Math.abs((currentProfile.lexicalRichness ?? 0) - (previousProfile.lexicalRichness ?? 0)) * 4,
	);
	const noveltyChange = Math.min(
		1,
		Math.abs((currentProfile.noveltyRate ?? 0) - (previousProfile.noveltyRate ?? 0)) * 2,
	);
	const sentenceChange = Math.min(
		1,
		Math.abs(Math.log(((currentProfile.averageSentenceLength ?? 0) + 1) / ((previousProfile.averageSentenceLength ?? 0) + 1))),
	);
	const phraseChange = Math.min(
		1,
		Math.abs((currentProfile.recurringPhraseShare ?? 0) - (previousProfile.recurringPhraseShare ?? 0)) * 2,
	);

	return lexicalChange * 0.35 + noveltyChange * 0.25 + sentenceChange * 0.2 + phraseChange * 0.2;
}

function buildDayActivities(entries: AdvancedEntry[]): DayActivity[] {
	const dayMap = new Map<number, DayActivity>();

	for (const entry of entries) {
		const existing = dayMap.get(entry.epochDay) ?? {
			year: entry.year,
			month: entry.month,
			weekday: entry.weekday,
			epochDay: entry.epochDay,
			entryCount: 0,
			wordCount: 0,
			revisionEntryCount: 0,
		};

		existing.entryCount += 1;
		existing.wordCount += entry.wordCount;
		if ((entry.revisionLagDays ?? 0) > 0) {
			existing.revisionEntryCount += 1;
		}

		dayMap.set(entry.epochDay, existing);
	}

	return [...dayMap.values()].sort((left, right) => left.epochDay - right.epochDay);
}

function buildIntervalDays(dayActivities: DayActivity[]): number[] {
	const intervals: number[] = [];

	for (let index = 1; index < dayActivities.length; index += 1) {
		const previous = dayActivities[index - 1];
		const current = dayActivities[index];
		if (!previous || !current) {
			continue;
		}

		intervals.push(Math.max(1, current.epochDay - previous.epochDay));
	}

	return intervals;
}

function buildStreakLengths(intervalDays: number[]): number[] {
	if (intervalDays.length === 0) {
		return [];
	}

	const streakLengths: number[] = [];
	let currentLength = 1;

	for (const interval of intervalDays) {
		if (interval === 1) {
			currentLength += 1;
		} else {
			streakLengths.push(currentLength);
			currentLength = 1;
		}
	}

	streakLengths.push(currentLength);
	return streakLengths;
}

function buildSeasonSignals(entries: AdvancedEntry[]): { maxShare: number; minShare: number; dominantSeason: string | null } {
	const seasonEntries = Array<number>(4).fill(0);
	const seasonWords = Array<number>(4).fill(0);
	const seasonRevisions = Array<number>(4).fill(0);

	for (const entry of entries) {
		const seasonIndex = getSeasonIndex(entry.month);
		seasonEntries[seasonIndex] = (seasonEntries[seasonIndex] ?? 0) + 1;
		seasonWords[seasonIndex] = (seasonWords[seasonIndex] ?? 0) + entry.wordCount;
		if ((entry.revisionLagDays ?? 0) > 0) {
			seasonRevisions[seasonIndex] = (seasonRevisions[seasonIndex] ?? 0) + 1;
		}
	}

	const totalEntries = seasonEntries.reduce((sum, value) => sum + value, 0);
	const totalWords = seasonWords.reduce((sum, value) => sum + value, 0);
	const totalRevisions = seasonRevisions.reduce((sum, value) => sum + value, 0);
	const compositeShares = seasonEntries.map((entryCount, seasonIndex) => {
		const shares: number[] = [];
		if (totalEntries > 0) {
			shares.push(entryCount / totalEntries);
		}
		if (totalWords > 0) {
			shares.push((seasonWords[seasonIndex] ?? 0) / totalWords);
		}
		if (totalRevisions > 0) {
			shares.push((seasonRevisions[seasonIndex] ?? 0) / totalRevisions);
		}

		return shares.length > 0 ? getAverage(shares) : 0;
	});
	const dominantSeasonIndex = compositeShares.findIndex((share) => share === getMax(compositeShares));

	return {
		maxShare: getMax(compositeShares),
		minShare: compositeShares.length > 0 ? Math.min(...compositeShares) : 0,
		dominantSeason: dominantSeasonIndex >= 0 ? SEASON_LABELS[dominantSeasonIndex] ?? null : null,
	};
}

function buildWritingConcentrationIndex(entries: AdvancedEntry[], byYear: boolean): number {
	const bucketTotals = new Map<string, number>();
	let totalWords = 0;

	for (const entry of entries) {
		const key = byYear ? entry.month.toString().padStart(2, "0") : `${entry.year}-${entry.month.toString().padStart(2, "0")}`;
		bucketTotals.set(key, (bucketTotals.get(key) ?? 0) + entry.wordCount);
		totalWords += entry.wordCount;
	}

	return totalWords > 0 ? computeHerfindahlIndex([...bucketTotals.values()], totalWords) : 0;
}

function buildWeekdayCounts(entries: AdvancedEntry[]): number[] {
	const counts = Array<number>(7).fill(0);
	for (const entry of entries) {
		counts[entry.weekday] = (counts[entry.weekday] ?? 0) + 1;
	}

	return counts;
}

function normalizeDistribution(values: number[]): number[] {
	const total = values.reduce((sum, value) => sum + value, 0);
	if (total <= 0) {
		return values.map(() => 0);
	}

	return values.map((value) => value / total);
}

function normalizeDistributionFromTagDistribution(distribution: TagDistribution | undefined): number[] {
	if (!distribution) {
		return [];
	}

	const sortedEntries = [...distribution.counts.entries()].sort(([left], [right]) => left.localeCompare(right));
	return normalizeDistribution(sortedEntries.map(([, count]) => count));
}

function computeBurstiness(intervalDays: number[]): number {
	if (intervalDays.length < 2) {
		return 0;
	}

	const mean = getAverage(intervalDays);
	const stddev = getStandardDeviation(intervalDays, mean);
	const denominator = stddev + mean;
	return denominator > 0 ? (stddev - mean) / denominator : 0;
}

function computeEntropy(counts: number[]): number {
	const total = counts.reduce((sum, value) => sum + value, 0);
	if (total <= 0) {
		return 0;
	}

	let entropy = 0;
	for (const count of counts) {
		if (count <= 0) {
			continue;
		}

		const probability = count / total;
		entropy -= probability * Math.log2(probability);
	}

	return entropy;
}

function computeHerfindahlIndex(counts: number[], total: number): number {
	if (total <= 0) {
		return 0;
	}

	return counts.reduce((sum, count) => {
		const share = count / total;
		return sum + share * share;
	}, 0);
}

function computeJensenShannonDistance(left: number[], right: number[]): number {
	const maxLength = Math.max(left.length, right.length);
	const paddedLeft = Array.from({ length: maxLength }, (_, index) => left[index] ?? 0);
	const paddedRight = Array.from({ length: maxLength }, (_, index) => right[index] ?? 0);
	const midpoint = paddedLeft.map((value, index) => (value + (paddedRight[index] ?? 0)) / 2);

	return Math.sqrt((computeKullbackLeiblerDivergence(paddedLeft, midpoint) + computeKullbackLeiblerDivergence(paddedRight, midpoint)) / 2);
}

function computeKullbackLeiblerDivergence(left: number[], right: number[]): number {
	let divergence = 0;

	for (let index = 0; index < left.length; index += 1) {
		const leftValue = left[index] ?? 0;
		const rightValue = right[index] ?? 0;
		if (leftValue <= 0 || rightValue <= 0) {
			continue;
		}

		divergence += leftValue * Math.log2(leftValue / rightValue);
	}

	return divergence;
}

function computePearsonCorrelation(left: number[], right: number[]): number | null {
	if (left.length !== right.length || left.length < 2) {
		return null;
	}

	const leftMean = getAverage(left);
	const rightMean = getAverage(right);
	let numerator = 0;
	let leftVariance = 0;
	let rightVariance = 0;

	for (let index = 0; index < left.length; index += 1) {
		const leftDelta = (left[index] ?? 0) - leftMean;
		const rightDelta = (right[index] ?? 0) - rightMean;
		numerator += leftDelta * rightDelta;
		leftVariance += leftDelta * leftDelta;
		rightVariance += rightDelta * rightDelta;
	}

	const denominator = Math.sqrt(leftVariance * rightVariance);
	return denominator > 0 ? numerator / denominator : null;
}

function computeClusteringCoefficient(tag: string, adjacency: Map<string, Set<string>>): number {
	const neighbors = [...(adjacency.get(tag) ?? new Set<string>())];
	if (neighbors.length < 2) {
		return 0;
	}

	let linkedNeighborPairs = 0;
	let possibleNeighborPairs = 0;

	for (let leftIndex = 0; leftIndex < neighbors.length; leftIndex += 1) {
		const leftNeighbor = neighbors[leftIndex];
		if (!leftNeighbor) {
			continue;
		}

		for (let rightIndex = leftIndex + 1; rightIndex < neighbors.length; rightIndex += 1) {
			const rightNeighbor = neighbors[rightIndex];
			if (!rightNeighbor) {
				continue;
			}

			possibleNeighborPairs += 1;
			if (adjacency.get(leftNeighbor)?.has(rightNeighbor)) {
				linkedNeighborPairs += 1;
			}
		}
	}

	return possibleNeighborPairs > 0 ? linkedNeighborPairs / possibleNeighborPairs : 0;
}

function linkTags(adjacency: Map<string, Set<string>>, leftTag: string, rightTag: string): void {
	const leftNeighbors = adjacency.get(leftTag) ?? new Set<string>();
	leftNeighbors.add(rightTag);
	adjacency.set(leftTag, leftNeighbors);

	const rightNeighbors = adjacency.get(rightTag) ?? new Set<string>();
	rightNeighbors.add(leftTag);
	adjacency.set(rightTag, rightNeighbors);
}

function getLongestConsecutiveRun(sortedYears: number[]): number {
	if (sortedYears.length === 0) {
		return 0;
	}

	let longestRun = 1;
	let currentRun = 1;

	for (let index = 1; index < sortedYears.length; index += 1) {
		const previousYear = sortedYears[index - 1];
		const currentYear = sortedYears[index];
		if (previousYear === undefined || currentYear === undefined) {
			continue;
		}

		if (currentYear === previousYear + 1) {
			currentRun += 1;
			longestRun = Math.max(longestRun, currentRun);
		} else {
			currentRun = 1;
		}
	}

	return longestRun;
}

function getMostCommonMode(modes: AdvancedProductivityMode[]): string | null {
	if (modes.length === 0) {
		return null;
	}

	const counts = new Map<string, number>();
	for (const mode of modes) {
		counts.set(mode.mode, (counts.get(mode.mode) ?? 0) + 1);
	}

	return [...counts.entries()].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))[0]?.[0] ?? null;
}

function getAverage(values: number[]): number {
	if (values.length === 0) {
		return 0;
	}

	return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function getStandardDeviation(values: number[], mean: number): number {
	if (values.length === 0) {
		return 0;
	}

	const variance = values.reduce((sum, value) => sum + (value - mean) * (value - mean), 0) / values.length;
	return Math.sqrt(variance);
}

function getPercentile(values: number[], percentile: number): number {
	if (values.length === 0) {
		return 0;
	}

	const normalizedPercentile = Math.max(0, Math.min(1, percentile));
	const position = (values.length - 1) * normalizedPercentile;
	const lowerIndex = Math.floor(position);
	const upperIndex = Math.ceil(position);
	const lowerValue = values[lowerIndex] ?? values[values.length - 1] ?? 0;
	const upperValue = values[upperIndex] ?? values[values.length - 1] ?? 0;

	if (lowerIndex === upperIndex) {
		return lowerValue;
	}

	return lowerValue + (upperValue - lowerValue) * (position - lowerIndex);
}

function getWeightedMedian(weightedValues: Array<{ value: number; weight: number }>): number {
	if (weightedValues.length === 0) {
		return 0;
	}

	const sortedValues = [...weightedValues].sort((left, right) => left.value - right.value);
	const totalWeight = sortedValues.reduce((sum, item) => sum + Math.max(0, item.weight), 0);
	if (totalWeight <= 0) {
		return sortedValues[0]?.value ?? 0;
	}

	let cumulativeWeight = 0;
	for (const item of sortedValues) {
		cumulativeWeight += Math.max(0, item.weight);
		if (cumulativeWeight >= totalWeight / 2) {
			return item.value;
		}
	}

	return sortedValues[sortedValues.length - 1]?.value ?? 0;
}

function computeShare(values: number[], predicate: (value: number) => boolean): number {
	if (values.length === 0) {
		return 0;
	}

	return values.filter(predicate).length / values.length;
}

function getMax(values: number[]): number {
	return values.length > 0 ? Math.max(...values) : 0;
}

function getTopBy<T>(values: T[], selector: (value: T) => number): T | null {
	if (values.length === 0) {
		return null;
	}

	return values.reduce((best, candidate) => (selector(candidate) > selector(best) ? candidate : best));
}

function toEpochDay(year: number, month: number, day: number): number {
	return Math.floor(Date.UTC(year, month - 1, day) / DAY_MS);
}

function getSeasonIndex(month: number): number {
	if (month === 12 || month === 1 || month === 2) {
		return 0;
	}
	if (month >= 3 && month <= 5) {
		return 1;
	}
	if (month >= 6 && month <= 8) {
		return 2;
	}

	return 3;
}

function formatMetric(value: number): string {
	return Number.isInteger(value) ? value.toString() : value.toFixed(2);
}
