import React from "react";
import { WatchlistHitBadge } from "./WatchlistHitBadge";
import {
	WatchlistHitItem,
	type WatchlistHitItemProps,
} from "./WatchlistHitItem";
import { WatchlistNoHitItem } from "./WatchlistNoHitItem";

import { Card, CardContent, CardHeader, CardTitle } from "@/ui/card";

export type WatchlistHitCardProps = {
	entity: string;
	hits: WatchlistHitItemProps[];
};

export const WatchlistHitCard: React.FC<WatchlistHitCardProps> = ({
	entity,
	hits,
}) => {
	return (
		<Card>
			<CardHeader>
				<div className="flex items-center gap-2">
					<CardTitle>Hits for {entity}</CardTitle>
					<WatchlistHitBadge hits={hits} />
				</div>
			</CardHeader>
			<CardContent>
				<div className="flex flex-col border-t border-gray-100 divide-y divide-gray-100">
					{hits.length ? (
						hits.map((hit) => (
							<WatchlistHitItem
								key={`watchlist-hit-${hit.list}-${hit.agency}`}
								{...hit}
							/>
						))
					) : (
						<WatchlistNoHitItem />
					)}
				</div>
			</CardContent>
		</Card>
	);
};
