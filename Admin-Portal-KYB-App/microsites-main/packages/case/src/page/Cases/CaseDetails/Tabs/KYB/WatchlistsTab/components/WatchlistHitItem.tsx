import React from "react";
import {
	ArrowTopRightOnSquareIcon,
	ExclamationCircleIcon,
} from "@heroicons/react/24/outline";

import { VALUE_NOT_AVAILABLE } from "@/constants";
import { Tooltip } from "@/ui/tooltip";

export type WatchlistHitItemProps = {
	list: string;
	agency: string;
	country?: string;
	url?: string | null;
};

export const WatchlistHitItem: React.FC<WatchlistHitItemProps> = ({
	list,
	agency,
	country = "United States of America",
	url,
}) => {
	return (
		<div className="flex flex-row items-start justify-start gap-4 py-4">
			<div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
				<ExclamationCircleIcon className="text-red-700 size-6" />
			</div>

			<div className="flex flex-col gap-1">
				<span className="text-sm font-medium text-gray-800">
					{list}
				</span>
				<span className="text-sm font-medium text-gray-500">
					{agency}
				</span>
				<span className="text-sm font-medium text-gray-500">
					{country}
				</span>
			</div>
			{url ? (
				<div className="ml-auto">
					<a
						href={url}
						target="_blank"
						rel="noopener noreferrer"
						className="text-sm font-medium text-blue-600 flex items-center gap-1"
					>
						Source
						<ArrowTopRightOnSquareIcon className="w-4 h-4 text-blue-600" />
					</a>
				</div>
			) : (
				<div className="ml-auto">
					<Tooltip
						trigger={
							<span className="text-sm font-medium text-gray-800">
								{VALUE_NOT_AVAILABLE}
							</span>
						}
						content={
							<div className="max-w-xs">
								<p className="text-xs">
									No source link available.
								</p>
							</div>
						}
						side="left"
					/>
				</div>
			)}
		</div>
	);
};
