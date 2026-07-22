import type { BodyTextMetricTimeScope, DiaryStatsSettings } from "../types";

export interface BodyTextMetricScopeConfig {
	bodyTextMetricTimeScope: BodyTextMetricTimeScope;
	bodyTextMetricFromYear: number | null;
	bodyTextMetricToYear: number | null;
}

export function isYearIncludedInBodyTextMetricScope(
	year: number,
	settings: Pick<DiaryStatsSettings, "bodyTextMetricTimeScope" | "bodyTextMetricFromYear" | "bodyTextMetricToYear">,
): boolean {
	if (settings.bodyTextMetricTimeScope === "year-range") {
		if (settings.bodyTextMetricFromYear !== null && year < settings.bodyTextMetricFromYear) {
			return false;
		}

		if (settings.bodyTextMetricToYear !== null && year > settings.bodyTextMetricToYear) {
			return false;
		}
	}

	return true;
}

export function formatBodyTextMetricScopeSummary(
	settings: Pick<DiaryStatsSettings, "bodyTextMetricTimeScope" | "bodyTextMetricFromYear" | "bodyTextMetricToYear">,
): string {
	if (settings.bodyTextMetricTimeScope === "all-years") {
		return "All eligible years";
	}

	const fromLabel = settings.bodyTextMetricFromYear?.toString() ?? "start";
	const toLabel = settings.bodyTextMetricToYear?.toString() ?? "end";
	return `${fromLabel} to ${toLabel}`;
}
