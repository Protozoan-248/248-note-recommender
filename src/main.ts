import { Notice, Plugin, TFile } from "obsidian";
import { createEmptyAnalysisCache, normalizeAnalysisCache } from "./analysis/cache";
import { tokenizeMarkdownForWordCount } from "./analysis/parse";
import { runDiaryAnalysisPipeline } from "./analysis/run";
import { buildRecommendations } from "./analysis/recommendation-pipeline";
import { buildCsvReport } from "./export/csv";
import { writeExportFile } from "./export/files";
import { buildMarkdownReport } from "./export/markdown";
import { DEFAULT_NOTE_RECOMMENDER_SETTINGS, DEFAULT_SETTINGS, DiaryStatsSettingTab, NoteRecommenderSettingTab } from "./settings";
import type {
	DiaryAnalysisResult,
	DiaryStatsSettings,
	NoteRecommendationSettings,
	PersistedPluginData,
	RecommendationResult,
	ResultsViewUiState,
	WordCountDebugResult,
} from "./types";
import { DiaryStatsResultsView, VIEW_TYPE_DIARY_STATS_RESULTS } from "./ui/results-view";
import { NoteRecommenderView, VIEW_TYPE_NOTE_RECOMMENDER } from "./ui/recommendations-view";

export default class DiaryStatsPlugin extends Plugin {
	settings!: DiaryStatsSettings;
	noteRecommendationSettings!: NoteRecommendationSettings;
	private analysisCache = createEmptyAnalysisCache();
	private lastAnalysisResult: DiaryAnalysisResult | null = null;
	private lastWordCountDebugResult: WordCountDebugResult | null = null;
	private lastRecommendationResult: RecommendationResult | null = null;
	private resultsViewUiState: ResultsViewUiState = {
		detailOpenByKey: {},
	};

	async onload(): Promise<void> {
		await this.loadPluginData();

		this.registerView(
			VIEW_TYPE_DIARY_STATS_RESULTS,
			(leaf) =>
				new DiaryStatsResultsView(leaf, () => ({
					lowColor: this.settings.heatmapLowColor,
					highColor: this.settings.heatmapHighColor,
					showVisualAnalytics: this.settings.showVisualAnalytics,
					yearlyEntryLengthTrendMethod: this.settings.yearlyEntryLengthTrendMethod,
					tagRowsDisplayLimit: this.settings.tagRowsDisplayLimit,
					recurringPhraseDisplayLimit: this.settings.recurringPhraseDisplayLimit,
					periodSignatureDisplayLimit: this.settings.periodSignatureDisplayLimit,
					entityDisplayLimit: this.settings.entityDisplayLimit,
					advancedRowsDisplayLimit: this.settings.advancedRowsDisplayLimit,
					tagPairLiftDisplayLimit: this.settings.tagPairLiftDisplayLimit,
					bridgeTagDisplayLimit: this.settings.bridgeTagDisplayLimit,
					weekdaySemanticBiasDisplayLimit: this.settings.weekdaySemanticBiasDisplayLimit,
					tagTextProfileDisplayLimit: this.settings.tagTextProfileDisplayLimit,
					recordsMode: this.settings.recordsMode,
					recordsDisplayLimit: this.settings.recordsDisplayLimit,
					enableStructuralExamples: this.settings.enableStructuralExamples,
					structuralExamplesLimit: this.settings.structuralExamplesLimit,
				}),
				(detailKey) => this.resultsViewUiState.detailOpenByKey?.[detailKey],
				(detailKey, isOpen) => {
					void this.setResultsViewDetailState(detailKey, isOpen);
				},
				() => {
					void this.runDiaryAnalysis();
				},
				() => {
					void this.clearAnalysisCache();
				},
				() => {
					void this.exportLastAnalysis("markdown");
				},
				() => {
					void this.exportLastAnalysis("csv");
				}),
		);
		this.registerView(VIEW_TYPE_NOTE_RECOMMENDER, (leaf) => new NoteRecommenderView(leaf));
		this.registerHoverLinkSource(VIEW_TYPE_DIARY_STATS_RESULTS, {
			display: "Diary statistics",
			defaultMod: true,
		});

		this.addCommand({
			id: "generate-note-recommendations",
			name: "Generate note recommendations",
			checkCallback: (checking) => {
				const activeFile = this.app.workspace.getActiveFile();
				if (!isMarkdownFile(activeFile)) {
					return false;
				}

				if (!checking) {
					void this.runRecommendationsForActiveNote(activeFile);
				}

				return true;
			},
		});

		this.addCommand({
			id: "run-diary-analysis",
			name: "Run diary analysis",
			callback: async () => {
				await this.runDiaryAnalysis();
			},
		});

		this.addCommand({
			id: "inspect-active-note-word-count",
			name: "Inspect active note word count",
			checkCallback: (checking) => {
				if (!this.settings.enableWordCountDebugTools) {
					return false;
				}

				const activeFile = this.app.workspace.getActiveFile();
				if (!isMarkdownFile(activeFile)) {
					return false;
				}

				if (!checking) {
					void this.inspectActiveNoteWordCount(activeFile);
				}

				return true;
			},
		});

		this.addCommand({
			id: "export-last-analysis-markdown",
			name: "Export last analysis as Markdown",
			checkCallback: (checking) => {
				if (!this.lastAnalysisResult) {
					return false;
				}

				if (!checking) {
					void this.exportLastAnalysis("markdown");
				}

				return true;
			},
		});

		this.addCommand({
			id: "export-last-analysis-csv",
			name: "Export last analysis as CSV",
			checkCallback: (checking) => {
				if (!this.lastAnalysisResult) {
					return false;
				}

				if (!checking) {
					void this.exportLastAnalysis("csv");
				}

				return true;
			},
		});

		this.addCommand({
			id: "clear-analysis-cache",
			name: "Clear analysis cache",
			callback: async () => {
				await this.clearAnalysisCache();
			},
		});

		this.addSettingTab(new DiaryStatsSettingTab(this.app, this));
		this.addSettingTab(new NoteRecommenderSettingTab(this.app, this));
	}

