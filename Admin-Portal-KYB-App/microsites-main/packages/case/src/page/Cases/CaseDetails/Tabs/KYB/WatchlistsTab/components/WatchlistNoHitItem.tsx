import React from "react";
import { CheckCircleIcon } from "@heroicons/react/24/outline";

export const WatchlistNoHitItem: React.FC = () => {
	return (
		<div className="flex flex-row items-center justify-start gap-4 py-4">
			<div className="w-10 h-10 bg-green-50 rounded-full flex items-center justify-center">
				<CheckCircleIcon className="text-green-700 size-6" />
			</div>

			<div className="flex flex-col gap-1">
				<span className="text-sm font-medium text-gray-800">
					No Hits Found
				</span>
			</div>
		</div>
	);
};
