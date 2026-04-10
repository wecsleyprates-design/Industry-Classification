import { type WatchlistHitDetails } from "@/types/businessEntityVerification";
import { titleExistsInWatchlistHits } from "./helpers";

export const WatchlistTitle = ({
	title,
	watchlistHits,
}: {
	title: string;
	watchlistHits: WatchlistHitDetails[];
}) => {
	const { titleExists, hitCount } = titleExistsInWatchlistHits(
		title,
		watchlistHits,
	);

	return (
		<p
			className={`text-sm py-0.5 ${
				titleExists ? "text-red-600" : "text-gray-700"
			}`}
		>
			{title}{" "}
			{titleExists && (
				<span className="inline-flex items-center gap-x-0.5 mr-1 rounded-md px-2 py-1 text-xs font-medium text-red-600 bg-red-50">
					{hitCount} Hit{hitCount > 1 ? "s" : ""}
				</span>
			)}
		</p>
	);
};
