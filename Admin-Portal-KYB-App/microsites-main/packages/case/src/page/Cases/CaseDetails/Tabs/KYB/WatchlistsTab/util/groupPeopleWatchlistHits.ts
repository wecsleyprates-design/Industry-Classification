import {
	type WatchlistPerson,
	type WatchlistPersonResult,
} from "@/types/businessEntityVerification";
import { type PeopleObjectValue } from "@/types/integrations";

export type GroupedPeopleWatchlistHits = Record<
	string,
	WatchlistPersonResult[]
>;

/**
 * Combine and group watchlist hits by person name (case insensitive).
 * The names in the people names array and the names in the hits will not necessarily be equivalent;
 * if a name does not appear in the hits, it indicates that there were no watchlist hits for that person.
 */
export const groupPeopleWatchlistHits = (
	peopleNames: PeopleObjectValue[],
	hits: WatchlistPerson[],
) => {
	const groupedHits: GroupedPeopleWatchlistHits = {};

	peopleNames.forEach((name) => {
		const key = name.name?.toUpperCase();
		if (key) groupedHits[key] = [];
	});

	hits.forEach((hit) => {
		const key = hit.name?.toUpperCase();
		if (!key) return;
		if (!groupedHits[key]) groupedHits[key] = [];
		groupedHits[key] = groupedHits[key].concat(hit.watchlist_results);
	});

	return groupedHits;
};
