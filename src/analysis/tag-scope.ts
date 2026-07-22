import type { DiaryStatsSettings, TagMetricTimeScope } from "../types";

export interface TagMetricScopeConfig {
	tagMetricTimeScope: TagMetricTimeScope;
	tagMetricFromYear: number | null;
	tagMetricToYear: number | null;
	tagAnalysisIncludedYears: number[];
	tagAnalysisExcludedYears: number[];
}

export function isYearIncludedInTagMetricScope(
	year: number,
	settings: Pick<
		DiaryStatsSettings,
		| "tagMetricTimeScope"
		| "tagMetricFromYear"
		| "tagMetricToYear"
		| "tagAnalysisIncludedYears"
		| "tagAnalysisExcludedYears"
	>,
): boolean {
	if (settings.tagMetricTimeScope === "year-range") {
		if (settings.tagMetricFromYear !== null && year < settings.tagMetricFromYear) {
			return false;
		}

		if (settings.tagMetricToYear !== null && year > settings.tagMetricToYear) {
			return false;
		}
	}

	if (settings.tagAnalysisIncludedYears.length > 0 && !settings.tagAnalysisIncludedYears.includes(year)) {
		return false;
	}

	return !settings.tagAnalysisExcludedYears.includes(year);
}

export function formatTagMetricScopeSummary(
	settings: Pick<DiaryStatsSettings, "tagMetricTimeScope" | "tagMetricFromYear" | "tagMetricToYear">,
): string {
	if (settings.tagMetricTimeScope === "all-years") {
		return "All eligible years";
	}

	const fromLabel = settings.tagMetricFromYear?.toString() ?? "start";
	const toLabel = settings.tagMetricToYear?.toString() ?? "end";
	return `${fromLabel} to ${toLabel}`;
}
