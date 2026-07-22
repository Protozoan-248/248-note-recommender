import type { DeepTextAnalysisScopeMode, DiaryFileAnalysis, DiaryStatsSettings } from "../types";
import { normalizeTagValue } from "./parse";

export interface DeepTextScopeConfig {
	deepTextAnalysisScopeMode: DeepTextAnalysisScopeMode;
	deepTextAnalysisFromYear: number | null;
	deepTextAnalysisToYear: number | null;
	deepTextIncludedTags: string[];
	deepTextExcludedTags: string[];
	hierarchicalTagMode: DiaryStatsSettings["hierarchicalTagMode"];
	ignoredTags: string[];
	tagAliasMap: Record<string, string>;
}

export interface ResolvedDeepTextScope {
	mode: DeepTextAnalysisScopeMode;
	fromYear: number | null;
	toYear: number | null;
	includedTags: string[];
	excludedTags: string[];
}

export function resolveDeepTextScope(
	settings: Pick<
		DiaryStatsSettings,
		| "deepTextAnalysisScopeMode"
		| "deepTextAnalysisFromYear"
		| "deepTextAnalysisToYear"
		| "deepTextIncludedTags"
		| "deepTextExcludedTags"
		| "hierarchicalTagMode"
		| "ignoredTags"
		| "tagAliasMap"
	>,
): ResolvedDeepTextScope {
	if (settings.deepTextAnalysisScopeMode === "all") {
		return {
			mode: "all",
			fromYear: null,
			toYear: null,
			includedTags: [],
			excludedTags: [],
		};
	}

	const ignoredTags = new Set(
		settings.ignoredTags
			.map((tag) => normalizeTagValue(tag, settings.hierarchicalTagMode))
			.filter((tag) => tag.length > 0),
	);
	const aliasMap = new Map(
		Object.entries(settings.tagAliasMap)
			.map(([source, target]) => [
				normalizeTagValue(source, settings.hierarchicalTagMode),
				normalizeTagValue(target, settings.hierarchicalTagMode),
			] as const)
			.filter(([source, target]) => source.length > 0 && target.length > 0),
	);

	return {
		mode: "defined",
		fromYear: settings.deepTextAnalysisFromYear,
		toYear: settings.deepTextAnalysisToYear,
		includedTags: normalizeScopeTags(
			settings.deepTextIncludedTags,
			settings.hierarchicalTagMode,
			aliasMap,
			ignoredTags,
		),
		excludedTags: normalizeScopeTags(
			settings.deepTextExcludedTags,
			settings.hierarchicalTagMode,
			aliasMap,
			ignoredTags,
		),
	};
}

export function isFileIncludedInDeepTextScope(
	file: Pick<DiaryFileAnalysis, "createdAt" | "normalizedTags">,
	scope: ResolvedDeepTextScope,
): boolean {
	if (scope.mode === "all") {
		return true;
	}

	const year = file.createdAt.value?.year ?? null;
	if (year === null) {
		return false;
	}

	if (scope.fromYear !== null && year < scope.fromYear) {
		return false;
	}

	if (scope.toYear !== null && year > scope.toYear) {
		return false;
	}

	if (scope.includedTags.length > 0 && !scope.includedTags.some((tag) => file.normalizedTags.includes(tag))) {
		return false;
	}

	if (scope.excludedTags.length > 0 && scope.excludedTags.some((tag) => file.normalizedTags.includes(tag))) {
		return false;
	}

	return true;
}

export function formatDeepTextScopeSummary(scope: ResolvedDeepTextScope): string {
	if (scope.mode === "all") {
		return "Analyze everything";
	}

	const fromLabel = scope.fromYear?.toString() ?? "start";
	const toLabel = scope.toYear?.toString() ?? "end";
	return `${fromLabel} to ${toLabel}`;
}

export function formatDeepTextTagFilterSummary(scope: ResolvedDeepTextScope): string {
	const parts: string[] = [];
	if (scope.includedTags.length > 0) {
		parts.push(`include ${scope.includedTags.join(", ")}`);
	}

	if (scope.excludedTags.length > 0) {
		parts.push(`exclude ${scope.excludedTags.join(", ")}`);
	}

	return parts.length > 0 ? parts.join(" | ") : "No tag filter";
}

function normalizeScopeTags(
	values: string[],
	hierarchicalTagMode: DiaryStatsSettings["hierarchicalTagMode"],
	aliasMap: Map<string, string>,
	ignoredTags: Set<string>,
): string[] {
	const tags = new Set<string>();
	for (const value of values) {
		const normalizedTag = normalizeTagValue(value, hierarchicalTagMode);
		if (normalizedTag.length === 0) {
			continue;
		}

		const aliasedTag = aliasMap.get(normalizedTag) ?? normalizedTag;
		if (ignoredTags.has(aliasedTag)) {
			continue;
		}

		tags.add(aliasedTag);
	}

	return [...tags].sort((left, right) => left.localeCompare(right));
}
