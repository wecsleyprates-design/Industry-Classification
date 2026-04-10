import React from "react";
import { WatchlistHitLoadingItem } from "./WatchlistHitLoadingItem";

import { Card, CardContent, CardHeader, CardTitle } from "@/ui/card";
import { Skeleton } from "@/ui/skeleton";

export const WatchlistHitLoadingCard: React.FC = () => {
	return (
		<Card>
			<CardHeader>
				<div className="flex items-center gap-2">
					<CardTitle>
						<Skeleton className="h-7 w-24" />
					</CardTitle>
					<Skeleton className="h-7 w-12" />
				</div>
			</CardHeader>
			<CardContent>
				<div className="flex flex-col border-t border-gray-100 divide-y divide-gray-100">
					<WatchlistHitLoadingItem />
				</div>
			</CardContent>
		</Card>
	);
};
