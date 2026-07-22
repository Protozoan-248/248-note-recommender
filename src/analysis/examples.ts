import type {
	AdvancedBridgeTag,
	AdvancedHiddenStructureSummary,
	AdvancedTagStructureSummary,
	AdvancedRegimeShift,
	AdvancedTagPairLift,
	BodyTextMetricsSummary,
	BodyTextRecurringPhrase,
	DiaryFileAnalysis,
	StructuralBridgeTagExample,
	StructuralExamplesSummary,
	StructuralPhraseExample,
	StructuralRegimeShiftExample,
	StructuralRevisionLagExample,
	StructuralSilenceGapExample,
	StructuralTagPairExample,
} from "../types";

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_STORED_EXAMPLE_ROWS = 25;
const MAX_LINKED_NOTES_PER_EXAMPLE = 3;

interface ExampleEntry {
	path: string;
	year: number;
	epochDay: number;
	createdAtLabel: string | null;
	updatedAtLabel: string | null;
	wordCount: number;
	revisionLagDays: number | null;
	tags: string[];
	phraseCandidates: string[];
}

export function buildStructuralExamplesSummary(
	files: DiaryFileAnalysis[],
	advancedMetrics: {
		bodyText: BodyTextMetricsSummary;
		tagStructure: AdvancedTagStructureSummary;
		hiddenStructure: AdvancedHiddenStructureSummary;
	},
): StructuralExamplesSummary {
	const entries = toExampleEntries(files);

	return {
		silenceGaps: buildSilenceGapExamples(entries),
		revisionLags: buildRevisionLagExamples(entries),
		recurringPhrases: buildRecurringPhraseExamples(entries, advancedMetrics.bodyText.topRecurringPhrases),
		tagPairLifts: buildTagPairExamples(entries, advancedMetrics.tagStructure.topPairLifts),
		bridgeTags: buildBridgeTagExamples(entries, advancedMetrics.tagStructure.bridgeTags),
		regimeShifts: buildRegimeShiftExamples(entries, advancedMetrics.hiddenStructure.regimeShifts),
	};
}

function toExampleEntries(files: DiaryFileAnalysis[]): ExampleEntry[] {
	return files
		.filter((file) => file.createdAt.value !== null)
		.map((file) => {
			const createdAt = file.createdAt.value!;
			const updatedAt = file.updatedAt.value;

			return {
				path: file.path,
				year: createdAt.year,
				epochDay: Math.floor(createdAt.epochMillis / DAY_MS),
				createdAtLabel: createdAt.normalizedLocal,
				updatedAtLabel: updatedAt?.normalizedLocal ?? null,
				wordCount: file.wordCount,
				revisionLagDays:
					updatedAt && updatedAt.epochMillis >= createdAt.epochMillis
						? Math.floor((updatedAt.epochMillis - createdAt.epochMillis) / DAY_MS)
						: null,
				tags: file.normalizedTags,
				phraseCandidates: file.bodyTextFeatures?.phraseCandidates ?? [],
			} satisfies ExampleEntry;
		})
		.sort((left, right) => left.epochDay - right.epochDay || left.path.localeCompare(right.path));
}

function buildSilenceGapExamples(entries: ExampleEntry[]): StructuralSilenceGapExample[] {
	const examples: StructuralSilenceGapExample[] = [];

	for (let index = 1; index < entries.length; index += 1) {
		const previousEntry = entries[index - 1];
		const currentEntry = entries[index];
		if (!previousEntry || !currentEntry) {
			continue;
		}

		const gapDays = Math.max(0, currentEntry.epochDay - previousEntry.epochDay - 1);
		if (gapDays <= 0) {
			continue;
		}

		examples.push({
			gapDays,
			before: {
				path: previousEntry.path,
				timestampLabel: previousEntry.createdAtLabel,
			},
			after: {
				path: currentEntry.path,
				timestampLabel: currentEntry.createdAtLabel,
			},
		});
	}

	return examples
		.sort(
			(left, right) =>
				right.gapDays - left.gapDays ||
				left.before.path.localeCompare(right.before.path) ||
				left.after.path.localeCompare(right.after.path),
		)
		.slice(0, MAX_STORED_EXAMPLE_ROWS);
}

