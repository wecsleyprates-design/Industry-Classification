const DEFAULT_SERP_API_BASE_URL = "https://serpapi.com";
const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);

export const resolveSerpApiBaseUrl = (rawValue, nodeEnv, warn = () => undefined) => {
	const trimmed = typeof rawValue === "string" ? rawValue.trim() : "";

	if (!trimmed) {
		return DEFAULT_SERP_API_BASE_URL;
	}

	try {
		const parsed = new URL(trimmed);
		if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
			warn("Ignoring CONFIG_SERPAPI_BASE_URL with unsupported protocol", {
				serpApiBaseUrlRaw: rawValue
			});
			return DEFAULT_SERP_API_BASE_URL;
		}

		const origin = parsed.origin;
		if (nodeEnv === "production" && !LOOPBACK_HOSTS.has(parsed.hostname) && origin !== DEFAULT_SERP_API_BASE_URL) {
			warn("Ignoring non-loopback CONFIG_SERPAPI_BASE_URL in production", {
				serpApiBaseUrlRaw: rawValue,
				serpApiBaseUrlResolved: origin
			});
			return DEFAULT_SERP_API_BASE_URL;
		}

		return origin;
	} catch {
		warn("Ignoring invalid CONFIG_SERPAPI_BASE_URL", {
			serpApiBaseUrlRaw: rawValue
		});
		return DEFAULT_SERP_API_BASE_URL;
	}
};

export { DEFAULT_SERP_API_BASE_URL };