	onunload(): void {
		this.app.workspace.detachLeavesOfType(VIEW_TYPE_DIARY_STATS_RESULTS);
		this.app.workspace.detachLeavesOfType(VIEW_TYPE_NOTE_RECOMMENDER);
	}

	async saveSettings(): Promise<void> {
		await this.savePluginData();
	}

	private async loadPluginData(): Promise<void> {
		const loadedData = (await this.loadData()) as PersistedPluginData | Partial<DiaryStatsSettings> | null;
		if (isPersistedPluginData(loadedData)) {
			this.settings = normalizeLoadedSettings(Object.assign({}, DEFAULT_SETTINGS, loadedData.settings ?? {}));
			this.noteRecommendationSettings = normalizeLoadedRecommendationSettings(
				Object.assign({}, DEFAULT_NOTE_RECOMMENDER_SETTINGS, loadedData.noteRecommendationSettings ?? {}),
			);
			this.analysisCache = normalizeAnalysisCache(loadedData.analysisCache);
			this.resultsViewUiState = normalizeResultsViewUiState(loadedData.resultsViewUiState);
			return;
		}

		this.settings = normalizeLoadedSettings(Object.assign({}, DEFAULT_SETTINGS, loadedData ?? {}));
		this.noteRecommendationSettings = normalizeLoadedRecommendationSettings(DEFAULT_NOTE_RECOMMENDER_SETTINGS);
		this.analysisCache = createEmptyAnalysisCache();
		this.resultsViewUiState = normalizeResultsViewUiState(undefined);
	}

	private async savePluginData(): Promise<void> {
		await this.saveData({
			settings: this.settings,
			analysisCache: this.analysisCache,
			resultsViewUiState: this.resultsViewUiState,
			noteRecommendationSettings: this.noteRecommendationSettings,
		} satisfies PersistedPluginData);
	}

	private async runDiaryAnalysis(): Promise<void> {
		new Notice("Diary analysis started.");
		const view = await this.activateResultsView();
		const progressStartedAt = new Date().toISOString();
		view.setProgress({
			startedAt: progressStartedAt,
			elapsedLabel: "0 s",
			message: "Preparing analysis...",
			processedFiles: 0,
			totalFiles: 0,
			percent: 0,
		});

		try {
			const { result, cache } = await runDiaryAnalysisPipeline(this.app, this.settings, this.analysisCache, {
				onProgress: async (progress) => {
					view.setProgress(progress);
				},
			});
			this.analysisCache = cache;
			this.lastAnalysisResult = result;
			await this.savePluginData();

			view.clearProgress();
			view.setResult(result);

			new Notice(
				`Diary analysis finished. ${result.aggregate.totalEntries} entries, ${result.aggregate.totalWords} words.`,
			);
		} catch (error: unknown) {
			view.clearProgress();
			console.error("Diary analysis failed", error);
			new Notice("Diary analysis failed. Check the developer console for details.");
		}
	}

