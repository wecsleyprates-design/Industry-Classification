import React from "react";
import { createRoot } from "react-dom/client";
import { asyncWithLDProvider } from "launchdarkly-react-client-sdk";
import App from "./App";
import "./index.css";

import { envConfig } from "@/config/envConfig";

const container = document.getElementById("root") as HTMLElement;
const root = createRoot(container);

(async () => {
	const LDProvider = await asyncWithLDProvider({
		clientSideID: envConfig.VITE_LD_CLIENT_KEY,
		reactOptions: {
			useCamelCaseFlagKeys: false,
		},
	});
	root.render(
		<React.StrictMode>
			<LDProvider>
				<App />
			</LDProvider>
		</React.StrictMode>,
	);
})().catch(() => {});
