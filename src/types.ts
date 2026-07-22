export type ScopeMode = "include" | "exclude";
export type AverageEntryLengthMethod = "median" | "mean";
export type TagCombinationMode = "single" | "single-pairs" | "single-pairs-triplets";
export type HierarchicalTagMode = "full" | "leaf";
export type TagMetricTimeScope = "all-years" | "year-range";
export type HourMetricTimeScope = "all-years" | "year-range";
export type BodyTextMetricTimeScope = "all-years" | "year-range";
export type DeepTextAnalysisScopeMode = "all" | "defined";
export type PeriodSignatureComparisonMode = "vs-earlier" | "vs-rest";
export type RecordsMode = "simple" | "expanded";
export type TimestampPrecision = "date" | "datetime";

export type DateValueSource =
	| "frontmatter"
	| "filesystem-ctime"
	| "filesystem-mtime"
	| "unresolved";

export type FrontmatterDateIssueKind = "missing" | "invalid";

export interface DiaryStatsSettings {
	scopeMode: ScopeMode;
	scopeFolders: string[];
	includeSubfolders: boolean;
	ignoreFolderRules: string[];
	ignoreHiddenFolders: boolean;
	createdAtKey: string;
	updatedAtKey: string;
	excludeCodeFencesFromWordCount: boolean;
	excludeInlineCodeFromWordCount: boolean;
	enableBodyTextAnalysis: boolean;
	enableCzechNormalizedDeepTextAnalysis: boolean;
	enablePeriodSignatureAnalysis: boolean;
	enableEntityRelationshipAnalysis: boolean;
	readingWordsPerMinute: number;
	averageEntryLengthMethod: AverageEntryLengthMethod;
	minimumTagFrequency: number;
	tagCombinationMode: TagCombinationMode;
	hierarchicalTagMode: HierarchicalTagMode;
	ignoredTags: string[];
	tagAliasMap: Record<string, string>;
	enableCombinedTagAnalysis: boolean;
	enablePerYearTagAnalysis: boolean;
	tagMetricTimeScope: TagMetricTimeScope;
	tagMetricFromYear: number | null;
	tagMetricToYear: number | null;
	hourMetricTimeScope: HourMetricTimeScope;
	hourMetricFromYear: number | null;
	hourMetricToYear: number | null;
	bodyTextMetricTimeScope: BodyTextMetricTimeScope;
	bodyTextMetricFromYear: number | null;
	bodyTextMetricToYear: number | null;
	deepTextAnalysisScopeMode: DeepTextAnalysisScopeMode;
	deepTextAnalysisFromYear: number | null;
	deepTextAnalysisToYear: number | null;
	deepTextIncludedTags: string[];
	deepTextExcludedTags: string[];
	periodSignatureComparisonMode: PeriodSignatureComparisonMode;
	periodSignatureFromYear: number | null;
	periodSignatureToYear: number | null;
	periodSignatureDisplayLimit: number;
	entityDisplayLimit: number;
	advancedRowsDisplayLimit: number;
	tagPairLiftDisplayLimit: number | null;
	bridgeTagDisplayLimit: number | null;
	weekdaySemanticBiasDisplayLimit: number | null;
	tagTextProfileDisplayLimit: number | null;
	tagAnalysisIncludedYears: number[];
	tagAnalysisExcludedYears: number[];
	recurringPhraseDisplayLimit: number;
	tagRowsDisplayLimit: number;
	recordsMode: RecordsMode;
	recordsDisplayLimit: number;
	enableStructuralExamples: boolean;
	structuralExamplesLimit: number;
	showVisualAnalytics: boolean;
	yearlyEntryLengthTrendMethod: AverageEntryLengthMethod;
	heatmapLowColor: string;
	heatmapHighColor: string;
	exportFolderPath: string;
	enableWordCountDebugTools: boolean;
}

export interface ResultsViewUiState {
	detailOpenByKey?: Record<string, boolean>;
}

