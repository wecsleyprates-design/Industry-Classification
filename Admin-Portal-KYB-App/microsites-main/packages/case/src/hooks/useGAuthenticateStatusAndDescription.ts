import { useMemo } from "react";
import { useFlags } from "launchdarkly-react-client-sdk";
import { type BankAccountVerification } from "@/types/banking";

import { getGAuthenticateStatusAndDescription } from "@/helpers/getGAuthenticateStatusAndDescription";

export const useGAuthenticateStatusAndDescription = (
	response: BankAccountVerification["account_authentication_response"],
): ReturnType<typeof getGAuthenticateStatusAndDescription> => {
	const flags = useFlags();
	return useMemo(() => {
		// Handle special CA30 case with feature flag
		if (
			response?.code === "CA30" &&
			flags.DOS_558_HANDLE_GIACT_CA30_TOOLTIP
		) {
			return {
				status: "Verified" as const,
				description:
					"Valid name match, but multiple secondary data points (e.g. address or phone number) did not match. Synthetic identity or fraud possible.",
			};
		}

		return getGAuthenticateStatusAndDescription(response);
	}, [response, flags.DOS_558_HANDLE_GIACT_CA30_TOOLTIP]);
};
