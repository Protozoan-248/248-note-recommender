import { App, TFile } from "obsidian";
import type { NoteIndex, NoteRecommendationSettings, RecommendationResult, RecommendationCandidate } from "../types";
import { buildNoteIndex, createEmptyRecommendationCandidate } from "./note-index";

export async function buildRecommendations(
	app: App,
	settings: NoteRecommendationSettings,
	activeFile: TFile | null,
): Promise<RecommendationResult> {
	const index = await buildNoteIndex(app, settings);
	const current = activeFile ? index.entries.find((entry) => entry.path === activeFile.path) ?? null : null;

	if (!current) {
		return {
			generatedAt: new Date().toISOString(),
			currentPath: activeFile?.path ?? null,
			recommendations: [],
		};
	}

	const candidates: RecommendationCandidate[] = [];

	for (const entry of index.entries) {
		if (entry.path === current.path) {
			continue;
		}

		const score = scoreCandidate(current, entry, settings);
		if (score <= 0) {
			continue;
		}

		const candidate = createEmptyRecommendationCandidate(entry.path);
		candidate.score = score;
		candidate.reasons = buildReasons(current, entry, score);
		candidate.explanation = buildExplanation(candidate.reasons);
		candidates.push(candidate);
	}

	const ranked = selectDiversifiedCandidates(candidates, settings.maxRecommendations, settings.diversityLambda);

	return {
		generatedAt: new Date().toISOString(),
		currentPath: current.path,
		recommendations: ranked,
	};
}

function scoreCandidate(current: NoteIndex["entries"][number], entry: NoteIndex["entries"][number], settings: NoteRecommendationSettings): number {
	let score = 0;

	if (current.links.includes(entry.path)) {
		score += settings.directLinkWeight;
	}

	if (entry.links.includes(current.path)) {
		score += settings.backlinkWeight;
	}

	const sharedTags = current.tags.filter((tag) => entry.tags.includes(tag));
	if (sharedTags.length > 0) {
		score += sharedTags.length * settings.sharedTagWeight;
	}

	const sharedNeighbours = current.links.filter((linkPath) => entry.links.includes(linkPath));
	if (sharedNeighbours.length > 0) {
		score += sharedNeighbours.length * settings.sharedNeighbourWeight;
	}

	if (current.folder && entry.folder && current.folder === entry.folder) {
		score += settings.sameFolderWeight;
	}

	return score;
}

function buildReasons(current: NoteIndex["entries"][number], entry: NoteIndex["entries"][number], score: number): string[] {
	const reasons: string[] = [];
	if (current.links.includes(entry.path)) {
		reasons.push("It is directly linked from the current note.");
	}
	if (entry.links.includes(current.path)) {
		reasons.push("It links back to the current note.");
	}
	if (current.tags.some((tag) => entry.tags.includes(tag))) {
		reasons.push("It shares tags with the current note.");
	}
	const sharedNeighbours = current.links.filter((linkPath) => entry.links.includes(linkPath));
	if (sharedNeighbours.length > 0) {
		reasons.push("It shares neighbouring notes with the current note.");
	}
	if (current.folder && entry.folder && current.folder === entry.folder) {
		reasons.push("It is in the same folder context.");
	}
	if (reasons.length === 0) {
		reasons.push(`It scored ${score.toFixed(1)} under the base heuristics.`);
	}
	return reasons;
}

function selectDiversifiedCandidates(candidates: RecommendationCandidate[], limit: number, diversityLambda: number): RecommendationCandidate[] {
	const sorted = [...candidates].sort((left, right) => right.score - left.score);
	const selected: RecommendationCandidate[] = [];

	for (const candidate of sorted) {
		const similarityToSelected = selected.reduce((maxSimilarity, selectedCandidate) => {
			const similarity = estimateSimilarity(candidate, selectedCandidate);
			return Math.max(maxSimilarity, similarity);
		}, 0);
		const adjustedScore = candidate.score - diversityLambda * similarityToSelected * 10;
		if (selected.length === 0 || adjustedScore >= 0) {
			selected.push({ ...candidate, score: adjustedScore });
		}
	}

	return selected
		.sort((left, right) => right.score - left.score)
		.slice(0, limit)
		.map((candidate) => ({ ...candidate, explanation: buildExplanation(candidate.reasons) }));
}

function estimateSimilarity(left: RecommendationCandidate, right: RecommendationCandidate): number {
	const leftPath = left.path.toLowerCase();
	const rightPath = right.path.toLowerCase();
	const pathSimilarity = leftPath === rightPath ? 1 : 0;
	return pathSimilarity;
}

function buildExplanation(reasons: string[]): string {
	return reasons.length > 0 ? reasons.join(" ") : "No explanation generated.";
}
