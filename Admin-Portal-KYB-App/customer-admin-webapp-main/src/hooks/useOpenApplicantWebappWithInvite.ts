import { useCallback } from "react";
import { getSubDomainInfo } from "@/services/api/integration.service";
import { useGetCustomerOnboardingInvite } from "@/services/queries/case.query";

import ERROR_MSG from "@/constants/ErrorMessages";

export const useOpenApplicantWebappWithInvite = () => {
	const { mutateAsync: fetchCustomerOnboardingInvite } =
		useGetCustomerOnboardingInvite();

	return useCallback(
		async ({
			caseId,
			customerId,
			params,
		}: {
			caseId: string;
			customerId: string;
			params?: Record<string, string>;
		}) => {
			const inviteData = await fetchCustomerOnboardingInvite({
				caseId,
				customerId,
			});

			const subDomainInfo = await getSubDomainInfo(customerId);
			const whitelableSubDomain = subDomainInfo?.data?.domain.split(".")[0];

			if (!inviteData.data)
				throw new Error(ERROR_MSG.FETCH_CUSTOMER_ONBOARDING_INVITE_ERROR);

			let redirectLink = whitelableSubDomain
				? inviteData.data.replace("app", whitelableSubDomain)
				: inviteData.data;

			if (params) {
				const separator = redirectLink.includes("?") ? "&" : "?";
				redirectLink += separator + new URLSearchParams(params).toString();
			}

			window.open(redirectLink, "_blank");

			return redirectLink;
		},
		[fetchCustomerOnboardingInvite],
	);
};