	private async runRecommendationsForActiveNote(file: TFile): Promise<void> {
		try {
			const view = await this.activateRecommendationView();
			const result = await buildRecommendations(this.app, this.noteRecommendationSettings, file);
			this.lastRecommendationResult = result;
			view.setResult(result);
			new Notice(`Recommendations generated for ${file.basename}.`);
		} catch (error: unknown) {
			console.error("Recommendation generation failed", error);
			new Notice("Recommendation generation failed. Check the developer console for details.");
		}
	}

	private async inspectActiveNoteWordCount(file: TFile): Promise<void> {
		try {
			const content = await this.app.vault.cachedRead(file);
			const tokenization = tokenizeMarkdownForWordCount(content, this.settings);

			this.lastWordCountDebugResult = {
				path: file.path,
				wordCount: tokenization.tokens.length,
				cleanedText: tokenization.cleanedText,
				tokens: tokenization.tokens,
			};

			const view = await this.activateResultsView();
			view.setDebugResult(this.lastWordCountDebugResult);

			new Notice(`Word count debug ready for ${file.name}: ${tokenization.tokens.length} tokens.`);
		} catch (error: unknown) {
			console.error("Word count debug failed", error);
			new Notice("Word count debug failed. Check the developer console for details.");
		}
	}

	private async exportLastAnalysis(format: "markdown" | "csv"): Promise<void> {
		if (!this.lastAnalysisResult) {
			new Notice("Run diary analysis first.");
			return;
		}

		try {
			const content =
				format === "markdown"
					? buildMarkdownReport(this.lastAnalysisResult, {
							includeStructuralExamples:
								this.settings.enableStructuralExamples && this.settings.structuralExamplesLimit > 0,
							structuralExamplesLimit: this.settings.structuralExamplesLimit,
							recurringPhraseDisplayLimit: this.settings.recurringPhraseDisplayLimit,
							periodSignatureDisplayLimit: this.settings.periodSignatureDisplayLimit,
							entityDisplayLimit: this.settings.entityDisplayLimit,
							recordsDisplayLimit: this.settings.recordsDisplayLimit,
							recordsMode: this.settings.recordsMode,
					  })
					: buildCsvReport(this.lastAnalysisResult, {
							includeStructuralExamples:
								this.settings.enableStructuralExamples && this.settings.structuralExamplesLimit > 0,
							structuralExamplesLimit: this.settings.structuralExamplesLimit,
					  });
			const filePath = await writeExportFile(
				this.app,
				this.settings.exportFolderPath,
				format === "markdown" ? "diary-statistics-report" : "diary-statistics-data",
				format === "markdown" ? "md" : "csv",
				content,
			);

			new Notice(`Export created: ${filePath}`);
		} catch (error: unknown) {
			console.error("Export failed", error);
			new Notice("Export failed. Check the developer console for details.");
		}
	}

	async clearAnalysisCache(): Promise<void> {
		this.analysisCache = createEmptyAnalysisCache();
		await this.savePluginData();
		new Notice("Analysis cache cleared. The next run will rebuild all files.");
	}

	async refreshResultsViewIfOpen(): Promise<void> {
		const leaf = this.app.workspace.getLeavesOfType(VIEW_TYPE_DIARY_STATS_RESULTS)[0];
		if (!leaf || !(leaf.view instanceof DiaryStatsResultsView)) {
			return;
		}

		if (this.lastAnalysisResult) {
			leaf.view.setResult(this.lastAnalysisResult);
		} else if (this.lastWordCountDebugResult) {
			leaf.view.setDebugResult(this.lastWordCountDebugResult);
		}
	}

	private async setResultsViewDetailState(detailKey: string, isOpen: boolean): Promise<void> {
		const currentValue = this.resultsViewUiState.detailOpenByKey?.[detailKey];
		if (currentValue === isOpen) {
			return;
		}

		this.resultsViewUiState = {
			detailOpenByKey: {
				...(this.resultsViewUiState.detailOpenByKey ?? {}),
				[detailKey]: isOpen,
			},
		};
		await this.savePluginData();
	}

	private async activateRecommendationView(): Promise<NoteRecommenderView> {
		const existingLeaf = this.app.workspace.getLeavesOfType(VIEW_TYPE_NOTE_RECOMMENDER)[0];
		const leaf = existingLeaf ?? this.app.workspace.getLeaf(true);

		await leaf.setViewState({
			type: VIEW_TYPE_NOTE_RECOMMENDER,
			active: true,
		});

		this.app.workspace.revealLeaf(leaf);

		if (!(leaf.view instanceof NoteRecommenderView)) {
			throw new Error("Failed to activate the note recommender view.");
		}

		if (this.lastRecommendationResult) {
			leaf.view.setResult(this.lastRecommendationResult);
		}

		return leaf.view;
	}

