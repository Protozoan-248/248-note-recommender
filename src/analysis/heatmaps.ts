import type {
	AdvancedMetricsSummary,
	AnalysisVisualSummary,
	DiaryAggregateSummary,
	DiaryFileAnalysis,
	HistogramData,
	MonthlyHeatmapCell,
	MonthlyWordsHeatmapCell,
	StructuralTrendData,
	StructuralTrendPoint,
	TagCoverageTrendData,
	TagCoverageTrendPoint,
	TextAwareTrendData,
	TextAwareTrendPoint,
	WeekdayHeatmapCell,
	YearlyTrendData,
	YearlyTrendPoint,
} from "../types";

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MILLISECONDS_PER_DAY = 1000 * 60 * 60 * 24;

export function buildVisualSummary(
	files: DiaryFileAnalysis[],
	aggregate: DiaryAggregateSummary,
	advancedMetrics: AdvancedMetricsSummary,
): AnalysisVisualSummary {
	const years = [...new Set(files.map((file) => file.chronologyYear).filter((year): year is number => year !== null))]
		.sort((left, right) => left - right);

	const monthlyHeatmap = buildMonthlyHeatmap(files, years);
	const monthlyWordsHeatmap = buildMonthlyWordsHeatmap(files, years);
	const weekdayHeatmap = buildWeekdayHeatmap(files, years);
	const yearlyTrends = buildYearlyTrendData(aggregate);
	const noteLengthHistogram = buildHistogramData(files.map((file) => file.wordCount), 0);
	const revisionLagHistogram = buildHistogramData(getPositiveRevisionLagDays(files), 0);
	const structuralTrends = buildStructuralTrendData(advancedMetrics);
	const tagCoverageTrends = buildTagCoverageTrendData(files, years);
	const textAwareTrends = buildTextAwareTrendData(advancedMetrics);

	return {
		monthlyHeatmap,
		monthlyWordsHeatmap,
		weekdayHeatmap,
		yearlyTrends,
		noteLengthHistogram,
		revisionLagHistogram,
		structuralTrends,
		tagCoverageTrends,
		textAwareTrends,
	};
}

function buildMonthlyHeatmap(files: DiaryFileAnalysis[], years: number[]) {
	const countMap = new Map<string, number>();
	let maxEntryCount = 0;

	for (const file of files) {
		const createdValue = file.createdAt.value;
		if (!createdValue) {
			continue;
		}

		const key = `${createdValue.year}-${createdValue.month - 1}`;
		const nextValue = (countMap.get(key) ?? 0) + 1;
		countMap.set(key, nextValue);
		maxEntryCount = Math.max(maxEntryCount, nextValue);
	}

	const cells: MonthlyHeatmapCell[] = [];
	for (const year of years) {
		for (let monthIndex = 0; monthIndex < MONTH_LABELS.length; monthIndex += 1) {
			cells.push({
				year,
				monthIndex,
				entryCount: countMap.get(`${year}-${monthIndex}`) ?? 0,
			});
		}
	}

	return {
		years,
		months: MONTH_LABELS,
		maxEntryCount,
		cells,
	};
}

function buildMonthlyWordsHeatmap(files: DiaryFileAnalysis[], years: number[]) {
	const wordCountMap = new Map<string, number>();
	const entryCountMap = new Map<string, number>();
	let maxWordCount = 0;

	for (const file of files) {
		const createdValue = file.createdAt.value;
		if (!createdValue) {
			continue;
		}

		const key = `${createdValue.year}-${createdValue.month - 1}`;
		const nextWordCount = (wordCountMap.get(key) ?? 0) + file.wordCount;
		wordCountMap.set(key, nextWordCount);
		entryCountMap.set(key, (entryCountMap.get(key) ?? 0) + 1);
		maxWordCount = Math.max(maxWordCount, nextWordCount);
	}

	const cells: MonthlyWordsHeatmapCell[] = [];
	for (const year of years) {
		for (let monthIndex = 0; monthIndex < MONTH_LABELS.length; monthIndex += 1) {
			const key = `${year}-${monthIndex}`;
			const entryCount = entryCountMap.get(key) ?? 0;
			const wordCount = wordCountMap.get(key) ?? 0;
			cells.push({
				year,
				monthIndex,
				wordCount,
				entryCount,
				averageWordsPerEntry: entryCount > 0 ? wordCount / entryCount : 0,
			});
		}
	}

	return {
		years,
		months: MONTH_LABELS,
		maxWordCount,
		cells,
	};
}

