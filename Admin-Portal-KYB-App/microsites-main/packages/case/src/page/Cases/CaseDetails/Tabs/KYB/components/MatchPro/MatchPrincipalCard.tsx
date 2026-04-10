import React, { useMemo } from "react";
import type { Principal } from "@/types/integrations";
import { MatchFieldBadge } from "./MatchFieldBadge";
import { MatchRow } from "./MatchRows";
import type { MatchSuccessData } from "./types";
import { MatchSignalCode } from "./types";
import { formatAddress, formatFullName } from "./utils";

import { formatSSN } from "@/helpers/case";
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/card";

interface MatchPrincipalCardProps {
	index: number;
	principal: Principal;
	matchSignals?: MatchSuccessData["matchSignal"]["principalMatch"][number];
}

const getOverallSignal = (
	matchSignals:
		| MatchSuccessData["matchSignal"]["principalMatch"][number]
		| undefined,
): MatchSignalCode | undefined => {
	if (!matchSignals) return undefined;
	const values = Object.values(matchSignals).filter(Boolean);
	if (values.includes(MatchSignalCode.EXACT_MATCH))
		return MatchSignalCode.EXACT_MATCH;
	if (values.includes(MatchSignalCode.FUZZY_MATCH))
		return MatchSignalCode.FUZZY_MATCH;
	if (values.length > 0) return MatchSignalCode.NO_MATCH;
	return undefined;
};

export const MatchPrincipalCard: React.FC<MatchPrincipalCardProps> = ({
	index,
	principal,
	matchSignals,
}) => {
	const fullName = useMemo(
		() =>
			formatFullName(
				principal.firstName,
				principal.middleInitial,
				principal.lastName,
			),
		[principal.firstName, principal.middleInitial, principal.lastName],
	);

	const address = useMemo(
		() => formatAddress(principal.address),
		[principal.address],
	);

	const overallSignal = getOverallSignal(matchSignals);

	return (
		<Card>
			<CardHeader className="pb-2">
				<div className="flex items-center justify-between">
					<CardTitle className="text-base font-semibold">
						Principal/Owner #{index}
					</CardTitle>
					{overallSignal ? (
						<MatchFieldBadge value={overallSignal} />
					) : null}
				</div>
			</CardHeader>
			<CardContent className="pt-0">
				<dl className="divide-y divide-gray-100 border-t border-gray-100">
					<MatchRow
						label="Full Name"
						value={fullName || "N/A"}
						signal={matchSignals?.name}
					/>
					<MatchRow
						label="Date of Birth"
						value={principal.dateOfBirth || "N/A"}
						signal={matchSignals?.dateOfBirth}
					/>
					<MatchRow
						label="Primary Address"
						value={address || "N/A"}
						signal={matchSignals?.address}
					/>
					<MatchRow
						label="Email Address"
						value={principal.email || "N/A"}
						signal={matchSignals?.email}
					/>
					<MatchRow
						label="Phone"
						value={principal.phoneNumber || "N/A"}
						signal={matchSignals?.phoneNumber}
					/>
					<MatchRow
						label="SSN"
						value={formatSSN(principal.nationalId ?? null) || "N/A"}
						signal={matchSignals?.nationalId}
					/>
				</dl>
			</CardContent>
		</Card>
	);
};
