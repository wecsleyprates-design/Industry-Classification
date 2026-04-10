import React from "react";
import type { BadgeVariant } from "./types";
import { MatchSignalCode } from "./types";
import { getMatchSignalTooltip, mapMatchSignal } from "./utils";

import { VerificationBadge } from "@/ui/badge";
import { Tooltip } from "@/ui/tooltip";

interface MatchSignalBadgeProps {
	label: string;
	value: string;
	hideNegatives?: boolean;
	variant?: BadgeVariant;
}

export const MatchSignalBadge: React.FC<MatchSignalBadgeProps> = ({
	label,
	value,
	hideNegatives = false,
	variant,
}) => {
	if (
		hideNegatives &&
		(!value ||
			value === MatchSignalCode.NOT_AVAILABLE ||
			value === MatchSignalCode.NO_MATCH)
	) {
		return null;
	}

	const tooltipText = getMatchSignalTooltip(value);
	const isExactMatch = value === MatchSignalCode.EXACT_MATCH;

	const badgeVariant = variant ?? (isExactMatch ? "info" : "secondary");

	return (
		<Tooltip
			trigger={
				<VerificationBadge
					variant={badgeVariant}
					className="text-xs h-5"
				>
					{label}: {mapMatchSignal(value)}
				</VerificationBadge>
			}
			content={tooltipText}
		/>
	);
};
