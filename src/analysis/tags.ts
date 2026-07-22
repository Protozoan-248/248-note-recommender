import type {
	DiaryFileAnalysis,
	DiaryStatsSettings,
	PerYearTagAnalysisSection,
	TagAnalysisRow,
	TagAnalysisSection,
	TagAnalysisSummary,
	TagCombinationMode,
} from "../types";
import { isYearIncludedInTagMetricScope } from "./tag-scope";

const WEEKDAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTH_LABELS = [
	"January",
	"February",
	"March",
	"April",
	"May",
	"June",
	"July",
	"August",
	"September",
	"October",
	"November",
	"December",
];

interface TagAccumulator {
	label: string;
	entryCount: number;
	wordCounts: number[];
	weekdayCounts: number[];
	monthCounts: Map<string, number>;
}

interface RankedBucket {
	label: string;
	count: number;
}

export function buildTagAnalysisSummary(
	files: DiaryFileAnalysis[],
	settings: Pick<
		DiaryStatsSettings,
		| "minimumTagFrequency"
		| "tagCombinationMode"
		| "hierarchicalTagMode"
		| "ignoredTags"
		| "tagAliasMap"
		| "enableCombinedTagAnalysis"
		| "enablePerYearTagAnalysis"
		| "tagMetricTimeScope"
		| "tagMetricFromYear"
		| "tagMetricToYear"
		| "tagAnalysisIncludedYears"
		| "tagAnalysisExcludedYears"
	>,
): TagAnalysisSummary {
	const filteredFiles = files.filter((file) => shouldIncludeFileInTagAnalysis(file, settings));
	const tagCountsPerNote = filteredFiles
		.map((file) => file.normalizedTags.length)
		.sort((left, right) => left - right);

	return {
		minimumFrequency: settings.minimumTagFrequency,
		combinationMode: settings.tagCombinationMode,
		hierarchicalTagMode: settings.hierarchicalTagMode,
		timeScopeMode: settings.tagMetricTimeScope,
		timeScopeFromYear: settings.tagMetricFromYear,
		timeScopeToYear: settings.tagMetricToYear,
		aliasCount: Object.keys(settings.tagAliasMap).length,
		ignoredTagCount: settings.ignoredTags.length,
		meanTagsPerNote:
			filteredFiles.length > 0
				? filteredFiles.reduce((sum, file) => sum + file.normalizedTags.length, 0) / filteredFiles.length
				: 0,
		medianTagsPerNote: getMedian(tagCountsPerNote),
		combinedEnabled: settings.enableCombinedTagAnalysis,
		perYearEnabled: settings.enablePerYearTagAnalysis,
		includedYears: [...settings.tagAnalysisIncludedYears].sort((left, right) => left - right),
		excludedYears: [...settings.tagAnalysisExcludedYears].sort((left, right) => left - right),
		overall: settings.enableCombinedTagAnalysis
			? buildTagAnalysisSection(filteredFiles, settings.minimumTagFrequency, settings.tagCombinationMode, "year-month")
			: null,
		perYear: settings.enablePerYearTagAnalysis
			? buildPerYearTagAnalysis(filteredFiles, settings.minimumTagFrequency, settings.tagCombinationMode)
			: [],
	};
}

function shouldIncludeFileInTagAnalysis(
	file: DiaryFileAnalysis,
	settings: Pick<
		DiaryStatsSettings,
		| "tagMetricTimeScope"
		| "tagMetricFromYear"
		| "tagMetricToYear"
		| "tagAnalysisIncludedYears"
		| "tagAnalysisExcludedYears"
	>,
): boolean {
	if (file.chronologyYear === null || file.createdAt.value === null) {
		return false;
	}

	return isYearIncludedInTagMetricScope(file.chronologyYear, settings);
}

function buildPerYearTagAnalysis(
	files: DiaryFileAnalysis[],
	minimumTagFrequency: number,
	combinationMode: TagCombinationMode,
): PerYearTagAnalysisSection[] {
	const yearMap = new Map<number, DiaryFileAnalysis[]>();

	for (const file of files) {
		if (file.chronologyYear === null) {
			continue;
		}

		const existingFiles = yearMap.get(file.chronologyYear) ?? [];
		existingFiles.push(file);
		yearMap.set(file.chronologyYear, existingFiles);
	}

	return [...yearMap.entries()]
		.sort(([left], [right]) => left - right)
		.map(([year, yearFiles]) => ({
			year,
			...buildTagAnalysisSection(yearFiles, minimumTagFrequency, combinationMode, "month"),
		}));
}

