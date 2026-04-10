import React from "react";
import useGetCustomerDetails from "@/hooks/useGetCustomerDetails";
import { CustomerWrapper } from "@/layouts/CustomerWrapper";
import CustomerKeyDetails from "./CustomerKeyDetails";

import { Card } from "@/ui/card";
import { CustomerSummaryHeader } from "@/ui/customer-summary-header";
import OnboardingCount from "@/ui/onboardingcount";
import { Skeleton } from "@/ui/skeleton";

interface CustomerDetailsOverviewTabProps {
	customerId: string;
}

export const CustomerDetailsOverviewTab = ({
	customerId,
}: CustomerDetailsOverviewTabProps) => {
	const { customerData, customerLoading, customerError } =
		useGetCustomerDetails(customerId);

	if (customerLoading) {
		return (
			<Card>
				<div className="flex items-start p-4 space-x-3">
					<Skeleton className="w-12 h-12 rounded-full" />
					<div className="flex-grow">
						<Skeleton className="w-48 mb-2 h-7" />
						<Skeleton className="w-32 h-5 mb-3" />
						<Skeleton className="h-6 w-[150px]" />
					</div>
				</div>
			</Card>
		);
	}

	if (customerError) {
		return (
			<Card>
				<div className="flex flex-col items-center justify-center p-8 text-center">
					<p className="text-lg font-semibold text-gray-900">
						Unable to load customer details
					</p>
					<p className="mt-2 text-sm text-gray-500">
						There was an error loading the customer information. Please try
						again later.
					</p>
				</div>
			</Card>
		);
	}

	const businessName = customerData?.data?.company_details?.name ?? "N/A";
	const createdAt = customerData?.data?.created_at ?? "N/A";

	return (
		<CustomerWrapper>
			<div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
				<div className="lg:col-span-7 flex flex-col gap-5">
					<CustomerSummaryHeader
						businessName={businessName}
						timestamp={createdAt}
						customerId={customerId}
					/>
					<CustomerKeyDetails customerId={customerId} />
				</div>
				<div className="lg:col-span-5 flex ">
					<div className="w-full max-w-[420px] gap-3">
						<OnboardingCount />
					</div>
				</div>
			</div>
		</CustomerWrapper>
	);
};

export default CustomerDetailsOverviewTab;
