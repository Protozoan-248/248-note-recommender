import { TFile } from "obsidian";
import type {
	DateResolution,
	DateValueSource,
	DiaryFileAnalysis,
	DiaryStatsSettings,
	FrontmatterDateIssueKind,
	NormalizedTimestamp,
	TimestampPrecision,
	WordCountTokenization,
} from "../types";

interface FrontmatterLookupResult {
	found: boolean;
	value: unknown;
}

export function analyzeDiaryFile(
	file: TFile,
	content: string,
	frontmatter: Record<string, unknown> | null | undefined,
	settings: DiaryStatsSettings,
): DiaryFileAnalysis {
	const createdLookup = findFrontmatterValue(frontmatter, settings.createdAtKey);
	const updatedLookup = findFrontmatterValue(frontmatter, settings.updatedAtKey);
	const normalizedTags = extractNormalizedTags(frontmatter, settings);

	const createdAt = resolveDateValue(file, createdLookup, "created");
	const updatedAt = resolveDateValue(file, updatedLookup, "updated");

	return {
		path: file.path,
		size: file.stat.size,
		wordCount: countWordsFromMarkdown(content, settings),
		createdAt,
		updatedAt,
		chronologyYear: createdAt.value?.year ?? null,
		hasCreatedFrontmatterKey: createdLookup.found,
		hasUpdatedFrontmatterKey: updatedLookup.found,
		normalizedTags,
		bodyTextFeatures: null,
	};
}

export function countWordsFromMarkdown(content: string, settings: DiaryStatsSettings): number {
	return tokenizeMarkdownForWordCount(content, settings).tokens.length;
}

export function tokenizeMarkdownForWordCount(
	content: string,
	settings: DiaryStatsSettings,
): WordCountTokenization {
	const cleanedText = normalizeMarkdownTextForAnalysis(content, settings);
	const tokens = cleanedText
		.split(/\s+/u)
		.map((token) => token.trim())
		.filter((token) => token.length > 0)
		.filter((token) => !isStandaloneSeparatorToken(token));

	return {
		cleanedText,
		tokens,
	};
}

export function normalizeMarkdownTextForAnalysis(
	content: string,
	settings: Pick<DiaryStatsSettings, "excludeCodeFencesFromWordCount" | "excludeInlineCodeFromWordCount">,
): string {
	let text = stripYamlFrontmatter(content);

	if (settings.excludeCodeFencesFromWordCount) {
		text = stripCodeFences(text);
	}

	if (settings.excludeInlineCodeFromWordCount) {
		text = stripInlineCodeSpans(text);
	}

	text = text.replace(/!\[\[([^[\]]+)\]\]/gu, " ");
	text = text.replace(/\[\[([^[\]]+)\]\]/gu, (_fullMatch, inner: string) => ` ${getWikiLinkAliasText(inner)} `);
	text = text.replace(/!?\[([^\]]*)\]\([^)]+\)/gu, (_fullMatch, label: string) => ` ${label} `);
	text = stripBlockquoteMarkers(text);
	text = stripStructuralMarkdownMarkers(text);

	return text.replace(/\u00a0/gu, " ").trim();
}

function resolveDateValue(
	file: TFile,
	lookup: FrontmatterLookupResult,
	dateKind: "created" | "updated",
): DateResolution {
	if (lookup.found) {
		const parsedFrontmatterValue = parseTimestampValue(lookup.value);
		if (parsedFrontmatterValue) {
			return {
				value: parsedFrontmatterValue,
				source: "frontmatter",
				issue: null,
			};
		}

		return {
			value: resolveFilesystemTimestamp(file, dateKind),
			source: dateKind === "created" ? "filesystem-ctime" : "filesystem-mtime",
			issue: "invalid",
		};
	}

	const fallbackValue = resolveFilesystemTimestamp(file, dateKind);
	return {
		value: fallbackValue,
		source: fallbackValue ? (dateKind === "created" ? "filesystem-ctime" : "filesystem-mtime") : "unresolved",
		issue: "missing",
	};
}

function findFrontmatterValue(
	frontmatter: Record<string, unknown> | null | undefined,
	key: string,
): FrontmatterLookupResult {
	if (!frontmatter || key.trim().length === 0) {
		return {
			found: false,
			value: null,
		};
	}

	const normalizedKey = key.trim().toLocaleLowerCase();
	for (const [frontmatterKey, frontmatterValue] of Object.entries(frontmatter)) {
		if (frontmatterKey.toLocaleLowerCase() === normalizedKey) {
			return {
				found: true,
				value: frontmatterValue,
			};
		}
	}

	return {
		found: false,
		value: null,
	};
}

