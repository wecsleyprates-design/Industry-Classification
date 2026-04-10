import { DEFAULT_SERP_API_BASE_URL, resolveSerpApiBaseUrl } from "../resolveSerpApiBaseUrl";

describe("resolveSerpApiBaseUrl", () => {
	const warn = jest.fn();

	beforeEach(() => {
		warn.mockReset();
	});

	it("defaults to serpapi when the config is unset", () => {
		expect(resolveSerpApiBaseUrl(undefined, "test", warn)).toBe(DEFAULT_SERP_API_BASE_URL);
		expect(resolveSerpApiBaseUrl("   ", "test", warn)).toBe(DEFAULT_SERP_API_BASE_URL);
		expect(warn).not.toHaveBeenCalled();
	});

	it("falls back and warns on invalid URLs", () => {
		expect(resolveSerpApiBaseUrl("not a url", "test", warn)).toBe(DEFAULT_SERP_API_BASE_URL);
		expect(warn).toHaveBeenCalledWith("Ignoring invalid CONFIG_SERPAPI_BASE_URL", {
			serpApiBaseUrlRaw: "not a url"
		});
	});

	it("falls back and warns on unsupported protocols", () => {
		expect(resolveSerpApiBaseUrl("ftp://example.com/stub", "test", warn)).toBe(DEFAULT_SERP_API_BASE_URL);
		expect(warn).toHaveBeenCalledWith("Ignoring CONFIG_SERPAPI_BASE_URL with unsupported protocol", {
			serpApiBaseUrlRaw: "ftp://example.com/stub"
		});
	});

	it("normalizes valid URLs to their origin", () => {
		expect(resolveSerpApiBaseUrl("https://serpapi.com/search.json?engine=google_maps", "test", warn)).toBe(
			DEFAULT_SERP_API_BASE_URL
		);
		expect(warn).not.toHaveBeenCalled();
	});

	it("allows loopback origins in production", () => {
		expect(resolveSerpApiBaseUrl("http://127.0.0.1:18765/search", "production", warn)).toBe("http://127.0.0.1:18765");
		expect(warn).not.toHaveBeenCalled();
	});

	it("coerces non-loopback production overrides back to serpapi and warns", () => {
		expect(resolveSerpApiBaseUrl("https://example.com/serp-stub", "production", warn)).toBe(DEFAULT_SERP_API_BASE_URL);
		expect(warn).toHaveBeenCalledWith("Ignoring non-loopback CONFIG_SERPAPI_BASE_URL in production", {
			serpApiBaseUrlRaw: "https://example.com/serp-stub",
			serpApiBaseUrlResolved: "https://example.com"
		});
	});

	it("allows non-loopback origins outside production", () => {
		expect(resolveSerpApiBaseUrl("https://example.com/serp-stub", "development", warn)).toBe("https://example.com");
		expect(warn).not.toHaveBeenCalled();
	});
});
