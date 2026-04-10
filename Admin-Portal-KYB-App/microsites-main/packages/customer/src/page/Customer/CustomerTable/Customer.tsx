import React, { useEffect, useState } from "react";
import qs from "qs";
import { type CustomerRecord } from "@/components/Table/types";
import { getCustomerStatusVariant } from "@/lib/helper";
import { useGetCustomers } from "@/services/queries/customer.query";
import { useAppContextStore } from "@/store/useAppContextStore";
import { type IPayload } from "@/types/common";
import CustomerTable from ".";

const Customer = () => {
	const [payload, setPayload] = useState<IPayload>({});
	const { setPlatformType } = useAppContextStore();

	const {
		data: customerData,
		isLoading,
		refetch,
	} = useGetCustomers(qs.stringify(payload));
	const updatePayload = (newPayload: IPayload) => {
		setPayload(newPayload);
	};

	useEffect(() => {
		setPlatformType("admin");
	}, [setPlatformType]);

	const mappedDataResponse = customerData
		? {
				...customerData,
				data: {
					...customerData.data,
					records: customerData.data.records.map((c) => ({
						customerId: c.customer_details.id,
						businessName: c.customer_details.name,
						type: {
							label:
								c.customer_details.customer_type === "PRODUCTION"
									? "Production"
									: "Sandbox",
						},
						onboardingDate: c.created_at
							? new Date(c.created_at).toLocaleDateString()
							: "N/A",
						owner:
							[c.first_name, c.last_name].filter(Boolean).join(" ") || "N/A",
						status: {
							label: c.status,
							variant: getCustomerStatusVariant(c.status),
						},
					})),
				},
			}
		: undefined;

	return (
		<CustomerTable
			title="Customers"
			customerData={mappedDataResponse}
			isLoadingCustomerData={isLoading}
			updatePayload={updatePayload}
			refetchTableData={async () => await refetch()}
		/>
	);
};

export default Customer;
