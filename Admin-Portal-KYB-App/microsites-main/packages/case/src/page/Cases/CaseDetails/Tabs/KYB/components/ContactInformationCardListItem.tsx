import React, { type ReactNode } from "react";
import { usePermission } from "@/hooks/usePermission";
import { DisplayFieldValue } from "../../../components";
import type { FieldSource } from "../../../components/fieldSource.types";

export interface ContactInformationCardListItemProps {
	type?: "address" | "businessName";
	label: ReactNode;
	value: ReactNode;
	accessory?: ReactNode;
	fieldSource?: FieldSource;
	registrationVerificationBadge?: ReactNode;
	googleProfileVerificationBadge?: ReactNode;
}

export const ContactInformationCardListItem: React.FC<
	ContactInformationCardListItemProps
> = (props) => {
	const {
		type,
		label,
		value,
		accessory,
		registrationVerificationBadge,
		googleProfileVerificationBadge,
		fieldSource,
	} = props;

	const canDisplayBadges = usePermission("case:read:badge_display");

	return (
		<div className="flex flex-col py-4 gap-4 min-h-[56px]">
			<div className="flex flex-col gap-1">
				<dt className="flex flex-row gap-2 text-xs font-medium text-gray-500">
					{label}
					{accessory}
				</dt>
				<dd className="mt-1 text-sm text-gray-900 sm:col-span-1 sm:mt-0">
					<DisplayFieldValue
						value={value}
						fieldSource={fieldSource}
					/>
				</dd>
			</div>
			{canDisplayBadges && type === "address" && (
				<div className="flex flex-row gap-8">
					<div className="flex flex-col gap-1">
						<div className="flex flex-row gap-2 text-xs font-medium text-gray-500">
							Business Registration
						</div>
						<div>{registrationVerificationBadge}</div>
					</div>
					{googleProfileVerificationBadge && (
						<div className="flex flex-col gap-1">
							<div className="flex flex-row gap-2 text-xs font-medium text-gray-500">
								Google Profile
							</div>
							<div>{googleProfileVerificationBadge}</div>
						</div>
					)}
				</div>
			)}
		</div>
	);
};
