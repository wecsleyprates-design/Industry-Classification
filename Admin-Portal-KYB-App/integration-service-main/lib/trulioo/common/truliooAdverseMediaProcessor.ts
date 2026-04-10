import type { TruliooWatchlistHit } from "./types";
import type { AdverseMediaResponse } from "#api/v1/modules/adverse-media/types";
import { logger } from "#helpers/logger";
import type { UUID } from "crypto";

interface ScoredArticle {
	title: string;
	link: string;
	date: string | null;
	source: string;
	keywordsScore: number;
	negativeSentimentScore: number;
	entityFocusScore: number;
	finalScore: number;
	riskLevel: "LOW" | "MEDIUM" | "HIGH";
	riskDescription: string;
	mediaType: string;
}

interface TruliooAdverseMediaProcessorDeps {
	scoreAdverseMedia: (title: string, entityNames: string[], individuals: string[]) => Promise<{
		keywordsScore?: number;
		negativeSentimentScore?: number;
		entityFocusScore?: number;
		finalScore?: number;
		riskLevel?: string;
		description?: string;
		mediaType?: string;
		individuals?: string[];
	} | undefined>;
	insertAdverseMedia: (businessId: UUID, taskId: UUID, data: AdverseMediaResponse) => Promise<void>;
}

const TITLE_CASE_MINOR_WORDS = new Set([
	"a", "an", "the", "and", "but", "or", "for", "nor",
	"on", "at", "to", "in", "of", "by", "with", "from", "as", "is", "vs"
]);

/**
 * Converts a lowercase slug string to Title Case.
 * Minor words (articles, prepositions) stay lowercase unless they are the first word.
 */
export function toTitleCase(str: string): string {
	return str
		.split(" ")
		.map((word, i) => {
			if (word.length === 0) return word;
			if (i > 0 && TITLE_CASE_MINOR_WORDS.has(word.toLowerCase())) {
				return word.toLowerCase();
			}
			return word.charAt(0).toUpperCase() + word.slice(1);
		})
		.join(" ");
}

/**
 * Derives a human-readable title from a URL slug.
 * Trulioo ADVERSE_MEDIA hits only provide generic listName ("Adverse Media"),
 * but the URL slug often contains the real article headline.
 *
 * Returns null when the slug is too short or the URL is unparseable.
 */
export function extractTitleFromUrl(url: string): string | null {
	try {
		const parsed = new URL(url);
		const segments = parsed.pathname.split("/").filter(Boolean);
		if (segments.length === 0) return null;
		let slug = segments[segments.length - 1];
		slug = slug.replace(/\.\w+$/, "");
		slug = slug.replace(/-[a-z]?\d{5,}$/, "");
		slug = slug.replace(/[-_]/g, " ").trim();
		if (slug.length < 10) return null;
		return toTitleCase(slug);
	} catch {
		return null;
	}
}

/**
 * Extracts a formatted publication name from a URL domain.
 * Strips www prefix, removes TLD (.com, .co.uk, etc.), and applies Title Case.
 * e.g. "https://www.cbsnews.com/..." -> "Cbsnews"
 *      "https://www.belfasttelegraph.co.uk/..." -> "Belfasttelegraph"
 */
export function extractSourceFromUrl(url: string): string | null {
	try {
		const hostname = new URL(url).hostname.replace(/^www\./, "");
		const name = hostname.replace(/\.co\.\w+$|\.com$|\.org$|\.net$|\.io$|\.gov$|\.edu$|\.info$/, "");
		if (!name) return hostname;
		return toTitleCase(name);
	} catch {
		return null;
	}
}

/**
 * Extracts ADVERSE_MEDIA hits from Trulioo watchlist results, scores each with OpenAI,
 * and persists them into the adverse_media / adverse_media_articles tables.
 *
 * If scoring fails for a specific article, that article is skipped (not persisted)
 * following the same pattern as the SerpAPI adverse media flow.
 */
