import { buildCzechNormalizedTextFeatures } from "./czech-normalization";
import { extractEntityCandidates } from "./entity-candidates";
import type { BodyTextFeatures, BodyTextOpeningSignature, DiaryStatsSettings } from "../types";
import { normalizeMarkdownTextForAnalysis } from "./parse";

const MAX_PHRASE_CANDIDATES_PER_NOTE = 60;
const TEMPORAL_CUES = new Set([
	"today",
	"yesterday",
	"tomorrow",
	"morning",
	"evening",
	"night",
	"monday",
	"tuesday",
	"wednesday",
	"thursday",
	"friday",
	"saturday",
	"sunday",
	"dnes",
	"včera",
	"zítra",
	"rano",
	"ráno",
	"vecer",
	"večer",
	"noc",
	"pondeli",
	"pondělí",
	"utery",
	"úterý",
	"streda",
	"středa",
	"ctvrtek",
	"čtvrtek",
	"patek",
	"pátek",
	"sobota",
	"nedele",
	"neděle",
]);
const SCENE_SETTING_CUES = new Set([
	"in",
	"at",
	"on",
	"under",
	"behind",
	"before",
	"near",
	"outside",
	"inside",
	"v",
	"ve",
	"na",
	"u",
	"pod",
	"nad",
	"před",
	"pred",
	"za",
]);
const EMOTIONAL_CUES = new Set(["oh", "ah", "aha", "wow", "uff", "ach", "boze", "bože", "jejda"]);

export function extractBodyTextFeatures(
	content: string,
	settings: Pick<
		DiaryStatsSettings,
		| "excludeCodeFencesFromWordCount"
		| "excludeInlineCodeFromWordCount"
		| "enableCzechNormalizedDeepTextAnalysis"
	>,
): BodyTextFeatures {
	const cleanedText = normalizeMarkdownTextForAnalysis(content, settings);
	const normalizedTokens = extractNormalizedTokens(cleanedText);
	const normalizedVocabulary = [...new Set(normalizedTokens)].sort((left, right) => left.localeCompare(right));
	const sentenceWordLengths = extractSentenceWordLengths(cleanedText);
	const openingLine = getOpeningLine(cleanedText);
	const entityCandidates = settings.enableCzechNormalizedDeepTextAnalysis ? extractEntityCandidates(cleanedText) : [];

	return {
		normalizedTokenCount: normalizedTokens.length,
		uniqueNormalizedTokenCount: normalizedVocabulary.length,
		normalizedVocabulary,
		sentenceCount: sentenceWordLengths.length,
		sentenceWordTotal: sentenceWordLengths.reduce((sum, length) => sum + length, 0),
		sentenceWordSquareTotal: sentenceWordLengths.reduce((sum, length) => sum + length * length, 0),
		openingLine,
		openingSignature: classifyOpeningLine(openingLine),
		phraseCandidates: extractPhraseCandidates(normalizedTokens),
		czechNormalized: settings.enableCzechNormalizedDeepTextAnalysis
			? buildCzechNormalizedTextFeatures(normalizedTokens, entityCandidates)
			: null,
	};
}

function extractNormalizedTokens(text: string): string[] {
	return [...text.matchAll(/[\p{L}\p{N}]+(?:['’_-][\p{L}\p{N}]+)*/gu)].map((match) =>
		match[0].toLocaleLowerCase(),
	);
}

function extractSentenceWordLengths(text: string): number[] {
	const normalizedText = text
		.replace(/\r\n/gu, "\n")
		.replace(/[!?]+/gu, ".")
		.replace(/…/gu, ".")
		.replace(/\n{2,}/gu, ".\n");

	return normalizedText
		.split(/[.\n]+/u)
		.map((segment) => extractNormalizedTokens(segment).length)
		.filter((length) => length > 0);
}

function getOpeningLine(text: string): string | null {
	for (const line of text.replace(/\r\n/gu, "\n").split("\n")) {
		const trimmedLine = line.trim();
		if (trimmedLine.length > 0) {
			return trimmedLine.slice(0, 200);
		}
	}

	return null;
}

function classifyOpeningLine(openingLine: string | null): BodyTextOpeningSignature | null {
	if (!openingLine) {
		return null;
	}

	const trimmedLine = openingLine.trim();
	const normalizedTokens = extractNormalizedTokens(trimmedLine);
	if (normalizedTokens.length === 0) {
		return null;
	}

	if (isTemporalOpening(trimmedLine, normalizedTokens)) {
		return "temporal";
	}

	if (isEmotionalOpening(trimmedLine, normalizedTokens)) {
		return "emotional";
	}

	if (isSceneSettingOpening(normalizedTokens)) {
		return "scene-setting";
	}

	if (normalizedTokens.length <= 4 && !/[.!?…]$/u.test(trimmedLine)) {
		return "fragmentary";
	}

	if (trimmedLine.includes(",") || normalizedTokens.length >= 14) {
		return "descriptive";
	}

	if (/[.!?…]$/u.test(trimmedLine) || normalizedTokens.length >= 6) {
		return "declarative";
	}

	return normalizedTokens.length <= 5 ? "fragmentary" : "other";
}

function isTemporalOpening(openingLine: string, normalizedTokens: string[]): boolean {
	if (/^\d{1,2}[:.]\d{2}\b/u.test(openingLine) || /^\d{4}-\d{2}-\d{2}\b/u.test(openingLine)) {
		return true;
	}

	return normalizedTokens.some((token, index) => index < 3 && TEMPORAL_CUES.has(token));
}

function isEmotionalOpening(openingLine: string, normalizedTokens: string[]): boolean {
	if (openingLine.includes("!") || /^[.?!]{2,}/u.test(openingLine)) {
		return true;
	}

	return normalizedTokens.some((token, index) => index < 2 && EMOTIONAL_CUES.has(token));
}

function isSceneSettingOpening(normalizedTokens: string[]): boolean {
	if (normalizedTokens.length < 3) {
		return false;
	}

	return SCENE_SETTING_CUES.has(normalizedTokens[0] ?? "") || SCENE_SETTING_CUES.has(normalizedTokens[1] ?? "");
}

function extractPhraseCandidates(normalizedTokens: string[]): string[] {
	const phrases: string[] = [];
	const seen = new Set<string>();

	for (const phraseLength of [4, 3]) {
		for (let index = 0; index <= normalizedTokens.length - phraseLength; index += 1) {
			const tokens = normalizedTokens.slice(index, index + phraseLength);
			if (!isUsefulPhraseCandidate(tokens)) {
				continue;
			}

			const phrase = tokens.join(" ");
			if (seen.has(phrase)) {
				continue;
			}

			seen.add(phrase);
			phrases.push(phrase);
			if (phrases.length >= MAX_PHRASE_CANDIDATES_PER_NOTE) {
				return phrases;
			}
		}
	}

	return phrases;
}

function isUsefulPhraseCandidate(tokens: string[]): boolean {
	if (tokens.length < 3) {
		return false;
	}

	const longTokenCount = tokens.filter((token) => token.length >= 5).length;
	const numericTokenCount = tokens.filter((token) => /^\d+$/u.test(token)).length;
	const averageLength = tokens.reduce((sum, token) => sum + token.length, 0) / tokens.length;

	return longTokenCount >= 1 && numericTokenCount < tokens.length && averageLength >= 3;
}
