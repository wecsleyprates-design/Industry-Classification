import React from "react";
import { WatchlistNoHitItem } from "./WatchlistNoHitItem";

import { Card, CardContent, CardHeader, CardTitle } from "@/ui/card";

export const WatchlistHitNullState: React.FC<{ businessName: string }> = ({
	businessName,
}) => {
	return (
		<Card>
			<CardHeader>
				<div className="flex items-center gap-2">
					<CardTitle>Hits for {businessName}</CardTitle>
				</div>
			</CardHeader>
			<CardContent>
				<div className="flex flex-col border-t border-gray-100 divide-y divide-gray-100">
					<WatchlistNoHitItem />
				</div>
			</CardContent>
		</Card>
	);
};