function buildRevisionLagExamples(entries: ExampleEntry[]): StructuralRevisionLagExample[] {
	return entries
		.filter((entry) => (entry.revisionLagDays ?? 0) > 0)
		.sort(
			(left, right) =>
				(right.revisionLagDays ?? 0) - (left.revisionLagDays ?? 0) ||
				right.wordCount - left.wordCount ||
				left.path.localeCompare(right.path),
		)
		.slice(0, MAX_STORED_EXAMPLE_ROWS)
		.map((entry) => ({
			path: entry.path,
			lagDays: entry.revisionLagDays ?? 0,
			createdAtLabel: entry.createdAtLabel,
			updatedAtLabel: entry.updatedAtLabel,
			wordCount: entry.wordCount,
		}));
}

function buildRecurringPhraseExamples(
	entries: ExampleEntry[],
	topRecurringPhrases: BodyTextRecurringPhrase[],
): StructuralPhraseExample[] {
	const phrasePaths = new Map<string, string[]>();

	for (const entry of entries) {
		for (const phrase of new Set(entry.phraseCandidates)) {
			const existingPaths = phrasePaths.get(phrase) ?? [];
			existingPaths.push(entry.path);
			phrasePaths.set(phrase, existingPaths);
		}
	}

	return topRecurringPhrases.slice(0, MAX_STORED_EXAMPLE_ROWS).map((phrase) => ({
		phrase: phrase.phrase,
		supportEntries: phrase.supportEntries,
		averageGapDays: phrase.averageGapDays,
		recurrenceScore: phrase.recurrenceScore,
		examplePaths: (phrasePaths.get(phrase.phrase) ?? []).slice(0, MAX_LINKED_NOTES_PER_EXAMPLE),
	}));
}

function buildTagPairExamples(
	entries: ExampleEntry[],
	topPairLifts: AdvancedTagPairLift[],
): StructuralTagPairExample[] {
	return topPairLifts.slice(0, MAX_STORED_EXAMPLE_ROWS).map((pair) => {
		const pairTags = pair.label.split(" + ").filter((tag) => tag.length > 0);
		const examplePaths = entries
			.filter((entry) => pairTags.every((tag) => entry.tags.includes(tag)))
			.map((entry) => entry.path)
			.slice(0, MAX_LINKED_NOTES_PER_EXAMPLE);

		return {
			label: pair.label,
			support: pair.support,
			lift: pair.lift,
			examplePaths,
		};
	});
}

function buildBridgeTagExamples(
	entries: ExampleEntry[],
	bridgeTags: AdvancedBridgeTag[],
): StructuralBridgeTagExample[] {
	return bridgeTags.slice(0, MAX_STORED_EXAMPLE_ROWS).map((tag) => ({
		label: tag.label,
		frequency: tag.frequency,
		degree: tag.degree,
		bridgeScore: tag.bridgeScore,
		examplePaths: entries
			.filter((entry) => entry.tags.includes(tag.label))
			.map((entry) => entry.path)
			.slice(0, MAX_LINKED_NOTES_PER_EXAMPLE),
	}));
}

function buildRegimeShiftExamples(
	entries: ExampleEntry[],
	regimeShifts: AdvancedRegimeShift[],
): StructuralRegimeShiftExample[] {
	return regimeShifts.slice(0, MAX_STORED_EXAMPLE_ROWS).map((shift) => ({
		fromYear: shift.fromYear,
		toYear: shift.toYear,
		score: shift.score,
		tagChange: shift.tagChange,
		textChange: shift.textChange,
		volumeChange: shift.volumeChange,
		revisionChange: shift.revisionChange,
		cadenceChange: shift.cadenceChange,
		fromPaths: entries
			.filter((entry) => entry.year === shift.fromYear)
			.slice()
			.sort((left, right) => right.epochDay - left.epochDay || left.path.localeCompare(right.path))
			.map((entry) => entry.path)
			.slice(0, MAX_LINKED_NOTES_PER_EXAMPLE),
		toPaths: entries
			.filter((entry) => entry.year === shift.toYear)
			.map((entry) => entry.path)
			.slice(0, MAX_LINKED_NOTES_PER_EXAMPLE),
	}));
}
