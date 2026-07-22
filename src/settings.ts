import { App, PluginSettingTab, Setting } from "obsidian";
import DiaryStatsPlugin from "./main";
import type {
	AverageEntryLengthMethod,
	BodyTextMetricTimeScope,
	DeepTextAnalysisScopeMode,
	DiaryStatsSettings,
	HierarchicalTagMode,
	HourMetricTimeScope,
	NoteRecommendationSettings,
	PeriodSignatureComparisonMode,
	RecordsMode,
	ScopeMode,
	TagMetricTimeScope,
	TagCombinationMode,
} from "./types";

export const DEFAULT_SETTINGS: DiaryStatsSettings = {
	scopeMode: "include",
	scopeFolders: [],
	includeSubfolders: true,
	ignoreFolderRules: ["Resources", "_resources", "attachments"],
	ignoreHiddenFolders: true,
	createdAtKey: "Created at",
	updatedAtKey: "Last updated at",
	excludeCodeFencesFromWordCount: true,
	excludeInlineCodeFromWordCount: true,
	enableBodyTextAnalysis: false,
	enableCzechNormalizedDeepTextAnalysis: false,
	enablePeriodSignatureAnalysis: false,
	enableEntityRelationshipAnalysis: false,
	readingWordsPerMinute: 230,
	averageEntryLengthMethod: "median",
	minimumTagFrequency: 10,
	tagCombinationMode: "single",
	hierarchicalTagMode: "full",
	ignoredTags: [],
	tagAliasMap: {},
	enableCombinedTagAnalysis: true,
	enablePerYearTagAnalysis: true,
	tagMetricTimeScope: "all-years",
	tagMetricFromYear: null,
	tagMetricToYear: null,
	hourMetricTimeScope: "all-years",
	hourMetricFromYear: null,
	hourMetricToYear: null,
	bodyTextMetricTimeScope: "all-years",
	bodyTextMetricFromYear: null,
	bodyTextMetricToYear: null,
	deepTextAnalysisScopeMode: "all",
	deepTextAnalysisFromYear: null,
	deepTextAnalysisToYear: null,
	deepTextIncludedTags: [],
	deepTextExcludedTags: [],
	periodSignatureComparisonMode: "vs-earlier",
	periodSignatureFromYear: null,
	periodSignatureToYear: null,
	periodSignatureDisplayLimit: 10,
	entityDisplayLimit: 10,
	advancedRowsDisplayLimit: 5,
	tagPairLiftDisplayLimit: null,
	bridgeTagDisplayLimit: null,
	weekdaySemanticBiasDisplayLimit: null,
	tagTextProfileDisplayLimit: null,
	tagAnalysisIncludedYears: [],
	tagAnalysisExcludedYears: [],
	recurringPhraseDisplayLimit: 5,
	tagRowsDisplayLimit: 20,
	recordsMode: "simple",
	recordsDisplayLimit: 20,
	enableStructuralExamples: false,
	structuralExamplesLimit: 5,
	showVisualAnalytics: true,
	yearlyEntryLengthTrendMethod: "mean",
	heatmapLowColor: "#f4efe6",
	heatmapHighColor: "#a35318",
	exportFolderPath: "Diary statistics exports",
	enableWordCountDebugTools: false,
};

export const DEFAULT_NOTE_RECOMMENDER_SETTINGS: NoteRecommendationSettings = {
	enableIndexing: true,
	ignoreHiddenFolders: true,
	excludeFolders: ["Templates", "Attachments"],
	directLinkWeight: 5,
	backlinkWeight: 3,
	sharedTagWeight: 2,
	sharedNeighbourWeight: 2,
	sameFolderWeight: 1,
	diversityLambda: 0.35,
	maxRecommendations: 10,
};

export class DiaryStatsSettingTab extends PluginSettingTab {
	plugin: DiaryStatsPlugin;

