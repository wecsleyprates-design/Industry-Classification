import React, { useEffect, useState } from "react";
import { useParams } from "react-router";
import { useGetCasesQuery } from "@/services/queries/case.query";
import { useAppContextStore } from "@/store/useAppContextStore";
import { type IPayload } from "@/types/common";
import CaseTable from ".";

// Cases Table used in Worth admin Customer details cases
const CustomerDetailsCaseTable = () => {
	const { slug } = useParams();
	const [payload, setPayload] = useState<IPayload>({});
	const { setModuleType, setPlatformType, setCustomerId } =
		useAppContextStore();
	const {
		data: customerCasesData,
		isLoading: isLoadingCaseData,
		refetch,
	} = useGetCasesQuery({
		customerId: slug ?? "N/A",
		params: payload,
	});

	const updatePayload = (newPayload: IPayload) => {
		setPayload(newPayload);
	};

	useEffect(() => {
		// set module and platform type in global store
		setPlatformType("admin");
		setModuleType("customer_case");
		if (slug) {
			setCustomerId(slug);
		}
	}, [setModuleType, setPlatformType, slug]);

	return (
		<CaseTable
			customerCasesData={customerCasesData}
			isLoadingCaseData={isLoadingCaseData}
			updatePayload={updatePayload}
			customerId={slug}
			refetchTableData={async () => {
				await refetch();
			}}
		/>
	);
};

export default CustomerDetailsCaseTable;
