import React from "react";
import {
	CheckBadgeIcon,
	ExclamationCircleIcon,
	XCircleIcon,
} from "@heroicons/react/24/outline";
import {
	type FactsBusinessKybResponseType,
	type KYBSosFilingValue,
} from "@/types/integrations";

import { SOS_BADGE_TEXT, SOS_BADGE_TOOLTIPS } from "@/constants/SOSBadges";
import { type BadgeProps, VerificationBadge } from "@/ui/badge";
import { Tooltip } from "@/ui/tooltip";

export const SOSBadge: React.FC<{
	sosFiling: KYBSosFilingValue | undefined;
	isInvalidated?: boolean;
}> = ({ sosFiling, isInvalidated = false }) => {
	let text: string;
	let badgeVariant: BadgeProps["variant"];
	let IconComponent:
		| typeof XCircleIcon
		| typeof ExclamationCircleIcon
		| typeof CheckBadgeIcon;
	let tooltipText: string;

	if (isInvalidated) {
		text = SOS_BADGE_TEXT.INVALIDATED;
		badgeVariant = "warning";
		IconComponent = ExclamationCircleIcon;
		tooltipText = SOS_BADGE_TOOLTIPS.INVALIDATED;
	} else if (sosFiling?.active) {
		text = SOS_BADGE_TEXT.VERIFIED;
		badgeVariant = "info";
		IconComponent = CheckBadgeIcon;
		tooltipText = SOS_BADGE_TOOLTIPS.VERIFIED;
	} else {
		text = SOS_BADGE_TEXT.MISSING_ACTIVE_FILING;
		badgeVariant = "error";
		IconComponent = XCircleIcon;
		tooltipText = SOS_BADGE_TOOLTIPS.MISSING_ACTIVE_FILING_INACTIVE;
	}

	return (
		<Tooltip
			trigger={
				<VerificationBadge
					variant={badgeVariant}
					className="cursor-pointer"
				>
					<IconComponent />
					{text}
				</VerificationBadge>
			}
			content={tooltipText}
			side="bottom"
			align="center"
		/>
	);
};
