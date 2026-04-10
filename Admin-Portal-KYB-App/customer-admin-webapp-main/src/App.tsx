import { useEffect, useMemo } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useFlags } from "launchdarkly-react-client-sdk";
import { Toaster } from "sonner";
import FloatingSupportWidget from "@/components/FloatingSupportWidget";
import Toast from "./components/Toast";
import FEATURE_FLAGES from "./constants/FeatureFlags";
import { useAllVersionCheckers } from "./hooks/useAllVersionCheckers";
import { useIdentifyUserInLaunchDarkly } from "./hooks/useIdentifyUserInLaunchDarkly";
import { useUserPilot } from "./hooks/useUserpilot";
import { addDataQAAttributes } from "./lib/add-data-qa";
import Router from "./routes";
import "react-toastify/dist/ReactToastify.css";
import "./App.css";

function App() {
	const flags = useFlags();

	const queryClient = new QueryClient();

	useUserPilot();
	useIdentifyUserInLaunchDarkly();
	// addDataQAAttributes runs to add "data-qa" attribute to every element of the DOM. This is done to make writing test scripts easier and efficient.
	useEffect(() => {
		// UNCOMMENT THIS CODE IF NEEDS TO ADD RESTRICTION
		// const url = window.location.href;
		// if (
		// 	url.includes(".dev.joinworth.com") ||
		// 	url.includes(".staging.joinworth.com")
		// )
		addDataQAAttributes();
	}, []);

	//  check if the feature flag for Hubspot tracking pixel is enabled
	const hubspotTrackingPixel = useMemo(
		() => flags[FEATURE_FLAGES.DOS_501_ADD_HUBSPOT_TRACKING_PIXEL] ?? false,
		[flags],
	);

	// Load the script is loaded dynamically when hubspotTrackingPixel is enabled.
	useEffect(() => {
		if (hubspotTrackingPixel) {
			const script = document.createElement("script");
			script.type = "text/javascript";
			script.id = "hs-script-loader";
			script.src = "//js.hs-scripts.com/43710413.js";
			script.async = true;
			script.defer = true;
			document.body.appendChild(script);
			return () => {
				document.body.removeChild(script);
			};
		}
	}, [hubspotTrackingPixel]);

	// Check versions of host and remote apps
	useAllVersionCheckers();

	return (
		<QueryClientProvider client={queryClient}>
			<div className="h-screen App">
				<Toast />
				<Router />
			</div>
			{flags[FEATURE_FLAGES.PAT_663_HELPER_BOX_CUSTOMER_ADMIN_WEBAPP] && (
				<FloatingSupportWidget />
			)}
			<Toaster />
		</QueryClientProvider>
	);
}

export default App;
