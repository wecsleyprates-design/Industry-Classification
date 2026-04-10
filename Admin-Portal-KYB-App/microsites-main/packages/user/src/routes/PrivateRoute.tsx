import { useEffect, useState } from "react";
import { Navigate, Outlet } from "react-router";
import { useLDClient } from "launchdarkly-react-client-sdk";
import { getItem } from "@/lib/localStorage";
import { type LoginResponseUserDetails } from "@/types/common";

import { LOCALSTORAGE } from "@/constants";

export const PrivateRoute = () => {
	// Replace with your auth condition
	const [isLoggedIn] = useState(getItem(LOCALSTORAGE.token));

	const ldClient = useLDClient();
	const customerId: string = getItem(LOCALSTORAGE.customerId) ?? "";
	const userDetails: LoginResponseUserDetails =
		getItem(LOCALSTORAGE.userDetails) ??
		({
			id: "",
			first_name: "",
			last_name: "",
			email: "",
			is_email_verified: false,
		} satisfies LoginResponseUserDetails);

	useEffect(() => {
		if (ldClient && userDetails && customerId) {
			ldClient
				.waitForInitialization(10)
				.then(async () => {
					const newMultiContext = {
						kind: "multi",
						user: {
							key: "user",
							email: userDetails.email,
							name: `${userDetails.first_name} ${userDetails.last_name}`.trim(),
						},
						customer: {
							key: "customer",
							customer_id: customerId,
						},
					};
					await ldClient.identify(newMultiContext);
				})
				.catch((error) => {
					console.error("Error in ldClient initialization or identify:", error);
				});
		}
	}, [userDetails, ldClient, customerId]);

	return isLoggedIn ? <Outlet /> : <Navigate to="/" />;
};
