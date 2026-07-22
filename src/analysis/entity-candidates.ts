import { normalizeForCzechAnalysis, stripCommonCzechSuffix } from "./czech-normalization";

const ENTITY_STOPWORDS = new Set([
	"a",
	"aby",
	"ach",
	"ah",
	"ale",
	"ani",
	"ano",
	"asi",
	"az",
	"bez",
	"bohuzel",
	"boze",
	"by",
	"byl",
	"byla",
	"byli",
	"bylo",
	"co",
	"dalsi",
	"diky",
	"dnes",
	"do",
	"dr",
	"hej",
	"ho",
	"i",
	"ja",
	"jak",
	"jako",
	"je",
	"jeho",
	"jej",
	"jejich",
	"jen",
	"jeste",
	"jsem",
	"jsi",
	"jsme",
	"jsou",
	"kam",
	"kde",
	"kdo",
	"kdy",
	"leden",
	"ledna",
	"letos",
	"listopad",
	"listopadu",
	"mam",
	"mame",
	"mate",
	"me",
	"mezitim",
	"mi",
	"mu",
	"my",
	"na",
	"nad",
	"nam",
	"nas",
	"ne",
	"nedele",
	"nejen",
	"neni",
	"nez",
	"nic",
	"noc",
	"on",
	"ona",
	"oni",
	"ono",
	"pan",
	"pani",
	"patek",
	"po",
	"pod",
	"pondeli",
	"potom",
	"pred",
	"proc",
	"proto",
	"pry",
	"rano",
	"rijen",
	"rijna",
	"s",
	"se",
	"si",
	"sobota",
	"srpen",
	"srpna",
	"streda",
	"strevda",
	"tak",
	"take",
	"taky",
	"tam",
	"te",
	"ted",
	"teda",
	"ten",
	"tentokrat",
	"tento",
	"to",
	"tohle",
	"tom",
	"u",
	"unor",
	"unora",
	"utery",
	"uz",
	"v",
	"ve",
	"vecer",
	"vcera",
	"vsak",
	"za",
	"zacatek",
	"zari",
	"zarij",
	"zitra",
]);

const ENTITY_INFLECTION_SUFFIXES = [
	"ovych",
	"ovymi",
	"oveho",
	"ovemu",
	"kami",
	"tami",
	"temi",
	"osti",
	"ovou",
	"ovym",
	"ovim",
	"ech",
	"ich",
	"ych",
	"ami",
	"emi",
	"ove",
	"ovi",
	"ova",
	"ino",
	"ina",
	"iny",
	"ou",
	"em",
	"om",
	"am",
	"im",
	"ym",
	"ho",
	"mu",
	"u",
	"y",
	"i",
	"a",
	"e",
	"o",
];

const ENTITY_MULTIWORD_LEAD_BLACKLIST = new Set([
	"ma",
	"mam",
	"mas",
	"mame",
	"mate",
	"maji",
	"vola",
	"volal",
	"volala",
	"pise",
	"psal",
	"psala",
	"rika",
	"rikal",
	"rikala",
	"rekl",
	"rekla",
	"naha",
	"nahy",
	"nahou",
]);

interface EntityToken {
	value: string;
}

export function extractEntityCandidates(text: string): string[] {
	const candidates = new Map<string, string>();
	const segments = text
		.replace(/\r\n/gu, "\n")
		.split(/[.!?…]+\s*|\n+/u)
		.map((segment) => segment.trim())
		.filter((segment) => segment.length > 0);

	for (const segment of segments) {
		const tokens = extractEntityTokens(segment);
		for (let index = 0; index < tokens.length; index += 1) {
			const token = tokens[index];
			if (!token || !isPotentialEntityToken(token.value)) {
				continue;
			}

			let runEnd = index + 1;
			while (runEnd < tokens.length && isPotentialEntityToken(tokens[runEnd]?.value ?? "")) {
				runEnd += 1;
			}

			const runTokens = tokens.slice(index, runEnd).map((entry) => cleanSurfaceToken(entry.value));
			if (runTokens.length >= 2) {
				const candidate = runTokens.join(" ");
				if (isUsefulEntityCandidate(candidate, true)) {
					const key = normalizeEntityCandidateKey(candidate);
					if (!candidates.has(key)) {
						candidates.set(key, candidate);
					}
				} else if (isBlacklistedEntityLeadToken(runTokens[0] ?? "")) {
					const tailCandidate = runTokens.slice(1).join(" ");
					const isTailMultiWord = runTokens.length - 1 >= 2;
					if (tailCandidate && isUsefulEntityCandidate(tailCandidate, isTailMultiWord)) {
						const tailKey = normalizeEntityCandidateKey(tailCandidate);
						if (!candidates.has(tailKey)) {
							candidates.set(tailKey, tailCandidate);
						}
					}
				}
			} else if (index > 0) {
				const candidate = runTokens[0] ?? "";
				if (isUsefulEntityCandidate(candidate, false)) {
					const key = normalizeEntityCandidateKey(candidate);
					if (!candidates.has(key)) {
						candidates.set(key, candidate);
					}
				}
			}

			index = runEnd - 1;
		}
	}

	return [...candidates.values()].sort((left, right) => left.localeCompare(right));
}

