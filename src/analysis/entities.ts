import type {
	CzechNormalizedTextFeatures,
	DiaryStatsSettings,
	EntityAnalysisSummary,
	EntityCandidateRow,
	EntityPairRow,
} from "../types";
import { normalizeForCzechAnalysis } from "./czech-normalization";
import { normalizeEntityCandidateKey } from "./entity-candidates";

const ENTITY_MIN_SUPPORT = 2;
const MILLIS_PER_DAY = 24 * 60 * 60 * 1000;

interface EntitySummaryEntry {
	year: number;
	createdEpochMillis: number;
	features: Pick<CzechNormalizedTextFeatures, "entityCandidates">;
}

interface MutableCandidateStats {
	surfaceCounts: Map<string, number>;
	supportEntries: number;
	years: Set<number>;
	timestamps: number[];
}

interface MutablePairStats {
	leftKey: string;
	rightKey: string;
	supportEntries: number;
	years: Set<number>;
}

export function buildEntityAnalysisSummary(
	entries: EntitySummaryEntry[],
	settings: Pick<DiaryStatsSettings, "enableEntityRelationshipAnalysis">,
): EntityAnalysisSummary {
	if (!settings.enableEntityRelationshipAnalysis) {
		return createEmptyEntityAnalysisSummary(false, entries.length);
	}

	if (entries.length === 0) {
		return createEmptyEntityAnalysisSummary(true, 0);
	}

	const candidateStats = new Map<string, MutableCandidateStats>();
	const pairStats = new Map<string, MutablePairStats>();

	for (const entry of entries) {
		const entryCandidates = new Map<string, string>();
		for (const candidate of entry.features.entityCandidates) {
			const key = normalizeEntityCandidateKey(candidate);
			if (key.length === 0 || entryCandidates.has(key)) {
				continue;
			}

			entryCandidates.set(key, candidate);
			const stats = getOrCreateCandidateStats(candidateStats, key);
			stats.supportEntries += 1;
			stats.years.add(entry.year);
			stats.timestamps.push(entry.createdEpochMillis);
			stats.surfaceCounts.set(candidate, (stats.surfaceCounts.get(candidate) ?? 0) + 1);
		}

		const entryKeys = [...entryCandidates.keys()].sort((left, right) => left.localeCompare(right));
		for (let leftIndex = 0; leftIndex < entryKeys.length; leftIndex += 1) {
			for (let rightIndex = leftIndex + 1; rightIndex < entryKeys.length; rightIndex += 1) {
				const leftKey = entryKeys[leftIndex];
				const rightKey = entryKeys[rightIndex];
				if (!leftKey || !rightKey) {
					continue;
				}
				const pairKey = `${leftKey}||${rightKey}`;
				const stats = pairStats.get(pairKey);
				if (stats) {
					stats.supportEntries += 1;
					stats.years.add(entry.year);
					continue;
				}

				pairStats.set(pairKey, {
					leftKey,
					rightKey,
					supportEntries: 1,
					years: new Set([entry.year]),
				});
			}
		}
	}

	const candidateRows = [...candidateStats.entries()]
		.map(([key, stats]) => buildEntityCandidateRow(key, stats))
		.filter((row) => row.supportEntries >= ENTITY_MIN_SUPPORT);
	const labelByKey = new Map(
		[...candidateStats.entries()].map(([key, stats]) => [key, pickPreferredSurface(stats.surfaceCounts)] as const),
	);
	const pairRows = [...pairStats.values()]
		.map((stats) => buildEntityPairRow(stats, labelByKey))
		.filter((row): row is EntityPairRow => row !== null && row.supportEntries >= ENTITY_MIN_SUPPORT);

	const topPersistentCandidates = [...candidateRows].sort(comparePersistentCandidates);
	const topBridgeCandidates = [...candidateRows].sort(compareBridgeCandidates);
	const topEntityPairs = [...pairRows].sort(compareEntityPairs);

	return {
		enabled: true,
		analyzedEntryCount: entries.length,
		candidateCount: candidateRows.length,
		pairCount: pairRows.length,
		mostPersistentCandidate: topPersistentCandidates[0] ?? null,
		newestCandidate: [...candidateRows].sort(compareNewestCandidates)[0] ?? null,
		longestLivedCandidate: [...candidateRows].sort(compareLongestLivedCandidates)[0] ?? null,
		bridgeCandidate: topBridgeCandidates[0] ?? null,
		strongestPair: topEntityPairs[0] ?? null,
		topPersistentCandidates,
		topBridgeCandidates,
		topEntityPairs,
	};
}

