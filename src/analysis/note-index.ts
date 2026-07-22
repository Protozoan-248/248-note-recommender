import { App, TFile } from "obsidian";
import type { NoteRecommendationSettings, NoteIndex, NoteIndexEntry, RecommendationCandidate } from "../types";

export async function buildNoteIndex(app: App, settings: NoteRecommendationSettings): Promise<NoteIndex> {
	const markdownFiles = app.vault.getMarkdownFiles().sort((left, right) => left.path.localeCompare(right.path));
	const entries: NoteIndexEntry[] = [];

	for (const file of markdownFiles) {
		if (!shouldIncludeFile(file, settings)) {
			continue;
		}

		const content = await app.vault.cachedRead(file);
		const frontmatter = app.metadataCache.getFileCache(file)?.frontmatter;
		const tags = extractTags(frontmatter);
		const links = extractWikiLinks(content);

		entries.push({
			path: file.path,
			title: file.basename,
			folder: getFolderPath(file.path),
			tags,
			links,
			mtime: file.stat.mtime,
			size: file.stat.size,
			previewText: content.slice(0, 600),
		});
	}

	return {
		generatedAt: new Date().toISOString(),
		entries,
	};
}

function shouldIncludeFile(file: TFile, settings: NoteRecommendationSettings): boolean {
	if (!settings.enableIndexing) {
		return false;
	}

	if (settings.ignoreHiddenFolders && file.path.split("/").some((segment) => segment.startsWith("."))) {
		return false;
	}

	if (settings.excludeFolders.some((folder) => file.path.startsWith(`${folder}/`) || file.path === folder)) {
		return false;
	}

	return true;
}

function getFolderPath(path: string): string {
	const segments = path.split("/");
	if (segments.length <= 1) {
		return "";
	}
	return segments.slice(0, -1).join("/");
}

function extractTags(frontmatter: Record<string, unknown> | null | undefined): string[] {
	if (!frontmatter || typeof frontmatter !== "object") {
		return [];
	}

	const rawTags = frontmatter.tags;
	if (Array.isArray(rawTags)) {
		return rawTags.filter((tag): tag is string => typeof tag === "string");
	}

	if (typeof rawTags === "string") {
		return [rawTags];
	}

	return [];
}

function extractWikiLinks(content: string): string[] {
	const matches = content.match(/\[\[([^\]]+)\]\]/gu) ?? [];
	return matches
		.map((match) => match.slice(2, -2).trim())
		.filter((value) => value.length > 0)
		.map((value) => value.split("|")[0] ?? value)
		.map((value) => value.split("#")[0] ?? value);
}

export function createEmptyRecommendationCandidate(path: string): RecommendationCandidate {
	return {
		path,
		score: 0,
		reasons: [],
		explanation: "No explanation available yet.",
	};
}
