import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { serializeFilters } from "@/lib/helper";
import {
	useGetBusinessByCustomerId,
	useGetCustomerBusinesses,
	useGetCustomerById,
} from "@/services/queries/customer.query";
import { type GetBusinessesResponse } from "@/types/business";
import { type IPayload } from "@/types/common";
import BusinessTable from ".";

type Props = {
	customerId?: string;
};

const CustomerBusinessTable: React.FC<Props> = ({
	customerId: propCustomerId,
}) => {
	const { slug: routeCustomerId } = useParams<{ slug: string }>();
	const [payload, setPayload] = useState<IPayload>({});
	const rawCustomerId = propCustomerId ?? routeCustomerId;

	const customerId = rawCustomerId;

	const combinedPayload: IPayload = useMemo(
		() => ({
			...payload,
			filter: {
				...payload.filter,
				"rel_business_customer_monitoring.customer_id": customerId,
			},
		}),
		[payload, customerId],
	);

	const serializedPayload = useMemo(
		() => serializeFilters(combinedPayload),
		[combinedPayload],
	);

	const {
		data: businessesData,
		isLoading: businessesLoading,
		refetch,
	} = useGetCustomerBusinesses(serializedPayload);

	const { data: customerMonitoringData, isLoading: monitoringLoading } =
		useGetBusinessByCustomerId(customerId ?? "", serializedPayload);

	const { data: customerData, isLoading: customerLoading } =
		useGetCustomerById(customerId ?? "");

	const [businessData, setBusinessData] = useState<GetBusinessesResponse>();

	const updatePayload = (newPayload: IPayload) => {
		if (newPayload.filter?.created_at) {
			newPayload.filter["data_businesses.created_at"] =
				newPayload.filter.created_at;
			delete newPayload.filter.created_at;
		}
		setPayload(newPayload);
	};

	useEffect(() => {
		if (!businessesData) return;

		if (!customerMonitoringData) return;

		const monitoringMap = new Map(
			customerMonitoringData?.data?.records?.map((b: any) => [
				b.id,
				b.is_monitoring_enabled,
			]),
		);

		const mergedRecords = businessesData?.data?.records?.map((b: any) => ({
			...b,
			is_monitoring_enabled: monitoringMap.get(b.id) ?? false,
		}));

		setBusinessData({
			...businessesData,
			data: {
				...businessesData.data,
				records: mergedRecords,
			},
		});
	}, [businessesData, customerMonitoringData]);

	const isLoadingBusinessData =
		businessesLoading || monitoringLoading || customerLoading;

	if (!rawCustomerId || !customerId) return null;

	return (
		<BusinessTable
			title="Businesses"
			isLoadingBusinessData={isLoadingBusinessData}
			businessData={businessData}
			updatePayload={updatePayload}
			refetchTableData={refetch}
			customerRiskMonitoringEnabled={
				customerData?.data?.settings?.risk_monitoring ?? false
			}
		/>
	);
};

export default CustomerBusinessTable;
