import React, { type FC } from "react";
import { ArrowTopRightOnSquareIcon } from "@heroicons/react/20/solid";
import { twMerge } from "tailwind-merge";
import ConditionalPlusIcon from "@/assets/ConditionalPlusIcon";
import { TitleLeftDivider } from "@/components/Dividers";
import { convertToLocalDate } from "@/lib/helper";
import type { BusinessNpiData } from "@/types/integrations";

import { GuestOwnerStyle } from "@/constants/TailwindStyles";

const NPI: FC<{
	businessNpiData: BusinessNpiData | undefined;
}> = ({ businessNpiData }) => {
	function buildProvider() {
		if (!businessNpiData) {
			return null;
		}

		const names = [
			businessNpiData.provider_first_name,
			businessNpiData.provider_middle_name,
			businessNpiData.provider_last_name,
		];

		if (names.every((n) => !n)) {
			return null;
		}

		return [
			businessNpiData.metadata?.["provider name prefix text"],
			businessNpiData.provider_first_name,
			businessNpiData.provider_middle_name,
			businessNpiData.provider_last_name,
			businessNpiData.provider_credential_text,
			businessNpiData.is_matched,
		]
			.filter((text) => !!text)
			.join(" ");
	}

	function buildLastUpdatedDate() {
		if (!businessNpiData?.updated_at) {
			return null;
		}
		return convertToLocalDate(businessNpiData?.updated_at, "MM/DD/YYYY");
	}

	return (
		<>
			<div className="py-2">
				<TitleLeftDivider
					text="NPI"
					badgeText={
						!businessNpiData || Object.keys(businessNpiData).length === 0
							? undefined
							: businessNpiData.is_matched
								? "Active"
								: "No Records Found"
					}
					badgeType={
						!businessNpiData || Object.keys(businessNpiData).length === 0
							? undefined
							: businessNpiData?.is_matched
								? "active"
								: "red_exclamation_circle"
					}
				/>
			</div>
			<div className="container mx-auto">
				<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
					<div className="p-4">
						<p className="py-2 text-xs font-normal tracking-tight text-gray-500">
							Provider
						</p>
						<p className="py-2 text-sm font-medium tracking-tight break-words text-slate-800">
							{buildProvider() ?? "-"}
						</p>
					</div>
					<div className="p-4">
						<p className="py-2 text-xs font-normal tracking-tight text-gray-500">
							NPI Number
						</p>
						{businessNpiData?.submitted_npi ? (
							businessNpiData.is_matched ? (
								<a
									target="_blank"
									href={`https://npiregistry.cms.hhs.gov/provider-view/${businessNpiData?.submitted_npi}`}
									rel="noopener noreferrer"
									className={twMerge(
										"flex flex-row items-center text-sm font-medium text-blue-600",
										businessNpiData?.guest_owner_edits?.includes("npi") &&
											GuestOwnerStyle,
									)}
								>
									<span className="truncate">
										{businessNpiData?.submitted_npi}
										<ConditionalPlusIcon
											isNotapplicant={
												businessNpiData?.guest_owner_edits?.includes("npi") ??
												false
											}
										/>
									</span>
									<ArrowTopRightOnSquareIcon className="h-4 ml-2 text-blue-600 min-w-4" />
								</a>
							) : (
								<p className="text-sm font-medium tracking-tight break-words text-slate-800">
									{businessNpiData.submitted_npi}
								</p>
							)
						) : (
							<p className="py-2 text-sm font-medium tracking-tight break-words text-slate-800">
								{"-"}
							</p>
						)}
					</div>
					<div className="p-4">
						<p className="py-2 text-xs font-normal tracking-tight text-gray-500">
							Last Updated
						</p>
						<p className="py-2 text-sm font-medium tracking-tight break-words text-slate-800">
							{buildLastUpdatedDate() ?? "-"}
						</p>
					</div>
					<div className="p-4">
						<p className="py-2 text-xs font-normal tracking-tight text-gray-500">
							Primary Taxonomy
						</p>
						<p className="py-2 text-sm font-medium tracking-tight break-words text-slate-800">
							{businessNpiData?.metadata?.[
								"healthcare provider taxonomy code_1"
							] ?? "-"}
						</p>
					</div>
					<div className="p-4">
						<p className="py-2 text-xs font-normal tracking-tight text-gray-500">
							State #1 License Issuer
						</p>
						<p className="py-2 text-sm font-medium tracking-tight break-words text-slate-800">
							{businessNpiData?.metadata?.[
								"provider license number state code_1"
							] ?? "-"}
						</p>
					</div>
					<div className="p-4">
						<p className="py-2 text-xs font-normal tracking-tight text-gray-500">
							State #1 License Number
						</p>
						<p className="py-2 text-sm font-medium tracking-tight break-words text-slate-800">
							{businessNpiData?.metadata?.["provider license number_1"] ?? "-"}
						</p>
					</div>
				</div>
			</div>
		</>
	);
};

export default NPI;
