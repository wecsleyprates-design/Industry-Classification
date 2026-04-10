import React from "react";
import type { SelectedBusiness } from "@/types/test-workflow";

interface SelectedBusinessesListProps {
	businesses: SelectedBusiness[];
	onRemoveBusiness: (businessId: string) => void;
	maxSelections: number;
}

export const SelectedBusinessesList: React.FC<SelectedBusinessesListProps> = ({
	businesses,
	onRemoveBusiness,
	maxSelections,
}) => {
	if (businesses.length === 0) {
		return null;
	}

	return (
		<div className="mt-6">
			<p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-4">
				Selected Businesses (Can add up to {maxSelections} businesses)
			</p>
			<div>
				{businesses.map((business) => (
					<div
						key={business.id}
						className="flex items-center justify-between py-4 border-b border-gray-100 last:border-b-0"
					>
						<div>
							<p className="text-sm font-semibold text-gray-900">
								{business.name}
							</p>
							<p className="text-sm text-gray-500">{business.location}</p>
						</div>
						<button
							type="button"
							onClick={() => {
								onRemoveBusiness(business.id);
							}}
							className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 hover:border-gray-400 transition-colors"
						>
							Remove
						</button>
					</div>
				))}
			</div>
		</div>
	);
};
