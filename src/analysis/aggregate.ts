import type {
	DateIssueReportEntry,
	DiaryAggregateSummary,
	DiaryFileAnalysis,
	DiaryStatsSettings,
	YearAggregate,
} from "../types";
import { hasDateIssue, isFilesystemFallbackSource } from "./parse";
import {
	estimateReadingTimeMinutes,
	formatReadingTime,
	normalizeReadingWordsPerMinute,
} from "./reading-time";

interface MutableYearAggregate extends YearAggregate {
	wordCounts: number[];
}

export function buildAggregateSummary(
	files: DiaryFileAnalysis[],
	settings: Pick<DiaryStatsSettings, "readingWordsPerMinute" | "averageEntryLengthMethod">,
): DiaryAggregateSummary {
	const wordCounts = files.map((file) => file.wordCount).sort((left, right) => left - right);
	const yearMap = new Map<number, MutableYearAggregate>();
	const readingWordsPerMinute = normalizeReadingWordsPerMinute(settings.readingWordsPerMinute);

	let totalWords = 0;
	let entriesWithCreatedFallback = 0;
	let entriesWithUpdatedFallback = 0;
	let missingCreatedFrontmatterCount = 0;
	let invalidCreatedFrontmatterCount = 0;
	let missingUpdatedFrontmatterCount = 0;
	let invalidUpdatedFrontmatterCount = 0;
	let unresolvedChronologyCount = 0;

	for (const file of files) {
		totalWords += file.wordCount;

		if (isFilesystemFallbackSource(file.createdAt.source)) {
			entriesWithCreatedFallback += 1;
		}
		if (isFilesystemFallbackSource(file.updatedAt.source)) {
			entriesWithUpdatedFallback += 1;
		}

		if (file.createdAt.issue === "missing") {
			missingCreatedFrontmatterCount += 1;
		} else if (file.createdAt.issue === "invalid") {
			invalidCreatedFrontmatterCount += 1;
		}

		if (file.updatedAt.issue === "missing") {
			missingUpdatedFrontmatterCount += 1;
		} else if (file.updatedAt.issue === "invalid") {
			invalidUpdatedFrontmatterCount += 1;
		}

		if (file.chronologyYear === null) {
			unresolvedChronologyCount += 1;
			continue;
		}

		const yearSummary = yearMap.get(file.chronologyYear) ?? {
			year: file.chronologyYear,
			entryCount: 0,
			wordCount: 0,
			readingTimeMinutes: 0,
			readingTimeLabel: "0 min",
			averageWordsPerEntry: 0,
			medianWordsPerEntry: 0,
			createdFallbackCount: 0,
			updatedFallbackCount: 0,
			wordCounts: [],
		};

		yearSummary.entryCount += 1;
		yearSummary.wordCount += file.wordCount;
		yearSummary.readingTimeMinutes += estimateReadingTimeMinutes(file.wordCount, readingWordsPerMinute);
		yearSummary.wordCounts.push(file.wordCount);

		if (isFilesystemFallbackSource(file.createdAt.source)) {
			yearSummary.createdFallbackCount += 1;
		}
		if (isFilesystemFallbackSource(file.updatedAt.source)) {
			yearSummary.updatedFallbackCount += 1;
		}

		yearMap.set(file.chronologyYear, yearSummary);
	}

	const yearSummaries = [...yearMap.values()]
		.sort((left, right) => left.year - right.year)
		.map((summary) => {
			const sortedWordCounts = [...summary.wordCounts].sort((left, right) => left - right);
			return {
				year: summary.year,
				entryCount: summary.entryCount,
				wordCount: summary.wordCount,
				readingTimeMinutes: summary.readingTimeMinutes,
				readingTimeLabel: formatReadingTime(summary.readingTimeMinutes),
				averageWordsPerEntry: summary.entryCount > 0 ? summary.wordCount / summary.entryCount : 0,
				medianWordsPerEntry: getMedian(sortedWordCounts),
				createdFallbackCount: summary.createdFallbackCount,
				updatedFallbackCount: summary.updatedFallbackCount,
			};
		});

	const averageWordsPerEntry = files.length > 0 ? totalWords / files.length : 0;
	const medianWordsPerEntry = getMedian(wordCounts);
	const selectedAverageEntryWords =
		settings.averageEntryLengthMethod === "mean" ? averageWordsPerEntry : medianWordsPerEntry;
	const totalReadingTimeMinutes = estimateReadingTimeMinutes(totalWords, readingWordsPerMinute);
	const averageEntryReadingTimeMinutes = estimateReadingTimeMinutes(selectedAverageEntryWords, readingWordsPerMinute);

	return {
		yearsWritten: yearSummaries.map((summary) => summary.year),
		totalEntries: files.length,
		totalWords,
		averageWordsPerEntry,
		medianWordsPerEntry,
		selectedAverageEntryMethod: settings.averageEntryLengthMethod,
		selectedAverageEntryWords,
		readingWordsPerMinute,
		totalReadingTimeMinutes,
		totalReadingTimeLabel: formatReadingTime(totalReadingTimeMinutes),
		averageEntryReadingTimeMinutes,
		averageEntryReadingTimeLabel: formatReadingTime(averageEntryReadingTimeMinutes),
		entriesWithCreatedFallback,
		entriesWithUpdatedFallback,
		missingCreatedFrontmatterCount,
		invalidCreatedFrontmatterCount,
		missingUpdatedFrontmatterCount,
		invalidUpdatedFrontmatterCount,
		unresolvedChronologyCount,
		yearSummaries,
	};
}

export function buildDateIssueReport(files: DiaryFileAnalysis[]): DateIssueReportEntry[] {
	return files
		.filter((file) => hasDateIssue(file.createdAt.issue) || hasDateIssue(file.updatedAt.issue))
		.map((file) => ({
			path: file.path,
			createdAtIssue: file.createdAt.issue,
			updatedAtIssue: file.updatedAt.issue,
			createdAtSource: file.createdAt.source,
			updatedAtSource: file.updatedAt.source,
			resolvedCreatedAt: file.createdAt.value?.normalizedLocal ?? null,
			resolvedUpdatedAt: file.updatedAt.value?.normalizedLocal ?? null,
		}))
		.sort((left, right) => left.path.localeCompare(right.path));
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
