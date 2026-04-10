import React, { useMemo } from "react";
import {
	CheckBadgeIcon,
	ExclamationCircleIcon,
} from "@heroicons/react/24/outline";
import { type GetBankingIntegrationResponseData } from "@/types/banking";

import { type BadgeProps, VerificationBadge } from "@/ui/badge";
import { Tooltip } from "@/ui/tooltip";

interface AccountMatchBadgeProps {
	match: GetBankingIntegrationResponseData["match"];
}

type BadgeConfig = Pick<BadgeProps, "variant"> & {
	icon: typeof CheckBadgeIcon;
	text: string;
	tooltip: string;
};

export const AccountMatchBadge: React.FC<AccountMatchBadgeProps> = ({
	match,
}) => {
	const {
		variant: badgeVariant,
		text: badgeText,
		tooltip: badgeTooltip,
		icon: BadgeIcon,
	} = useMemo((): BadgeConfig => {
		let variant: BadgeProps["variant"] = "error";
		let text = "No Match";
		let tooltip =
			"The business or individual name(s) on this account do not directly match the names provided on the application.";
		let icon = ExclamationCircleIcon;

		if (match) {
			variant = "info";
			text = "Match";
			tooltip =
				"The business or individual name(s) on this account match one or more of the names provided on the application.";
			icon = CheckBadgeIcon;
		}

		return { variant, text, tooltip, icon };
	}, [match]);

	return (
		<Tooltip
			content={badgeTooltip}
			trigger={
				<VerificationBadge variant={badgeVariant}>
					<BadgeIcon />
					{badgeText}
				</VerificationBadge>
			}
		/>
	);
};
