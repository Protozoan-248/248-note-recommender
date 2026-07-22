import { TFile } from "obsidian";
import type {
	DiaryFileAnalysis,
	DiaryStatsSettings,
	PersistedAnalysisCache,
	PersistedFileAnalysisCacheEntry,
} from "../types";

const ANALYSIS_CACHE_VERSION = 4;
const ANALYSIS_ALGORITHM_VERSION = 9;

export function createEmptyAnalysisCache(): PersistedAnalysisCache {
	return {
		version: ANALYSIS_CACHE_VERSION,
		entries: {},
	};
}

export function normalizeAnalysisCache(value: unknown): PersistedAnalysisCache {
	if (!isRecord(value)) {
		return createEmptyAnalysisCache();
	}

	if (value.version !== ANALYSIS_CACHE_VERSION) {
		return createEmptyAnalysisCache();
	}

	const entriesValue = value.entries;
	if (!isRecord(entriesValue)) {
		return createEmptyAnalysisCache();
	}

	const entries: Record<string, PersistedFileAnalysisCacheEntry> = {};

	for (const [path, entryValue] of Object.entries(entriesValue)) {
		if (!isRecord(entryValue)) {
			continue;
		}

		if (
			typeof entryValue.path !== "string" ||
			typeof entryValue.mtimeMs !== "number" ||
			typeof entryValue.size !== "number" ||
			typeof entryValue.settingsSignature !== "string" ||
			!isRecord(entryValue.analysis)
		) {
			continue;
		}

		entries[path] = entryValue as unknown as PersistedFileAnalysisCacheEntry;
	}

	return {
		version: ANALYSIS_CACHE_VERSION,
		entries,
	};
}

export function buildAnalysisSettingsSignature(settings: DiaryStatsSettings): string {
	return [
		`algorithm:${ANALYSIS_ALGORITHM_VERSION}`,
		`created:${settings.createdAtKey.trim().toLocaleLowerCase()}`,
		`updated:${settings.updatedAtKey.trim().toLocaleLowerCase()}`,
		`excludeFences:${settings.excludeCodeFencesFromWordCount ? "1" : "0"}`,
		`excludeInline:${settings.excludeInlineCodeFromWordCount ? "1" : "0"}`,
		`bodyText:${settings.enableBodyTextAnalysis ? "1" : "0"}`,
		`czechDeepText:${settings.enableCzechNormalizedDeepTextAnalysis ? "1" : "0"}`,
		`tagHierarchy:${settings.hierarchicalTagMode}`,
		`tagIgnore:${settings.ignoredTags.map((tag) => tag.trim().toLocaleLowerCase()).sort().join(",")}`,
		`tagAlias:${Object.entries(settings.tagAliasMap)
			.map(([source, target]) => `${source.trim().toLocaleLowerCase()}=>${target.trim().toLocaleLowerCase()}`)
			.sort()
			.join(",")}`,
	].join("|");
}

export function pruneDeletedCacheEntries(cache: PersistedAnalysisCache, files: TFile[]): number {
	const livePaths = new Set(files.map((file) => file.path));
	let droppedDeletedEntries = 0;

	for (const cachedPath of Object.keys(cache.entries)) {
		if (!livePaths.has(cachedPath)) {
			delete cache.entries[cachedPath];
			droppedDeletedEntries += 1;
		}
	}

	return droppedDeletedEntries;
}

export function getReusableCacheEntry(
	cache: PersistedAnalysisCache,
	file: TFile,
	settingsSignature: string,
): PersistedFileAnalysisCacheEntry | null {
	const entry = cache.entries[file.path];
	if (!entry) {
		return null;
	}

	if (entry.settingsSignature !== settingsSignature) {
		return null;
	}

	if (entry.mtimeMs !== file.stat.mtime || entry.size !== file.stat.size) {
		return null;
	}

	return entry;
}

export function writeCacheEntry(
	cache: PersistedAnalysisCache,
	file: TFile,
	settingsSignature: string,
	analysis: DiaryFileAnalysis,
): void {
	cache.entries[file.path] = {
		path: file.path,
		mtimeMs: file.stat.mtime,
		size: file.stat.size,
		settingsSignature,
		analysis,
	};
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}
