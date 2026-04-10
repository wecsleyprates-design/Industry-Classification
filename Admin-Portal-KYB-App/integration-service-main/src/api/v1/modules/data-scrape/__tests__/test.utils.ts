export const businessID = "11111111-1111-4111-8111-111111111111";
export const alternateBusinessID = "22222222-2222-4222-8222-222222222222";
export const taskID = "22222222-2222-4222-8222-222222222222";

export const defaultBusinessName = "Test Business";
export const defaultBusinessTitle = defaultBusinessName;
export const defaultLocalBusinessTitle = "Local Test Business";
export const defaultBusinessAddress = "123 Market St, San Francisco, CA 94105";

export const routeSuccessMessage = "Matches found in search for business details.";
export const serviceSuccessMessage = "Business entity website details fetched successfully";
export const localResultsFoundMessage = "No business match found, but local results found";
export const timeoutDegradedMessage = "We had an issue with the search, please try again later.";

export const baseHarnessEnvConfig = {
	ENV: "test",
	OPEN_AI_KEY: "mock-open-ai-key",
	SERP_API_BASE_URL: "https://serpapi.com",
	SERP_API_KEY: "MOCK_SERP_API_KEY",
	SYNCHRONOUS_API_TIMEOUT_SECONDS: 60
};

export const createMockConstants = () => ({
	ERROR_CODES: {
		UNKNOWN_ERROR: "UNKNOWN_ERROR"
	},
	INTEGRATION_ID: {
		SERP_SCRAPE: 200
	},
	DIRECTORIES: {
		BUSINESS_SERP_SCRAPE: "business-serp-scrape"
	},
	CONNECTION_STATUS: {
		SUCCESS: "SUCCESS"
	},
	SCORE_TRIGGER: {
		MANUAL_REFRESH: "MANUAL_REFRESH"
	},
	kafkaTopics: {
		BUSINESS: "business.v1"
	},
	kafkaEvents: {
		UPDATE_NAICS_CODE: "update_naics_code_event"
	},
	FEATURE_FLAGS: {
		PAT_64_SERP_LOGIC_UPDATE: "PAT_64_SERP_LOGIC_UPDATE"
	},
	TASK_STATUS: {
		SUCCESS: "SUCCESS"
	}
});

export const buildValidSearchBusinessBody = () => ({
	businessName: defaultBusinessName,
	businessAddress: defaultBusinessAddress
});

export const buildRouteSearchSuccessResponse = () => ({
	message: routeSuccessMessage,
	businessMatch: { title: defaultBusinessTitle }
});

export const buildPlaceResult = (overrides: Record<string, unknown> = {}) =>
	({
		title: defaultBusinessTitle,
		place_id: "place-1",
		data_id: "data-1",
		data_cid: "cid-1",
		reviews_link: "https://reviews.example.com",
		photos_link: "https://photos.example.com",
		gps_coordinates: {
			latitude: 37.7749,
			longitude: -122.4194
		},
		place_id_search: "search-1",
		provider_id: "provider-1",
		thumbnail: "https://images.example.com/thumb.png",
		rating: 4.9,
		reviews: 37,
		price: "$$",
		type: ["consulting"],
		type_ids: ["consulting"],
		service_options: {
			delivery: false,
			takeout: false,
			dine_in: false
		},
		address: defaultBusinessAddress,
		website: "https://test-business.example.com",
		phone: "555-0100",
		open_state: "Open",
		plus_code: "QH9C+X8",
		images: [],
		user_reviews: {
			summary: [],
			most_relevant: []
		},
		rating_summary: [],
		web_results_link: "https://web-results.example.com",
		serpapi_web_results_link: "https://serp-web.example.com",
		...overrides
	}) as any;

export const buildLocalResult = (overrides: Record<string, unknown> = {}) =>
	({
		position: 1,
		title: defaultLocalBusinessTitle,
		place_id: "local-place-1",
		data_id: "local-data-1",
		data_cid: "local-cid-1",
		reviews_link: "",
		photos_link: "https://photos.example.com/local.png",
		gps_coordinates: {
			latitude: 37.7749,
			longitude: -122.4194
		},
		place_id_search: "local-search-1",
		provider_id: "local-provider-1",
		rating: 4.5,
		reviews: 18,
		price: "$",
		type: "restaurant",
		types: ["restaurant"],
		type_id: "restaurant",
		type_ids: ["restaurant"],
		address: defaultBusinessAddress,
		open_state: "Open",
		hours: "Open now",
		operating_hours: {},
		phone: "555-0101",
		website: "https://local-business.example.com",
		service_options: {
			dine_in: true,
			takeout: true,
			delivery: false
		},
		order_online: "",
		thumbnail: "https://images.example.com/local-thumb.png",
		...overrides
	}) as any;

export const buildReview = (overrides: Record<string, unknown> = {}) =>
	({
		link: "https://reviews.example.com/review-1",
		rating: 5,
		date: "2 days ago",
		iso_date: "2025-01-01",
		iso_date_of_last_edit: "2025-01-01",
		images: [],
		source: "Google",
		review_id: "review-1",
		user: {
			name: "Reviewer",
			link: "https://profiles.example.com/reviewer",
			contributor_id: "contributor-1",
			thumbnail: "https://images.example.com/reviewer.png",
			reviews: 12,
			photos: 3
		},
		snippet: "Great team to work with.",
		extracted_snippet: {
			original: "Great team to work with."
		},
		details: {
			service: 5,
			meal_type: "",
			food: 0,
			atmosphere: 0
		},
		likes: 0,
		...overrides
	}) as any;

export const buildSerializedWebsiteData = (overrides: Record<string, unknown> = {}) => ({
	company_description: "Worth helps businesses with onboarding.",
	target_audience: "Small businesses",
	industry: "Professional services",
	industry_vertical: "Fintech",
	industry_mapped: "financial_services",
	relevant_tags: ["onboarding", "risk"],
	...overrides
});

export const buildBusinessLegitimacyClassification = (overrides: Record<string, unknown> = {}) => ({
	naics_code: 541611,
	secondary_naics_code: 0,
	sic_code: 8742,
	secondary_sic_code: 0,
	confidence_in_business_legitimacy: 93,
	...overrides
});

export const buildReviewSynthesis = (overrides: Record<string, unknown> = {}) => ({
	best_review: "Fast, thoughtful service",
	worst_review: null,
	general_sentiment: "positive",
	relevant_emotions: ["trust"],
	suggested_focus_area: "support",
	...overrides
});

/*
 * Scrubbed from a Datadog-observed search-business-details payload shape:
 * a top-level place result can include reviews_link, website, unclaimed_listing, and type
 * while omitting aggregate rating/review counts. That should still allow review scraping
 * without entering the synthesis branch.
 */
export const buildDatadogStylePlaceResult = (overrides: Record<string, unknown> = {}) =>
	buildPlaceResult({
		title: "Northwood Property Management",
		provider_id: "/g/property-management",
		unclaimed_listing: true,
		type: ["Property management company"],
		type_ids: ["property_management_company"],
		address: "432 Henry St, Exampletown, WI 54165",
		website: "https://property-management.example.com",
		reviews_link:
			"https://serpapi.com/search.json?engine=google_maps_reviews&hl=en&data_id=datadog-observed-property",
		rating: undefined,
		reviews: undefined,
		...overrides
	});
