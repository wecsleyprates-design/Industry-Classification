import React, { useMemo } from "react";
import { capitalize } from "@/lib/helper";
import { formatName, formatSourceDate } from "@/lib/utils";
import { type RiskCheckResult } from "@/types/businessEntityVerification";
import { type Owner } from "@/types/case";
import { type RiskStatus } from "@/types/risk";
import { CardList } from "../../../components/CardList";
import {
	CardListItem,
	type CardListItemProps,
} from "../../../components/CardListItem";

import { VALUE_NOT_AVAILABLE } from "@/constants";

const formatDomainProvider = (isFreeProvider: RiskStatus | undefined) => {
	if (typeof isFreeProvider === "undefined") return VALUE_NOT_AVAILABLE;
	return isFreeProvider === "no" ? "Paid" : "Free";
};

export const EmailReport: React.FC<{
	owner: Owner | null;
	businessId: string;
	riskCheckResult:
		| Pick<RiskCheckResult, "email" | "ip_spam_list_count">
		| undefined;
}> = ({ owner, riskCheckResult }) => {
	const detailItems = useMemo(() => {
		if (!owner) return [];

		const detailItems: CardListItemProps[] = [
			{
				label: "Name",
				value: formatName(owner),
			},
			{
				label: "Email",
				value: owner.email,
			},
			{
				label: "Email Deliverable",
				value: riskCheckResult?.email?.is_deliverable
					? capitalize(riskCheckResult?.email?.is_deliverable)
					: VALUE_NOT_AVAILABLE,
			},
			{
				label: "Breach Count",
				value: riskCheckResult?.email?.breach_count,
			},
			{
				label: "First Breached",
				value: riskCheckResult?.email?.first_breached_at
					? formatSourceDate(
							riskCheckResult?.email?.first_breached_at,
						)
					: VALUE_NOT_AVAILABLE,
			},
			{
				label: "Last Breached",
				value: riskCheckResult?.email?.last_breached_at
					? formatSourceDate(riskCheckResult?.email?.last_breached_at)
					: VALUE_NOT_AVAILABLE,
			},
			{
				label: "Domain Registration Date",
				value: riskCheckResult?.email?.domain_registered_at
					? formatSourceDate(
							riskCheckResult?.email?.domain_registered_at,
						)
					: VALUE_NOT_AVAILABLE,
			},
			{
				label: "Domain Provider",
				value: formatDomainProvider(
					riskCheckResult?.email?.domain_is_free_provider,
				),
			},
			{
				label: "Disposable Email Domain",
				value: riskCheckResult?.email?.domain_is_disposable
					? capitalize(riskCheckResult?.email?.domain_is_disposable)
					: VALUE_NOT_AVAILABLE,
			},
			{
				label: "Suspicious Top Level Domain",
				value: riskCheckResult?.email?.top_level_domain_is_suspicious
					? capitalize(
							riskCheckResult?.email
								?.top_level_domain_is_suspicious,
						)
					: VALUE_NOT_AVAILABLE,
			},
			{
				label: "IP Spam List Count",
				value: riskCheckResult?.ip_spam_list_count,
			},
		];

		return detailItems;
	}, [owner, riskCheckResult]);

	return (
		<CardList>
			{detailItems.map((detail, i) => (
				<CardListItem
					key={i}
					label={detail.label}
					value={detail.value}
				/>
			))}
		</CardList>
	);
};
