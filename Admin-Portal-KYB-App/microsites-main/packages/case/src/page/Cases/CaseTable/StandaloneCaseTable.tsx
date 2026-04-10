import React, { useEffect, useState } from "react";
import { useGetStandaloneCases } from "@/services/queries/case.query";
import { useAppContextStore } from "@/store/useAppContextStore";
import { type IPayload } from "@/types/common";
import CaseTable from ".";

const StandaloneCaseTable = () => {
	const [payload, setPayload] = useState<IPayload>({});
	const { setModuleType, setPlatformType } = useAppContextStore();
	const {
		data: customerCasesData,
		isLoading: isLoadingCaseData,
		refetch,
	} = useGetStandaloneCases(payload);

	const updatePayload = (newPayload: IPayload) => {
		setPayload(newPayload);
	};

	useEffect(() => {
		// set module and platform type in global store
		setPlatformType("admin");
		setModuleType("standalone_case");
	}, [setModuleType, setPlatformType]);

	return (
		<CaseTable
			title="Standalone Cases"
			customerCasesData={customerCasesData}
			isLoadingCaseData={isLoadingCaseData}
			updatePayload={updatePayload}
			refetchTableData={async () => {
				await refetch();
			}}
			customerId="" // No customerId for standalone cases
		/>
	);
};

export default StandaloneCaseTable;
