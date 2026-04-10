import React, { useMemo } from "react";
import { MatchFieldBadge } from "./MatchFieldBadge";
import { MatchMerchantDetailsCard } from "./MatchMerchantDetailsCard";
import { MatchPrincipalCard } from "./MatchPrincipalCard";
import type { MatchSuccessData } from "./types";

import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@/ui/accordion";

interface MatchAdditionalMatchesSectionProps {
	matches: MatchSuccessData[];
}

export const MatchAdditionalMatchesSection: React.FC<
	MatchAdditionalMatchesSectionProps
> = ({ matches }) => {
	const parsedMatches = useMemo(
		() =>
			matches.map((matchData) => {
				const merchantName =
					matchData.merchantInfo?.name ?? "Additional Match";
				return { matchData, merchantName };
			}),
		[matches],
	);

	if (matches.length === 0) return null;

	return (
		<Accordion type="multiple" className="space-y-4">
			{parsedMatches.map(({ matchData, merchantName }, idx) => {
				const responsePrincipals =
					matchData.merchantInfo?.principals ?? [];

				return (
					<AccordionItem
						key={`additional-match-${idx}`}
						value={`additional-match-${idx}`}
						className="border border-gray-200 rounded-lg bg-white shadow-sm overflow-hidden"
					>
						<AccordionTrigger className="px-4 text-base font-semibold">
							<div className="flex items-center gap-2">
								<span>
									Additional Match #{idx + 1} — {merchantName}
								</span>
								<MatchFieldBadge
									value={
										matchData.matchSignal.businessNameMatch
									}
								/>
							</div>
						</AccordionTrigger>
						<AccordionContent>
							<div className="space-y-4 px-4">
								<MatchMerchantDetailsCard matches={matchData} />

								{responsePrincipals.map(
									(principal, principalIdx) => (
										<MatchPrincipalCard
											key={principalIdx}
											index={principalIdx + 1}
											principal={principal}
											matchSignals={
												matchData.matchSignal
													.principalMatch[
													principalIdx
												]
											}
										/>
									),
								)}
							</div>
						</AccordionContent>
					</AccordionItem>
				);
			})}
		</Accordion>
	);
};