function parseTimestampValue(value: unknown): NormalizedTimestamp | null {
	if (value instanceof Date && !Number.isNaN(value.getTime())) {
		return normalizeDate(value, "datetime");
	}

	if (typeof value !== "string") {
		return null;
	}

	const trimmedValue = value.trim();
	if (trimmedValue.length === 0) {
		return null;
	}

	const match = trimmedValue.match(
		/^(\d{4})-(\d{2})-(\d{2})(?:[Tt ](\d{2}):(\d{2})(?::(\d{2}))?)?$/u,
	);

	if (!match) {
		return null;
	}

	const year = Number(match[1]);
	const month = Number(match[2]);
	const day = Number(match[3]);
	const hasExplicitTime = match[4] !== undefined && match[5] !== undefined;
	const hour = Number(match[4] ?? "0");
	const minute = Number(match[5] ?? "0");
	const second = Number(match[6] ?? "0");

	const date = new Date(year, month - 1, day, hour, minute, second, 0);
	if (
		date.getFullYear() !== year ||
		date.getMonth() !== month - 1 ||
		date.getDate() !== day ||
		date.getHours() !== hour ||
		date.getMinutes() !== minute ||
		date.getSeconds() !== second
	) {
		return null;
	}

	return normalizeDate(date, hasExplicitTime ? "datetime" : "date");
}

function resolveFilesystemTimestamp(
	file: TFile,
	dateKind: "created" | "updated",
): NormalizedTimestamp | null {
	const timestamp = dateKind === "created" ? file.stat.ctime : file.stat.mtime;
	if (!Number.isFinite(timestamp) || timestamp <= 0) {
		return null;
	}

	return normalizeDate(new Date(timestamp), "datetime");
}

function normalizeDate(date: Date, precision: TimestampPrecision): NormalizedTimestamp {
	const year = date.getFullYear();
	const month = date.getMonth() + 1;
	const day = date.getDate();
	const hour = date.getHours();
	const minute = date.getMinutes();

	return {
		normalizedLocal: buildNormalizedLocalLabel(year, month, day, hour, minute, precision),
		precision,
		year,
		month,
		day,
		hour,
		minute,
		weekday: date.getDay(),
		epochMillis: date.getTime(),
	};
}

function buildNormalizedLocalLabel(
	year: number,
	month: number,
	day: number,
	hour: number,
	minute: number,
	precision: TimestampPrecision,
): string {
	const dateLabel = `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-${day
		.toString()
		.padStart(2, "0")}`;

	if (precision === "date") {
		return dateLabel;
	}

	return `${dateLabel}T${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
}

function stripYamlFrontmatter(content: string): string {
	if (!content.startsWith("---")) {
		return content;
	}

	const normalizedContent = content.replace(/\r\n/gu, "\n");
	const frontmatterMatch = normalizedContent.match(/^---\n[\s\S]*?\n---\n?/u);
	return frontmatterMatch ? normalizedContent.slice(frontmatterMatch[0].length) : normalizedContent;
}

function stripCodeFences(content: string): string {
	const lines = content.replace(/\r\n/gu, "\n").split("\n");
	const keptLines: string[] = [];
	let activeFence: { char: string; length: number } | null = null;

	for (const line of lines) {
		const fenceMatch = line.match(/^\s*(`{3,}|~{3,})/u);
		if (fenceMatch) {
			const fence = fenceMatch[1];
			if (!fence) {
				continue;
			}
			if (!activeFence) {
				activeFence = {
					char: fence.charAt(0),
					length: fence.length,
				};
				continue;
			}

			if (fence[0] === activeFence.char && fence.length >= activeFence.length) {
				activeFence = null;
				continue;
			}
		}

		if (!activeFence) {
			keptLines.push(line);
		}
	}

	return keptLines.join("\n");
}

function stripInlineCodeSpans(content: string): string {
	let result = "";
	let index = 0;

	while (index < content.length) {
		if (content[index] !== "`") {
			result += content[index];
			index += 1;
			continue;
		}

		const fenceLength = countRepeatedCharacter(content, index, "`");
		const closingIndex = findClosingInlineCodeFence(content, index + fenceLength, fenceLength);

		if (closingIndex === -1) {
			result += content[index];
			index += 1;
			continue;
		}

		result += " ";
		index = closingIndex + fenceLength;
	}

	return result;
}

function stripBlockquoteMarkers(content: string): string {
	return content.replace(/^[\t ]{0,3}(?:>\s*)+/gmu, "");
}

