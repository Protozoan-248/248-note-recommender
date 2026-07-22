import type { DiaryFileAnalysis, DiaryStatsSettings, NoteRecordRow, RecordsSummary, RecordSection } from "../types";
import { estimateReadingTimeMinutes } from "./reading-time";

const DAY_MS = 24 * 60 * 60 * 1000;

interface RecordCandidate {
	path: string;
	wordCount: number;
	tagCount: number;
	revisionLagDays: number | null;
	lexicalRichness: number | null;
	averageSentenceLength: number | null;
	recurringPhraseMatches: number;
	uniqueWordCount: number | null;
	tagDensityPer100Words: number;
	readingTimeMinutes: number;
}

export function buildRecordsSummary(
	files: DiaryFileAnalysis[],
	settings: Pick<DiaryStatsSettings, "readingWordsPerMinute">,
): RecordsSummary {
	const recurringPhraseCounts = buildRecurringPhraseCounts(files);
	const candidates = files.map((file) => toRecordCandidate(file, recurringPhraseCounts, settings.readingWordsPerMinute));

	const sections: RecordSection[] = [
		buildRecordSection(
			"longest-notes",
			"Longest notes",
			candidates,
			(candidate) => candidate.wordCount,
			"desc",
			(candidate) => `${formatNumber(candidate.wordCount)} words`,
			(candidate) => `${formatNumber(candidate.readingTimeMinutes)} min read`,
		),
		buildRecordSection(
			"shortest-notes",
			"Shortest notes",
			candidates.filter((candidate) => candidate.wordCount > 0),
			(candidate) => candidate.wordCount,
			"asc",
			(candidate) => `${formatNumber(candidate.wordCount)} words`,
			(candidate) => `${formatNumber(candidate.readingTimeMinutes)} min read`,
		),
		buildRecordSection(
			"most-tags",
			"Most tags on one note",
			candidates,
			(candidate) => candidate.tagCount,
			"desc",
			(candidate) => `${candidate.tagCount} tags`,
			(candidate) => `${formatNumber(candidate.wordCount)} words`,
		),
		buildRecordSection(
			"longest-revision-lags",
			"Longest revision lags",
			candidates.filter((candidate) => candidate.revisionLagDays !== null && candidate.revisionLagDays > 0),
			(candidate) => candidate.revisionLagDays ?? 0,
			"desc",
			(candidate) => `${formatNumber(candidate.revisionLagDays ?? 0)} days`,
			(candidate) => `${formatNumber(candidate.wordCount)} words`,
		),
		buildRecordSection(
			"highest-lexical-richness",
			"Highest lexical richness notes",
			candidates.filter((candidate) => candidate.lexicalRichness !== null),
			(candidate) => candidate.lexicalRichness ?? Number.NEGATIVE_INFINITY,
			"desc",
			(candidate) => formatNumber(candidate.lexicalRichness ?? 0),
			(candidate) => `${candidate.uniqueWordCount ?? 0} unique words`,
		),
		buildRecordSection(
			"fewest-tags",
			"Fewest tags on one note",
			candidates,
			(candidate) => candidate.tagCount,
			"asc",
			(candidate) => `${candidate.tagCount} tags`,
			(candidate) => `${formatNumber(candidate.wordCount)} words`,
		),
		buildRecordSection(
			"longest-average-sentences",
			"Longest average-sentence notes",
			candidates.filter((candidate) => candidate.averageSentenceLength !== null),
			(candidate) => candidate.averageSentenceLength ?? Number.NEGATIVE_INFINITY,
			"desc",
			(candidate) => `${formatNumber(candidate.averageSentenceLength ?? 0)} words/sentence`,
			(candidate) => `${formatNumber(candidate.wordCount)} words`,
		),
		buildRecordSection(
			"most-repetitive-phrases",
			"Most repetitive-phrase notes",
			candidates.filter((candidate) => candidate.recurringPhraseMatches > 0),
			(candidate) => candidate.recurringPhraseMatches,
			"desc",
			(candidate) => `${candidate.recurringPhraseMatches} recurring phrases`,
			(candidate) => `${formatNumber(candidate.wordCount)} words`,
		),
		buildRecordSection(
			"most-unique-words",
			"Most unique-word notes",
			candidates.filter((candidate) => candidate.uniqueWordCount !== null),
			(candidate) => candidate.uniqueWordCount ?? Number.NEGATIVE_INFINITY,
			"desc",
			(candidate) => `${candidate.uniqueWordCount ?? 0} unique words`,
			(candidate) => `richness ${formatNumber(candidate.lexicalRichness ?? 0)}`,
		),
		buildRecordSection(
			"highest-tag-density",
			"Highest tag-density notes",
			candidates.filter((candidate) => candidate.wordCount > 0),
			(candidate) => candidate.tagDensityPer100Words,
			"desc",
			(candidate) => `${formatNumber(candidate.tagDensityPer100Words)} tags / 100 words`,
			(candidate) => `${candidate.tagCount} tags`,
		),
	];

	return {
		sections,
	};
}

