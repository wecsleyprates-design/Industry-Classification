import React from "react";
import { Row } from "./MatchRows";
import type { MatchSuccessData } from "./types";

import { REASON_CODE_MAP } from "@/constants/ReasonCodes";
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/card";

interface MatchReasonCodeCardProps {
	index: number;
	code: string;
	matches: MatchSuccessData;
}

export const MatchReasonCodeCard: React.FC<MatchReasonCodeCardProps> = ({
	index,
	code,
	matches,
}) => {
	const numericCode = parseInt(code, 10);
	const mapEntry = !isNaN(numericCode)
		? REASON_CODE_MAP[numericCode]
		: undefined;
	const info = matches.merchantInfo;

	return (
		<Card>
			<CardHeader className="pb-2">
				<CardTitle className="text-base font-semibold">
					Reason Code
				</CardTitle>
			</CardHeader>
			<CardContent className="pt-0">
				<dl className="divide-y divide-gray-100 border-t border-gray-100">
					<Row label="Reason Code">
						{code.padStart(2, "0")} – {mapEntry?.title ?? "Unknown"}
					</Row>
					{mapEntry?.description ? (
						<Row label="Reason Details">{mapEntry.description}</Row>
					) : null}
					{info?.dateOpened ? (
						<Row label="Date Opened">{info.dateOpened}</Row>
					) : null}
					{info?.dateClosed ? (
						<Row label="Date Closed">{info.dateClosed}</Row>
					) : null}
					{info?.createdDate ? (
						<Row label="Created Date">{info.createdDate}</Row>
					) : null}
					{info?.merchRefNum ? (
						<Row label="Reference #">{info.merchRefNum}</Row>
					) : null}
				</dl>
			</CardContent>
		</Card>
	);
};
