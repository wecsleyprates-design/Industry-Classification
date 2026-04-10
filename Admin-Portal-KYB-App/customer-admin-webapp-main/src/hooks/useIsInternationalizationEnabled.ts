import { useMemo } from "react";
import { useGetOnboardingSetup } from "@/services/queries/case.query";

export const useIsInternationalizationEnabled = (
	customerId: string | undefined | null,
): boolean => {
	const { data: onboardingSetupData } = useGetOnboardingSetup(customerId ?? "");

	return useMemo(() => {
		return (
			onboardingSetupData?.data?.find(
				(e) => e.code === "international_business_setup",
			)?.is_enabled ?? false
		);
	}, [onboardingSetupData]);
};
