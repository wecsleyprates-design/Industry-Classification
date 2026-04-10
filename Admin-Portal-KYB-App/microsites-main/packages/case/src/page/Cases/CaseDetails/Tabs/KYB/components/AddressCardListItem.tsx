import React from "react";
import {
	CheckBadgeIcon,
	CheckCircleIcon,
	ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";
import { ContactInformationCardListItem } from "./ContactInformationCardListItem";

import { type EnrichedAddress } from "@/helpers";
import { VerificationBadge } from "@/ui/badge";
import { Tooltip } from "@/ui/tooltip";

export const AddressCardListItem: React.FC<{
	label: string;
	address: EnrichedAddress;
}> = ({ label, address }) => {
	const {
		deliverable,
		address: value,
		registrationVerification,
		googleProfileVerification,
		isPrimary,
	} = address;
	return (
		<ContactInformationCardListItem
			type="address"
			label={label}
			accessory={
				deliverable ? (
					<div className="flex flex-row gap-1 items-center text-xs font-sm text-green-700">
						<CheckCircleIcon className="size-4" />
						Deliverable
					</div>
				) : null
			}
			value={value}
			registrationVerificationBadge={
				registrationVerification?.status === "success" ? (
					<Tooltip
						side="bottom"
						content="Address matches business registration."
						trigger={
							<VerificationBadge variant="info">
								<CheckBadgeIcon />
								Verified
							</VerificationBadge>
						}
					/>
				) : (
					<Tooltip
						side="bottom"
						content="Unable to find a business registration address match at this time."
						trigger={
							<VerificationBadge variant="warning">
								<ExclamationTriangleIcon />
								Unverified
							</VerificationBadge>
						}
					/>
				)
			}
			googleProfileVerificationBadge={
				googleProfileVerification && isPrimary ? (
					<Tooltip
						side="bottom"
						content="Address provided matches Google Profile."
						trigger={
							<VerificationBadge variant="info">
								<CheckBadgeIcon />
								Verified
							</VerificationBadge>
						}
					/>
				) : isPrimary ? (
					<Tooltip
						side="bottom"
						content="For more details, please visit the Google Profile section of Public Records."
						trigger={
							<VerificationBadge variant="warning">
								<ExclamationTriangleIcon />
								Unverified
							</VerificationBadge>
						}
					/>
				) : null
			}
		/>
	);
};