	private async activateResultsView(): Promise<DiaryStatsResultsView> {
		const existingLeaf = this.app.workspace.getLeavesOfType(VIEW_TYPE_DIARY_STATS_RESULTS)[0];
		const leaf = existingLeaf ?? this.app.workspace.getLeaf(true);

		await leaf.setViewState({
			type: VIEW_TYPE_DIARY_STATS_RESULTS,
			active: true,
		});

		this.app.workspace.revealLeaf(leaf);

		if (!(leaf.view instanceof DiaryStatsResultsView)) {
			throw new Error("Failed to activate the diary statistics view.");
		}

		if (this.lastAnalysisResult) {
			leaf.view.setResult(this.lastAnalysisResult);
		}

		if (this.lastWordCountDebugResult) {
			leaf.view.setDebugResult(this.lastWordCountDebugResult);
		}

		return leaf.view;
	}
}

function isPersistedPluginData(value: unknown): value is PersistedPluginData {
	return (
		typeof value === "object" &&
		value !== null &&
		("settings" in value || "analysisCache" in value || "resultsViewUiState" in value)
	);
}

function isMarkdownFile(file: TFile | null): file is TFile {
	return file !== null && file.extension === "md";
}

function normalizeLoadedSettings(settings: DiaryStatsSettings): DiaryStatsSettings {
	return {
		...settings,
		scopeMode: settings.scopeMode === "exclude" ? "exclude" : "include",
		scopeFolders: Array.isArray(settings.scopeFolders) ? settings.scopeFolders : DEFAULT_SETTINGS.scopeFolders,
		ignoreFolderRules: Array.isArray(settings.ignoreFolderRules)
			? settings.ignoreFolderRules
			: DEFAULT_SETTINGS.ignoreFolderRules,
		ignoredTags: Array.isArray(settings.ignoredTags) ? settings.ignoredTags : DEFAULT_SETTINGS.ignoredTags,
		tagAnalysisIncludedYears: Array.isArray(settings.tagAnalysisIncludedYears)
			? settings.tagAnalysisIncludedYears
			: DEFAULT_SETTINGS.tagAnalysisIncludedYears,
		tagAnalysisExcludedYears: Array.isArray(settings.tagAnalysisExcludedYears)
			? settings.tagAnalysisExcludedYears
			: DEFAULT_SETTINGS.tagAnalysisExcludedYears,
		tagMetricTimeScope: settings.tagMetricTimeScope === "year-range" ? "year-range" : "all-years",
		tagMetricFromYear:
			Number.isFinite(settings.tagMetricFromYear) && (settings.tagMetricFromYear ?? 0) > 0
				? Math.round(settings.tagMetricFromYear as number)
				: DEFAULT_SETTINGS.tagMetricFromYear,
		tagMetricToYear:
			Number.isFinite(settings.tagMetricToYear) && (settings.tagMetricToYear ?? 0) > 0
				? Math.round(settings.tagMetricToYear as number)
				: DEFAULT_SETTINGS.tagMetricToYear,
		hourMetricTimeScope: settings.hourMetricTimeScope === "year-range" ? "year-range" : "all-years",
		hourMetricFromYear:
			Number.isFinite(settings.hourMetricFromYear) && (settings.hourMetricFromYear ?? 0) > 0
				? Math.round(settings.hourMetricFromYear as number)
				: DEFAULT_SETTINGS.hourMetricFromYear,
		hourMetricToYear:
			Number.isFinite(settings.hourMetricToYear) && (settings.hourMetricToYear ?? 0) > 0
				? Math.round(settings.hourMetricToYear as number)
				: DEFAULT_SETTINGS.hourMetricToYear,
		bodyTextMetricTimeScope: settings.bodyTextMetricTimeScope === "year-range" ? "year-range" : "all-years",
		bodyTextMetricFromYear:
			Number.isFinite(settings.bodyTextMetricFromYear) && (settings.bodyTextMetricFromYear ?? 0) > 0
				? Math.round(settings.bodyTextMetricFromYear as number)
				: DEFAULT_SETTINGS.bodyTextMetricFromYear,
		bodyTextMetricToYear:
			Number.isFinite(settings.bodyTextMetricToYear) && (settings.bodyTextMetricToYear ?? 0) > 0
				? Math.round(settings.bodyTextMetricToYear as number)
				: DEFAULT_SETTINGS.bodyTextMetricToYear,
		deepTextAnalysisScopeMode: settings.deepTextAnalysisScopeMode === "defined" ? "defined" : "all",
		deepTextAnalysisFromYear:
			Number.isFinite(settings.deepTextAnalysisFromYear) && (settings.deepTextAnalysisFromYear ?? 0) > 0
				? Math.round(settings.deepTextAnalysisFromYear as number)
				: DEFAULT_SETTINGS.deepTextAnalysisFromYear,
		deepTextAnalysisToYear:
			Number.isFinite(settings.deepTextAnalysisToYear) && (settings.deepTextAnalysisToYear ?? 0) > 0
				? Math.round(settings.deepTextAnalysisToYear as number)
				: DEFAULT_SETTINGS.deepTextAnalysisToYear,
		deepTextIncludedTags: Array.isArray(settings.deepTextIncludedTags)
			? settings.deepTextIncludedTags
			: DEFAULT_SETTINGS.deepTextIncludedTags,
		deepTextExcludedTags: Array.isArray(settings.deepTextExcludedTags)
			? settings.deepTextExcludedTags
			: DEFAULT_SETTINGS.deepTextExcludedTags,
		periodSignatureComparisonMode:
			settings.periodSignatureComparisonMode === "vs-rest" ? "vs-rest" : DEFAULT_SETTINGS.periodSignatureComparisonMode,
		periodSignatureFromYear:
			Number.isFinite(settings.periodSignatureFromYear) && (settings.periodSignatureFromYear ?? 0) > 0
				? Math.round(settings.periodSignatureFromYear as number)
				: DEFAULT_SETTINGS.periodSignatureFromYear,
		periodSignatureToYear:
			Number.isFinite(settings.periodSignatureToYear) && (settings.periodSignatureToYear ?? 0) > 0
				? Math.round(settings.periodSignatureToYear as number)
				: DEFAULT_SETTINGS.periodSignatureToYear,
		periodSignatureDisplayLimit:
			Number.isFinite(settings.periodSignatureDisplayLimit) && settings.periodSignatureDisplayLimit >= 0
				? Math.round(settings.periodSignatureDisplayLimit)
				: DEFAULT_SETTINGS.periodSignatureDisplayLimit,
		entityDisplayLimit:
			Number.isFinite(settings.entityDisplayLimit) && settings.entityDisplayLimit >= 0
				? Math.round(settings.entityDisplayLimit)
				: DEFAULT_SETTINGS.entityDisplayLimit,
		advancedRowsDisplayLimit:
			Number.isFinite(settings.advancedRowsDisplayLimit) && settings.advancedRowsDisplayLimit >= 0
				? Math.round(settings.advancedRowsDisplayLimit)
				: DEFAULT_SETTINGS.advancedRowsDisplayLimit,
		tagPairLiftDisplayLimit:
			settings.tagPairLiftDisplayLimit === null
				? null
				: Number.isFinite(settings.tagPairLiftDisplayLimit) && settings.tagPairLiftDisplayLimit >= 0
					? Math.round(settings.tagPairLiftDisplayLimit)
					: DEFAULT_SETTINGS.tagPairLiftDisplayLimit,
		bridgeTagDisplayLimit:
			settings.bridgeTagDisplayLimit === null
				? null
				: Number.isFinite(settings.bridgeTagDisplayLimit) && settings.bridgeTagDisplayLimit >= 0
					? Math.round(settings.bridgeTagDisplayLimit)
					: DEFAULT_SETTINGS.bridgeTagDisplayLimit,
		weekdaySemanticBiasDisplayLimit:
			settings.weekdaySemanticBiasDisplayLimit === null
				? null
				: Number.isFinite(settings.weekdaySemanticBiasDisplayLimit) && settings.weekdaySemanticBiasDisplayLimit >= 0
					? Math.round(settings.weekdaySemanticBiasDisplayLimit)
					: DEFAULT_SETTINGS.weekdaySemanticBiasDisplayLimit,
		tagTextProfileDisplayLimit:
			settings.tagTextProfileDisplayLimit === null
				? null
				: Number.isFinite(settings.tagTextProfileDisplayLimit) && settings.tagTextProfileDisplayLimit >= 0
					? Math.round(settings.tagTextProfileDisplayLimit)
					: DEFAULT_SETTINGS.tagTextProfileDisplayLimit,
		recurringPhraseDisplayLimit:
			Number.isFinite(settings.recurringPhraseDisplayLimit) && settings.recurringPhraseDisplayLimit >= 0
				? Math.round(settings.recurringPhraseDisplayLimit)
				: DEFAULT_SETTINGS.recurringPhraseDisplayLimit,
		tagRowsDisplayLimit:
			Number.isFinite(settings.tagRowsDisplayLimit) && settings.tagRowsDisplayLimit >= 0
				? Math.round(settings.tagRowsDisplayLimit)
				: DEFAULT_SETTINGS.tagRowsDisplayLimit,
		recordsMode: settings.recordsMode === "expanded" ? "expanded" : "simple",
		recordsDisplayLimit:
			Number.isFinite(settings.recordsDisplayLimit) && settings.recordsDisplayLimit >= 0
				? Math.round(settings.recordsDisplayLimit)
				: DEFAULT_SETTINGS.recordsDisplayLimit,
		enableStructuralExamples: settings.enableStructuralExamples === true,
		structuralExamplesLimit:
			Number.isFinite(settings.structuralExamplesLimit) && settings.structuralExamplesLimit >= 0
				? Math.round(settings.structuralExamplesLimit)
				: DEFAULT_SETTINGS.structuralExamplesLimit,
		showVisualAnalytics: settings.showVisualAnalytics !== false,
		yearlyEntryLengthTrendMethod:
			settings.yearlyEntryLengthTrendMethod === "median" ? "median" : DEFAULT_SETTINGS.yearlyEntryLengthTrendMethod,
		enableBodyTextAnalysis: settings.enableBodyTextAnalysis === true,
		enableCzechNormalizedDeepTextAnalysis: settings.enableCzechNormalizedDeepTextAnalysis === true,
		enablePeriodSignatureAnalysis: settings.enablePeriodSignatureAnalysis === true,
		enableEntityRelationshipAnalysis: settings.enableEntityRelationshipAnalysis === true,
	};
}