export async function processAndPersistTruliooAdverseMedia(params: {
	watchlistHits: TruliooWatchlistHit[];
	businessId: string;
	taskId: string;
	entityNames: string[];
	individuals: string[];
	deps: TruliooAdverseMediaProcessorDeps;
}): Promise<number> {
	const { watchlistHits, businessId, taskId, entityNames, individuals, deps } = params;

	const adverseMediaHits = watchlistHits.filter(
		hit => (hit.listType ?? "").toUpperCase() === "ADVERSE_MEDIA"
	);

	if (adverseMediaHits.length === 0) {
		return 0;
	}

	logger.info({
		businessId,
		taskId,
		adverseMediaCount: adverseMediaHits.length
	}, "Processing Trulioo adverse media hits for scoring and persistence");

	const scoredArticles: ScoredArticle[] = [];

	for (const hit of adverseMediaHits) {
		const rawTitle = hit.listName || hit.matchDetails || "";
		if (!rawTitle) {
			logger.warn({ businessId, listType: hit.listType }, "Skipping adverse media hit with no title/listName");
			continue;
		}

		const urlTitle = hit.url ? extractTitleFromUrl(hit.url) : null;
		const isGenericTitle = rawTitle.toLowerCase() === "adverse media";
		const title = (isGenericTitle && urlTitle) ? urlTitle : rawTitle;

		try {
			const riskScore = await deps.scoreAdverseMedia(title, entityNames, individuals);

			if (!riskScore) {
				logger.warn({ title }, "OpenAI scoring returned empty result, skipping article");
				continue;
			}

			const article: ScoredArticle = {
				title,
				link: hit.url || `trulioo://${hit.listType}/${hit.listName || "unknown"}`,
				date: null,
				source: hit.sourceAgencyName || (hit.url ? extractSourceFromUrl(hit.url) : null) || "Trulioo Watchlist",
				keywordsScore: riskScore.keywordsScore || 0,
				negativeSentimentScore: riskScore.negativeSentimentScore || 0,
				entityFocusScore: riskScore.entityFocusScore || 0,
				finalScore: riskScore.finalScore || 0,
				riskLevel: (riskScore.riskLevel as "LOW" | "MEDIUM" | "HIGH") || "LOW",
				riskDescription: riskScore.description || "",
				mediaType: riskScore.mediaType || "business"
			};

			const individualsList = riskScore.individuals || [];
			if (individualsList.length > 0) {
				for (const individualName of individualsList) {
					scoredArticles.push({ ...article, mediaType: individualName.toLowerCase() });
				}
			} else {
				scoredArticles.push(article);
			}
		} catch (error) {
			logger.error({ err: error, title }, "OpenAI scoring failed for adverse media article, skipping");
		}
	}

	if (scoredArticles.length === 0) {
		logger.info({ businessId }, "No adverse media articles scored successfully, nothing to persist");
		return 0;
	}

	// Deduplicate by (link, mediaType) to match the DB UNIQUE constraint on (link, business_id, media_type).
	// PostgreSQL rejects batch INSERTs with ON CONFLICT DO UPDATE when the same conflict target appears twice.
	const seen = new Set<string>();
	const uniqueArticles = scoredArticles.filter(article => {
		const key = `${article.link}::${article.mediaType}`;
		if (seen.has(key)) return false;
		seen.add(key);
		return true;
	});

	if (uniqueArticles.length < scoredArticles.length) {
		logger.info({
			businessId,
			before: scoredArticles.length,
			after: uniqueArticles.length
		}, "Deduplicated adverse media articles by (link, mediaType)");
	}

	const adverseMediaData: AdverseMediaResponse = {
		articles: uniqueArticles as AdverseMediaResponse["articles"],
		total_risk_count: uniqueArticles.length,
		high_risk_count: uniqueArticles.filter(a => a.riskLevel === "HIGH").length,
		medium_risk_count: uniqueArticles.filter(a => a.riskLevel === "MEDIUM").length,
		low_risk_count: uniqueArticles.filter(a => a.riskLevel === "LOW").length,
		average_risk_score: uniqueArticles.length > 0
			? Number((uniqueArticles.reduce((sum, a) => sum + a.finalScore, 0) / uniqueArticles.length).toFixed(2))
			: 0
	};

	try {
		await deps.insertAdverseMedia(businessId as UUID, taskId as UUID, adverseMediaData);
		logger.info({
			businessId,
			taskId,
			articlesCount: uniqueArticles.length
		}, "Trulioo adverse media articles scored and persisted successfully");
	} catch (error) {
		logger.error({ err: error, businessId }, "Failed to persist Trulioo adverse media articles");
	}

	return uniqueArticles.length;
}
