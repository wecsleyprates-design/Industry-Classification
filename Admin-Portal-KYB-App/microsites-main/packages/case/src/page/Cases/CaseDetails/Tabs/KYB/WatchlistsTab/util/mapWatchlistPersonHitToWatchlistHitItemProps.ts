import { type WatchlistPersonResult } from "@/types/businessEntityVerification";
import { type WatchlistHitItemProps } from "../components/WatchlistHitItem";

export const mapWatchlistPersonResultToWatchlistHitItemProps = (
	record: WatchlistPersonResult,
): WatchlistHitItemProps => {
	return {
		list: record.metadata.title,
		agency: record.metadata.agency,
		country: record.list_country,
		url: record.url,
	};
};
