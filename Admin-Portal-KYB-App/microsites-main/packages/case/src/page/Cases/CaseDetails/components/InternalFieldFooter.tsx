import React from "react";

import { Card } from "@/ui/card";

export const InternalFieldFooter: React.FC<{
	hasApplicantFields?: boolean;
	hasInternalFields?: boolean;
}> = ({ hasApplicantFields = false, hasInternalFields = false }) => {
	if (!hasApplicantFields && !hasInternalFields) return null;

	return (
		<Card className="flex flex-col gap-3 p-4 font-normal tracking-tight font-inter">
			{hasApplicantFields && (
				<div className="flex flex-row items-center">
					<div className="flex items-center justify-center h-8 text-xs border-l-2 border-yellow-400 min-w-8 rounded" />
					<span className="ml-3 text-xs text-gray-600">
						Fields provided by applicant
					</span>
				</div>
			)}
			{hasInternalFields && (
				<div className="flex flex-row items-center">
					<div className="flex items-center justify-center h-8 text-xs border-l-2 border-blue-400 min-w-8 rounded" />
					<span className="ml-3 text-xs text-gray-600">
						Fields edited by internal users
					</span>
				</div>
			)}
		</Card>
	);
};
