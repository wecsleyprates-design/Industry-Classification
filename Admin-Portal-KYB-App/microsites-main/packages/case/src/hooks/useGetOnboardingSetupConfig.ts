import { useGetOnboardingSetup } from "@/services/queries/case.query";
import { type GetOnboardingSetupResponseData } from "@/types/onboarding";

export const useGetOnboardingSetupConfig = (
	customerId: string | null | undefined,
	code: GetOnboardingSetupResponseData["code"],
) => {
	const { data: onboardingSetupData } = useGetOnboardingSetup(
		customerId ?? "",
	);

	return onboardingSetupData?.data?.find((setup) => setup.code === code);
};