function buildWeekdayHeatmap(files: DiaryFileAnalysis[], years: number[]) {
	const countMap = new Map<string, number>();
	let maxAverageEntries = 0;

	for (const file of files) {
		const createdValue = file.createdAt.value;
		if (!createdValue) {
			continue;
		}

		const weekdayIndex = mapToMondayFirstIndex(createdValue.weekday);
		const key = `${createdValue.year}-${weekdayIndex}`;
		countMap.set(key, (countMap.get(key) ?? 0) + 1);
	}

	const cells: WeekdayHeatmapCell[] = [];
	for (const year of years) {
		const weekdayOccurrences = countWeekdayOccurrences(year);
		for (let weekdayIndex = 0; weekdayIndex < WEEKDAY_LABELS.length; weekdayIndex += 1) {
			const entryCount = countMap.get(`${year}-${weekdayIndex}`) ?? 0;
			const occurrences = weekdayOccurrences[weekdayIndex] ?? 0;
			const averageEntriesPerWeekday = occurrences > 0 ? entryCount / occurrences : 0;
			maxAverageEntries = Math.max(maxAverageEntries, averageEntriesPerWeekday);

			cells.push({
				year,
				weekdayIndex,
				entryCount,
				weekdayOccurrences: occurrences,
				averageEntriesPerWeekday,
			});
		}
	}

	return {
		years,
		weekdays: WEEKDAY_LABELS,
		maxAverageEntries,
		cells,
	};
}

function mapToMondayFirstIndex(jsWeekday: number): number {
	return jsWeekday === 0 ? 6 : jsWeekday - 1;
}

function countWeekdayOccurrences(year: number): number[] {
	const counts = [0, 0, 0, 0, 0, 0, 0];
	const cursor = new Date(year, 0, 1);

	while (cursor.getFullYear() === year) {
		const weekdayIndex = mapToMondayFirstIndex(cursor.getDay());
		counts[weekdayIndex] = (counts[weekdayIndex] ?? 0) + 1;
		cursor.setDate(cursor.getDate() + 1);
	}

	return counts;
}

function buildYearlyTrendData(aggregate: DiaryAggregateSummary): YearlyTrendData {
	const points: YearlyTrendPoint[] = aggregate.yearSummaries.map((summary) => ({
		year: summary.year,
		entryCount: summary.entryCount,
		wordCount: summary.wordCount,
		readingTimeMinutes: summary.readingTimeMinutes,
		averageWordsPerEntry: summary.averageWordsPerEntry,
		medianWordsPerEntry: summary.medianWordsPerEntry,
	}));

	return {
		points,
	};
}

function buildHistogramData(values: number[], minimumStart: number): HistogramData {
	const sanitizedValues = values.filter((value) => Number.isFinite(value) && value >= 0);
	if (sanitizedValues.length === 0) {
		return {
			bins: [],
			maxCount: 0,
			totalValues: 0,
		};
	}

	const maxValue = Math.max(...sanitizedValues);
	const desiredBinCount = clamp(Math.round(Math.sqrt(sanitizedValues.length)), 6, 14);
	const roughStep = Math.max(1, (maxValue - minimumStart + 1) / desiredBinCount);
	const step = getNiceHistogramStep(roughStep);
	const start = minimumStart;
	const binCount = Math.max(1, Math.ceil((maxValue - start + 1) / step));
	const counts = Array<number>(binCount).fill(0);

	for (const value of sanitizedValues) {
		const index = Math.min(binCount - 1, Math.max(0, Math.floor((value - start) / step)));
		counts[index] = (counts[index] ?? 0) + 1;
	}

	return {
		bins: counts.map((count, index) => {
			const binStart = start + index * step;
			const binEnd = binStart + step;
			return {
				label: formatHistogramLabel(binStart, binEnd),
				start: binStart,
				end: binEnd,
				count,
			};
		}),
		maxCount: Math.max(...counts),
		totalValues: sanitizedValues.length,
	};
}