export interface NoteRecommendationSettings {
	enableIndexing: boolean;
	ignoreHiddenFolders: boolean;
	excludeFolders: string[];
	directLinkWeight: number;
	backlinkWeight: number;
	sharedTagWeight: number;
	sharedNeighbourWeight: number;
	sameFolderWeight: number;
	diversityLambda: number;
	maxRecommendations: number;
}

export interface NoteIndexEntry {
	path: string;
	title: string;
	folder: string;
	tags: string[];
	links: string[];
	mtime: number;
	size: number;
	previewText: string;
}

export interface NoteIndex {
	generatedAt: string;
	entries: NoteIndexEntry[];
}

export interface RecommendationCandidate {
	path: string;
	score: number;
	reasons: string[];
	explanation: string;
}

export interface RecommendationResult {
	generatedAt: string;
	currentPath: string | null;
	recommendations: RecommendationCandidate[];
}

export interface PersistedPluginData {
	settings?: Partial<DiaryStatsSettings>;
	analysisCache?: PersistedAnalysisCache;
	resultsViewUiState?: ResultsViewUiState;
	noteRecommendationSettings?: Partial<NoteRecommendationSettings>;
}

export interface PersistedAnalysisCache {
	version: number;
	entries: Record<string, PersistedFileAnalysisCacheEntry>;
}

export interface PersistedFileAnalysisCacheEntry {
	path: string;
	mtimeMs: number;
	size: number;
	settingsSignature: string;
	analysis: DiaryFileAnalysis;
}

export interface ScopeScanSummary {
	totalMarkdownFiles: number;
	matchedFileCount: number;
	ignoredByHiddenFolders: number;
	ignoredByFolderRules: number;
	ignoredByScope: number;
	samplePaths: string[];
	appliedScopeMode: ScopeMode;
	appliedScopeFolders: string[];
	includeSubfolders: boolean;
	ignoreFolderRules: string[];
	ignoreHiddenFolders: boolean;
	scopeInterpretation: string;
}

export interface NormalizedTimestamp {
	normalizedLocal: string;
	precision: TimestampPrecision;
	year: number;
	month: number;
	day: number;
	hour: number;
	minute: number;
	weekday: number;
	epochMillis: number;
}

export interface DateResolution {
	value: NormalizedTimestamp | null;
	source: DateValueSource;
	issue: FrontmatterDateIssueKind | null;
}

export interface DiaryFileAnalysis {
	path: string;
	size: number;
	wordCount: number;
	createdAt: DateResolution;
	updatedAt: DateResolution;
	chronologyYear: number | null;
	hasCreatedFrontmatterKey: boolean;
	hasUpdatedFrontmatterKey: boolean;
	normalizedTags: string[];
	bodyTextFeatures: BodyTextFeatures | null;
}

export interface YearAggregate {
	year: number;
	entryCount: number;
	wordCount: number;
	readingTimeMinutes: number;
	readingTimeLabel: string;
	averageWordsPerEntry: number;
	medianWordsPerEntry: number;
	createdFallbackCount: number;
	updatedFallbackCount: number;
}

export interface DiaryAggregateSummary {
	yearsWritten: number[];
	totalEntries: number;
	totalWords: number;
	averageWordsPerEntry: number;
	medianWordsPerEntry: number;
	selectedAverageEntryMethod: AverageEntryLengthMethod;
	selectedAverageEntryWords: number;
	readingWordsPerMinute: number;
	totalReadingTimeMinutes: number;
	totalReadingTimeLabel: string;
	averageEntryReadingTimeMinutes: number;
	averageEntryReadingTimeLabel: string;
	entriesWithCreatedFallback: number;
	entriesWithUpdatedFallback: number;
	missingCreatedFrontmatterCount: number;
	invalidCreatedFrontmatterCount: number;
	missingUpdatedFrontmatterCount: number;
	invalidUpdatedFrontmatterCount: number;
	unresolvedChronologyCount: number;
	yearSummaries: YearAggregate[];
}

