import React, { useMemo } from "react";
import {
	CheckBadgeIcon,
	CheckCircleIcon,
	ExclamationCircleIcon,
	ExclamationTriangleIcon,
	QuestionMarkCircleIcon,
} from "@heroicons/react/24/outline";
import { useGAuthenticateStatusAndDescription } from "@/hooks/useGAuthenticateStatusAndDescription";
import { type BankAccountVerification } from "@/types/banking";

import { VALUE_NOT_AVAILABLE } from "@/constants";
import { type BadgeProps, VerificationBadge } from "@/ui/badge";
import { Tooltip } from "@/ui/tooltip";

interface AccountAuthenticationResponseBadgeProps {
	response: BankAccountVerification["account_authentication_response"];
}

export const AccountAuthenticationResponseBadge: React.FC<
	AccountAuthenticationResponseBadgeProps
> = ({ response }) => {
	const { status, description } =
		useGAuthenticateStatusAndDescription(response);

	const { variant: badgeVariant, icon: BadgeIcon } = useMemo((): Pick<
		BadgeProps,
		"variant"
	> & {
		icon: typeof CheckBadgeIcon;
	} => {
		let variant: BadgeProps["variant"] = "secondary";
		let icon = QuestionMarkCircleIcon;

		switch (status) {
			case "Verified":
				variant = "info";
				icon = CheckBadgeIcon;
				break;
			case "Match":
				variant = "success";
				icon = CheckCircleIcon;
				break;
			case "No Match":
				variant = "error";
				icon = ExclamationCircleIcon;
				break;
			case "Did Not Run":
				variant = "secondary";
				icon = ExclamationTriangleIcon;
				break;
			default:
				variant = "secondary";
				icon = QuestionMarkCircleIcon;
		}

		return { variant, icon };
	}, [status]);

	return description ? (
		<Tooltip
			content={
				<div className="flex flex-col gap-1">
					<strong>
						GAuthenticate Response Code{" "}
						{response?.code ?? VALUE_NOT_AVAILABLE}
					</strong>
					<span>{description}</span>
				</div>
			}
			trigger={
				<VerificationBadge variant={badgeVariant}>
					<BadgeIcon />
					{status}
				</VerificationBadge>
			}
		/>
	) : (
		<VerificationBadge variant={badgeVariant}>
			<BadgeIcon />
			{status}
		</VerificationBadge>
	);
};
