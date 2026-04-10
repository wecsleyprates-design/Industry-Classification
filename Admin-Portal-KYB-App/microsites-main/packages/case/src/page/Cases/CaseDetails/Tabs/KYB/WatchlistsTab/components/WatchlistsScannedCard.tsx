import React from "react";

import { WATCHLISTS } from "@/constants/Watchlists";
import { CardList, CardListItem } from "@/page/Cases/CaseDetails/components";
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/card";

export const WatchlistsScannedCard: React.FC = () => {
	return (
		<Card>
			<CardHeader>
				<CardTitle className="text-gray-600">
					Watchlists Scanned
				</CardTitle>
			</CardHeader>
			<CardContent>
				<div className="flex flex-col gap-4">
					{Object.entries(WATCHLISTS).map(([category, lists]) => (
						<div className="flex flex-col" key={category}>
							<label className="text-sm font-medium text-black py-2">
								{category}
							</label>
							<CardList borderless>
								{lists.map((list) => (
									<CardListItem
										key={list}
										label={list}
										value={null}
									/>
								))}
							</CardList>
						</div>
					))}
				</div>
			</CardContent>
		</Card>
	);
};
