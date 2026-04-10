import React from "react";

import { Skeleton } from "@/ui/skeleton";

export const WatchlistHitLoadingItem: React.FC = () => {
	return (
		<div className="flex flex-row items-start justify-start gap-4 py-4">
			<Skeleton className="size-10 rounded-full" />

			<div className="flex flex-col gap-1">
				<Skeleton className="w-24 h-4" />
				<Skeleton className="w-24 h-4" />
				<Skeleton className="w-24 h-4" />
			</div>
			<div className="ml-auto">
				<Skeleton className="w-12 h-4" />
			</div>
		</div>
	);
};
