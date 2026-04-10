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

export const JudgmentsCard: React.FC<{
	bjl:
		| Pick<GetFactsBusinessBJLResponse, "judgements" | "num_judgements">
		| null
		| undefined;
	isLoading: boolean;
}> = ({ bjl, isLoading }) => {
	const detailItems: CardListItemProps[] = [
		{
			label: "Number of Judgement Filings",
			value: bjl?.num_judgements?.value ?? VALUE_NOT_AVAILABLE,
		},
		{
			label: "Most Recent Filing Date",
			value: bjl?.judgements?.value?.most_recent
				? dayjs
						.utc(bjl.judgements.value.most_recent)
						.format("MM/DD/YYYY")
				: VALUE_NOT_AVAILABLE,
		},
		{
			label: "Most Recent Status",
			value: bjl?.judgements?.value?.most_recent_status
				? capitalize(bjl.judgements.value.most_recent_status)
				: VALUE_NOT_AVAILABLE,
		},
		{
			label: "Most Recent Amount",
			value: bjl?.judgements?.value?.most_recent_amount
				? formatCurrency(bjl.judgements.value.most_recent_amount)
				: VALUE_NOT_AVAILABLE,
		},
		{
			label: "Total Amount",
			value: bjl?.judgements?.value?.total_judgement_amount
				? formatCurrency(bjl.judgements.value.total_judgement_amount)
				: VALUE_NOT_AVAILABLE,
		},
	];

	return (
		<Card>
			<CardHeader>
				<CardTitle>Judgments</CardTitle>
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
