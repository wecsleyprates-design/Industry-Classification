import React from "react";

export interface PaginationHintProps {
	currentPage: number;
	totalItems: number;
	itemsPerPage?: number;
	isLoading: boolean;
	hasValidData: boolean;
}

export const PaginationHint: React.FC<PaginationHintProps> = ({
	currentPage,
	totalItems,
	itemsPerPage = 10,
	isLoading,
	hasValidData,
}) => {
	// Helper function to display results
	const getResultsDisplay = (): string => {
		if (totalItems === 0) {
			return "No results to display";
		}

		const startItem = (currentPage - 1) * itemsPerPage + 1;
		const endItem = Math.min(currentPage * itemsPerPage, totalItems);

		return `Showing ${startItem} to ${endItem} of ${totalItems} results`;
	};

	if (!hasValidData || isLoading) {
		return null;
	}

	return <span className="text-sm text-gray-600">{getResultsDisplay()}</span>;
};
