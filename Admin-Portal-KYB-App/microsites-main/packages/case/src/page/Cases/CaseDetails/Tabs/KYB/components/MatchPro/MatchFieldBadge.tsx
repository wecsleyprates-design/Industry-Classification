import React from "react";
import { MatchSignalCode } from "./types";
import { SIGNAL_CONFIG } from "./utils";

import { VerificationBadge } from "@/ui/badge";

interface MatchFieldBadgeProps {
	value: string | undefined;
}

const NO_MATCH_CONFIG = SIGNAL_CONFIG[MatchSignalCode.NO_MATCH];

export const MatchFieldBadge: React.FC<MatchFieldBadgeProps> = ({ value }) => {
	if (!value || value === MatchSignalCode.NOT_AVAILABLE) return null;
	const config = SIGNAL_CONFIG[value as MatchSignalCode] ?? NO_MATCH_CONFIG;
	const Icon = config.icon;
	return (
		<VerificationBadge
			variant={config.variant}
			className="gap-1 whitespace-nowrap shrink-0"
		>
			<Icon className="w-3.5 h-3.5" />
			{config.badgeLabel}
		</VerificationBadge>
	);
};