export interface DateIssueReportEntry {
	path: string;
	createdAtIssue: FrontmatterDateIssueKind | null;
	updatedAtIssue: FrontmatterDateIssueKind | null;
	createdAtSource: DateValueSource;
	updatedAtSource: DateValueSource;
	resolvedCreatedAt: string | null;
	resolvedUpdatedAt: string | null;
}

export interface AnalysisCacheRunSummary {
	reusedEntries: number;
	refreshedEntries: number;
	droppedDeletedEntries: number;
	currentCacheEntryCount: number;
	settingsSignature: string;
}

export interface MonthlyHeatmapCell {
	year: number;
	monthIndex: number;
	entryCount: number;
}

export interface MonthlyHeatmapData {
	years: number[];
	months: string[];
	maxEntryCount: number;
	cells: MonthlyHeatmapCell[];
}

export interface MonthlyWordsHeatmapCell {
	year: number;
	monthIndex: number;
	wordCount: number;
	entryCount: number;
	averageWordsPerEntry: number;
}

export interface MonthlyWordsHeatmapData {
	years: number[];
	months: string[];
	maxWordCount: number;
	cells: MonthlyWordsHeatmapCell[];
}

export interface WeekdayHeatmapCell {
	year: number;
	weekdayIndex: number;
	entryCount: number;
	weekdayOccurrences: number;
	averageEntriesPerWeekday: number;
}

export interface WeekdayHeatmapData {
	years: number[];
	weekdays: string[];
	maxAverageEntries: number;
	cells: WeekdayHeatmapCell[];
}

export interface YearlyTrendPoint {
	year: number;
	entryCount: number;
	wordCount: number;
	readingTimeMinutes: number;
	averageWordsPerEntry: number;
	medianWordsPerEntry: number;
}

export interface YearlyTrendData {
	points: YearlyTrendPoint[];
}

export interface HistogramBin {
	label: string;
	start: number;
	end: number;
	count: number;
}

export interface HistogramData {
	bins: HistogramBin[];
	maxCount: number;
	totalValues: number;
}

export interface StructuralTrendPoint {
	year: number;
	burstinessIndex: number;
	writingConcentrationIndex: number;
	tagEntropy: number | null;
	regimeShiftFromPrevious: number | null;
}

export interface StructuralTrendData {
	points: StructuralTrendPoint[];
}

export interface TagCoverageTrendPoint {
	year: number;
	entryCount: number;
	taggedEntryCount: number;
	taggedEntryShare: number;
	meanTagsPerNote: number;
	medianTagsPerNote: number;
}

export interface TagCoverageTrendData {
	points: TagCoverageTrendPoint[];
}

export interface TextAwareTrendPoint {
	year: number;
	lexicalRichness: number | null;
	noveltyRate: number | null;
	averageSentenceLength: number | null;
	recurringPhraseShare: number | null;
}

export interface TextAwareTrendData {
	points: TextAwareTrendPoint[];
}

export interface MonthLengthProfilePoint {
	monthIndex: number;
	monthLabel: string;
	entryCount: number;
	averageWords: number;
	medianWords: number;
}

export interface MonthLengthProfileData {
	points: MonthLengthProfilePoint[];
}

export interface TagFrequencyHeatmapCell {
	tagIndex: number;
	year: number;
	entryCount: number;
}

export interface TagFrequencyHeatmapData {
	years: number[];
	tags: string[];
	maxEntryCount: number;
	cells: TagFrequencyHeatmapCell[];
}

export interface HourlyActivityPoint {
	hour: number;
	entryCount: number;
	averageWords: number;
}

export interface HourlyActivityData {
	points: HourlyActivityPoint[];
	usableEntryCount: number;
}

export interface AnalysisVisualSummary {
	monthlyHeatmap: MonthlyHeatmapData;
	monthlyWordsHeatmap: MonthlyWordsHeatmapData;
	weekdayHeatmap: WeekdayHeatmapData;
	yearlyTrends: YearlyTrendData;
	noteLengthHistogram: HistogramData;
	revisionLagHistogram: HistogramData;
	structuralTrends: StructuralTrendData;
	tagCoverageTrends: TagCoverageTrendData;
	textAwareTrends: TextAwareTrendData;
}