export function normalizeEntityCandidateKey(value: string): string {
	return value
		.split(/\s+/u)
		.map((token) => normalizeEntityTokenKey(token))
		.filter((token) => token.length > 0)
		.join(" ")
		.trim();
}

function extractEntityTokens(segment: string): EntityToken[] {
	return [...segment.matchAll(/\p{L}+(?:[.'’`-]\p{L}+)*/gu)].map((match) => ({
		value: match[0],
	}));
}

function isPotentialEntityToken(value: string): boolean {
	const cleaned = cleanSurfaceToken(value);
	if (cleaned.length < 2 || /^\d+$/u.test(cleaned)) {
		return false;
	}

	return /^[\p{Lu}][\p{L}'’`-]*$/u.test(cleaned);
}

function cleanSurfaceToken(value: string): string {
	return value.replace(/[.]+$/u, "").trim();
}

function isUsefulEntityCandidate(value: string, isMultiWord: boolean): boolean {
	const tokens = value.split(/\s+/u).map((token) => cleanSurfaceToken(token)).filter((token) => token.length > 0);
	if (tokens.length === 0) {
		return false;
	}

	if (!isMultiWord && (tokens[0]?.length ?? 0) < 3) {
		return false;
	}

	if (isMultiWord && isBlacklistedEntityLeadToken(tokens[0] ?? "")) {
		return false;
	}

	for (const token of tokens) {
		const normalized = normalizeEntityCandidateKey(token);
		if (normalized.length < 2 || ENTITY_STOPWORDS.has(normalized)) {
			return false;
		}
	}

	return true;
}

function isBlacklistedEntityLeadToken(token: string): boolean {
	const rawNormalized = normalizeForCzechAnalysis(token);
	if (!rawNormalized) {
		return false;
	}

	if (ENTITY_MULTIWORD_LEAD_BLACKLIST.has(rawNormalized)) {
		return true;
	}

	return ENTITY_MULTIWORD_LEAD_BLACKLIST.has(stripCommonCzechSuffix(rawNormalized));
}

function normalizeEntityTokenKey(value: string): string {
	const normalized = normalizeForCzechAnalysis(
		value.replace(/['’`".,;:!?()[\]{}]+/gu, "").trim(),
	);
	if (!normalized) {
		return "";
	}

	const collapsedForeignVariant = collapseForeignEntityVariant(normalized);
	const collapsedPossessive = collapsePossessiveEntityForm(collapsedForeignVariant);
	const collapsedSpecialCase = collapseSpecialEntityCaseForm(collapsedPossessive);
	const trimmedByCommonSuffix = stripCommonCzechSuffix(collapsedSpecialCase);
	const trimmedByEntitySuffix = stripEntityInflectionSuffix(trimmedByCommonSuffix);
	return trimmedByEntitySuffix.length > 0 ? trimmedByEntitySuffix : collapsedSpecialCase;
}

function collapseForeignEntityVariant(token: string): string {
	return token.replace(/^th/u, "t");
}

function collapsePossessiveEntityForm(token: string): string {
	if (/cin[a-z]*$/u.test(token)) {
		const stem = token.replace(/cin[a-z]*$/u, "");
		if (stem.length >= 3) {
			return `${stem}k`;
		}
	}

	return token;
}

function collapseSpecialEntityCaseForm(token: string): string {
	if (token.length < 4) {
		return token;
	}

	for (const suffix of ["kou", "ka", "ky", "ku"]) {
		if (token.endsWith(suffix) && token.length - suffix.length >= 3) {
			return `${token.slice(0, -suffix.length)}k`;
		}
	}

	if (
		(token.endsWith("ce") || token.endsWith("ci") || token.endsWith("cu") || token.endsWith("cy")) &&
		token.length >= 5 &&
		!/[aeiouy]$/u.test(token.slice(0, -2))
	) {
		return `${token.slice(0, -2)}k`;
	}

	return token;
}

function stripEntityInflectionSuffix(token: string): string {
	if (token.length < 4) {
		return token;
	}

	for (const suffix of ENTITY_INFLECTION_SUFFIXES) {
		if (token.endsWith(suffix) && token.length - suffix.length >= 3) {
			return token.slice(0, -suffix.length);
		}
	}

	return token;
}
