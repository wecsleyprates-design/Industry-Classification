import { useEffect } from "react";
import { useNavigate } from "react-router";
import { isAxiosError } from "axios";
import { toast } from "sonner";
import { getCurrentTimezone } from "@/lib/helper";
import { useGetCaseByIdQuery } from "@/services/queries/case.query";
import { useAppContextStore } from "@/store/useAppContextStore";

import { URL } from "@/constants";

export const useGetCaseDetails = ({
	caseId,
	customerId,
}: {
	caseId: string;
	customerId: string;
}) => {
	const navigate = useNavigate();
	const { moduleType, businessId, platformType } = useAppContextStore();
	const {
		data: caseData,
		error: caseError,
		refetch: refetchCaseData,
		isLoading: caseIdQueryLoading,
	} = useGetCaseByIdQuery({
		customerId,
		caseId,
		businessId,
		moduleType,
		platformType,
		params: { filter: { time_zone: getCurrentTimezone() } },
	});

	useEffect(() => {
		if (caseError && isAxiosError(caseError)) {
			toast.error("Error fetching case data");
			if (caseError?.response?.status === 404) {
				navigate(URL.NOT_FOUND, { replace: true });
			} else if (caseError?.response?.status === 401) {
				navigate(URL.CASES);
			}
		}
	}, [caseError, navigate]);

	return {
		caseData,
		caseError,
		refetchCaseData,
		caseIdQueryLoading,
	};
};

export default useGetCaseDetails;