export interface TagAnalysisRow {
	label: string;
	entryCount: number;
	averageWords: number;
	medianWords: number;
	averageWordDelta: number;
	medianWordDelta: number;
	dominantWeekdayLabel: string;
	dominantWeekdayShare: number;
	secondaryWeekdayLabel: string | null;
	secondaryWeekdayShare: number;
	dominantMonthLabel: string;
	dominantMonthShare: number;
}

export interface TagAnalysisSection {
	entryCountConsidered: number;
	candidateCount: number;
	rows: TagAnalysisRow[];
}

export interface PerYearTagAnalysisSection extends TagAnalysisSection {
	year: number;
}

export interface TagAnalysisSummary {
	minimumFrequency: number;
	combinationMode: TagCombinationMode;
	hierarchicalTagMode: HierarchicalTagMode;
	timeScopeMode: TagMetricTimeScope;
	timeScopeFromYear: number | null;
	timeScopeToYear: number | null;
	aliasCount: number;
	ignoredTagCount: number;
	meanTagsPerNote: number;
	medianTagsPerNote: number;
	combinedEnabled: boolean;
	perYearEnabled: boolean;
	includedYears: number[];
	excludedYears: number[];
	overall: TagAnalysisSection | null;
	perYear: PerYearTagAnalysisSection[];
}

export interface NoteRecordRow {
	path: string;
	valueLabel: string;
	detailLabel: string;
	sortValue: number;
}

export interface RecordSection {
	id: string;
	title: string;
	rows: NoteRecordRow[];
}

export interface RecordsSummary {
	sections: RecordSection[];
}

export type BodyTextOpeningSignature =
	| "declarative"
	| "fragmentary"
	| "descriptive"
	| "temporal"
	| "emotional"
	| "scene-setting"
	| "other";

export interface BodyTextFeatures {
	normalizedTokenCount: number;
	uniqueNormalizedTokenCount: number;
	normalizedVocabulary: string[];
	sentenceCount: number;
	sentenceWordTotal: number;
	sentenceWordSquareTotal: number;
	openingLine: string | null;
	openingSignature: BodyTextOpeningSignature | null;
	phraseCandidates: string[];
	czechNormalized?: CzechNormalizedTextFeatures | null;
}

export interface CzechNormalizedTextFeatures {
	normalizedTokenCount: number;
	contentTokenCount: number;
	contentVocabulary: string[];
	contentFrequencies: Record<string, number>;
	entityCandidates: string[];
}

export interface EntityCandidateRow {
	label: string;
	supportEntries: number;
	firstYear: number;
	lastYear: number;
	activeYears: number;
	averageGapDays: number | null;
	bridgeScore: number;
}

export interface EntityPairRow {
	leftLabel: string;
	rightLabel: string;
	supportEntries: number;
	firstYear: number;
	lastYear: number;
	activeYears: number;
	strength: number;
}

export interface EntityAnalysisSummary {
	enabled: boolean;
	analyzedEntryCount: number;
	candidateCount: number;
	pairCount: number;
	mostPersistentCandidate: EntityCandidateRow | null;
	newestCandidate: EntityCandidateRow | null;
	longestLivedCandidate: EntityCandidateRow | null;
	bridgeCandidate: EntityCandidateRow | null;
	strongestPair: EntityPairRow | null;
	topPersistentCandidates: EntityCandidateRow[];
	topBridgeCandidates: EntityCandidateRow[];
	topEntityPairs: EntityPairRow[];
}

export interface PeriodSignatureTerm {
	term: string;
	selectedCount: number;
	comparisonCount: number;
	selectedRate: number;
	comparisonRate: number;
	score: number;
}

