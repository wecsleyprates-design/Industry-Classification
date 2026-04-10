type PaginationDescriptionProps = {
	totalItems?: number | null;
	currentPage: number;
	itemsPerPage: number;
};

export const PaginationDescription: React.FC<PaginationDescriptionProps> = ({
	totalItems,
	currentPage,
	itemsPerPage = 10,
}) => {
	if (totalItems === 0) return "No results to display";

	const start = (currentPage - 1) * itemsPerPage + 1;
	const end = Math.min(currentPage * itemsPerPage, totalItems ?? 10);

	return (
		<div className="text-sm text-gray-500">
			Showing <strong>{start}</strong> to <strong>{end}</strong> of{" "}
			<strong>{totalItems ?? 0}</strong> results
		</div>
	);
};
