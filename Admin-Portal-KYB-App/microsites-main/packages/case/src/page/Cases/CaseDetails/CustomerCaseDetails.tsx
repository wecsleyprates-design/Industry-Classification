import { useEffect } from "react";
import { useParams } from "react-router-dom";
import { useGetCaseDetails } from "@/hooks";
import { getItem } from "@/lib/localStorage";
import { useAppContextStore } from "@/store/useAppContextStore";
import { CaseDetailsPage } from ".";

import { URL, VALUE_NOT_AVAILABLE } from "@/constants";

// Customer admin case details page
const CustomerCaseDetails = () => {
	const { id } = useParams();
	const customerIdLocalStorage: string = getItem("customerId") ?? "";
	const { setModuleType, setPlatformType, setCustomerId } =
		useAppContextStore();
	const caseId = id ?? VALUE_NOT_AVAILABLE;
	const {
		caseData,
		caseIdQueryLoading: isCaseLoading,
		refetchCaseData: refetchCaseDetails,
	} = useGetCaseDetails({
		customerId: customerIdLocalStorage,
		caseId,
	});

	useEffect(() => {
		// set module and platform type in global store
		setPlatformType("customer");
		setModuleType("customer_case");
		if (customerIdLocalStorage) {
			setCustomerId(customerIdLocalStorage);
		}
	}, [customerIdLocalStorage]);

	return (
		<CaseDetailsPage
			backNavigateTo={URL.CASES}
			caseData={caseData?.data}
			isLoading={isCaseLoading}
			refetchCaseDetails={refetchCaseDetails}
		/>
	);
};

export default CustomerCaseDetails;
