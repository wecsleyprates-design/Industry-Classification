import React from "react";
import type { MerchantDetails } from "@/types/integrations";
import { Row } from "./MatchRows";
import { formatAddress, formatFullName } from "./utils";

import { MCC_DESCRIPTIONS } from "@/constants/mccCodes";
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/card";

interface MatchSearchCriteriaCardProps {
	merchant: MerchantDetails;
}

export const MatchSearchCriteriaCard: React.FC<
	MatchSearchCriteriaCardProps
> = ({ merchant }) => {
	const address = formatAddress(merchant.address);
	const urls = merchant.urls?.filter(Boolean).join(", ");

	return (
		<Card>
			<CardHeader className="pb-2">
				<CardTitle className="text-base font-semibold">
					MATCH Search Criteria
				</CardTitle>
				<p className="text-xs text-gray-500 mt-0.5">
					Information submitted to Mastercard MATCH for the search.
				</p>
			</CardHeader>
			<CardContent className="pt-0">
				<dl className="divide-y divide-gray-100 border-t border-gray-100">
					<Row label="Merchant Name">{merchant.name || "N/A"}</Row>
					<Row label="DBA Name">
						{merchant.doingBusinessAsName || "N/A"}
					</Row>
					<Row label="Merchant Address">{address || "N/A"}</Row>
					<Row label="Phone Number">
						{merchant.phoneNumber || "N/A"}
					</Row>
					<Row label="URLs">{urls || "N/A"}</Row>
					<Row label="MCC">
						{merchant.merchantCategory
							? `${merchant.merchantCategory} – ${MCC_DESCRIPTIONS[merchant.merchantCategory] ?? "Unknown"}`
							: "N/A"}
					</Row>
					<Row label="Merchant ID">
						{merchant.merchantId || "N/A"}
					</Row>
					<Row label="Sub-Merchant ID">
						{merchant.subMerchantId || "N/A"}
					</Row>
				</dl>

				{merchant.principals?.map((principal, idx) => (
					<div
						key={idx}
						className="mt-4 pt-2 border-t border-gray-200"
					>
						<p className="text-sm font-medium text-gray-700 mb-1">
							Principal #{idx + 1}
						</p>
						<dl className="divide-y divide-gray-100">
							<Row label="Full Name">
								{formatFullName(
									principal.firstName,
									principal.middleInitial,
									principal.lastName,
								) || "N/A"}
							</Row>
							<Row label="Date of Birth">
								{principal.dateOfBirth || "N/A"}
							</Row>
							<Row label="Email">{principal.email || "N/A"}</Row>
							<Row label="Address">
								{formatAddress(principal.address) || "N/A"}
							</Row>
							<Row label="Phone">
								{principal.phoneNumber || "N/A"}
							</Row>
						</dl>
					</div>
				))}
			</CardContent>
		</Card>
	);
};
