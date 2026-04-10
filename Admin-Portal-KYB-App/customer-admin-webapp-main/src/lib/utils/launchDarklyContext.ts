import { getItem } from "@/lib/localStorage";
import { type ILoginResponseUserDetails } from "@/types/auth";
import { LOCALSTORAGE } from "../../constants/LocalStorage";

export interface LaunchDarklyMultiContext {
	kind: "multi";
	user: {
		key: string;
		email: string;
		name: string;
	};
	customer: {
		key: string;
		customer_id: string;
	};
}

/**
 * Creates a LaunchDarkly multi-context object from stored user details and customer ID.
 * Returns undefined if required data is missing.
 */
export const createLaunchDarklyContext = ():
	| LaunchDarklyMultiContext
	| undefined => {
	const userDetails = getItem<ILoginResponseUserDetails>("userDetails");
	const customerId = getItem<string>(LOCALSTORAGE.customerId);

	if (!userDetails || !customerId) {
		return undefined;
	}

	return {
		kind: "multi",
		user: {
			key: "user",
			email: userDetails.email ?? "",
			name: `${String(userDetails.first_name ?? "")} ${String(
				userDetails.last_name ?? "",
			)}`.trim(),
		},
		customer: {
			key: "customer",
			customer_id: customerId,
		},
	};
};
