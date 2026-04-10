import React from "react";
import dayjs from "dayjs";
import { capitalize } from "@/lib/helper";
import { type GetFactsBusinessBJLResponse } from "@/types/integrations";

import { VALUE_NOT_AVAILABLE } from "@/constants";
import {
	CardList,
	CardListItem,
	type CardListItemProps,
} from "@/page/Cases/CaseDetails/components";
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/card";
import { Skeleton } from "@/ui/skeleton";

export const BankruptciesCard: React.FC<{
	bjl:
		| Pick<GetFactsBusinessBJLResponse, "bankruptcies" | "num_bankruptcies">
		| null
		| undefined;
	isLoading: boolean;
}> = ({ bjl, isLoading }) => {
	const detailItems: CardListItemProps[] = [
		{
			label: "Number of Bankruptcies",
			value: bjl?.num_bankruptcies?.value ?? VALUE_NOT_AVAILABLE,
		},
		{
			label: "Most Recent Filing Date",
			value: bjl?.bankruptcies?.value?.most_recent
				? dayjs
						.utc(bjl.bankruptcies.value.most_recent)
						.format("MM/DD/YYYY")
				: VALUE_NOT_AVAILABLE,
		},
		{
			label: "Most Recent Status",
			value: bjl?.bankruptcies?.value?.most_recent_status
				? capitalize(bjl.bankruptcies.value.most_recent_status)
				: VALUE_NOT_AVAILABLE,
		},
	];

	return (
		<Card>
			<CardHeader>
				<CardTitle>Bankruptcies</CardTitle>
			</CardHeader>
			<CardContent>
				<CardList>
					{isLoading
						? detailItems.map((_, index) => (
								<CardListItem
									key={index}
									label={<Skeleton className="w-24 h-4" />}
									value={<Skeleton className="w-32 h-4" />}
								/>
							))
						: detailItems.map((item, index) => (
								<CardListItem
									key={index}
									label={item.label}
									value={item.value}
								/>
							))}
				</CardList>
			</CardContent>
		</Card>
	);
};
