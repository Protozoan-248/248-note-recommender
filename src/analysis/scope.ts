import { App, TFile } from "obsidian";
import type { DiaryStatsSettings, ScopeMode, ScopeScanSummary } from "../types";

const MAX_SAMPLE_PATHS = 20;

type ExclusionReason = "hidden-folder" | "ignored-folder-rule" | "scope" | null;

export interface ScopedMarkdownFilesResult {
	matchingFiles: TFile[];
	summary: ScopeScanSummary;
}

export function collectScopedMarkdownFiles(app: App, settings: DiaryStatsSettings): ScopedMarkdownFilesResult {
	const normalizedSettings = normalizeSettings(settings);
	const markdownFiles = [...app.vault.getMarkdownFiles()].sort((left, right) => left.path.localeCompare(right.path));

	let ignoredByHiddenFolders = 0;
	let ignoredByFolderRules = 0;
	let ignoredByScope = 0;
	const matchingFiles: TFile[] = [];
	const samplePaths: string[] = [];

	for (const file of markdownFiles) {
		const exclusionReason = getExclusionReason(file, normalizedSettings);

		switch (exclusionReason) {
			case "hidden-folder":
				ignoredByHiddenFolders += 1;
				continue;
			case "ignored-folder-rule":
				ignoredByFolderRules += 1;
				continue;
			case "scope":
				ignoredByScope += 1;
				continue;
			default:
				break;
		}

		matchingFiles.push(file);

		if (samplePaths.length < MAX_SAMPLE_PATHS) {
			samplePaths.push(file.path);
		}
	}

	return {
		matchingFiles,
		summary: {
			totalMarkdownFiles: markdownFiles.length,
			matchedFileCount: matchingFiles.length,
			ignoredByHiddenFolders,
			ignoredByFolderRules,
			ignoredByScope,
			samplePaths,
			appliedScopeMode: normalizedSettings.scopeMode,
			appliedScopeFolders: normalizedSettings.scopeFolders,
			includeSubfolders: normalizedSettings.includeSubfolders,
			ignoreFolderRules: normalizedSettings.ignoreFolderRules,
			ignoreHiddenFolders: normalizedSettings.ignoreHiddenFolders,
			scopeInterpretation: describeScopeInterpretation(
				normalizedSettings.scopeMode,
				normalizedSettings.scopeFolders.length,
			),
		},
	};
}

function normalizeSettings(settings: DiaryStatsSettings): DiaryStatsSettings {
	return {
		...settings,
		scopeFolders: settings.scopeFolders.map(normalizeConfiguredPath).filter((path) => path.length > 0),
		ignoreFolderRules: settings.ignoreFolderRules.map(normalizeConfiguredPath).filter((rule) => rule.length > 0),
		createdAtKey: settings.createdAtKey.trim(),
		updatedAtKey: settings.updatedAtKey.trim(),
	};
}

function getExclusionReason(file: TFile, settings: DiaryStatsSettings): ExclusionReason {
	const normalizedFilePath = normalizeConfiguredPath(file.path);
	const folderSegments = getFolderSegments(normalizedFilePath);
	const parentFolderPath = folderSegments.join("/");

	// Hidden and ignored-folder rules always win over scope mode.
	if (settings.ignoreHiddenFolders && folderSegments.some((segment) => segment.startsWith("."))) {
		return "hidden-folder";
	}

	if (matchesIgnoredFolderRule(normalizedFilePath, parentFolderPath, folderSegments, settings.ignoreFolderRules)) {
		return "ignored-folder-rule";
	}

	if (isExcludedByScopeMode(normalizedFilePath, parentFolderPath, settings)) {
		return "scope";
	}

	return null;
}

function isExcludedByScopeMode(filePath: string, parentFolderPath: string, settings: DiaryStatsSettings): boolean {
	const matchesConfiguredFolder = settings.scopeFolders.some((folder) =>
		matchesConfiguredFolderPath(filePath, parentFolderPath, folder, settings.includeSubfolders),
	);

	if (settings.scopeMode === "include") {
		if (settings.scopeFolders.length === 0) {
			return true;
		}
		return !matchesConfiguredFolder;
	}

	return matchesConfiguredFolder;
}

function matchesIgnoredFolderRule(
	filePath: string,
	parentFolderPath: string,
	folderSegments: string[],
	rules: string[],
): boolean {
	return rules.some((rule) => {
		if (rule.includes("/")) {
			return matchesConfiguredFolderPath(filePath, parentFolderPath, rule, true);
		}

		const normalizedRule = rule.toLocaleLowerCase();
		return folderSegments.some((segment) => segment.toLocaleLowerCase() === normalizedRule);
	});
}

function matchesConfiguredFolderPath(
	filePath: string,
	parentFolderPath: string,
	configuredFolder: string,
	includeSubfolders: boolean,
): boolean {
	const normalizedFilePath = filePath.toLocaleLowerCase();
	const normalizedParentFolderPath = parentFolderPath.toLocaleLowerCase();
	const normalizedConfiguredFolder = configuredFolder.toLocaleLowerCase();

	if (includeSubfolders) {
		return normalizedFilePath.startsWith(`${normalizedConfiguredFolder}/`);
	}

	return normalizedParentFolderPath === normalizedConfiguredFolder;
}

function getFolderSegments(path: string): string[] {
	const segments = path.split("/").filter((segment) => segment.length > 0);
	return segments.slice(0, Math.max(segments.length - 1, 0));
}

function normalizeConfiguredPath(value: string): string {
	return value.replace(/\\/gu, "/").trim().replace(/^\/+|\/+$/gu, "");
}

function describeScopeInterpretation(scopeMode: ScopeMode, scopeFolderCount: number): string {
	if (scopeMode === "include") {
		if (scopeFolderCount === 0) {
			return "Include mode is active, but no scope folders are configured yet, so the scan will match no files.";
		}
		return "Include mode scans only markdown files inside the configured folders.";
	}

	if (scopeFolderCount === 0) {
		return "Exclude mode is active with no excluded folders configured, so the scan covers the vault except ignored folders.";
	}

	return "Exclude mode scans the vault except markdown files inside the configured folders.";
}
