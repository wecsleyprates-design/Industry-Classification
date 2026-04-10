import React from "react";
import { type SaveStatus } from "../types";

export interface UpdateBadgeProps {
	/** Save status of the field */
	saveStatus: SaveStatus;
	showUpdatedBadge?: boolean;
}

/**
 * Badge component that displays the save status of an editable field.
 * Shows "Updating", "Updated", or "Error" based on the saveStatus prop.
 */
export const UpdateBadge: React.FC<UpdateBadgeProps> = ({
	saveStatus,
	showUpdatedBadge = true,
}) => {
	if (!showUpdatedBadge) return null;
	if (saveStatus === "saving") {
		return (
			<span className="ml-2 text-xs font-medium text-yellow-600 whitespace-nowrap">
				- Updating
			</span>
		);
	}

	if (saveStatus === "saved") {
		return (
			<span className="ml-2 text-xs font-medium text-green-600 whitespace-nowrap">
				- Updated
			</span>
		);
	}

	if (saveStatus === "error") {
		return (
			<span className="ml-2 text-xs font-medium text-red-600 whitespace-nowrap">
				- Error
			</span>
		);
	}

	return null;
};

export default UpdateBadge;
