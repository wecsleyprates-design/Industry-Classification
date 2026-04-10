import React from "react";
import { createRoot } from "react-dom/client";
import { asyncWithLDProvider } from "launchdarkly-react-client-sdk";
import { Userpilot } from "userpilot";
import { registerSW } from "virtual:pwa-register";
import { createLaunchDarklyContext } from "@/lib/utils/launchDarklyContext";
import { envConfig } from "./config/envConfig";
import { datadogRUMInit } from "./lib/datadog-rum";
import App from "./App";
import "./index.css";

import { initLogger, log } from "@/Logger";

registerSW({ immediate: true });

datadogRUMInit();

const userpilotAppToken = envConfig.VITE_USERPILOT_APP_TOKEN;
Userpilot.initialize(String(userpilotAppToken ?? ""));

const container = document.getElementById("root") as HTMLElement;
const root = createRoot(container);

(async () => {
	await initLogger();

	const ldContext = createLaunchDarklyContext();

	const LDProvider = await asyncWithLDProvider({
		clientSideID: String(envConfig.VITE_LD_CLIENT_KEY ?? ""),
		reactOptions: {
			useCamelCaseFlagKeys: false,
		},
		...(ldContext && { context: ldContext }),
	});
	root.render(
		<React.StrictMode>
			<LDProvider>
				<App />
			</LDProvider>
		</React.StrictMode>,
	);
})().catch((e) => {});