	constructor(app: App, plugin: DiaryStatsPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();
		containerEl.addClass("diary-stats-settings");
		const introEl = containerEl.createDiv({ cls: "diary-stats-settings-intro" });
		introEl.createEl("h2", { text: "Diary statistics settings" });
		introEl.createEl("p", {
			text: "Use these sections to tune scope, analysis depth, tag/time ranges, visual density, exports, and debug behavior without changing the underlying diary files.",
			cls: "diary-stats-muted",
		});
		const introBadgesEl = introEl.createDiv({ cls: "diary-stats-settings-badges" });
		for (const badgeText of ["Scope-first", "Local only", "Cache-aware", "Markdown + CSV export"]) {
			introBadgesEl.createSpan({ text: badgeText, cls: "diary-stats-header-badge" });
		}
		const isIncludeMode = this.plugin.settings.scopeMode === "include";
		const scopeFolderSettingName = isIncludeMode ? "Included folders" : "Excluded folders";
		const scopeFolderSettingDescription = isIncludeMode
			? "Enter one folder path per line, relative to the vault root. In include mode, an empty list matches nothing."
			: "Enter one folder path per line, relative to the vault root. In exclude mode, these folders are skipped while the rest of the vault remains eligible.";
		const scopeModePreviewText = isIncludeMode
			? "Current rule: scan only the configured folders."
			: "Current rule: scan the whole vault except the configured folders.";

		containerEl.createEl("h2", { text: "Scope" });
		containerEl.createEl("p", {
			text: "Choose which folder paths should be scanned when you run the manual analysis command.",
		});

		new Setting(containerEl)
			.setName("Folder mode")
			.setDesc("Use include mode to scan only selected folders. Use exclude mode to scan the vault except selected folders.")
			.addDropdown((dropdown) => {
				dropdown
					.addOption("include", "Only the configured folders")
					.addOption("exclude", "Everything except the configured folders")
					.setValue(this.plugin.settings.scopeMode)
					.onChange(async (value) => {
						this.plugin.settings.scopeMode = value as ScopeMode;
						await this.plugin.saveSettings();
						this.display();
					});
			});

		containerEl.createEl("p", {
			text: scopeModePreviewText,
			cls: "diary-stats-muted",
		});

		new Setting(containerEl)
			.setName(scopeFolderSettingName)
			.setDesc(scopeFolderSettingDescription)
			.addTextArea((textArea) => {
				textArea
					.setPlaceholder("Diaries\nArchive/Denik 2024")
					.setValue(this.plugin.settings.scopeFolders.join("\n"))
					.onChange(async (value) => {
						this.plugin.settings.scopeFolders = parseLineList(value);
						await this.plugin.saveSettings();
					});

				textArea.inputEl.rows = 6;
				textArea.inputEl.cols = 40;
			});

		new Setting(containerEl)
			.setName("Include subfolders")
			.setDesc("When enabled, matching folders also include their nested subfolders.")
			.addToggle((toggle) => {
				toggle
					.setValue(this.plugin.settings.includeSubfolders)
					.onChange(async (value) => {
						this.plugin.settings.includeSubfolders = value;
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName("Ignored folder rules")
			.setDesc("Enter one rule per line. Plain names match any folder segment, while paths such as Assets/Images match that folder path and its descendants.")
			.addTextArea((textArea) => {
				textArea
					.setPlaceholder("Resources\n_resources\nattachments")
					.setValue(this.plugin.settings.ignoreFolderRules.join("\n"))
					.onChange(async (value) => {
						this.plugin.settings.ignoreFolderRules = parseLineList(value);
						await this.plugin.saveSettings();
					});

				textArea.inputEl.rows = 5;
				textArea.inputEl.cols = 40;
			});

		new Setting(containerEl)
			.setName("Ignore hidden folders")
			.setDesc("Skip files inside dotfolders such as .git or .obsidian.")
			.addToggle((toggle) => {
				toggle
					.setValue(this.plugin.settings.ignoreHiddenFolders)
					.onChange(async (value) => {
						this.plugin.settings.ignoreHiddenFolders = value;
						await this.plugin.saveSettings();
					});
			});

		containerEl.createEl("h2", { text: "Parsing" });
		containerEl.createEl("p", {
			text: "Milestone 2 adds the word-count rules and cautious date fallback that the core analysis engine relies on.",
		});

		new Setting(containerEl)
			.setName("Created date key")
			.setDesc("Frontmatter key used as the primary created timestamp.")
			.addText((text) => {
				text
					.setPlaceholder("Created at")
					.setValue(this.plugin.settings.createdAtKey)
					.onChange(async (value) => {
						this.plugin.settings.createdAtKey = value.trim();
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName("Updated date key")
			.setDesc("Frontmatter key used as the primary updated timestamp.")
			.addText((text) => {
				text
					.setPlaceholder("Last updated at")
					.setValue(this.plugin.settings.updatedAtKey)
					.onChange(async (value) => {
						this.plugin.settings.updatedAtKey = value.trim();
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName("Exclude code fences")
			.setDesc("Ignore fenced code blocks when counting words.")
			.addToggle((toggle) => {
				toggle
					.setValue(this.plugin.settings.excludeCodeFencesFromWordCount)
					.onChange(async (value) => {
						this.plugin.settings.excludeCodeFencesFromWordCount = value;
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName("Exclude inline code")
			.setDesc("Ignore inline code spans when counting words.")
			.addToggle((toggle) => {
				toggle
					.setValue(this.plugin.settings.excludeInlineCodeFromWordCount)
					.onChange(async (value) => {
						this.plugin.settings.excludeInlineCodeFromWordCount = value;
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName("Enable body-text analysis")
			.setDesc("Compute deeper text-aware metrics such as lexical richness, phrase recurrence, sentence climate, and opening-line signatures. This keeps the existing metadata metrics intact but can make full scans slower.")
			.addToggle((toggle) => {
				toggle
					.setValue(this.plugin.settings.enableBodyTextAnalysis)
					.onChange(async (value) => {
						this.plugin.settings.enableBodyTextAnalysis = value;
						await this.plugin.saveSettings();
					});
			});

		containerEl.createEl("h2", { text: "Metrics" });
		containerEl.createEl("p", {
			text: "These settings control reading-time estimates and the definition of an average-length entry.",
		});

		new Setting(containerEl)
			.setName("Reading words per minute")
			.setDesc("Used to estimate the time required to read the diary and each year.")
			.addText((text) => {
				text
					.setPlaceholder("230")
					.setValue(this.plugin.settings.readingWordsPerMinute.toString())
					.onChange(async (value) => {
						const parsedValue = parsePositiveInteger(value);
						if (parsedValue === null) {
							return;
						}

						this.plugin.settings.readingWordsPerMinute = parsedValue;
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName("Average-length entry")
			.setDesc("Choose whether average entry reading time is based on the median or arithmetic mean note length.")
			.addDropdown((dropdown) => {
				dropdown
					.addOption("median", "Median note length")
					.addOption("mean", "Arithmetic mean note length")
					.setValue(this.plugin.settings.averageEntryLengthMethod)
					.onChange(async (value) => {
						this.plugin.settings.averageEntryLengthMethod = value as AverageEntryLengthMethod;
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName("Hour metric time scope")
			.setDesc("Use all eligible years, or restrict hour-of-day metrics to a year range when older notes often have date-only created timestamps.")
			.addDropdown((dropdown) => {
				dropdown
					.addOption("all-years", "All eligible years")
					.addOption("year-range", "Restrict to year range")
					.setValue(this.plugin.settings.hourMetricTimeScope)
					.onChange(async (value) => {
						this.plugin.settings.hourMetricTimeScope = value as HourMetricTimeScope;
						await this.plugin.saveSettings();
						this.display();
					});
			});

		new Setting(containerEl)
			.setName("Hour metric from year")
			.setDesc("Lower bound for hour-of-day metrics when the year-range scope is enabled. Leave blank to keep the beginning open.")
			.addText((text) => {
				text
					.setPlaceholder("2024")
					.setValue(formatOptionalYearInput(this.plugin.settings.hourMetricFromYear))
					.onChange(async (value) => {
						this.plugin.settings.hourMetricFromYear = parseOptionalYear(value);
						await this.plugin.saveSettings();
					});

				text.setDisabled(this.plugin.settings.hourMetricTimeScope !== "year-range");
			});

		new Setting(containerEl)
			.setName("Hour metric to year")
			.setDesc("Upper bound for hour-of-day metrics when the year-range scope is enabled. Leave blank to keep the end open.")
			.addText((text) => {
				text
					.setPlaceholder("2026")
					.setValue(formatOptionalYearInput(this.plugin.settings.hourMetricToYear))
					.onChange(async (value) => {
						this.plugin.settings.hourMetricToYear = parseOptionalYear(value);
						await this.plugin.saveSettings();
					});

				text.setDisabled(this.plugin.settings.hourMetricTimeScope !== "year-range");
			});

		containerEl.createEl("h2", { text: "Text-aware analysis" });
		containerEl.createEl("p", {
			text: "These settings affect only the body-text layer: recurring phrases, lexical-richness trends, sentence climate, opening signatures, and tag text profiles.",
		});

		new Setting(containerEl)
			.setName("Body-text metric time scope")
			.setDesc("Use all eligible years, or restrict text-aware metrics to a year range when you want to inspect one era of writing more deeply.")
			.addDropdown((dropdown) => {
				dropdown
					.addOption("all-years", "All eligible years")
					.addOption("year-range", "Restrict to year range")
					.setValue(this.plugin.settings.bodyTextMetricTimeScope)
					.onChange(async (value) => {
						this.plugin.settings.bodyTextMetricTimeScope = value as BodyTextMetricTimeScope;
						await this.plugin.saveSettings();
						this.display();
					});
			});

		new Setting(containerEl)
			.setName("Body-text metric from year")
			.setDesc("Lower bound for text-aware metrics when the year-range scope is enabled. Leave blank to keep the beginning open.")
			.addText((text) => {
				text
					.setPlaceholder("2023")
					.setValue(formatOptionalYearInput(this.plugin.settings.bodyTextMetricFromYear))
					.onChange(async (value) => {
						this.plugin.settings.bodyTextMetricFromYear = parseOptionalYear(value);
						await this.plugin.saveSettings();
					});

				text.setDisabled(this.plugin.settings.bodyTextMetricTimeScope !== "year-range");
			});

		new Setting(containerEl)
			.setName("Body-text metric to year")
			.setDesc("Upper bound for text-aware metrics when the year-range scope is enabled. Leave blank to keep the end open.")
			.addText((text) => {
				text
					.setPlaceholder("2026")
					.setValue(formatOptionalYearInput(this.plugin.settings.bodyTextMetricToYear))
					.onChange(async (value) => {
						this.plugin.settings.bodyTextMetricToYear = parseOptionalYear(value);
						await this.plugin.saveSettings();
					});

				text.setDisabled(this.plugin.settings.bodyTextMetricTimeScope !== "year-range");
			});

		containerEl.createEl("h2", { text: "Czech-normalized deep text" });
		containerEl.createEl("p", {
			text: "This optional layer adds Czech-aware normalized content vocabulary metrics on top of the existing body-text analysis. It stays off by default and uses its own scope so you can inspect one era or one tagged subset without changing the rest of the dashboard.",
		});

		new Setting(containerEl)
			.setName("Enable Czech-normalized deep text analysis")
			.setDesc("Adds Czech-aware normalized content metrics such as scoped vocabulary size, normalized lexical richness, and normalized novelty. This layer is deterministic and local, but still heuristic rather than full lemmatization.")
			.addToggle((toggle) => {
				toggle
					.setValue(this.plugin.settings.enableCzechNormalizedDeepTextAnalysis)
					.onChange(async (value) => {
						this.plugin.settings.enableCzechNormalizedDeepTextAnalysis = value;
						await this.plugin.saveSettings();
						this.display();
					});

				toggle.setDisabled(!this.plugin.settings.enableBodyTextAnalysis);
			});

		new Setting(containerEl)
			.setName("Deep text analysis scope")
			.setDesc("Analyze all eligible body-text notes, or only a defined subset by years and normalized tags.")
			.addDropdown((dropdown) => {
				dropdown
					.addOption("all", "Analyze everything")
					.addOption("defined", "Use defined scope")
					.setValue(this.plugin.settings.deepTextAnalysisScopeMode)
					.onChange(async (value) => {
						this.plugin.settings.deepTextAnalysisScopeMode = value as DeepTextAnalysisScopeMode;
						await this.plugin.saveSettings();
						this.display();
					});

				dropdown.setDisabled(!this.plugin.settings.enableCzechNormalizedDeepTextAnalysis);
			});

		new Setting(containerEl)
			.setName("Deep text from year")
			.setDesc("Lower bound for deep-text analysis when `Use defined scope` is selected. Leave blank to keep the beginning open.")
			.addText((text) => {
				text
					.setPlaceholder("2022")
					.setValue(formatOptionalYearInput(this.plugin.settings.deepTextAnalysisFromYear))
					.onChange(async (value) => {
						this.plugin.settings.deepTextAnalysisFromYear = parseOptionalYear(value);
						await this.plugin.saveSettings();
					});

				text.setDisabled(
					!this.plugin.settings.enableCzechNormalizedDeepTextAnalysis ||
						this.plugin.settings.deepTextAnalysisScopeMode !== "defined",
				);
			});

		new Setting(containerEl)
			.setName("Deep text to year")
			.setDesc("Upper bound for deep-text analysis when `Use defined scope` is selected. Leave blank to keep the end open.")
			.addText((text) => {
				text
					.setPlaceholder("2023")
					.setValue(formatOptionalYearInput(this.plugin.settings.deepTextAnalysisToYear))
					.onChange(async (value) => {
						this.plugin.settings.deepTextAnalysisToYear = parseOptionalYear(value);
						await this.plugin.saveSettings();
					});

				text.setDisabled(
					!this.plugin.settings.enableCzechNormalizedDeepTextAnalysis ||
						this.plugin.settings.deepTextAnalysisScopeMode !== "defined",
				);
			});

		new Setting(containerEl)
			.setName("Deep text included tags")
			.setDesc("Optional normalized tag filter. When set, a note must contain at least one of these tags to enter the deep-text scope. Matching follows the current tag alias, ignore, and hierarchy rules.")
			.addTextArea((textArea) => {
				textArea
					.setPlaceholder("therapy\nwriting/process")
					.setValue(this.plugin.settings.deepTextIncludedTags.join("\n"))
					.onChange(async (value) => {
						this.plugin.settings.deepTextIncludedTags = parseLineList(value);
						await this.plugin.saveSettings();
					});

				textArea.inputEl.rows = 3;
				textArea.inputEl.cols = 40;
				textArea.setDisabled(
					!this.plugin.settings.enableCzechNormalizedDeepTextAnalysis ||
						this.plugin.settings.deepTextAnalysisScopeMode !== "defined",
				);
			});

		new Setting(containerEl)
			.setName("Deep text excluded tags")
			.setDesc("Optional normalized tag filter. Any note containing one of these tags will be removed from the deep-text scope after the include filter is applied.")
			.addTextArea((textArea) => {
				textArea
					.setPlaceholder("work\nprivate")
					.setValue(this.plugin.settings.deepTextExcludedTags.join("\n"))
					.onChange(async (value) => {
						this.plugin.settings.deepTextExcludedTags = parseLineList(value);
						await this.plugin.saveSettings();
					});

				textArea.inputEl.rows = 3;
				textArea.inputEl.cols = 40;
				textArea.setDisabled(
					!this.plugin.settings.enableCzechNormalizedDeepTextAnalysis ||
						this.plugin.settings.deepTextAnalysisScopeMode !== "defined",
				);
			});

		new Setting(containerEl)
			.setName("Enable period signature analysis")
			.setDesc("Compare one selected period against earlier scoped years or the rest of the scoped corpus, using the current Czech-normalized deep-text layer. This works only when both sides of the comparison contain usable scoped notes.")
			.addToggle((toggle) => {
				toggle
					.setValue(this.plugin.settings.enablePeriodSignatureAnalysis)
					.onChange(async (value) => {
						this.plugin.settings.enablePeriodSignatureAnalysis = value;
						await this.plugin.saveSettings();
						this.display();
					});

				toggle.setDisabled(!this.plugin.settings.enableCzechNormalizedDeepTextAnalysis);
			});

		new Setting(containerEl)
			.setName("Period signature comparison")
			.setDesc("Choose whether the selected period should be compared with earlier scoped years only, or with all other scoped years. The earliest scoped year cannot be compared against earlier years, and a selected period cannot cover the whole scoped corpus when using the rest-of-scope comparison.")
			.addDropdown((dropdown) => {
				dropdown
					.addOption("vs-earlier", "Selected period vs earlier scoped years")
					.addOption("vs-rest", "Selected period vs all other scoped years")
					.setValue(this.plugin.settings.periodSignatureComparisonMode)
					.onChange(async (value) => {
						this.plugin.settings.periodSignatureComparisonMode = value as PeriodSignatureComparisonMode;
						await this.plugin.saveSettings();
					});

				dropdown.setDisabled(
					!this.plugin.settings.enableCzechNormalizedDeepTextAnalysis ||
						!this.plugin.settings.enablePeriodSignatureAnalysis,
				);
			});

		new Setting(containerEl)
			.setName("Period signature from year")
			.setDesc("Start of the selected period. Leave blank to default to the latest scoped year.")
			.addText((text) => {
				text
					.setPlaceholder("2022")
					.setValue(formatOptionalYearInput(this.plugin.settings.periodSignatureFromYear))
					.onChange(async (value) => {
						this.plugin.settings.periodSignatureFromYear = parseOptionalYear(value);
						await this.plugin.saveSettings();
					});

				text.setDisabled(
					!this.plugin.settings.enableCzechNormalizedDeepTextAnalysis ||
						!this.plugin.settings.enablePeriodSignatureAnalysis,
				);
			});

		new Setting(containerEl)
			.setName("Period signature to year")
			.setDesc("End of the selected period. Leave blank to use the same year as the start, or the latest scoped year when both fields are blank.")
			.addText((text) => {
				text
					.setPlaceholder("2023")
					.setValue(formatOptionalYearInput(this.plugin.settings.periodSignatureToYear))
					.onChange(async (value) => {
						this.plugin.settings.periodSignatureToYear = parseOptionalYear(value);
						await this.plugin.saveSettings();
					});

				text.setDisabled(
					!this.plugin.settings.enableCzechNormalizedDeepTextAnalysis ||
						!this.plugin.settings.enablePeriodSignatureAnalysis,
				);
			});

		new Setting(containerEl)
			.setName("Period signature rows shown")
			.setDesc("How many distinctive, emergent, and fading terms to show in the dashboard and Markdown export. Use 0 to show all available rows.")
			.addText((text) => {
				text
					.setPlaceholder("10")
					.setValue(this.plugin.settings.periodSignatureDisplayLimit.toString())
					.onChange(async (value) => {
						const parsedValue = parseNonNegativeInteger(value);
						if (parsedValue === null) {
							return;
						}

						this.plugin.settings.periodSignatureDisplayLimit = parsedValue;
						await this.plugin.saveSettings();
						await this.plugin.refreshResultsViewIfOpen();
					});

				text.setDisabled(
					!this.plugin.settings.enableCzechNormalizedDeepTextAnalysis ||
						!this.plugin.settings.enablePeriodSignatureAnalysis,
				);
			});

		new Setting(containerEl)
			.setName("Enable entity and relationship analysis")
			.setDesc("Extract recurring entity candidates and their strongest co-occurrence relationships from the current Czech-normalized deep-text scope. This is a conservative local heuristic, not full named-entity recognition.")
			.addToggle((toggle) => {
				toggle
					.setValue(this.plugin.settings.enableEntityRelationshipAnalysis)
					.onChange(async (value) => {
						this.plugin.settings.enableEntityRelationshipAnalysis = value;
						await this.plugin.saveSettings();
						this.display();
					});

				toggle.setDisabled(!this.plugin.settings.enableCzechNormalizedDeepTextAnalysis);
			});

		new Setting(containerEl)
			.setName("Entity rows shown")
			.setDesc("How many persistent candidates, bridge candidates, and entity pairs to show in the dashboard and Markdown export. Use 0 to show all available rows.")
			.addText((text) => {
				text
					.setPlaceholder("10")
					.setValue(this.plugin.settings.entityDisplayLimit.toString())
					.onChange(async (value) => {
						const parsedValue = parseNonNegativeInteger(value);
						if (parsedValue === null) {
							return;
						}

						this.plugin.settings.entityDisplayLimit = parsedValue;
						await this.plugin.saveSettings();
						await this.plugin.refreshResultsViewIfOpen();
					});

				text.setDisabled(
					!this.plugin.settings.enableCzechNormalizedDeepTextAnalysis ||
						!this.plugin.settings.enableEntityRelationshipAnalysis,
				);
			});

		new Setting(containerEl)
			.setName("Recurring phrase families shown")
			.setDesc("How many recurring phrase families to show in the dashboard and Markdown export. Use 0 to show all currently available phrase families.")
			.addText((text) => {
				text
					.setPlaceholder("5")
					.setValue(this.plugin.settings.recurringPhraseDisplayLimit.toString())
					.onChange(async (value) => {
						const parsedValue = parseNonNegativeInteger(value);
						if (parsedValue === null) {
							return;
						}

						this.plugin.settings.recurringPhraseDisplayLimit = parsedValue;
						await this.plugin.saveSettings();
						await this.plugin.refreshResultsViewIfOpen();
					});
			});

		containerEl.createEl("h2", { text: "Tag analytics" });
		containerEl.createEl("p", {
			text: "These settings control frontmatter-tag normalization, filtering, and how deep the tag correlation analysis goes.",
		});

		new Setting(containerEl)
			.setName("Minimum tag frequency")
			.setDesc("Only tags or tag combinations that appear at least this many times will be shown.")
			.addText((text) => {
				text
					.setPlaceholder("10")
					.setValue(this.plugin.settings.minimumTagFrequency.toString())
					.onChange(async (value) => {
						const parsedValue = parsePositiveInteger(value);
						if (parsedValue === null) {
							return;
						}

						this.plugin.settings.minimumTagFrequency = parsedValue;
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName("Tag combination depth")
			.setDesc("Single tags are fastest. Pairs and triplets add broader associations but can cost more time.")
			.addDropdown((dropdown) => {
				dropdown
					.addOption("single", "Single tags only")
					.addOption("single-pairs", "Single tags and pairs")
					.addOption("single-pairs-triplets", "Single tags, pairs, and triplets")
					.setValue(this.plugin.settings.tagCombinationMode)
					.onChange(async (value) => {
						this.plugin.settings.tagCombinationMode = value as TagCombinationMode;
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName("Hierarchical tag handling")
			.setDesc("Full keeps travel/europe as one tag. Leaf keeps only the last segment, such as europe.")
			.addDropdown((dropdown) => {
				dropdown
					.addOption("full", "Keep full hierarchical tag")
					.addOption("leaf", "Keep only the leaf segment")
					.setValue(this.plugin.settings.hierarchicalTagMode)
					.onChange(async (value) => {
						this.plugin.settings.hierarchicalTagMode = value as HierarchicalTagMode;
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName("Ignored tags")
			.setDesc("Enter one normalized tag per line. Matching is case-insensitive and happens after alias normalization.")
			.addTextArea((textArea) => {
				textArea
					.setPlaceholder("draft\nprivate")
					.setValue(this.plugin.settings.ignoredTags.join("\n"))
					.onChange(async (value) => {
						this.plugin.settings.ignoredTags = parseLineList(value);
						await this.plugin.saveSettings();
					});

				textArea.inputEl.rows = 5;
				textArea.inputEl.cols = 40;
			});

		new Setting(containerEl)
			.setName("Tag aliases")
			.setDesc("Enter one alias rule per line in the form source => canonical. Example: work-travel => travel/work.")
			.addTextArea((textArea) => {
				textArea
					.setPlaceholder("work-travel => travel/work\nmood/good => mood/positive")
					.setValue(serializeTagAliasMap(this.plugin.settings.tagAliasMap))
					.onChange(async (value) => {
						this.plugin.settings.tagAliasMap = parseTagAliasMap(value);
						await this.plugin.saveSettings();
					});

				textArea.inputEl.rows = 6;
				textArea.inputEl.cols = 40;
			});

		new Setting(containerEl)
			.setName("Analyze all years combined")
			.setDesc("Show one overall tag-correlation table across all included years.")
			.addToggle((toggle) => {
				toggle
					.setValue(this.plugin.settings.enableCombinedTagAnalysis)
					.onChange(async (value) => {
						this.plugin.settings.enableCombinedTagAnalysis = value;
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName("Analyze each year separately")
			.setDesc("Show separate per-year tag tables for the filtered years.")
			.addToggle((toggle) => {
				toggle
					.setValue(this.plugin.settings.enablePerYearTagAnalysis)
					.onChange(async (value) => {
						this.plugin.settings.enablePerYearTagAnalysis = value;
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName("Tag metric time scope")
			.setDesc("Use all eligible years, or restrict tag-driven metrics to a continuous year range when newer notes are tagged more systematically than older ones.")
			.addDropdown((dropdown) => {
				dropdown
					.addOption("all-years", "All eligible years")
					.addOption("year-range", "Restrict to year range")
					.setValue(this.plugin.settings.tagMetricTimeScope)
					.onChange(async (value) => {
						this.plugin.settings.tagMetricTimeScope = value as TagMetricTimeScope;
						await this.plugin.saveSettings();
						this.display();
					});
			});

		new Setting(containerEl)
			.setName("Tag metric from year")
			.setDesc("Lower bound for tag-driven metrics when the year-range scope is enabled. Leave blank to keep the beginning open.")
			.addText((text) => {
				text
					.setPlaceholder("2018")
					.setValue(formatOptionalYearInput(this.plugin.settings.tagMetricFromYear))
					.onChange(async (value) => {
						this.plugin.settings.tagMetricFromYear = parseOptionalYear(value);
						await this.plugin.saveSettings();
					});

				text.setDisabled(this.plugin.settings.tagMetricTimeScope !== "year-range");
			});

		new Setting(containerEl)
			.setName("Tag metric to year")
			.setDesc("Upper bound for tag-driven metrics when the year-range scope is enabled. Leave blank to keep the end open.")
			.addText((text) => {
				text
					.setPlaceholder("2026")
					.setValue(formatOptionalYearInput(this.plugin.settings.tagMetricToYear))
					.onChange(async (value) => {
						this.plugin.settings.tagMetricToYear = parseOptionalYear(value);
						await this.plugin.saveSettings();
					});

				text.setDisabled(this.plugin.settings.tagMetricTimeScope !== "year-range");
			});

		new Setting(containerEl)
			.setName("Additional included years")
			.setDesc("Optional extra comma- or line-separated filter. When set, only these years are used after the main tag metric time scope is applied.")
			.addTextArea((textArea) => {
				textArea
					.setPlaceholder("2020, 2021, 2022")
					.setValue(formatYearListInput(this.plugin.settings.tagAnalysisIncludedYears))
					.onChange(async (value) => {
						this.plugin.settings.tagAnalysisIncludedYears = parseYearList(value);
						await this.plugin.saveSettings();
					});

				textArea.inputEl.rows = 3;
				textArea.inputEl.cols = 40;
			});

		new Setting(containerEl)
			.setName("Additional excluded years")
			.setDesc("Optional extra comma- or line-separated filter. These years are removed after the main tag metric time scope is applied.")
			.addTextArea((textArea) => {
				textArea
					.setPlaceholder("1990, 1991")
					.setValue(formatYearListInput(this.plugin.settings.tagAnalysisExcludedYears))
					.onChange(async (value) => {
						this.plugin.settings.tagAnalysisExcludedYears = parseYearList(value);
						await this.plugin.saveSettings();
					});

				textArea.inputEl.rows = 3;
				textArea.inputEl.cols = 40;
			});

		new Setting(containerEl)
			.setName("Tag rows shown in the dashboard")
			.setDesc("Use 0 to show all qualifying tags. Any positive number limits the visible rows in the dashboard while CSV export still contains all qualifying rows.")
			.addText((text) => {
				text
					.setPlaceholder("20")
					.setValue(this.plugin.settings.tagRowsDisplayLimit.toString())
					.onChange(async (value) => {
						const parsedValue = parseNonNegativeInteger(value);
						if (parsedValue === null) {
							return;
						}

						this.plugin.settings.tagRowsDisplayLimit = parsedValue;
						await this.plugin.saveSettings();
					});
			});

		containerEl.createEl("h2", { text: "Advanced rows" });
		containerEl.createEl("p", {
			text: "These settings control how many rows are shown in the denser structural tables. Leave an override blank to inherit the shared default.",
		});

		new Setting(containerEl)
			.setName("Advanced rows shown")
			.setDesc("Shared default row limit for advanced structural tables such as tag pair lifts, bridge tags, weekday semantic bias, and tag text profiles. Use 0 to show all rows by default.")
			.addText((text) => {
				text
					.setPlaceholder("5")
					.setValue(this.plugin.settings.advancedRowsDisplayLimit.toString())
					.onChange(async (value) => {
						const parsedValue = parseNonNegativeInteger(value);
						if (parsedValue === null) {
							return;
						}

						this.plugin.settings.advancedRowsDisplayLimit = parsedValue;
						await this.plugin.saveSettings();
						await this.plugin.refreshResultsViewIfOpen();
					});
			});

		new Setting(containerEl)
			.setName("Top tag pair lifts shown")
			.setDesc("Optional override for the `Top tag pair lifts` table. Leave blank to use the shared advanced row limit. Use 0 to show all qualifying rows.")
			.addText((text) => {
				text
					.setPlaceholder("Use advanced default")
					.setValue(formatOptionalNonNegativeIntegerInput(this.plugin.settings.tagPairLiftDisplayLimit))
					.onChange(async (value) => {
						this.plugin.settings.tagPairLiftDisplayLimit = parseOptionalNonNegativeInteger(value);
						await this.plugin.saveSettings();
						await this.plugin.refreshResultsViewIfOpen();
					});
			});

		new Setting(containerEl)
			.setName("Bridge tags shown")
			.setDesc("Optional override for the `Bridge tags` table. Leave blank to use the shared advanced row limit. Use 0 to show all qualifying rows.")
			.addText((text) => {
				text
					.setPlaceholder("Use advanced default")
					.setValue(formatOptionalNonNegativeIntegerInput(this.plugin.settings.bridgeTagDisplayLimit))
					.onChange(async (value) => {
						this.plugin.settings.bridgeTagDisplayLimit = parseOptionalNonNegativeInteger(value);
						await this.plugin.saveSettings();
						await this.plugin.refreshResultsViewIfOpen();
					});
			});

		new Setting(containerEl)
			.setName("Weekday semantic bias rows shown")
			.setDesc("Optional override for the `Day-of-week semantic bias` table. Leave blank to use the shared advanced row limit. Use 0 to show all qualifying rows.")
			.addText((text) => {
				text
					.setPlaceholder("Use advanced default")
					.setValue(formatOptionalNonNegativeIntegerInput(this.plugin.settings.weekdaySemanticBiasDisplayLimit))
					.onChange(async (value) => {
						this.plugin.settings.weekdaySemanticBiasDisplayLimit = parseOptionalNonNegativeInteger(value);
						await this.plugin.saveSettings();
						await this.plugin.refreshResultsViewIfOpen();
					});
			});

		new Setting(containerEl)
			.setName("Tag text profiles shown")
			.setDesc("Optional override for the `Tag text profiles` table. Leave blank to use the shared advanced row limit. Use 0 to show all qualifying rows.")
			.addText((text) => {
				text
					.setPlaceholder("Use advanced default")
					.setValue(formatOptionalNonNegativeIntegerInput(this.plugin.settings.tagTextProfileDisplayLimit))
					.onChange(async (value) => {
						this.plugin.settings.tagTextProfileDisplayLimit = parseOptionalNonNegativeInteger(value);
						await this.plugin.saveSettings();
						await this.plugin.refreshResultsViewIfOpen();
					});
			});

		containerEl.createEl("h2", { text: "Records" });
		containerEl.createEl("p", {
			text: "Records surface note-level extremes such as the longest notes, most-tagged notes, and other ranked edge cases from the current analysis result.",
		});

		new Setting(containerEl)
			.setName("Records mode")
			.setDesc("Simple shows the most intuitive ranked lists. Expanded adds more body-text and tag-density extremes.")
			.addDropdown((dropdown) => {
				dropdown
					.addOption("simple", "Simple")
					.addOption("expanded", "Expanded")
					.setValue(this.plugin.settings.recordsMode)
					.onChange(async (value) => {
						this.plugin.settings.recordsMode = value as RecordsMode;
						await this.plugin.saveSettings();
						await this.plugin.refreshResultsViewIfOpen();
					});
			});

		new Setting(containerEl)
			.setName("Records shown")
			.setDesc("How many rows to show in each record table. Use 0 to hide the records section.")
			.addText((text) => {
				text
					.setPlaceholder("20")
					.setValue(this.plugin.settings.recordsDisplayLimit.toString())
					.onChange(async (value) => {
						const parsedValue = parseNonNegativeInteger(value);
						if (parsedValue === null) {
							return;
						}

						this.plugin.settings.recordsDisplayLimit = parsedValue;
						await this.plugin.saveSettings();
						await this.plugin.refreshResultsViewIfOpen();
					});
			});

		new Setting(containerEl)
			.setName("Enable structural examples")
			.setDesc("Show concrete example lists for long silence gaps, revision lags, recurring phrases, tag-pair lifts, bridge tags, and regime shifts. These rows use real note links and can benefit from Obsidian page preview.")
			.addToggle((toggle) => {
				toggle
					.setValue(this.plugin.settings.enableStructuralExamples)
					.onChange(async (value) => {
						this.plugin.settings.enableStructuralExamples = value;
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName("Structural examples shown")
			.setDesc("How many example rows to show for each structural example table. Use 0 to hide example rows even if the feature is enabled.")
			.addText((text) => {
				text
					.setPlaceholder("5")
					.setValue(this.plugin.settings.structuralExamplesLimit.toString())
					.onChange(async (value) => {
						const parsedValue = parseNonNegativeInteger(value);
						if (parsedValue === null) {
							return;
						}

						this.plugin.settings.structuralExamplesLimit = parsedValue;
						await this.plugin.saveSettings();
					});
			});

		containerEl.createEl("h2", { text: "Visuals" });
		containerEl.createEl("p", {
			text: "These settings control whether chart-based visual analytics are shown in the dashboard and how the heatmaps look.",
		});

		new Setting(containerEl)
			.setName("Show visual analytics")
			.setDesc("Show or hide chart-based dashboard sections such as heatmaps, yearly trends, histograms, structural trend charts, tag coverage diagnostics, and text-aware trend charts. This affects only rendering in the dashboard, not the underlying analysis or exports.")
			.addToggle((toggle) => {
				toggle
					.setValue(this.plugin.settings.showVisualAnalytics)
					.onChange(async (value) => {
						this.plugin.settings.showVisualAnalytics = value;
						await this.plugin.saveSettings();
						await this.plugin.refreshResultsViewIfOpen();
					});
			});

		new Setting(containerEl)
			.setName("Yearly entry-length trend")
			.setDesc("Choose whether the yearly reading-depth chart uses arithmetic mean words per entry or median words per entry. Median is more robust when a few very long notes would otherwise pull the line upward.")
			.addDropdown((dropdown) => {
				dropdown
					.addOption("mean", "Mean words per entry")
					.addOption("median", "Median words per entry")
					.setValue(this.plugin.settings.yearlyEntryLengthTrendMethod)
					.onChange(async (value) => {
						this.plugin.settings.yearlyEntryLengthTrendMethod = value as AverageEntryLengthMethod;
						await this.plugin.saveSettings();
						await this.plugin.refreshResultsViewIfOpen();
					});
			});

		new Setting(containerEl)
			.setName("Heatmap low color")
			.setDesc("Color used for low activity cells.")
			.addColorPicker((picker) => {
				picker
					.setValue(this.plugin.settings.heatmapLowColor)
					.onChange(async (value) => {
						this.plugin.settings.heatmapLowColor = value;
						await this.plugin.saveSettings();
						await this.plugin.refreshResultsViewIfOpen();
					});
			});

		new Setting(containerEl)
			.setName("Heatmap high color")
			.setDesc("Color used for high activity cells.")
			.addColorPicker((picker) => {
				picker
					.setValue(this.plugin.settings.heatmapHighColor)
					.onChange(async (value) => {
						this.plugin.settings.heatmapHighColor = value;
						await this.plugin.saveSettings();
						await this.plugin.refreshResultsViewIfOpen();
					});
			});

		containerEl.createEl("h2", { text: "Export" });
		containerEl.createEl("p", {
			text: "Exports are written into the vault after you run analysis. This folder setting controls where the Markdown report and CSV file are created, relative to the vault root.",
		});

		new Setting(containerEl)
			.setName("Export output folder")
			.setDesc("Markdown reports and CSV files will be created here. Nested folders are allowed.")
			.addText((text) => {
				text
					.setPlaceholder("Diary statistics exports")
					.setValue(this.plugin.settings.exportFolderPath)
					.onChange(async (value) => {
						this.plugin.settings.exportFolderPath = value.trim();
						await this.plugin.saveSettings();
					});
			});

		containerEl.createEl("h2", { text: "Debug" });
		containerEl.createEl("p", {
			text: "Debug tools are hidden by default and are only meant for investigating count mismatches or parsing edge cases.",
		});

		new Setting(containerEl)
			.setName("Enable word count debug tools")
			.setDesc("Reveal the command \"Inspect active note word count\". Use it when you need to inspect cleaned text and tokenization while comparing this plugin with Obsidian or manual counts.")
			.addToggle((toggle) => {
				toggle
					.setValue(this.plugin.settings.enableWordCountDebugTools)
					.onChange(async (value) => {
						this.plugin.settings.enableWordCountDebugTools = value;
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName("Clear analysis cache")
			.setDesc("Remove cached per-file analysis results so the next run rebuilds everything from scratch.")
			.addButton((button) => {
				button
					.setButtonText("Clear cache")
					.setWarning()
					.onClick(async () => {
						await this.plugin.clearAnalysisCache();
					});
			});

		applySettingTooltips(containerEl);
	}
}

export class NoteRecommenderSettingTab extends PluginSettingTab {
	plugin: DiaryStatsPlugin;

	constructor(app: App, plugin: DiaryStatsPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();
		containerEl.createEl("h2", { text: "Note recommender" });
		containerEl.createEl("p", { text: "These settings control the lightweight M0 recommendation scaffold." });

		new Setting(containerEl)
			.setName("Enable indexing")
			.addToggle((toggle) => {
				toggle.setValue(this.plugin.noteRecommendationSettings.enableIndexing).onChange(async (value) => {
					this.plugin.noteRecommendationSettings.enableIndexing = value;
					await this.plugin.saveSettings();
				});
			});

		new Setting(containerEl)
			.setName("Ignore hidden folders")
			.addToggle((toggle) => {
				toggle.setValue(this.plugin.noteRecommendationSettings.ignoreHiddenFolders).onChange(async (value) => {
					this.plugin.noteRecommendationSettings.ignoreHiddenFolders = value;
					await this.plugin.saveSettings();
				});
			});

		new Setting(containerEl)
			.setName("Excluded folders")
			.setDesc("One folder path per line.")
			.addTextArea((textArea) => {
				textArea.setValue(this.plugin.noteRecommendationSettings.excludeFolders.join("\n")).onChange(async (value) => {
					this.plugin.noteRecommendationSettings.excludeFolders = value
						.split(/\r?\n/u)
						.map((folder) => folder.trim())
						.filter(Boolean);
					await this.plugin.saveSettings();
				});
			});
	}
}

function parseLineList(value: string): string[] {
	return value
		.split(/\r?\n/u)
		.map((line) => line.trim())
		.filter((line) => line.length > 0);
}

function parsePositiveInteger(value: string): number | null {
	const parsedValue = Number.parseInt(value.trim(), 10);
	if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
		return null;
	}

	return parsedValue;
}

function parseNonNegativeInteger(value: string): number | null {
	const parsedValue = Number.parseInt(value.trim(), 10);
	if (!Number.isFinite(parsedValue) || parsedValue < 0) {
		return null;
	}

	return parsedValue;
}

function parseOptionalNonNegativeInteger(value: string): number | null {
	const trimmedValue = value.trim();
	if (trimmedValue.length === 0) {
		return null;
	}

	return parseNonNegativeInteger(trimmedValue);
}

function parseOptionalYear(value: string): number | null {
	const trimmedValue = value.trim();
	if (trimmedValue.length === 0) {
		return null;
	}

	const parsedValue = Number.parseInt(trimmedValue, 10);
	if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
		return null;
	}

	return parsedValue;
}

function parseYearList(value: string): number[] {
	return [...new Set(
		value
			.split(/[\r\n,]+/u)
			.map((item) => Number.parseInt(item.trim(), 10))
			.filter((item) => Number.isFinite(item) && item > 0),
	)].sort((left, right) => left - right);
}

function formatYearListInput(years: number[]): string {
	return years.join(", ");
}

function formatOptionalYearInput(year: number | null): string {
	return year === null ? "" : year.toString();
}

function formatOptionalNonNegativeIntegerInput(value: number | null): string {
	return value === null ? "" : value.toString();
}

function parseTagAliasMap(value: string): Record<string, string> {
	const aliasMap: Record<string, string> = {};

	for (const line of value.split(/\r?\n/u)) {
		const trimmedLine = line.trim();
		if (trimmedLine.length === 0) {
			continue;
		}

		const separator = trimmedLine.includes("=>") ? "=>" : trimmedLine.includes("=") ? "=" : null;
		if (!separator) {
			continue;
		}

		const [source, target] = trimmedLine.split(separator, 2).map((part) => part.trim());
		if (!source || !target) {
			continue;
		}

		aliasMap[source] = target;
	}

	return aliasMap;
}

function serializeTagAliasMap(aliasMap: Record<string, string>): string {
	return Object.entries(aliasMap)
		.sort(([left], [right]) => left.localeCompare(right))
		.map(([source, target]) => `${source} => ${target}`)
		.join("\n");
}

function applySettingTooltips(containerEl: HTMLElement): void {
	for (const itemEl of Array.from(containerEl.querySelectorAll(".setting-item"))) {
		const nameEl = itemEl.querySelector(".setting-item-name") as HTMLElement | null;
		const descriptionEl = itemEl.querySelector(".setting-item-description") as HTMLElement | null;
		const tooltip = descriptionEl?.textContent?.trim() || nameEl?.textContent?.trim();
		if (!tooltip) {
			continue;
		}

		itemEl.setAttribute("title", tooltip);
		if (nameEl) {
			nameEl.setAttribute("title", tooltip);
		}
	}
}