function buildRecurringPhraseCounts(files: DiaryFileAnalysis[]): Map<string, number> {
	const phraseCounts = new Map<string, number>();

	for (const file of files) {
		const phrases = file.bodyTextFeatures?.phraseCandidates ?? [];
		for (const phrase of new Set(phrases)) {
			phraseCounts.set(phrase, (phraseCounts.get(phrase) ?? 0) + 1);
		}
	}

	return phraseCounts;
}

function toRecordCandidate(
	file: DiaryFileAnalysis,
	recurringPhraseCounts: Map<string, number>,
	readingWordsPerMinute: number,
): RecordCandidate {
	const createdAt = file.createdAt.value;
	const updatedAt = file.updatedAt.value;
	const bodyTextFeatures = file.bodyTextFeatures;
	const revisionLagDays =
		createdAt && updatedAt && updatedAt.epochMillis >= createdAt.epochMillis
			? (updatedAt.epochMillis - createdAt.epochMillis) / DAY_MS
			: null;
	const recurringPhraseMatches = (bodyTextFeatures?.phraseCandidates ?? []).filter(
		(phrase) => (recurringPhraseCounts.get(phrase) ?? 0) >= 2,
	).length;
	const uniqueWordCount = bodyTextFeatures?.uniqueNormalizedTokenCount ?? null;
	const lexicalRichness =
		bodyTextFeatures && bodyTextFeatures.normalizedTokenCount >= 2 && bodyTextFeatures.uniqueNormalizedTokenCount >= 2
			? Math.log(bodyTextFeatures.uniqueNormalizedTokenCount) / Math.log(bodyTextFeatures.normalizedTokenCount)
			: null;
	const averageSentenceLength =
		bodyTextFeatures && bodyTextFeatures.sentenceCount > 0
			? bodyTextFeatures.sentenceWordTotal / bodyTextFeatures.sentenceCount
			: null;

	return {
		path: file.path,
		wordCount: file.wordCount,
		tagCount: file.normalizedTags.length,
		revisionLagDays,
		lexicalRichness,
		averageSentenceLength,
		recurringPhraseMatches,
		uniqueWordCount,
		tagDensityPer100Words: file.wordCount > 0 ? (file.normalizedTags.length / file.wordCount) * 100 : 0,
		readingTimeMinutes: estimateReadingTimeMinutes(file.wordCount, readingWordsPerMinute),
	};
}

function buildRecordSection(
	id: string,
	title: string,
	candidates: RecordCandidate[],
	scoreSelector: (candidate: RecordCandidate) => number,
	sortDirection: "asc" | "desc",
	valueLabelSelector: (candidate: RecordCandidate) => string,
	detailLabelSelector: (candidate: RecordCandidate) => string,
): RecordSection {
	const rows: NoteRecordRow[] = [...candidates]
		.sort((left, right) => compareCandidates(left, right, scoreSelector, sortDirection))
		.map((candidate) => ({
			path: candidate.path,
			valueLabel: valueLabelSelector(candidate),
			detailLabel: detailLabelSelector(candidate),
			sortValue: scoreSelector(candidate),
		}));

	return {
		id,
		title,
		rows,
	};
}

function compareCandidates(
	left: RecordCandidate,
	right: RecordCandidate,
	scoreSelector: (candidate: RecordCandidate) => number,
	sortDirection: "asc" | "desc",
): number {
	const leftScore = scoreSelector(left);
	const rightScore = scoreSelector(right);
	const primaryDelta = sortDirection === "desc" ? rightScore - leftScore : leftScore - rightScore;

	return primaryDelta || right.wordCount - left.wordCount || left.path.localeCompare(right.path);
}

function formatNumber(value: number): string {
	return Number.isInteger(value) ? value.toString() : value.toFixed(1);
}