function stripStructuralMarkdownMarkers(content: string): string {
	return content
		.replace(/^[\t ]{0,3}#{1,6}[\t ]+/gmu, "")
		.replace(/^[\t ]{0,3}(?:[-+*]|\d+[.)])[\t ]+(?:\[(?: |x|X)\][\t ]+)?/gmu, "")
		.replace(/^[\t ]*\[![^\]\n]+\][+-]?[\t ]*/gmu, "")
		.replace(/^[\t ]*\|?(?:[\t ]*:?-{3,}:?[\t ]*\|)+[\t ]*$/gmu, " ")
		.replace(/^[\t ]{0,3}(?:-{3,}|\*{3,}|_{3,})[\t *-_]*$/gmu, " ")
		.replace(/\|/gu, " ");
}

function countRepeatedCharacter(content: string, startIndex: number, character: string): number {
	let length = 0;

	while (content[startIndex + length] === character) {
		length += 1;
	}

	return length;
}

function findClosingInlineCodeFence(content: string, startIndex: number, fenceLength: number): number {
	for (let index = startIndex; index < content.length; index += 1) {
		if (content[index] === "\n") {
			return -1;
		}

		if (content[index] !== "`") {
			continue;
		}

		const candidateLength = countRepeatedCharacter(content, index, "`");
		if (candidateLength === fenceLength) {
			return index;
		}
	}

	return -1;
}

function getWikiLinkAliasText(inner: string): string {
	const aliasDelimiterIndex = inner.indexOf("|");
	if (aliasDelimiterIndex === -1) {
		return "";
	}

	return inner.slice(aliasDelimiterIndex + 1).trim();
}

export function isFilesystemFallbackSource(source: DateValueSource): boolean {
	return source === "filesystem-ctime" || source === "filesystem-mtime";
}

export function hasDateIssue(issue: FrontmatterDateIssueKind | null): boolean {
	return issue === "missing" || issue === "invalid";
}

function isStandaloneSeparatorToken(token: string): boolean {
	return /^[-\u2013\u2014]+$/u.test(token);
}

function extractNormalizedTags(
	frontmatter: Record<string, unknown> | null | undefined,
	settings: Pick<DiaryStatsSettings, "hierarchicalTagMode" | "ignoredTags" | "tagAliasMap">,
): string[] {
	const tagLookup = findFrontmatterValue(frontmatter, "tags");
	if (!tagLookup.found) {
		return [];
	}

	const ignoredTags = new Set(
		settings.ignoredTags
			.map((tag) => normalizeTagValue(tag, settings.hierarchicalTagMode))
			.filter((tag) => tag.length > 0),
	);
	const aliasMap = new Map(
		Object.entries(settings.tagAliasMap)
			.map(([source, target]) => [
				normalizeTagValue(source, settings.hierarchicalTagMode),
				normalizeTagValue(target, settings.hierarchicalTagMode),
			] as const)
			.filter(([source, target]) => source.length > 0 && target.length > 0),
	);

	const normalizedTags = new Set<string>();
	for (const rawTag of collectRawTags(tagLookup.value)) {
		const normalizedTag = normalizeTagValue(rawTag, settings.hierarchicalTagMode);
		if (normalizedTag.length === 0) {
			continue;
		}

		const aliasedTag = aliasMap.get(normalizedTag) ?? normalizedTag;
		if (ignoredTags.has(aliasedTag)) {
			continue;
		}

		normalizedTags.add(aliasedTag);
	}

	return [...normalizedTags].sort((left, right) => left.localeCompare(right));
}

function collectRawTags(value: unknown): string[] {
	if (typeof value === "string") {
		return splitTagString(value);
	}

	if (Array.isArray(value)) {
		return value.flatMap((item) => collectRawTags(item));
	}

	return [];
}

function splitTagString(value: string): string[] {
	const trimmedValue = value.trim();
	if (trimmedValue.length === 0) {
		return [];
	}

	if (trimmedValue.startsWith("[") && trimmedValue.endsWith("]")) {
		return trimmedValue
			.slice(1, -1)
			.split(",")
			.map((item) => item.trim())
			.filter((item) => item.length > 0);
	}

	if (trimmedValue.includes(",")) {
		return trimmedValue
			.split(",")
			.map((item) => item.trim())
			.filter((item) => item.length > 0);
	}

	return [trimmedValue];
}

export function normalizeTagValue(value: string, hierarchicalTagMode: DiaryStatsSettings["hierarchicalTagMode"]): string {
	const trimmedValue = value
		.trim()
		.replace(/^#+/u, "")
		.replace(/\\/gu, "/")
		.replace(/\s+/gu, " ")
		.toLocaleLowerCase();
	if (trimmedValue.length === 0) {
		return "";
	}

	if (hierarchicalTagMode === "leaf") {
		return (
			trimmedValue
				.split("/")
				.map((segment) => segment.trim())
				.filter((segment) => segment.length > 0)
				.pop() ?? ""
		);
	}

	return trimmedValue
		.split("/")
		.map((segment) => segment.trim())
		.filter((segment) => segment.length > 0)
		.join("/");
}
