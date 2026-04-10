import { type WatchlistValueMetadatum } from "@/types/integrations";
import { type WatchlistHitItemProps } from "../components/WatchlistHitItem";

export const mapWatchlistValueMetadatumToWatchlistHitItemProps = (
	record: WatchlistValueMetadatum,
): WatchlistHitItemProps => {
	return {
		list: record.metadata.title,
		agency: record.metadata.agency,
		country: record.list_country ?? undefined,
		url:
			record.url ??
			record.list_url ??
			record.agency_information_url ??
			record.agency_list_url ??
			undefined,
	};
};
