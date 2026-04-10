import React from "react";
import { cn } from "@/lib/utils";
import type {
	BusinessSearchResult,
	SelectedBusiness,
} from "@/types/test-workflow";

import { Skeleton } from "@/ui/skeleton";

interface BusinessSearchDropdownProps {
	results: BusinessSearchResult[];
	selectedBusinesses: SelectedBusiness[];
	isLoading: boolean;
	onAddBusiness: (business: BusinessSearchResult) => void;
	maxSelections: number;
}

export const BusinessSearchDropdown: React.FC<BusinessSearchDropdownProps> = ({
	results,
	selectedBusinesses,
	isLoading,
	onAddBusiness,
	maxSelections,
}) => {
	const selectedIds = new Set(selectedBusinesses.map((b) => b.id));
	const isMaxReached = selectedBusinesses.length >= maxSelections;

	if (isLoading) {
		return (
			<div className="max-h-64 overflow-y-auto">
				<div className="p-4 space-y-4">
					{[1, 2, 3].map((i) => (
						<div key={i} className="flex items-center justify-between">
							<div className="space-y-2">
								<Skeleton className="h-4 w-40" />
								<Skeleton className="h-3 w-24" />
							</div>
							<Skeleton className="h-8 w-16 rounded-md" />
						</div>
					))}
				</div>
			</div>
		);
	}

	if (results.length === 0) {
		return null;
	}

	return (
		<div className="max-h-64 overflow-y-auto">
			{results.map((business) => {
				const isAlreadySelected = selectedIds.has(business.id);

				return (
					<div
						key={business.id}
						className="flex items-center justify-between px-4 py-3 border-b border-gray-100 last:border-b-0"
					>
						<div>
							<p className="text-sm font-semibold text-gray-900">
								{business.name}
							</p>
							<p className="text-sm text-gray-500">{business.location}</p>
						</div>
						{isAlreadySelected ? (
							<span className="px-4 py-2 text-sm font-medium text-gray-400">
								Added
							</span>
						) : (
							<button
								type="button"
								onClick={() => {
									onAddBusiness(business);
								}}
								disabled={isMaxReached}
								className={cn(
									"px-4 py-2 text-sm font-medium rounded-md border transition-colors",
									isMaxReached
										? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
										: "bg-white text-gray-700 border-gray-300 hover:bg-gray-50 hover:border-gray-400",
								)}
							>
								+ Add
							</button>
						)}
					</div>
				);
			})}
		</div>
	);
};
