import { useMemo } from "react";
import { useGetCustomerOnboardingStages } from "@/services/queries/onboarding.query";

export const useIsNPIEnabled = (customerId: string) => {
	const { data: onboardingStagesData } = useGetCustomerOnboardingStages(
		customerId ?? "",
		{ setupType: "modify_pages_fields_setup" },
	);

	return useMemo(() => {
		const stages = onboardingStagesData?.data;

		// Find the "Company" stage
		const companyStage = stages?.find((stage) => stage.stage === "Company");

		if (!companyStage?.config) {
			return false; // "Company" stage not found or has no config
		}

		// Find the NPI field
		const npiField = companyStage.config.fields.find(
			(field) => field.name === "Primary Provider’s NPI Number*",
		);

		if (!npiField) {
			return false; // NPI field not found
		}

		// Check if status is "Optional" or "Required"
		return npiField.status === "Optional" || npiField.status === "Required";
	}, [onboardingStagesData]);
};