export interface PeriodSignatureSummary {
	enabled: boolean;
	comparisonMode: PeriodSignatureComparisonMode;
	selectedFromYear: number | null;
	selectedToYear: number | null;
	selectedPeriodLabel: string;
	comparisonLabel: string;
	selectedEntryCount: number;
	comparisonEntryCount: number;
	selectedContentTokenCount: number;
	comparisonContentTokenCount: number;
	candidateTermCount: number;
	distinctiveTermCount: number;
	emergentTermCount: number;
	fadingTermCount: number;
	strongestDistinctiveTerm: PeriodSignatureTerm | null;
	strongestEmergentTerm: PeriodSignatureTerm | null;
	strongestFadingTerm: PeriodSignatureTerm | null;
	topDistinctiveTerms: PeriodSignatureTerm[];
	topEmergentTerms: PeriodSignatureTerm[];
	topFadingTerms: PeriodSignatureTerm[];
}

export interface BodyTextYearProfile {
	year: number;
	entryCount: number;
	lexicalRichness: number | null;
	noveltyRate: number | null;
	averageSentenceLength: number | null;
	sentenceLengthVariation: number | null;
	dominantOpeningSignature: BodyTextOpeningSignature | null;
	dominantOpeningSignatureShare: number | null;
	recurringPhraseShare: number | null;
}

export interface BodyTextMonthClimate {
	monthIndex: number;
	monthLabel: string;
	entryCount: number;
	lexicalRichness: number | null;
	averageSentenceLength: number | null;
	sentenceLengthVariation: number | null;
}

export interface BodyTextRecurringPhrase {
	phrase: string;
	supportEntries: number;
	firstYear: number;
	lastYear: number;
	averageGapDays: number | null;
	recurrenceScore: number;
}

export interface BodyTextOpeningSignatureDistribution {
	signature: BodyTextOpeningSignature;
	count: number;
	share: number;
}

export interface BodyTextTagProfile {
	label: string;
	support: number;
	averageWords: number;
	medianWords: number | null;
	averageLexicalRichness: number | null;
	averageSentenceLength: number | null;
	medianSentenceLength: number | null;
	averageRevisionLagDays: number | null;
	medianRevisionLagDays: number | null;
}

export interface BodyTextOpeningShift {
	fromYear: number;
	toYear: number;
	score: number;
}

export interface CzechNormalizedYearProfile {
	year: number;
	entryCount: number;
	contentTokenCount: number;
	vocabularySize: number;
	lexicalRichness: number | null;
	noveltyRate: number | null;
	contentShare: number | null;
}

export interface CzechNormalizedMetricsSummary {
	enabled: boolean;
	scopeMode: DeepTextAnalysisScopeMode;
	scopeFromYear: number | null;
	scopeToYear: number | null;
	scopeLabel: string;
	includedTags: string[];
	excludedTags: string[];
	tagFilterLabel: string;
	analyzedEntryCount: number;
	overallVocabularySize: number;
	overallContentTokenCount: number;
	overallLexicalRichness: number | null;
	overallContentShare: number | null;
	richestYear: CzechNormalizedYearProfile | null;
	mostNovelYear: CzechNormalizedYearProfile | null;
	densestContentYear: CzechNormalizedYearProfile | null;
	yearProfiles: CzechNormalizedYearProfile[];
	periodSignature: PeriodSignatureSummary;
	entities: EntityAnalysisSummary;
}

export interface BodyTextMetricsSummary {
	enabled: boolean;
	analyzedEntryCount: number;
	timeScopeMode: BodyTextMetricTimeScope;
	timeScopeFromYear: number | null;
	timeScopeToYear: number | null;
	timeScopeLabel: string;
	overallLexicalRichness: number | null;
	dominantOpeningSignature: BodyTextOpeningSignature | null;
	richestVocabularyYear: BodyTextYearProfile | null;
	mostNovelYear: BodyTextYearProfile | null;
	mostRepetitiveYear: BodyTextYearProfile | null;
	strongestPhraseFamily: BodyTextRecurringPhrase | null;
	longestSentenceMonth: BodyTextMonthClimate | null;
	shortestSentenceMonth: BodyTextMonthClimate | null;
	richestTag: BodyTextTagProfile | null;
	longestEntryTag: BodyTextTagProfile | null;
	shortestEntryTag: BodyTextTagProfile | null;
	mostRevisedTag: BodyTextTagProfile | null;
	sharpestOpeningShift: BodyTextOpeningShift | null;
	yearProfiles: BodyTextYearProfile[];
	monthClimateProfiles: BodyTextMonthClimate[];
	topRecurringPhrases: BodyTextRecurringPhrase[];
	openingSignatureDistribution: BodyTextOpeningSignatureDistribution[];
	tagProfiles: BodyTextTagProfile[];
	czechNormalized: CzechNormalizedMetricsSummary;
}