function buildTagAnalysisSection(
	files: DiaryFileAnalysis[],
	minimumTagFrequency: number,
	combinationMode: TagCombinationMode,
	monthLabelMode: "year-month" | "month",
): TagAnalysisSection {
	const candidateMap = new Map<string, TagAccumulator>();
	const baselineAverageWords = files.length > 0 ? files.reduce((sum, file) => sum + file.wordCount, 0) / files.length : 0;
	const baselineMedianWords = getMedian(files.map((file) => file.wordCount).sort((left, right) => left - right));

	for (const file of files) {
		if (file.normalizedTags.length === 0 || file.createdAt.value === null) {
			continue;
		}

		const monthLabel =
			monthLabelMode === "year-month"
				? formatYearMonth(file.createdAt.value.year, file.createdAt.value.month)
				: (MONTH_LABELS[file.createdAt.value.month - 1] ?? `Month ${file.createdAt.value.month}`);

		for (const combinationLabel of buildTagCombinations(file.normalizedTags, combinationMode)) {
			const accumulator = candidateMap.get(combinationLabel) ?? {
				label: combinationLabel,
				entryCount: 0,
				wordCounts: [],
				weekdayCounts: Array<number>(7).fill(0),
				monthCounts: new Map<string, number>(),
			};

			accumulator.entryCount += 1;
			accumulator.wordCounts.push(file.wordCount);
			accumulator.weekdayCounts[file.createdAt.value.weekday] =
				(accumulator.weekdayCounts[file.createdAt.value.weekday] ?? 0) + 1;
			accumulator.monthCounts.set(monthLabel, (accumulator.monthCounts.get(monthLabel) ?? 0) + 1);
			candidateMap.set(combinationLabel, accumulator);
		}
	}

	const rows = [...candidateMap.values()]
		.filter((candidate) => candidate.entryCount >= minimumTagFrequency)
		.map((candidate) => buildTagAnalysisRow(candidate, baselineAverageWords, baselineMedianWords))
		.sort(compareTagRows);

	return {
		entryCountConsidered: files.length,
		candidateCount: rows.length,
		rows,
	};
}

function buildTagAnalysisRow(
	candidate: TagAccumulator,
	baselineAverageWords: number,
	baselineMedianWords: number,
): TagAnalysisRow {
	const wordCounts = [...candidate.wordCounts].sort((left, right) => left - right);
	const averageWords = candidate.entryCount > 0 ? candidate.wordCounts.reduce((sum, value) => sum + value, 0) / candidate.entryCount : 0;
	const medianWords = getMedian(wordCounts);
	const topWeekdays = getTopWeekdayBuckets(candidate.weekdayCounts);
	const dominantMonth = getTopMapEntry(candidate.monthCounts);

	return {
		label: candidate.label,
		entryCount: candidate.entryCount,
		averageWords,
		medianWords,
		averageWordDelta: averageWords - baselineAverageWords,
		medianWordDelta: medianWords - baselineMedianWords,
		dominantWeekdayLabel: topWeekdays[0]?.label ?? "(none)",
		dominantWeekdayShare: candidate.entryCount > 0 ? (topWeekdays[0]?.count ?? 0) / candidate.entryCount : 0,
		secondaryWeekdayLabel: topWeekdays[1]?.label ?? null,
		secondaryWeekdayShare: candidate.entryCount > 0 ? (topWeekdays[1]?.count ?? 0) / candidate.entryCount : 0,
		dominantMonthLabel: dominantMonth.label,
		dominantMonthShare: candidate.entryCount > 0 ? dominantMonth.count / candidate.entryCount : 0,
	};
}

function buildTagCombinations(tags: string[], combinationMode: TagCombinationMode): string[] {
	const uniqueTags = [...new Set(tags)].sort((left, right) => left.localeCompare(right));
	if (uniqueTags.length === 0) {
		return [];
	}

	const combinations: string[] = [];
	const maxCombinationSize = getMaxCombinationSize(combinationMode);

	for (let combinationSize = 1; combinationSize <= Math.min(maxCombinationSize, uniqueTags.length); combinationSize += 1) {
		collectCombinations(uniqueTags, combinationSize, 0, [], combinations);
	}

	return combinations;
}

function collectCombinations(
	tags: string[],
	targetSize: number,
	startIndex: number,
	current: string[],
	output: string[],
): void {
	if (current.length === targetSize) {
		output.push(current.join(" + "));
		return;
	}

	for (let index = startIndex; index <= tags.length - (targetSize - current.length); index += 1) {
		const tag = tags[index];
		if (!tag) {
			continue;
		}

		current.push(tag);
		collectCombinations(tags, targetSize, index + 1, current, output);
		current.pop();
	}
}

function getMaxCombinationSize(combinationMode: TagCombinationMode): number {
	switch (combinationMode) {
		case "single-pairs":
			return 2;
		case "single-pairs-triplets":
			return 3;
		case "single":
		default:
			return 1;
	}
}

function getTopWeekdayBuckets(values: number[]): RankedBucket[] {
	return values
		.map((count, index) => ({
			label: WEEKDAY_LABELS[index] ?? "Unknown",
			count,
			index,
		}))
		.filter((entry) => entry.count > 0)
		.sort(
			(left, right) =>
				right.count - left.count || getWeekdayDisplayOrder(left.index) - getWeekdayDisplayOrder(right.index),
		)
		.slice(0, 2)
		.map(({ label, count }) => ({ label, count }));
}

function getTopMapEntry(values: Map<string, number>): { label: string; count: number } {
	let topLabel = "(none)";
	let topCount = 0;

	for (const [label, count] of values.entries()) {
		if (count > topCount) {
			topLabel = label;
			topCount = count;
		}
	}

	return {
		label: topLabel,
		count: topCount,
	};
}

function compareTagRows(left: TagAnalysisRow, right: TagAnalysisRow): number {
	return (
		right.entryCount - left.entryCount ||
		Math.abs(right.averageWordDelta) - Math.abs(left.averageWordDelta) ||
		right.dominantWeekdayShare - left.dominantWeekdayShare ||
		right.dominantMonthShare - left.dominantMonthShare ||
		left.label.localeCompare(right.label)
	);
}

function formatYearMonth(year: number, month: number): string {
	return `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}`;
}

function getWeekdayDisplayOrder(index: number): number {
	return index === 0 ? 6 : index - 1;
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
