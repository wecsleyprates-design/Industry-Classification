import React, { useMemo, useState } from "react";
import type { MatchError } from "@/types/integrations";
import { MatchAcquirerSection } from "./MatchAcquirerSection";
import { MatchAdditionalMatchesSection } from "./MatchAdditionalMatchesSection";
import { MatchErrorView } from "./MatchErrorView";
import { MatchMerchantDetailsCard } from "./MatchMerchantDetailsCard";
import { MatchPrincipalCard } from "./MatchPrincipalCard";
import { MatchSearchCriteriaCard } from "./MatchSearchCriteriaCard";
import { MatchStatus, type MatchUIState } from "./types";
import { getMatchStatusDefinition, resolveMatchStatus } from "./utils";

import { Card, CardContent } from "@/ui/card";

const NOT_REVIEWED_ERROR: MatchError[] = [
	{
		Source: "DB",
		Details: "This business has not been reviewed in Mastercard Match",
		ReasonCode: "",
		Description: "",
		Recoverable: false,
	},
];

// Hoisted static fallback card — content never changes (rendering-hoist-jsx)
const NOT_REVIEWED_CARD = (
	<Card>
		<CardContent className="py-6">
			<div className="text-sm text-gray-500 space-y-2">
				<MatchErrorView errors={NOT_REVIEWED_ERROR} />
			</div>
		</CardContent>
	</Card>
);

interface MatchListViewProps {
	matchUIState: MatchUIState;
	onResubmit: () => void;
}

export const MatchListView: React.FC<MatchListViewProps> = ({
	matchUIState,
	onResubmit,
}) => {
	// Memoised to avoid rerunning filter on every render (rerender-memo)
	const submittedIcas = useMemo(
		() =>
			matchUIState.icas.filter(
				(ica) => ica.status !== MatchStatus.NOT_SUBMITTED,
			),
		[matchUIState.icas],
	);

	const [selectedIcaId, setSelectedIcaId] = useState(
		submittedIcas[0]?.ica ?? "",
	);

	const result = useMemo(
		() =>
			submittedIcas.find((ica) => ica.ica === selectedIcaId) ??
			submittedIcas[0],
		[submittedIcas, selectedIcaId],
	);

	const principals = result?.matches?.merchantInfo?.principals ?? [];

	if (!result) {
		return NOT_REVIEWED_CARD;
	}

	const statusDef = getMatchStatusDefinition(resolveMatchStatus(result));
	const StatusIcon = statusDef.icon;
	const statusDescription = statusDef.description;

	return (
		<div className="space-y-4">
			<MatchAcquirerSection
				result={result}
				allIcas={submittedIcas}
				onResubmit={onResubmit}
				onSelectIca={setSelectedIcaId}
			/>

			{result.inquiryMerchant ? (
				<MatchSearchCriteriaCard merchant={result.inquiryMerchant} />
			) : null}

			{result.status === MatchStatus.RESULTS_FOUND && result.matches ? (
				<>
					<MatchMerchantDetailsCard matches={result.matches} />

					{principals.map((principal, idx) => (
						<MatchPrincipalCard
							key={idx}
							index={idx + 1}
							principal={principal}
							matchSignals={
								result.matches!.matchSignal.principalMatch[idx]
							}
						/>
					))}
				</>
			) : null}

			{result.additionalMatches && result.additionalMatches.length > 0 ? (
				<MatchAdditionalMatchesSection
					matches={result.additionalMatches}
				/>
			) : null}

			{result.status === MatchStatus.MATCH_ERROR && result.errors ? (
				<Card>
					<CardContent className="py-6">
						<div className="text-sm text-gray-500 space-y-2">
							{statusDescription ? (
								<p>{statusDescription}</p>
							) : null}
							<MatchErrorView errors={result.errors} />
						</div>
					</CardContent>
				</Card>
			) : null}

			{result.status === MatchStatus.NO_RESULTS_FOUND ? (
				<Card>
					<CardContent className="py-6">
						<div className="flex items-start gap-1.5 text-sm text-green-700">
							{StatusIcon ? (
								<StatusIcon className="w-4 h-4 mt-0.5 shrink-0" />
							) : null}
							<p>{statusDescription}</p>
						</div>
					</CardContent>
				</Card>
			) : null}
		</div>
	);
};