export interface StructuralExampleLink {
	path: string;
	timestampLabel: string | null;
}

export interface StructuralSilenceGapExample {
	gapDays: number;
	before: StructuralExampleLink;
	after: StructuralExampleLink;
}

export interface StructuralRevisionLagExample {
	path: string;
	lagDays: number;
	createdAtLabel: string | null;
	updatedAtLabel: string | null;
	wordCount: number;
}

export interface StructuralPhraseExample {
	phrase: string;
	supportEntries: number;
	averageGapDays: number | null;
	recurrenceScore: number;
	examplePaths: string[];
}

export interface StructuralTagPairExample {
	label: string;
	support: number;
	lift: number;
	examplePaths: string[];
}

export interface StructuralBridgeTagExample {
	label: string;
	frequency: number;
	degree: number;
	bridgeScore: number;
	examplePaths: string[];
}

export interface StructuralRegimeShiftExample {
	fromYear: number;
	toYear: number;
	score: number;
	tagChange: number;
	textChange: number;
	volumeChange: number;
	revisionChange: number;
	cadenceChange: number;
	fromPaths: string[];
	toPaths: string[];
}

export interface StructuralExamplesSummary {
	silenceGaps: StructuralSilenceGapExample[];
	revisionLags: StructuralRevisionLagExample[];
	recurringPhrases: StructuralPhraseExample[];
	tagPairLifts: StructuralTagPairExample[];
	bridgeTags: StructuralBridgeTagExample[];
	regimeShifts: StructuralRegimeShiftExample[];
}

export interface WritingStreakSummary {
	startDate: string;
	endDate: string;
	dayCount: number;
	entryCount: number;
}

export interface ExtraMetricsSummary {
	longestWritingStreak: WritingStreakSummary | null;
	mostVerboseMonth: MonthLengthProfilePoint | null;
	shortestMonth: MonthLengthProfilePoint | null;
	mostActiveHour: HourlyActivityPoint | null;
	quietestActiveHour: HourlyActivityPoint | null;
	hourOfDayEntriesWithTime: number;
	hourMetricScopeLabel: string;
	qualifyingTagCount: number;
	displayedTagCount: number;
	topTagByFrequency: string | null;
	topTagFrequencyCount: number;
	monthLengthProfile: MonthLengthProfileData;
	tagFrequencyHeatmap: TagFrequencyHeatmapData;
	hourlyActivity: HourlyActivityData;
}

export interface AdvancedHeadline {
	label: string;
	value: string;
	detail: string;
}

export interface AdvancedTemporalRhythmSummary {
	burstinessIndex: number;
	longestSilenceGapDays: number;
	p90SilenceGapDays: number;
	longSilenceShare: number;
	streakFragility: number;
	weekdayBiasStability: number;
	seasonalAsymmetry: number;
	dominantSeason: string | null;
}

export interface AdvancedVolumeStructureSummary {
	lengthSkewness: number;
	tailHeaviness: number;
	compressionExpansionRatio: number;
	writingConcentrationIndex: number;
}

export interface AdvancedRevisionStructureSummary {
	usableEntryCount: number;
	revisitedEntryCount: number;
	revisitRatio: number;
	medianLagDays: number;
	p90LagDays: number;
	maxLagDays: number;
	revisionHalfLifeDays: number;
	revisionWeightedWordsIndex: number;
}

export interface AdvancedTagPairLift {
	label: string;
	support: number;
	lift: number;
}

export interface AdvancedBridgeTag {
	label: string;
	frequency: number;
	degree: number;
	bridgeScore: number;
}

