import type { CzechNormalizedTextFeatures } from "../types";

const CZECH_STOPWORDS = new Set([
	"a",
	"aby",
	"aj",
	"ale",
	"ani",
	"ano",
	"asi",
	"az",
	"bez",
	"by",
	"byl",
	"byla",
	"byli",
	"bylo",
	"byt",
	"co",
	"do",
	"ho",
	"i",
	"ja",
	"jak",
	"jako",
	"je",
	"jeho",
	"jej",
	"jejich",
	"jemu",
	"jen",
	"jenom",
	"jeste",
	"ji",
	"jich",
	"jimi",
	"jinak",
	"jine",
	"jsem",
	"jsi",
	"jsme",
	"jsou",
	"k",
	"kam",
	"kde",
	"kdo",
	"kdy",
	"ktera",
	"ktere",
	"kteri",
	"ktery",
	"ma",
	"mate",
	"me",
	"mezi",
	"mi",
	"mit",
	"mu",
	"my",
	"na",
	"nad",
	"nam",
	"nas",
	"nasi",
	"ne",
	"nebo",
	"nebyl",
	"nebyla",
	"neco",
	"nejak",
	"nejen",
	"neni",
	"nez",
	"nic",
	"nich",
	"nim",
	"nimi",
	"no",
	"novy",
	"o",
	"od",
	"on",
	"ona",
	"oni",
	"ono",
	"po",
	"pod",
	"podle",
	"pokud",
	"pro",
	"proc",
	"pred",
	"pres",
	"pri",
	"s",
	"se",
	"si",
	"smi",
	"snad",
	"tak",
	"take",
	"takhle",
	"taky",
	"tam",
	"ten",
	"tento",
	"teprve",
	"tedy",
	"teho",
	"to",
	"tohle",
	"tom",
	"tomto",
	"totiz",
	"toto",
	"tu",
	"tuhle",
	"tuto",
	"tvuj",
	"ty",
	"u",
	"uz",
	"v",
	"vam",
	"vas",
	"vasi",
	"ve",
	"vice",
	"vsak",
	"vy",
	"za",
	"zase",
	"zda",
	"ze",
	"zpet",
	"zrovna",
	"the",
	"and",
	"or",
	"to",
	"of",
	"in",
	"on",
	"for",
	"with",
	"is",
	"are",
	"was",
	"were",
	"be",
	"been",
	"being",
	"that",
	"this",
	"it",
]);

const CZECH_SUFFIXES = [
	"oveho",
	"ovemu",
	"ovych",
	"ovymi",
	"kami",
	"temi",
	"tami",
	"tosti",
	"nosti",
	"ech",
	"ich",
	"ych",
	"ami",
	"emi",
	"ove",
	"ovi",
	"ova",
	"ost",
	"osti",
	"ani",
	"eni",
	"aci",
	"ace",
	"ovat",
	"ovat",
	"kou",
	"kem",
	"ami",
	"emi",
	"ove",
	"ovi",
	"ach",
	"ech",
	"ych",
	"ich",
	"ku",
	"ka",
	"ky",
	"ou",
	"at",
	"it",
	"et",
	"em",
	"om",
	"am",
	"ym",
	"im",
	"ho",
	"mu",
];

export function buildCzechNormalizedTextFeatures(
	normalizedTokens: string[],
	entityCandidates: string[] = [],
): CzechNormalizedTextFeatures {
	const normalizedScopeTokens = normalizedTokens
		.map((token) => normalizeForCzechAnalysis(token))
		.filter((token): token is string => token !== null);
	const contentTokens = normalizedScopeTokens
		.map((token) => toContentKey(token))
		.filter((token): token is string => token !== null);
	const contentFrequencies = new Map<string, number>();

	for (const token of contentTokens) {
		contentFrequencies.set(token, (contentFrequencies.get(token) ?? 0) + 1);
	}

	return {
		normalizedTokenCount: normalizedScopeTokens.length,
		contentTokenCount: contentTokens.length,
		contentVocabulary: [...new Set(contentTokens)].sort((left, right) => left.localeCompare(right)),
		contentFrequencies: Object.fromEntries(
			[...contentFrequencies.entries()].sort(([left], [right]) => left.localeCompare(right)),
		),
		entityCandidates: [...new Set(entityCandidates)].sort((left, right) => left.localeCompare(right)),
	};
}

export function normalizeForCzechAnalysis(token: string): string | null {
	const normalizedToken = token
		.toLocaleLowerCase()
		.normalize("NFD")
		.replace(/\p{M}+/gu, "")
		.replace(/['’`]/gu, "")
		.trim();

	return normalizedToken.length > 0 ? normalizedToken : null;
}

function toContentKey(token: string): string | null {
	if (token.length < 3 || /^\d+$/u.test(token) || !/[a-z]/u.test(token)) {
		return null;
	}

	if (CZECH_STOPWORDS.has(token)) {
		return null;
	}

	const strippedToken = stripCommonCzechSuffix(token);
	if (strippedToken.length < 3 || CZECH_STOPWORDS.has(strippedToken)) {
		return null;
	}

	return strippedToken;
}

export function stripCommonCzechSuffix(token: string): string {
	if (token.length < 6) {
		return token;
	}

	for (const suffix of CZECH_SUFFIXES) {
		if (token.endsWith(suffix) && token.length - suffix.length >= 4) {
			return token.slice(0, -suffix.length);
		}
	}

	return token;
}
