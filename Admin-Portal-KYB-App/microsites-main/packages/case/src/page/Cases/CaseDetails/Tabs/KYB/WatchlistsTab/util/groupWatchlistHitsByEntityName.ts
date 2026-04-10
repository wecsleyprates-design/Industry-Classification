import type { WatchlistValueMetadatum } from "@/types/integrations";

export type GroupedWatchlistHitsByEntity = Record<
	string,
	WatchlistValueMetadatum[]
>;

/**
 * Group watchlist hits by entity_name (case insensitive).
 * All hits with the same entity_name will be grouped together.
 * Optionally pre-populates with business names and people names to ensure
 * entities with no hits still appear in the UI.
 */
export const groupWatchlistHitsByEntityName = (
	hits: WatchlistValueMetadatum[],
	businessNames: Array<{ name?: string }>,
	peopleNames: Array<{ name?: string }>,
): GroupedWatchlistHitsByEntity => {
	const groupedHits: GroupedWatchlistHitsByEntity = {};

	// Pre-populate with all scanned entities (business names + people names)
	// This ensures entities with no hits still appear in the UI
	const allScannedEntities = [...businessNames, ...peopleNames];
	allScannedEntities.forEach((entity) => {
		const key = entity.name?.toUpperCase();
		if (key) {
			groupedHits[key] = [];
		}
	});

	// Group all hits by entity_name
	hits.forEach((hit) => {
		const entityName = hit.metadata?.entity_name?.toUpperCase();
		if (!entityName) return;
		if (!groupedHits[entityName]) {
			groupedHits[entityName] = [];
		}
		groupedHits[entityName].push(hit);
	});

	return groupedHits;
};
