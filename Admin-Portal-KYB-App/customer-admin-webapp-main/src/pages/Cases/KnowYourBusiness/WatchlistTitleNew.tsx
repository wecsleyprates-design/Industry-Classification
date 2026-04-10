export const WatchlistTitle = ({
	title,
	watchlistHits,
}: {
	title: string;
	watchlistHits:
		| Array<{
				id: string;
				type: string;
				metadata: {
					abbr: string;
					agency: string;
					agency_abbr: string;
					entity_name: string;
					title: string;
				};
		  }>
		| undefined;
}) => {
	const titleExists = watchlistHits?.some(
		(hit) => hit.metadata.title === title,
	);
	const hitCount =
		watchlistHits?.filter((hit) => hit.metadata.title === title).length ?? 0;

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
