import type {
	DiaryFileAnalysis,
	DiaryStatsSettings,
	ExtraMetricsSummary,
	HourlyActivityPoint,
	MonthLengthProfilePoint,
	WritingStreakSummary,
} from "../types";
import { formatHourMetricScopeSummary, isYearIncludedInHourMetricScope } from "./hour-scope";
import { isYearIncludedInTagMetricScope } from "./tag-scope";

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_TAG_HEATMAP_TAGS = 10;
const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function buildExtraMetricsSummary(
	files: DiaryFileAnalysis[],
	settings: Pick<
		DiaryStatsSettings,
		| "minimumTagFrequency"
		| "tagMetricTimeScope"
		| "tagMetricFromYear"
		| "tagMetricToYear"
		| "hourMetricTimeScope"
		| "hourMetricFromYear"
		| "hourMetricToYear"
		| "tagAnalysisIncludedYears"
		| "tagAnalysisExcludedYears"
	>,
): ExtraMetricsSummary {
	const longestWritingStreak = buildLongestWritingStreak(files);
	const monthLengthProfile = buildMonthLengthProfile(files);
	const mostVerboseMonth = getTopBy(monthLengthProfile.points, (point) => point.entryCount > 0, (point) => point.averageWords);
	const shortestMonth = getBottomBy(monthLengthProfile.points, (point) => point.entryCount > 0, (point) => point.averageWords);
	const hourlyActivity = buildHourlyActivity(files, settings);
	const mostActiveHour = getTopBy(hourlyActivity.points, (point) => point.entryCount > 0, (point) => point.entryCount);
	const quietestActiveHour = getBottomBy(hourlyActivity.points, (point) => point.entryCount > 0, (point) => point.entryCount);
	const tagFrequency = buildTagFrequencyHeatmap(files, settings);

	return {
		longestWritingStreak,
		mostVerboseMonth,
		shortestMonth,
		mostActiveHour,
		quietestActiveHour,
		hourOfDayEntriesWithTime: hourlyActivity.usableEntryCount,
		hourMetricScopeLabel: formatHourMetricScopeSummary(settings),
		qualifyingTagCount: tagFrequency.qualifyingTagCount,
		displayedTagCount: tagFrequency.displayedTagCount,
		topTagByFrequency: tagFrequency.topTagByFrequency,
		topTagFrequencyCount: tagFrequency.topTagFrequencyCount,
		monthLengthProfile: {
			points: monthLengthProfile.points,
		},
		tagFrequencyHeatmap: {
			years: tagFrequency.years,
			tags: tagFrequency.tags,
			maxEntryCount: tagFrequency.maxEntryCount,
			cells: tagFrequency.cells,
		},
		hourlyActivity,
	};
}

function buildLongestWritingStreak(files: DiaryFileAnalysis[]): WritingStreakSummary | null {
	const dayMap = new Map<number, { dateLabel: string; entryCount: number }>();

	for (const file of files) {
		const createdAt = file.createdAt.value;
		if (!createdAt) {
			continue;
		}

		const epochDay = Math.floor(createdAt.epochMillis / DAY_MS);
		const existing = dayMap.get(epochDay);
		if (existing) {
			existing.entryCount += 1;
			continue;
		}

		dayMap.set(epochDay, {
			dateLabel: createdAt.normalizedLocal.slice(0, 10),
			entryCount: 1,
		});
	}

	const days = [...dayMap.entries()].sort(([leftDay], [rightDay]) => leftDay - rightDay);
	if (days.length === 0) {
		return null;
	}

	let best: WritingStreakSummary | null = null;
	let currentStartIndex = 0;
	let currentEntryCount = days[0]?.[1].entryCount ?? 0;

	for (let index = 1; index <= days.length; index += 1) {
		const previousDay = days[index - 1]?.[0] ?? 0;
		const currentDay = days[index]?.[0] ?? Number.NaN;

		if (index < days.length && currentDay === previousDay + 1) {
			currentEntryCount += days[index]?.[1].entryCount ?? 0;
			continue;
		}

		const startDay = days[currentStartIndex];
		const endDay = days[index - 1];
		if (startDay && endDay) {
			const streak: WritingStreakSummary = {
				startDate: startDay[1].dateLabel,
				endDate: endDay[1].dateLabel,
				dayCount: index - currentStartIndex,
				entryCount: currentEntryCount,
			};

			if (
				!best ||
				streak.dayCount > best.dayCount ||
				(streak.dayCount === best.dayCount && streak.entryCount > best.entryCount)
			) {
				best = streak;
			}
		}

		currentStartIndex = index;
		currentEntryCount = days[index]?.[1].entryCount ?? 0;
	}

	return best;
}

