import React, { useEffect, useState } from "react";
import { getItem } from "@/lib/localStorage";
import { useGetCasesQuery } from "@/services/queries/case.query";
import { useAppContextStore } from "@/store/useAppContextStore";
import { type IPayload } from "@/types/common";
import CaseTable from ".";

// Case Table used in Customer admin cases page
const CustomerCaseTable = () => {
	const customerId: string = getItem("customerId") ?? "";
	const [payload, setPayload] = useState<IPayload>({});
	const { setModuleType, setPlatformType, setCustomerId } =
		useAppContextStore();
	const {
		data: customerCasesData,
		isLoading: isLoadingCaseData,
		refetch,
	} = useGetCasesQuery({
		customerId,
		params: payload,
	});

	const updatePayload = (newPayload: IPayload) => {
		setPayload(newPayload);
	};

	useEffect(() => {
		// set module and platform type in global store
		setPlatformType("customer");
		setModuleType("customer_case");
		setCustomerId(customerId);
	}, [setModuleType, setPlatformType]);

	return (
		<CaseTable
			customerCasesData={customerCasesData}
			isLoadingCaseData={isLoadingCaseData}
			updatePayload={updatePayload}
			refetchTableData={async () => {
				await refetch();
			}}
			customerId={customerId}
		/>
	);
};

export default CustomerCaseTable;
