import { App } from "obsidian";
import {
	buildAnalysisSettingsSignature,
	getReusableCacheEntry,
	pruneDeletedCacheEntries,
	writeCacheEntry,
} from "./cache";
import { buildAggregateSummary, buildDateIssueReport } from "./aggregate";
import { buildAdvancedMetricsSummary } from "./advanced";
import { buildExtraMetricsSummary } from "./extra-metrics";
import { buildStructuralExamplesSummary } from "./examples";
import { buildVisualSummary } from "./heatmaps";
import { analyzeDiaryFile } from "./parse";
import { buildRecordsSummary } from "./records";
import { formatElapsedDuration } from "./reading-time";
import { collectScopedMarkdownFiles } from "./scope";
import { buildTagAnalysisSummary } from "./tags";
import { extractBodyTextFeatures } from "./text-features";
import type {
	AnalysisProgressState,
	DiaryAnalysisResult,
	DiaryFileAnalysis,
	DiaryStatsSettings,
	PersistedAnalysisCache,
} from "../types";

export interface RunDiaryAnalysisOutput {
	result: DiaryAnalysisResult;
	cache: PersistedAnalysisCache;
}

export interface RunDiaryAnalysisOptions {
	onProgress?: (progress: AnalysisProgressState) => void | Promise<void>;
}

export async function runDiaryAnalysisPipeline(
	app: App,
	settings: DiaryStatsSettings,
	cache: PersistedAnalysisCache,
	options: RunDiaryAnalysisOptions = {},
): Promise<RunDiaryAnalysisOutput> {
	const startedAt = new Date().toISOString();
	await reportProgress(options, createProgressState(startedAt, "Collecting markdown files...", 0, 0, 0));
	const { matchingFiles, summary } = collectScopedMarkdownFiles(app, settings);
	const settingsSignature = buildAnalysisSettingsSignature(settings);
	const droppedDeletedEntries = pruneDeletedCacheEntries(cache, app.vault.getMarkdownFiles());
	await reportProgress(
		options,
		createProgressState(
			startedAt,
			`Analyzing ${matchingFiles.length} markdown files...`,
			0,
			matchingFiles.length,
			matchingFiles.length === 0 ? 100 : 0,
		),
	);

	const fileAnalyses: DiaryFileAnalysis[] = [];
	let reusedEntries = 0;
	let refreshedEntries = 0;

	for (let index = 0; index < matchingFiles.length; index += 1) {
		const file = matchingFiles[index];
		if (!file) {
			continue;
		}
		const reusableCacheEntry = getReusableCacheEntry(cache, file, settingsSignature);
		if (reusableCacheEntry) {
			fileAnalyses.push(reusableCacheEntry.analysis);
			reusedEntries += 1;
		} else {
			// Reading the file is the expensive step, so cache reuse is keyed to settings plus file metadata.
			const content = await app.vault.cachedRead(file);
			const frontmatter = app.metadataCache.getFileCache(file)?.frontmatter;
			const analysis = {
				...analyzeDiaryFile(file, content, frontmatter, settings),
				bodyTextFeatures: settings.enableBodyTextAnalysis ? extractBodyTextFeatures(content, settings) : null,
			};

			writeCacheEntry(cache, file, settingsSignature, analysis);
			fileAnalyses.push(analysis);
			refreshedEntries += 1;
		}

		if ((index + 1) % 25 === 0 || index === matchingFiles.length - 1) {
			await reportProgress(
				options,
				createProgressState(
					startedAt,
					`Analyzed ${index + 1} of ${matchingFiles.length} files...`,
					index + 1,
					matchingFiles.length,
					matchingFiles.length === 0 ? 100 : Math.round(((index + 1) / matchingFiles.length) * 100),
				),
			);
		}
	}

	await reportProgress(
		options,
		createProgressState(
			startedAt,
			"Aggregating statistics and preparing reports...",
			matchingFiles.length,
			matchingFiles.length,
			100,
		),
	);

	const aggregate = buildAggregateSummary(fileAnalyses, settings);
	const tagAnalysis = buildTagAnalysisSummary(fileAnalyses, settings);
	const advancedMetricsBase = buildAdvancedMetricsSummary(fileAnalyses, settings);
	const advancedMetrics = {
		...advancedMetricsBase,
		structuralExamples: buildStructuralExamplesSummary(fileAnalyses, advancedMetricsBase),
	};
	const visuals = buildVisualSummary(fileAnalyses, aggregate, advancedMetrics);
	const extraMetrics = buildExtraMetricsSummary(fileAnalyses, settings);
	const records = buildRecordsSummary(fileAnalyses, settings);
	const dateIssues = buildDateIssueReport(fileAnalyses);
	const finishedAt = new Date().toISOString();
	const durationMilliseconds = new Date(finishedAt).getTime() - new Date(startedAt).getTime();

	return {
		result: {
			startedAt,
			finishedAt,
			durationMilliseconds,
			durationLabel: formatElapsedDuration(durationMilliseconds),
			scope: summary,
			cache: {
				reusedEntries,
				refreshedEntries,
				droppedDeletedEntries,
				currentCacheEntryCount: Object.keys(cache.entries).length,
				settingsSignature,
			},
			aggregate,
			visuals,
			tagAnalysis,
			advancedMetrics,
			extraMetrics,
			records,
			dateIssues,
		},
		cache,
	};
}

async function reportProgress(
	options: RunDiaryAnalysisOptions,
	progress: AnalysisProgressState,
): Promise<void> {
	if (!options.onProgress) {
		return;
	}

	await options.onProgress(progress);
}

function createProgressState(
	startedAt: string,
	message: string,
	processedFiles: number,
	totalFiles: number,
	percent: number,
): AnalysisProgressState {
	const elapsedMilliseconds = Math.max(0, Date.now() - new Date(startedAt).getTime());

	return {
		startedAt,
		elapsedLabel: formatElapsedDuration(elapsedMilliseconds),
		message,
		processedFiles,
		totalFiles,
		percent,
	};
}
