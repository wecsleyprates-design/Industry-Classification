import { useEffect } from "react";
import { useLDClient } from "launchdarkly-react-client-sdk";
import { createLaunchDarklyContext } from "@/lib/utils/launchDarklyContext";
import useAuthStore from "@/store/useAuthStore";

/**
 * Custom hook that identifies the authenticated user in LaunchDarkly.
 * This runs once when the user authenticates and updates their context in LaunchDarkly.
 */
export const useIdentifyUserInLaunchDarkly = () => {
	const ldClient = useLDClient();
	const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

	useEffect(() => {
		if (!ldClient || !isAuthenticated) {
			return;
		}

		const identifyUser = async () => {
			try {
				await ldClient.waitForInitialization(10);
				const context = createLaunchDarklyContext();

				if (context) {
					await ldClient.identify(context);
				}
			} catch (error) {
				console.error("Error identifying user in LaunchDarkly:", error);
			}
		};

		void identifyUser();
	}, [ldClient, isAuthenticated]);
};
