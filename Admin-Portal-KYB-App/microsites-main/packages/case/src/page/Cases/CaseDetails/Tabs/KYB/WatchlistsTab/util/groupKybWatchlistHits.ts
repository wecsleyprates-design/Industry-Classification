import {
	type WatchlistValue,
	type WatchlistValueMetadatum,
} from "@/types/integrations";

export type GroupedKybWatchlistHits = Record<
	string,
	WatchlistValue["metadata"]
>;

/**
 * Combine and group watchlist hits by business name or person name (case insensitive).
 * The names in the names submitted array and the names in the hits will not necessarily be equivalent;
 * if a name does not appear in the hits, it indicates that there were no watchlist hits for that business name.
 */
export const groupKybWatchlistHits = (
	namesSubmitted: Array<{ name?: string }>,
	hits: WatchlistValueMetadatum[],
) => {
	const groupedHits: GroupedKybWatchlistHits = {};

	namesSubmitted.forEach((name) => {
		const key = name.name?.toUpperCase();
		if (key) groupedHits[key] = [];
	});

	hits.forEach((hit) => {
		const key = hit.metadata?.entity_name?.toUpperCase();
		if (!key) return;
		if (!groupedHits[key]) groupedHits[key] = [];
		groupedHits[key].push(hit);
	});

	return groupedHits;
};
