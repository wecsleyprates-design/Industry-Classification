import React from "react";
import useGetCustomerDetails from "@/hooks/useGetCustomerDetails";

import { CaseStatusBadge } from "@/ui/badge";
import { Card } from "@/ui/card";
import { Skeleton } from "@/ui/skeleton";

interface CustomerKeyDetailsProps {
	customerId: string;
}

export const CustomerKeyDetails: React.FC<CustomerKeyDetailsProps> = ({
	customerId,
}) => {
	const { customerData, customerLoading: isLoading } =
		useGetCustomerDetails(customerId);

	const accountType =
		customerData?.data?.company_details?.customer_type ?? "N/A";
	const accountStatus = customerData?.data?.status ?? "N/A";
	const accountOwner = customerData?.data
		? [customerData.data.first_name, customerData.data.last_name]
				.filter(Boolean)
				.join(" ") || "N/A"
		: "N/A";

	// Map API status values to badge variants
	const statusVariantMap: Record<
		string,
		"active" | "invited" | "invite-expired" | "inactive"
	> = {
		active: "active",
		invited: "invited",
		"invite expired": "invite-expired",
		"invite-expired": "invite-expired",
		invite_expired: "invite-expired",
		inactive: "inactive",
	};

	const normalizedStatus =
		statusVariantMap[accountStatus.toLowerCase()] ?? "invited";

	// Map account types to badge variants/colors
	const typeVariantMap: Record<string, "success" | "info" | "default"> = {
		production: "success", // green
		sandbox: "info", // blue
	};

	const normalizedType = typeVariantMap[accountType.toLowerCase()] ?? "default";

	return (
		<Card>
			<div className="px-6 py-6">
				{isLoading ? (
					<div className="grid grid-cols-3 gap-4 mt-2">
						<Skeleton className="h-6 w-full" />
						<Skeleton className="h-6 w-full" />
						<Skeleton className="h-6 w-full" />
					</div>
				) : (
					<div className="grid grid-cols-3 mt-2 relative divide-x divide-gray-200">
						{/* Account Type */}
						<div className="flex flex-col justify-center px-6">
							<p className="text-[12px] leading-[18px] text-gray-500 font-[400] font-inter">
								Account Type
							</p>
							<div className="mt-1">
								<span
									className={
										"inline-flex items-center px-2.5 py-1 rounded-sm text-[12px] font-[500] " +
										(normalizedType === "success"
											? "bg-green-100 text-green-800"
											: normalizedType === "info"
												? "bg-blue-100 text-blue-800"
												: "bg-gray-100 text-gray-800")
									}
								>
									{accountType}
								</span>
							</div>
						</div>

						{/* Account Status */}
						<div className="flex flex-col justify-center px-6">
							<p className="text-[12px] leading-[18px] text-gray-500 font-[400] font-inter">
								Account Status
							</p>
							<div className="mt-1">
								<CaseStatusBadge
									variant={normalizedStatus}
									label={accountStatus}
								/>
							</div>
						</div>

						{/* Account Owner */}
						<div className="flex flex-col justify-center px-6">
							<p className="text-[12px] leading-[18px] text-gray-500 font-[400] font-inter">
								Account Owner
							</p>
							<p className="text-[14px] leading-[20px] font-[400] font-inter text-[#1F2937] py-1">
								{accountOwner}
							</p>
						</div>
					</div>
				)}
			</div>
		</Card>
	);
};

export default CustomerKeyDetails;
