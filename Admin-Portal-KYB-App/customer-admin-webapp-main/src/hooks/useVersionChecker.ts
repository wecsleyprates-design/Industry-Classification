import { useEffect } from "react";
import { getItem, setItem } from "@/lib/localStorage";

import { LOCALSTORAGE } from "@/constants/LocalStorage";

type VersionCheckerConfig = {
	url?: string;
	interval?: number;
	onNewVersion?: () => void;
	autoReload?: boolean;
	key?: string;
};

/**
 * useVersionChecker
 * Periodically checks a version.json file to detect new deployments.
 * Can accept either a single config object or an array of configs.
 *
 * @param config - Single config object or array of version checker configurations
 * @param config.url - URL to version.json (default: "/version.json")
 * @param config.interval - Check interval in ms (default: 5 minutes)
 * @param config.onNewVersion - Optional callback when a new version is found
 * @param config.autoReload - If true, performs a hard refresh automatically
 * @param config.key - Local storage key for version tracking
 */
export const useVersionChecker = (
	config: VersionCheckerConfig | VersionCheckerConfig[],
) => {
	useEffect(() => {
		const configs = Array.isArray(config) ? config : [config];
		const cleanupFunctions: Array<() => void> = [];

		configs.forEach(
			({
				url = "/version.json",
				interval = 5 * 60 * 1000, // 5 min
				onNewVersion,
				autoReload = false,
				key = "app_version",
			}) => {
				const checkVersion = async () => {
					try {
						const response = await fetch(url, { cache: "no-store" });
						if (!response.ok) return;

						const { version } = await response.json();
						const storedVersion = getItem(key);
						if (storedVersion && storedVersion !== version) {
							setItem(key, version);
							if (autoReload) {
								setItem(LOCALSTORAGE.isReloadable, true);
							} else if (onNewVersion) {
								onNewVersion();
							}
						} else {
							setItem(key, version);
						}
					} catch (error) {
						console.warn("Version check failed:", error);
					}
				};

				// Initial check
				void checkVersion();
				const timer = setInterval(() => {
					void checkVersion();
				}, interval);

				cleanupFunctions.push(() => {
					clearInterval(timer);
				});
			},
		);

		return () => {
			cleanupFunctions.forEach((cleanup) => {
				cleanup();
			});
		};
	}, [config]);
};
