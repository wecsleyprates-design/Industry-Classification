import React from "react";
import { DocumentMagnifyingGlassIcon } from "@heroicons/react/24/outline";

export const EmptyState: React.FC<{
	showNoResultsMessage?: boolean;
}> = ({ showNoResultsMessage = false }) => {
	return (
		<tr>
			<td className="w-full">
				<div className="flex flex-col items-center my-10">
					<div className="flex h-[72px] w-[72px] justify-center border border-gray-200 rounded-xl">
						<DocumentMagnifyingGlassIcon className="w-8 text-blue-600" />
					</div>
					<div className="flex flex-col items-center my-5 gap-1">
						<span className="text-lg font-semibold">
							No Cases to Display
						</span>
						<span className="text-sm text-gray-500 w-[370px] text-center">
							{showNoResultsMessage
								? "Please adjust your filters or search terms to display more results."
								: "To begin viewing cases, add or invite a business."}
						</span>
					</div>
				</div>
			</td>
		</tr>
	);
};
