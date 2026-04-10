import React, { useMemo } from "react";
import { formatName } from "@/lib/utils";
import { type RiskCheckResult } from "@/types/businessEntityVerification";
import { type Owner } from "@/types/case";
import { CardList } from "../../../components/CardList";
import {
	CardListItem,
	type CardListItemProps,
} from "../../../components/CardListItem";
import { RiskScoreBadge } from "./RiskScoreBadge";

import { VALUE_NOT_AVAILABLE } from "@/constants";

const formatUserInteractions = (userInteractions: string | undefined) => {
	return (
		new Map<string, string>([
			["genuine", "Genuine"],
			["risky", "Risky"],
			["neutral", "Neutral"],
			["no_data", VALUE_NOT_AVAILABLE],
		]).get(userInteractions ?? "no_data") ?? VALUE_NOT_AVAILABLE
	);
};

const formatDetectionFlag = (flag: string | undefined) => {
	switch (flag) {
		case "yes":
			return "Detected";
		case "no":
			return "Not Detected";
		case "no_data":
			return "No Data";
		default:
			return VALUE_NOT_AVAILABLE;
	}
};

export const FraudReport: React.FC<{
	owner: Owner | null;
	businessId: string;
	riskCheckResult:
		| Pick<
				RiskCheckResult,
				| "user_interactions"
				| "synthetic_identity_risk_score"
				| "stolen_identity_risk_score"
				| "fraud_ring_detected"
				| "bot_detected"
		  >
		| undefined;
	isLoadingRiskCheckResult?: boolean;
}> = ({ owner, riskCheckResult, isLoadingRiskCheckResult }) => {
	const detailItems = useMemo(() => {
		if (!owner) return [];

		// @link https://plaid.com/docs/api/products/identity-verification/
		const detailItems: Array<CardListItemProps & { score?: number }> = [
			{
				label: "Name",
				value: formatName(owner),
			},
			{
				label: "User Interactions",
				value: formatUserInteractions(
					riskCheckResult?.user_interactions,
				),
			},
			{
				label: "Fraud Ring",
				value: formatDetectionFlag(
					riskCheckResult?.fraud_ring_detected,
				),
			},
			{
				label: "Bot Presence",
				value: formatDetectionFlag(riskCheckResult?.bot_detected),
			},
			{
				label: "Synthetic Identity Risk Score",
				value:
					riskCheckResult?.synthetic_identity_risk_score ??
					VALUE_NOT_AVAILABLE,
				score: riskCheckResult?.synthetic_identity_risk_score,
			},
			{
				label: "Stolen Identity Risk Score",
				value:
					riskCheckResult?.stolen_identity_risk_score ??
					VALUE_NOT_AVAILABLE,
				score: riskCheckResult?.stolen_identity_risk_score,
			},
		];

		return detailItems;
	}, [owner, riskCheckResult]);

	return (
		<CardList>
			{detailItems.map((item, index) => (
				<CardListItem
					key={index}
					label={item.label}
					value={item.value}
					badge={
						"score" in item ? (
							<RiskScoreBadge
								score={item.score}
								loading={isLoadingRiskCheckResult}
							/>
						) : null
					}
				/>
			))}
		</CardList>
	);
};
