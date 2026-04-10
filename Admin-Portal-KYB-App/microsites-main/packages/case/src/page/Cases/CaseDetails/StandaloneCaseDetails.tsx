import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { useGetStandaloneCaseByIdQuery } from "@/services/queries/case.query";
import { useAppContextStore } from "@/store/useAppContextStore";
import { CaseDetailsPage } from ".";

import { URL, VALUE_NOT_AVAILABLE } from "@/constants";

// Worth admin Standalone case details page
const StandaloneCaseDetails = () => {
	const { id } = useParams();
	const navigate = useNavigate();
	const { setCustomerId, setModuleType, setPlatformType } =
		useAppContextStore();
	const caseId = id ?? VALUE_NOT_AVAILABLE;
	const {
		data: caseData,
		error: caseError,
		isLoading: isCaseLoading,
		refetch: refetchCaseDetails,
	} = useGetStandaloneCaseByIdQuery(caseId);

	useEffect(() => {
		if (caseError) {
			toast.error("Error fetching applicant data");
			navigate(URL.STANDALONE_CASES);
		}
	}, [caseError]);

	useEffect(() => {
		// set module and platform type in global store,
		setPlatformType("admin");
		setModuleType("standalone_case");
		setCustomerId(""); // removed customer_id as this is standalone case
	}, []);

	return (
		<CaseDetailsPage
			backNavigateTo={URL.STANDALONE_CASES}
			caseData={caseData?.data}
			isLoading={isCaseLoading}
			refetchCaseDetails={refetchCaseDetails}
		/>
	);
};

export default StandaloneCaseDetails;