function createEmptyEntityAnalysisSummary(enabled: boolean, analyzedEntryCount: number): EntityAnalysisSummary {
	return {
		enabled,
		analyzedEntryCount,
		candidateCount: 0,
		pairCount: 0,
		mostPersistentCandidate: null,
		newestCandidate: null,
		longestLivedCandidate: null,
		bridgeCandidate: null,
		strongestPair: null,
		topPersistentCandidates: [],
		topBridgeCandidates: [],
		topEntityPairs: [],
	};
}

function getOrCreateCandidateStats(
	statsByKey: Map<string, MutableCandidateStats>,
	key: string,
): MutableCandidateStats {
	const existing = statsByKey.get(key);
	if (existing) {
		return existing;
	}

	const created: MutableCandidateStats = {
		surfaceCounts: new Map(),
		supportEntries: 0,
		years: new Set(),
		timestamps: [],
	};
	statsByKey.set(key, created);
	return created;
}

function buildEntityCandidateRow(_key: string, stats: MutableCandidateStats): EntityCandidateRow {
	const years = [...stats.years].sort((left, right) => left - right);
	const firstYear = years[0] ?? 0;
	const lastYear = years[years.length - 1] ?? 0;
	const spanYears = Math.max(1, lastYear - firstYear + 1);
	return {
		label: pickPreferredSurface(stats.surfaceCounts),
		supportEntries: stats.supportEntries,
		firstYear,
		lastYear,
		activeYears: years.length,
		averageGapDays: computeAverageGapDays(stats.timestamps),
		bridgeScore: Math.log2(stats.supportEntries + 1) * years.length * Math.sqrt(spanYears),
	};
}

function buildEntityPairRow(
	stats: MutablePairStats,
	labelByKey: Map<string, string>,
): EntityPairRow | null {
	const leftLabel = labelByKey.get(stats.leftKey);
	const rightLabel = labelByKey.get(stats.rightKey);
	if (!leftLabel || !rightLabel) {
		return null;
	}

	const years = [...stats.years].sort((left, right) => left - right);
	const firstYear = years[0] ?? 0;
	const lastYear = years[years.length - 1] ?? 0;
	const spanYears = Math.max(1, lastYear - firstYear + 1);
	return {
		leftLabel,
		rightLabel,
		supportEntries: stats.supportEntries,
		firstYear,
		lastYear,
		activeYears: years.length,
		strength: stats.supportEntries * Math.log2(years.length + 1) * Math.sqrt(spanYears),
	};
}

function pickPreferredSurface(surfaceCounts: Map<string, number>): string {
	return [...surfaceCounts.entries()]
		.sort(
			([leftLabel, leftCount], [rightLabel, rightCount]) =>
				scoreEntitySurfaceLabel(rightLabel) - scoreEntitySurfaceLabel(leftLabel) ||
				rightCount - leftCount ||
				leftLabel.length - rightLabel.length ||
				leftLabel.localeCompare(rightLabel),
		)[0]?.[0] ?? "(none)";
}

