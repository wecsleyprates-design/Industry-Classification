import { useEffect } from "react";
import { generatePath, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { useGetCaseDetails } from "@/hooks";
import { useAppContextStore } from "@/store/useAppContextStore";
import { CaseDetailsPage } from ".";

import { URL } from "@/constants";

// Worth admin customer case details page
const CustomerDetailsCaseDetails = () => {
	const { slug: customerId, id: caseId } = useParams();
	const navigate = useNavigate();
	const { setCustomerId, setModuleType, setPlatformType } =
		useAppContextStore();

	const validCustomerId = customerId ?? "";
	const validCaseId = caseId ?? "";

	const {
		caseData,
		caseError,
		caseIdQueryLoading: isCaseLoading,
		refetchCaseData: refetchCaseDetails,
	} = useGetCaseDetails({
		customerId: validCustomerId,
		caseId: validCaseId,
	});

	useEffect(() => {
		if (caseError) {
			toast.error("Error fetching case data");
			navigate(generatePath(URL.CUSTOMER_DETAILS, { slug: customerId }));
		}
	}, [caseError]);

	useEffect(() => {
		setPlatformType("admin");
		setModuleType("customer_case");
		if (validCustomerId) setCustomerId(validCustomerId);
	}, [validCustomerId]);

	return (
		<CaseDetailsPage
			backNavigateTo={generatePath(URL.CUSTOMER_DETAILS, {
				slug: customerId,
			})}
			caseData={caseData?.data}
			isLoading={isCaseLoading}
			refetchCaseDetails={refetchCaseDetails}
		/>
	);
};

export default CustomerDetailsCaseDetails;
