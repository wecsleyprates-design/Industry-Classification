import { useMemo } from "react";
import { useVersionChecker } from "./useVersionChecker";

import { REMOTE_APPS } from "@/constants/remoteUrls";

export function useAllVersionCheckers() {
	// Prepare configs for host app and all remote apps
	const configs = useMemo(() => {
		// Host app config
		const hostConfig = { autoReload: true };

		// Remote apps configs
		const remoteConfigs = REMOTE_APPS.map(({ key, envKey }) => {
			const remoteEntryUrl = import.meta.env[envKey];
			const versionUrl = remoteEntryUrl
				? remoteEntryUrl.replace("/assets/remoteEntry.js", "/version.json")
				: undefined;

			return {
				url: versionUrl,
				autoReload: true,
				key,
			};
		});

		return [hostConfig, ...remoteConfigs];
	}, []);

	// Check all versions with a single hook call
	useVersionChecker(configs);
}