function buildMonthLengthProfile(files: DiaryFileAnalysis[]) {
	const monthMap = new Map<number, number[]>();

	for (const file of files) {
		const createdAt = file.createdAt.value;
		if (!createdAt) {
			continue;
		}

		const monthIndex = createdAt.month - 1;
		const values = monthMap.get(monthIndex) ?? [];
		values.push(file.wordCount);
		monthMap.set(monthIndex, values);
	}

	const points: MonthLengthProfilePoint[] = MONTH_LABELS.map((monthLabel, monthIndex) => {
		const wordCounts = [...(monthMap.get(monthIndex) ?? [])].sort((left, right) => left - right);
		const totalWords = wordCounts.reduce((sum, value) => sum + value, 0);
		return {
			monthIndex,
			monthLabel,
			entryCount: wordCounts.length,
			averageWords: wordCounts.length > 0 ? totalWords / wordCounts.length : 0,
			medianWords: getMedian(wordCounts),
		};
	});

	return { points };
}

function buildHourlyActivity(
	files: DiaryFileAnalysis[],
	settings: Pick<DiaryStatsSettings, "hourMetricTimeScope" | "hourMetricFromYear" | "hourMetricToYear">,
) {
	const hourCounts = Array<number>(24).fill(0);
	const hourWordTotals = Array<number>(24).fill(0);
	let usableEntryCount = 0;

	for (const file of files) {
		const createdAt = file.createdAt.value;
		if (!createdAt || createdAt.precision !== "datetime" || file.chronologyYear === null) {
			continue;
		}

		if (!isYearIncludedInHourMetricScope(file.chronologyYear, settings)) {
			continue;
		}

		const hour = createdAt.hour;
		hourCounts[hour] = (hourCounts[hour] ?? 0) + 1;
		hourWordTotals[hour] = (hourWordTotals[hour] ?? 0) + file.wordCount;
		usableEntryCount += 1;
	}

	const points: HourlyActivityPoint[] = hourCounts.map((entryCount, hour) => ({
		hour,
		entryCount,
		averageWords: entryCount > 0 ? (hourWordTotals[hour] ?? 0) / entryCount : 0,
	}));

	return {
		points,
		usableEntryCount,
	};
}

function buildTagFrequencyHeatmap(
	files: DiaryFileAnalysis[],
	settings: Pick<
		DiaryStatsSettings,
		| "minimumTagFrequency"
		| "tagMetricTimeScope"
		| "tagMetricFromYear"
		| "tagMetricToYear"
		| "hourMetricTimeScope"
		| "hourMetricFromYear"
		| "hourMetricToYear"
		| "tagAnalysisIncludedYears"
		| "tagAnalysisExcludedYears"
	>,
) {
	const filteredFiles = files.filter((file) => {
		if (file.chronologyYear === null) {
			return false;
		}

		return isYearIncludedInTagMetricScope(file.chronologyYear, settings);
	});
	const totalTagCounts = new Map<string, number>();

	for (const file of filteredFiles) {
		for (const tag of file.normalizedTags) {
			totalTagCounts.set(tag, (totalTagCounts.get(tag) ?? 0) + 1);
		}
	}

	const qualifyingTags = [...totalTagCounts.entries()]
		.filter(([, count]) => count >= Math.max(1, settings.minimumTagFrequency))
		.sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]));
	const displayedTags = qualifyingTags.slice(0, MAX_TAG_HEATMAP_TAGS);
	const displayedTagSet = new Set(displayedTags.map(([tag]) => tag));
	const years = [...new Set(filteredFiles.map((file) => file.chronologyYear).filter((year): year is number => year !== null))]
		.sort((left, right) => left - right);
	const countMap = new Map<string, number>();
	let maxEntryCount = 0;

	for (const file of filteredFiles) {
		const year = file.chronologyYear;
		if (year === null) {
			continue;
		}

		for (const tag of file.normalizedTags) {
			if (!displayedTagSet.has(tag)) {
				continue;
			}

			const key = `${tag}::${year}`;
			const nextValue = (countMap.get(key) ?? 0) + 1;
			countMap.set(key, nextValue);
			maxEntryCount = Math.max(maxEntryCount, nextValue);
		}
	}

	return {
		qualifyingTagCount: qualifyingTags.length,
		displayedTagCount: displayedTags.length,
		topTagByFrequency: displayedTags[0]?.[0] ?? null,
		topTagFrequencyCount: displayedTags[0]?.[1] ?? 0,
		years,
		tags: displayedTags.map(([tag]) => tag),
		maxEntryCount,
		cells: displayedTags.flatMap(([tag], tagIndex) =>
			years.map((year) => ({
				tagIndex,
				year,
				entryCount: countMap.get(`${tag}::${year}`) ?? 0,
			})),
		),
	};
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

function getTopBy<T>(values: T[], predicate: (value: T) => boolean, score: (value: T) => number): T | null {
	const filteredValues = values.filter(predicate);
	if (filteredValues.length === 0) {
		return null;
	}

	return filteredValues.reduce((best, current) => (score(current) > score(best) ? current : best));
}

function getBottomBy<T>(values: T[], predicate: (value: T) => boolean, score: (value: T) => number): T | null {
	const filteredValues = values.filter(predicate);
	if (filteredValues.length === 0) {
		return null;
	}

	return filteredValues.reduce((best, current) => (score(current) < score(best) ? current : best));
}
