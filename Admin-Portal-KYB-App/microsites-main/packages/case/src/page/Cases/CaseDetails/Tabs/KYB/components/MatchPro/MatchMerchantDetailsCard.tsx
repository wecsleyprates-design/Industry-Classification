import React from "react";
import { MatchRow, Row } from "./MatchRows";
import type { MatchSuccessData } from "./types";
import { formatAddress } from "./utils";

import { MCC_DESCRIPTIONS } from "@/constants/mccCodes";
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/card";

interface MatchMerchantDetailsCardProps {
	matches: MatchSuccessData;
}

export const MatchMerchantDetailsCard: React.FC<
	MatchMerchantDetailsCardProps
> = ({ matches }) => {
	const info = matches.merchantInfo;
	if (!info) return null;

	const address = formatAddress(info.address);

	const urls = Array.isArray(info.urls)
		? info.urls.filter(Boolean).join(", ")
		: undefined;

	const hasTerminationInfo =
		info.reasonCode ||
		info.reasonCodeDesc ||
		info.createdDate ||
		info.dateOpened ||
		info.dateClosed ||
		info.addedByAcquirerId ||
		info.merchRefNum;

	return (
		<Card>
			<CardHeader className="pb-2">
				<CardTitle className="text-base font-semibold">
					Terminated Merchant Record
				</CardTitle>
				<p className="text-xs text-gray-500 mt-0.5">
					Primary record returned from the Mastercard MATCH database.
					Match indicators show how each field compares to the
					submitted search criteria.
				</p>
			</CardHeader>
			<CardContent className="pt-0">
				<dl className="divide-y divide-gray-100 border-t border-gray-100">
					<MatchRow
						label="Merchant Name"
						value={info.name || "N/A"}
						signal={matches.matchSignal.businessNameMatch}
					/>
					<MatchRow
						label="DBA Name"
						value={info.doingBusinessAsName || "N/A"}
						signal={matches.matchSignal.dbaMatch}
					/>
					<MatchRow
						label="Merchant Address"
						value={address || "N/A"}
						signal={matches.matchSignal.addressMatch}
					/>
					<MatchRow
						label="Merchant Phone"
						value={info.phoneNumber || "N/A"}
						signal={matches.matchSignal.phoneNumberMatch}
					/>
					{info.altPhoneNumber ? (
						<MatchRow
							label="Alt Phone"
							value={info.altPhoneNumber}
							signal={matches.matchSignal.altPhoneNumberMatch}
						/>
					) : null}
					<Row label="Merchant ID">{info.merchantId || "N/A"}</Row>
					<Row label="Sub-Merchant ID">
						{info.subMerchantId || "N/A"}
					</Row>
					<Row label="MCC">
						{info.merchantCategory
							? `${info.merchantCategory} – ${MCC_DESCRIPTIONS[info.merchantCategory] ?? "Unknown"}`
							: "N/A"}
					</Row>
					<MatchRow
						label="National Tax ID"
						value={info.nationalTaxId || "N/A"}
						signal={matches.matchSignal.nationalTaxIdMatch}
					/>
					{urls ? <Row label="URLs">{urls}</Row> : null}
				</dl>

				{hasTerminationInfo ? (
					<div className="mt-4 pt-2 border-t border-gray-200">
						<p className="text-sm font-medium text-gray-700 mb-1">
							Termination Information
						</p>
						<dl className="divide-y divide-gray-100">
							{info.reasonCode ? (
								<Row label="Reason Code">{info.reasonCode}</Row>
							) : null}
							{info.reasonCodeDesc ? (
								<Row label="Reason Description">
									{info.reasonCodeDesc}
								</Row>
							) : null}
							{info.createdDate ? (
								<Row label="Created Date">
									{info.createdDate}
								</Row>
							) : null}
							{info.dateOpened ? (
								<Row label="Date Opened">{info.dateOpened}</Row>
							) : null}
							{info.dateClosed ? (
								<Row label="Date Closed">{info.dateClosed}</Row>
							) : null}
							{info.addedByAcquirerId ? (
								<Row label="Added By Acquirer">
									{info.addedByAcquirerId}
								</Row>
							) : null}
							{info.merchRefNum ? (
								<Row label="Reference #">
									{info.merchRefNum}
								</Row>
							) : null}
						</dl>
					</div>
				) : null}
			</CardContent>
		</Card>
	);
};
