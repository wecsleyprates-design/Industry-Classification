import React from "react";
import dayjs from "dayjs";
import { capitalize } from "@/lib/helper";
import { type GetFactsBusinessBJLResponse } from "@/types/integrations";

import { VALUE_NOT_AVAILABLE } from "@/constants";
import { formatCurrency } from "@/helpers";
import {
	CardList,
	CardListItem,
	type CardListItemProps,
} from "@/page/Cases/CaseDetails/components";
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/card";
import { Skeleton } from "@/ui/skeleton";

export const LiensCard: React.FC<{
	bjl:
		| Pick<GetFactsBusinessBJLResponse, "liens" | "num_liens">
		| null
		| undefined;
	isLoading: boolean;
}> = ({ bjl, isLoading }) => {
	const detailItems: CardListItemProps[] = [
		{
			label: "Number of Liens",
			value: bjl?.num_liens?.value ?? VALUE_NOT_AVAILABLE,
		},
		{
			label: "Most Recent Filing Date",
			value: bjl?.liens?.value?.most_recent
				? dayjs.utc(bjl.liens.value.most_recent).format("MM/DD/YYYY")
				: VALUE_NOT_AVAILABLE,
		},
		{
			label: "Most Recent Status",
			value: bjl?.liens?.value?.most_recent_status
				? capitalize(bjl.liens.value.most_recent_status)
				: VALUE_NOT_AVAILABLE,
		},
		{
			label: "Most Recent Amount",
			value: bjl?.liens?.value?.most_recent_amount
				? formatCurrency(bjl.liens.value.most_recent_amount)
				: VALUE_NOT_AVAILABLE,
		},
		{
			label: "Total Amount",
			value: bjl?.liens?.value?.total_open_lien_amount
				? formatCurrency(bjl.liens.value.total_open_lien_amount)
				: VALUE_NOT_AVAILABLE,
		},
	];

	return (
		<Card>
			<CardHeader>
				<CardTitle>Liens</CardTitle>
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
