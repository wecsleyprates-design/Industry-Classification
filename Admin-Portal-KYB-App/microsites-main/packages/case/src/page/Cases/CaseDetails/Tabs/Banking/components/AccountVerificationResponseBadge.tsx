import React, { useMemo } from "react";
import {
	CheckBadgeIcon,
	ExclamationCircleIcon,
	ExclamationTriangleIcon,
	QuestionMarkCircleIcon,
} from "@heroicons/react/24/outline";
import { type BankAccountVerification } from "@/types/banking";

import { VALUE_NOT_AVAILABLE } from "@/constants";
import { getGVerifyStatusAndDescription } from "@/helpers/getGVerifyStatusAndDescription";
import { type BadgeProps, VerificationBadge } from "@/ui/badge";
import { Tooltip } from "@/ui/tooltip";

interface AccountVerificationResponseBadgeProps {
	response: BankAccountVerification["account_verification_response"];
}

export const AccountVerificationResponseBadge: React.FC<
	AccountVerificationResponseBadgeProps
> = ({ response }) => {
	const { status, description } = getGVerifyStatusAndDescription(response);
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
			case "High Risk":
				variant = "error";
				icon = ExclamationCircleIcon;
				break;
			case "Unverified":
				variant = "warning";
				icon = ExclamationTriangleIcon;
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
						GVerify Response Code{" "}
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
