import React from "react";
import { useGetBusinessPublicRecords } from "@/services/queries/integration.query";
import { formatPercentageFromDecimal } from "../../utils";

import { VALUE_NOT_AVAILABLE } from "@/constants";
import {
	CardList,
	CardListItem,
	type CardListItemProps,
} from "@/page/Cases/CaseDetails/components";
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/card";
import { Skeleton } from "@/ui/skeleton";

const CountAndPercentageValue: React.FC<{
	count: number | null | undefined;
	percentage: number | null | undefined;
}> = ({ count, percentage }) => {
	if (
		(count === null && percentage === null) ||
		(count === undefined && percentage === undefined)
	)
		return <span>{VALUE_NOT_AVAILABLE}</span>;

	return (
		<span>
			{count ?? VALUE_NOT_AVAILABLE}{" "}
			{formatPercentageFromDecimal(percentage)}
		</span>
	);
};

export const ComplaintsCard: React.FC<{
	businessId: string;
	caseId: string;
}> = ({ businessId, caseId }) => {
	const { data, isLoading } = useGetBusinessPublicRecords({
		businessId,
		caseId,
	});
	const publicRecords = data?.data?.public_records;
	const complaintStats = publicRecords?.complaint_statistics;

	const detailItems: CardListItemProps[] = [
		{
			label: "Total Complaints",
			value:
				complaintStats?.count_of_complaints_all_time ??
				VALUE_NOT_AVAILABLE,
		},
		{
			label: "CFPB Complaints with Alert Words",
			value: (
				<CountAndPercentageValue
					count={
						complaintStats?.count_of_consumer_financial_protection_bureau_complaints_all_time
					}
					percentage={
						complaintStats?.percentage_of_complaints_containing_alert_words_all_time
					}
				/>
			),
		},
		{
			label: "Answered Resolved Status",
			value: (
				<CountAndPercentageValue
					count={
						complaintStats?.count_of_answered_resolved_status_all_time
					}
					percentage={
						complaintStats?.percentage_of_answered_resolved_status_all_time
					}
				/>
			),
		},
		{
			label: "Resolved Resolved Status",
			value: (
				<CountAndPercentageValue
					count={
						complaintStats?.count_of_resolved_resolved_status_all_time
					}
					percentage={
						complaintStats?.percentage_of_resolved_resolved_status_all_time
					}
				/>
			),
		},
		{
			label: "Unresolved Resolved Status",
			value: (
				<CountAndPercentageValue
					count={
						complaintStats?.count_of_unresolved_resolved_status_all_time
					}
					percentage={
						complaintStats?.percentage_of_unresolved_resolved_status_all_time
					}
				/>
			),
		},
		{
			label: "Other Resolved Status",
			value: (
				<CountAndPercentageValue
					count={
						complaintStats?.count_of_other_resolved_status_all_time
					}
					percentage={
						complaintStats?.percentage_of_other_resolved_status_all_time
					}
				/>
			),
		},
	];

	return (
		<Card>
			<CardHeader>
				<CardTitle>Complaints</CardTitle>
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