function scoreEntitySurfaceLabel(label: string): number {
	const normalized = normalizeForCzechAnalysis(label);
	if (!normalized) {
		return 0;
	}

	let score = 0;

	if (/^(?:[a-z]+ )+[a-z]+$/u.test(normalized) && !hasBlacklistedLeadingWord(normalized)) {
		score += 2;
	}

	if (
		normalized.endsWith("a") ||
		normalized.endsWith("e") ||
		normalized.endsWith("o") ||
		normalized.endsWith("ek") ||
		normalized.endsWith("ec")
	) {
		score += 2;
	}

	if (
		normalized.endsWith("kou") ||
		normalized.endsWith("ku") ||
		normalized.endsWith("ky") ||
		normalized.endsWith("ce") ||
		normalized.endsWith("ci") ||
		normalized.endsWith("cu") ||
		normalized.endsWith("cy") ||
		normalized.endsWith("ou") ||
		normalized.endsWith("em") ||
		normalized.endsWith("om") ||
		normalized.endsWith("am") ||
		normalized.endsWith("im") ||
		normalized.endsWith("ym") ||
		normalized.endsWith("ich") ||
		normalized.endsWith("ych") ||
		normalized.endsWith("ech") ||
		normalized.endsWith("ami") ||
		normalized.endsWith("emi") ||
		normalized.endsWith("cina") ||
		normalized.endsWith("cino") ||
		normalized.endsWith("ciny") ||
		normalized.endsWith("cine") ||
		normalized.endsWith("cinu") ||
		normalized.endsWith("cin")
	) {
		score -= 3;
	}

	if (hasBlacklistedLeadingWord(normalized)) {
		score -= 4;
	}

	return score;
}

function hasBlacklistedLeadingWord(normalizedLabel: string): boolean {
	const firstWord = normalizedLabel.split(/\s+/u)[0] ?? "";
	return (
		firstWord === "ma" ||
		firstWord === "mam" ||
		firstWord === "mas" ||
		firstWord === "mame" ||
		firstWord === "mate" ||
		firstWord === "maji" ||
		firstWord === "vola" ||
		firstWord === "volal" ||
		firstWord === "volala" ||
		firstWord === "pise" ||
		firstWord === "psal" ||
		firstWord === "psala" ||
		firstWord === "rika" ||
		firstWord === "rikal" ||
		firstWord === "rikala" ||
		firstWord === "rekl" ||
		firstWord === "rekla" ||
		firstWord === "naha" ||
		firstWord === "nahy" ||
		firstWord === "nahou"
	);
}

function computeAverageGapDays(timestamps: number[]): number | null {
	if (timestamps.length < 2) {
		return null;
	}

	const sorted = [...timestamps].sort((left, right) => left - right);
	let gapSum = 0;
	for (let index = 1; index < sorted.length; index += 1) {
		const current = sorted[index];
		const previous = sorted[index - 1];
		if (current === undefined || previous === undefined) {
			continue;
		}

		gapSum += (current - previous) / MILLIS_PER_DAY;
	}

	return gapSum / (sorted.length - 1);
}

function comparePersistentCandidates(left: EntityCandidateRow, right: EntityCandidateRow): number {
	return (
		right.supportEntries - left.supportEntries ||
		right.activeYears - left.activeYears ||
		left.firstYear - right.firstYear ||
		left.label.localeCompare(right.label)
	);
}

function compareBridgeCandidates(left: EntityCandidateRow, right: EntityCandidateRow): number {
	return (
		right.bridgeScore - left.bridgeScore ||
		right.activeYears - left.activeYears ||
		right.supportEntries - left.supportEntries ||
		left.label.localeCompare(right.label)
	);
}

function compareNewestCandidates(left: EntityCandidateRow, right: EntityCandidateRow): number {
	return (
		right.firstYear - left.firstYear ||
		right.supportEntries - left.supportEntries ||
		right.activeYears - left.activeYears ||
		left.label.localeCompare(right.label)
	);
}

function compareLongestLivedCandidates(left: EntityCandidateRow, right: EntityCandidateRow): number {
	const leftSpan = left.lastYear - left.firstYear;
	const rightSpan = right.lastYear - right.firstYear;
	return (
		rightSpan - leftSpan ||
		right.activeYears - left.activeYears ||
		right.supportEntries - left.supportEntries ||
		left.label.localeCompare(right.label)
	);
}

function compareEntityPairs(left: EntityPairRow, right: EntityPairRow): number {
	return (
		right.strength - left.strength ||
		right.supportEntries - left.supportEntries ||
		right.activeYears - left.activeYears ||
		left.leftLabel.localeCompare(right.leftLabel) ||
		left.rightLabel.localeCompare(right.rightLabel)
	);
}
