import React, { useEffect } from "react";
import { useParams } from "react-router";
import { useGetCaseDetails } from "@/hooks";
import { useAppContextStore } from "@/store/useAppContextStore";
import { CaseDetailsPage } from ".";

import { URL, VALUE_NOT_AVAILABLE } from "@/constants";

const BusinessCaseDetails = () => {
	const { id, businessId } = useParams();
	const { setModuleType, setCustomerId, setBusinessId, setPlatformType } =
		useAppContextStore();

	const {
		caseData,
		caseIdQueryLoading: isCaseLoading,
		refetchCaseData: refetchCaseDetails,
	} = useGetCaseDetails({
		customerId: VALUE_NOT_AVAILABLE,
		caseId: id ?? VALUE_NOT_AVAILABLE,
	});

	useEffect(() => {
		// set module and platform type in global store
		setModuleType("business_case");
		setPlatformType("admin"); //  this is always admin platform
		setBusinessId(businessId ?? null);
		if (caseData) setCustomerId(caseData?.data?.customer_id ?? "");
	}, [caseData]);

	return (
		<CaseDetailsPage
			backNavigateTo={URL.BUSINESS_CASES}
			caseData={caseData?.data}
			isLoading={isCaseLoading}
			refetchCaseDetails={refetchCaseDetails}
		/>
	);
};

export default BusinessCaseDetails;