function normalizeLoadedRecommendationSettings(settings: Partial<NoteRecommendationSettings> | undefined): NoteRecommendationSettings {
	const base = { ...DEFAULT_NOTE_RECOMMENDER_SETTINGS, ...(settings ?? {}) };
	return {
		...base,
		excludeFolders: Array.isArray(base.excludeFolders)
			? base.excludeFolders.filter((folder): folder is string => typeof folder === "string")
			: DEFAULT_NOTE_RECOMMENDER_SETTINGS.excludeFolders,
		directLinkWeight: Number.isFinite(base.directLinkWeight) ? base.directLinkWeight : DEFAULT_NOTE_RECOMMENDER_SETTINGS.directLinkWeight,
		backlinkWeight: Number.isFinite(base.backlinkWeight) ? base.backlinkWeight : DEFAULT_NOTE_RECOMMENDER_SETTINGS.backlinkWeight,
		sharedTagWeight: Number.isFinite(base.sharedTagWeight) ? base.sharedTagWeight : DEFAULT_NOTE_RECOMMENDER_SETTINGS.sharedTagWeight,
		sameFolderWeight: Number.isFinite(base.sameFolderWeight) ? base.sameFolderWeight : DEFAULT_NOTE_RECOMMENDER_SETTINGS.sameFolderWeight,
		sharedNeighbourWeight: Number.isFinite(base.sharedNeighbourWeight)
			? base.sharedNeighbourWeight
			: DEFAULT_NOTE_RECOMMENDER_SETTINGS.sharedNeighbourWeight,
		diversityLambda: Number.isFinite(base.diversityLambda)
			? base.diversityLambda
			: DEFAULT_NOTE_RECOMMENDER_SETTINGS.diversityLambda,
		maxRecommendations: Number.isFinite(base.maxRecommendations) ? base.maxRecommendations : DEFAULT_NOTE_RECOMMENDER_SETTINGS.maxRecommendations,
	};
}

function normalizeResultsViewUiState(state: ResultsViewUiState | undefined): ResultsViewUiState {
	if (!state || typeof state !== "object") {
		return {
			detailOpenByKey: {},
		};
	}

	const detailOpenByKey = Object.fromEntries(
		Object.entries(state.detailOpenByKey ?? {}).filter((entry): entry is [string, boolean] => {
			const [key, value] = entry;
			return typeof key === "string" && typeof value === "boolean";
		}),
	);

	return {
		detailOpenByKey,
	};
}