export interface AdvancedTagInterval {
	label: string;
	support: number;
	averageGapDays: number;
}

export interface AdvancedTagPersistence {
	label: string;
	lifespanYears: number;
	consecutiveRunYears: number;
	persistenceScore: number;
}

export interface AdvancedTagCoupling {
	label: string;
	support: number;
	averageWordDelta: number;
}

export interface AdvancedTagWeekdayBias {
	label: string;
	weekdayLabel: string;
	support: number;
	lift: number;
}

export interface AdvancedTagStructureSummary {
	overallEntropy: number;
	overallConcentration: number;
	fastestReturningTag: AdvancedTagInterval | null;
	mostPersistentTag: AdvancedTagPersistence | null;
	longestLifespanTag: AdvancedTagPersistence | null;
	strongestRecurringMotif: AdvancedTagPairLift | null;
	strongestPositiveCoupling: AdvancedTagCoupling | null;
	strongestNegativeCoupling: AdvancedTagCoupling | null;
	topPairLifts: AdvancedTagPairLift[];
	bridgeTags: AdvancedBridgeTag[];
	weekdayBiases: AdvancedTagWeekdayBias[];
}

export interface AdvancedRegimeShift {
	fromYear: number;
	toYear: number;
	score: number;
	tagChange: number;
	textChange: number;
	volumeChange: number;
	revisionChange: number;
	cadenceChange: number;
}

export interface AdvancedProductivityMode {
	year: number;
	mode: string;
	rationale: string;
}

export interface AdvancedHiddenStructureSummary {
	sharpestRegimeShift: AdvancedRegimeShift | null;
	cadenceDepthCorrelation: number | null;
	revisionLengthCorrelation: number | null;
	strongestWeekdaySemanticBias: AdvancedTagWeekdayBias | null;
	productivityModes: AdvancedProductivityMode[];
	regimeShifts: AdvancedRegimeShift[];
	predominantMode: string | null;
	structuralReadings: AdvancedHeadline[];
}

export interface AdvancedYearProfile {
	year: number;
	entryCount: number;
	totalWords: number;
	averageWords: number;
	burstinessIndex: number;
	longestSilenceGapDays: number;
	streakFragility: number;
	seasonalAsymmetry: number;
	writingConcentrationIndex: number;
	revisitRatio: number;
	medianRevisionLagDays: number;
	revisionWeightedWordsIndex: number;
	tagEntropy: number | null;
	tagConcentration: number | null;
	productivityMode: string;
	regimeShiftFromPrevious: number | null;
}

export interface AdvancedMetricsSummary {
	headlineCards: AdvancedHeadline[];
	temporalRhythm: AdvancedTemporalRhythmSummary;
	volumeStructure: AdvancedVolumeStructureSummary;
	revisionStructure: AdvancedRevisionStructureSummary;
	tagStructure: AdvancedTagStructureSummary;
	bodyText: BodyTextMetricsSummary;
	hiddenStructure: AdvancedHiddenStructureSummary;
	structuralExamples: StructuralExamplesSummary;
	yearProfiles: AdvancedYearProfile[];
}

export interface DiaryAnalysisResult {
	startedAt: string;
	finishedAt: string;
	durationMilliseconds: number;
	durationLabel: string;
	scope: ScopeScanSummary;
	cache: AnalysisCacheRunSummary;
	aggregate: DiaryAggregateSummary;
	visuals: AnalysisVisualSummary;
	tagAnalysis: TagAnalysisSummary;
	advancedMetrics: AdvancedMetricsSummary;
	extraMetrics: ExtraMetricsSummary;
	records: RecordsSummary;
	dateIssues: DateIssueReportEntry[];
}

export interface WordCountTokenization {
	cleanedText: string;
	tokens: string[];
}

export interface WordCountDebugResult {
	path: string;
	wordCount: number;
	cleanedText: string;
	tokens: string[];
}

export interface AnalysisProgressState {
	startedAt: string;
	elapsedLabel: string;
	message: string;
	processedFiles: number;
	totalFiles: number;
	percent: number;
}