function getPositiveRevisionLagDays(files: DiaryFileAnalysis[]): number[] {
	const values: number[] = [];

	for (const file of files) {
		const createdAt = file.createdAt.value;
		const updatedAt = file.updatedAt.value;
		if (!createdAt || !updatedAt) {
			continue;
		}

		const lagDays = (updatedAt.epochMillis - createdAt.epochMillis) / MILLISECONDS_PER_DAY;
		if (lagDays > 0) {
			values.push(lagDays);
		}
	}

	return values;
}

function buildStructuralTrendData(advancedMetrics: AdvancedMetricsSummary): StructuralTrendData {
	const points: StructuralTrendPoint[] = advancedMetrics.yearProfiles.map((profile) => ({
		year: profile.year,
		burstinessIndex: profile.burstinessIndex,
		writingConcentrationIndex: profile.writingConcentrationIndex,
		tagEntropy: profile.tagEntropy,
		regimeShiftFromPrevious: profile.regimeShiftFromPrevious,
	}));

	return {
		points,
	};
}

function buildTagCoverageTrendData(files: DiaryFileAnalysis[], years: number[]): TagCoverageTrendData {
	const points: TagCoverageTrendPoint[] = years.map((year) => {
		const yearFiles = files.filter((file) => file.chronologyYear === year);
		const taggedFiles = yearFiles.filter((file) => file.normalizedTags.length > 0);
		const tagCounts = yearFiles.map((file) => file.normalizedTags.length).sort((left, right) => left - right);
		const meanTagsPerNote =
			yearFiles.length > 0
				? yearFiles.reduce((sum, file) => sum + file.normalizedTags.length, 0) / yearFiles.length
				: 0;

		return {
			year,
			entryCount: yearFiles.length,
			taggedEntryCount: taggedFiles.length,
			taggedEntryShare: yearFiles.length > 0 ? taggedFiles.length / yearFiles.length : 0,
			meanTagsPerNote,
			medianTagsPerNote: getMedian(tagCounts),
		};
	});

	return {
		points,
	};
}

function buildTextAwareTrendData(advancedMetrics: AdvancedMetricsSummary): TextAwareTrendData {
	const points: TextAwareTrendPoint[] = advancedMetrics.bodyText.yearProfiles.map((profile) => ({
		year: profile.year,
		lexicalRichness: profile.lexicalRichness,
		noveltyRate: profile.noveltyRate,
		averageSentenceLength: profile.averageSentenceLength,
		recurringPhraseShare: profile.recurringPhraseShare,
	}));

	return {
		points,
	};
}

function getNiceHistogramStep(value: number): number {
	if (value <= 1) {
		return 1;
	}

	const magnitude = 10 ** Math.floor(Math.log10(value));
	const normalized = value / magnitude;

	if (normalized <= 1) {
		return magnitude;
	}
	if (normalized <= 2) {
		return 2 * magnitude;
	}
	if (normalized <= 5) {
		return 5 * magnitude;
	}

	return 10 * magnitude;
}

function formatHistogramLabel(start: number, end: number): string {
	const inclusiveEnd = Math.max(start, end - 1);
	if (inclusiveEnd <= start) {
		return formatHistogramValue(start);
	}

	return `${formatHistogramValue(start)}-${formatHistogramValue(inclusiveEnd)}`;
}

function formatHistogramValue(value: number): string {
	return Number.isInteger(value) ? value.toString() : value.toFixed(1);
}

function clamp(value: number, minimum: number, maximum: number): number {
	return Math.min(maximum, Math.max(minimum, value));
}

function getMedian(values: number[]): number {
	if (values.length === 0) {
		return 0;
	}

	const middleIndex = Math.floor(values.length / 2);
	if (values.length % 2 === 1) {
		return values[middleIndex] ?? 0;
	}

	const lowerValue = values[middleIndex - 1] ?? 0;
	const upperValue = values[middleIndex] ?? 0;
	return (lowerValue + upperValue) / 2;
}
