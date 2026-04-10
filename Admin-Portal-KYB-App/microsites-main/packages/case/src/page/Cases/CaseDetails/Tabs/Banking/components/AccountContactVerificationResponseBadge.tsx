import React, { useMemo } from "react";
import {
	CheckBadgeIcon,
	CheckCircleIcon,
	ExclamationCircleIcon,
	ExclamationTriangleIcon,
	QuestionMarkCircleIcon,
} from "@heroicons/react/24/outline";
import { type BankAccountVerification } from "@/types/banking";

import { VALUE_NOT_AVAILABLE } from "@/constants";
import { getContactGAuthenticateStatusAndDescription } from "@/helpers/getContactGAuthenticateStatusAndDescription";
import { type BadgeProps, VerificationBadge } from "@/ui/badge";
import { Tooltip } from "@/ui/tooltip";

interface AccountContactVerificationResponseBadgeProps {
	response: BankAccountVerification["account_authentication_response"];
}

export const AccountContactVerificationResponseBadge: React.FC<
	AccountContactVerificationResponseBadgeProps
> = ({ response }) => {
	const { status, description } =
		getContactGAuthenticateStatusAndDescription(response);

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
			case "High Risk":
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

		if (status.includes("Invalid")) {
			variant = "error";
			icon = ExclamationCircleIcon;
		}

		return { variant, icon };
	}, [status]);

	return (
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
			disableHoverableContent={!description}
			trigger={
				<VerificationBadge variant={badgeVariant}>
					<BadgeIcon />
					{status}
				</VerificationBadge>
			}
		/>
	);
};
