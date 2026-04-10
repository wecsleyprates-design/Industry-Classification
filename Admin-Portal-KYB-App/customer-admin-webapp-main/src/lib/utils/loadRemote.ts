type RemoteConfig = {
	remoteName: string;
	baseUrl: string;
	entryPath?: string;
	versionPath?: string;
};

/**
 * Fetch version.json and construct the full remoteEntry URL
 */
async function fetchRemoteVersion(cfg: RemoteConfig): Promise<string> {
	const versionUrl = `${cfg.baseUrl}${cfg.versionPath ?? "/version.json"}`;
	try {
		const resp = await fetch(versionUrl, { cache: "no-store" });
		if (!resp.ok) throw new Error("No version file");
		const json = await resp.json();
		if (json.remoteEntry) return json.remoteEntry;
		if (json.version) {
			return `${cfg.baseUrl}${
				cfg.entryPath ?? "/assets/remoteEntry.js"
			}?v=${String(json.version)}`;
		}
	} catch (err) {
		console.warn(
			`[federation] Failed to fetch version.json for ${cfg.remoteName}`,
			err,
		);
	}
	return `${cfg.baseUrl}${cfg.entryPath ?? "/assets/remoteEntry.js"}`;
}

/**
 * Dynamically import the remote entry file as an ESM module.
 * This is the correct approach for @originjs/vite-plugin-federation.
 */
async function importRemoteEntry(url: string) {
	return await import(/* @vite-ignore */ url);
}

/**
 * Load and initialize a remote module
 */
export async function loadRemoteModule<T = any>(
	cfg: RemoteConfig,
	exposedModule: string,
): Promise<{ default: T }> {
	const remoteUrl = await fetchRemoteVersion(cfg);

	// Dynamically import the remote entry as an ESM module
	const remoteContainer = await importRemoteEntry(remoteUrl);

	// Ensure get/init exist
	if (!remoteContainer?.init || !remoteContainer?.get) {
		throw new Error(
			`Invalid remote container for ${cfg.remoteName}: missing init/get`,
		);
	}

	// Initialize shared scope - ensure React is properly shared as singleton
	if (!(window as any).__federation_shared__) {
		// Dynamically import shared dependencies in ESM environment
		const react = await import("react");
		const reactDom = await import("react-dom");
		const reactIs = await import("react-is");
		const zustand = await import("zustand");
		const reactQuery = await import("@tanstack/react-query");
		const reactRouterDom = await import("react-router-dom");
		const reactRouter = await import("react-router");
		const reactMultiDatePicker = await import("react-multi-date-picker");
		const launchdarklyReactClientSdk =
			await import("launchdarkly-react-client-sdk");
		const recharts = await import("recharts");
		const reactSelect = await import("react-select");
		const reactHookForm = await import("react-hook-form");
		const headlessui = await import("@headlessui/react");

		// Create shared scope with proper structure for module federation
		// The get function should return a factory that returns the module directly
		(window as any).__federation_shared__ = {
			default: {
				react: {
					"19.2.4": {
						get: () => () => react,
						loaded: true,
						eager: true,
					},
				},
				"react-dom": {
					"19.2.4": {
						get: () => () => reactDom,
						loaded: true,
						eager: true,
					},
				},
				"react-is": {
					"19.2.4": {
						get: () => () => reactIs,
						loaded: true,
						eager: true,
					},
				},
				zustand: {
					"5.0.10": {
						get: () => () => zustand,
						loaded: true,
						eager: true,
					},
				},
				"@tanstack/react-query": {
					"5.90.20": {
						get: () => () => reactQuery,
						loaded: true,
						eager: true,
					},
				},
				"react-router-dom": {
					"7.13.0": {
						get: () => () => reactRouterDom,
						loaded: true,
						eager: true,
					},
				},
				"react-router": {
					"7.13.0": {
						get: () => () => reactRouter,
						loaded: true,
						eager: true,
					},
				},
				"react-multi-date-picker": {
					"4.5.2": {
						get: () => () => reactMultiDatePicker,
						loaded: true,
						eager: true,
					},
				},
				"launchdarkly-react-client-sdk": {
					"3.9.0": {
						get: () => () => launchdarklyReactClientSdk,
						loaded: true,
						eager: true,
					},
				},
				recharts: {
					"3.7.0": {
						get: () => () => recharts,
						loaded: true,
						eager: true,
					},
				},
				"react-select": {
					"5.10.2": {
						get: () => () => reactSelect,
						loaded: true,
						eager: true,
					},
				},
				"react-hook-form": {
					"7.71.1": {
						get: () => () => reactHookForm,
						loaded: true,
						eager: true,
					},
				},
				"@headlessui/react": {
					"2.2.9": {
						get: () => () => headlessui,
						loaded: true,
						eager: true,
					},
				},
			},
		};
		await remoteContainer.init((window as any).__federation_shared__);
	}

	// Get and execute the exposed module factory
	const factory = await remoteContainer.get(exposedModule);
	const Module = factory();
	if (!Module) {
		throw new Error(`Module ${exposedModule} did not export correctly`);
	}

	// React.lazy expects { default: Component }
	return { default: Module.default || Module };
}
