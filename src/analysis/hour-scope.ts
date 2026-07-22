import type { DiaryStatsSettings, HourMetricTimeScope } from "../types";

export interface HourMetricScopeConfig {
	hourMetricTimeScope: HourMetricTimeScope;
	hourMetricFromYear: number | null;
	hourMetricToYear: number | null;
}

export function isYearIncludedInHourMetricScope(
	year: number,
	settings: Pick<DiaryStatsSettings, "hourMetricTimeScope" | "hourMetricFromYear" | "hourMetricToYear">,
): boolean {
	if (settings.hourMetricTimeScope === "year-range") {
		if (settings.hourMetricFromYear !== null && year < settings.hourMetricFromYear) {
			return false;
		}

		if (settings.hourMetricToYear !== null && year > settings.hourMetricToYear) {
			return false;
		}
	}

	return true;
}

export function formatHourMetricScopeSummary(
	settings: Pick<DiaryStatsSettings, "hourMetricTimeScope" | "hourMetricFromYear" | "hourMetricToYear">,
): string {
	if (settings.hourMetricTimeScope === "all-years") {
		return "All eligible years";
	}

	const fromLabel = settings.hourMetricFromYear?.toString() ?? "start";
	const toLabel = settings.hourMetricToYear?.toString() ?? "end";
	return `${fromLabel} to ${toLabel}`;
}
