import {
	getAddressVerificationReviewTask,
	getBusinessNameMatches,
	getBusinessReviewTask,
	getRegisteredAgentReviewTask,
	getSortedAddressSources,
	getSortedRegistrations,
	getWatchlistHits,
	getWatchlistReviewTask,
	titleExistsInWatchlistHits,
} from "../helpers";

// #region Mocked response from the server
const mockedBusinessNameReviewTask = {
	id: "2dc06908-fde0-49d9-8bd2-f4ff4ba495a0",
	business_entity_verification_id: "f0266e50-32bb-402f-bee0-3894a2a614b9",
	created_at: "2024-02-29T11:40:29.043Z",
	updated_at: null,
	category: "name",
	key: "name",
	status: "warning",
	message: "Similar match identified to the submitted Business Name",
	label: "Business Name",
	sublabel: "Similar Match",
	metadata: [
		{
			id: "71c9dcb9-9653-4f91-841a-cf33a074c40e",
			type: "name",
			metadata: {
				name: "Similar Name Business pt49",
				submitted: true,
			},
		},
		{
			id: "ca24a95f-a993-401c-a046-812fbd5ccb61",
			type: "name",
			metadata: {
				name: "Similar Name Buziness pt49",
				submitted: false,
			},
		},
	],
};

const mockedAddressVerificationReviewTask = {
	id: "6cf26130-338c-408d-b2cb-17e7a169a283",
	business_entity_verification_id: "f0266e50-32bb-402f-bee0-3894a2a614b9",
	created_at: "2024-02-29T11:40:29.043Z",
	updated_at: null,
	category: "address",
	key: "address_verification",
	status: "success",
	message: "Match identified to the submitted Office Address",
	label: "Office Address",
	sublabel: "Verified",
	metadata: [
		{
			id: "50742bd2-3dc0-42a9-8cbe-6b18ccd1d5f2",
			type: "address",
			metadata: {
				city: "Orlando",
				state: "FL",
				submitted: true,
				postal_code: "32819",
				full_address: "8990 Turkey Lake Rd, Orlando, FL 32819",
				address_line1: "8990 Turkey Lake Rd",
				address_line2: null,
			},
		},
	],
};

const mockedRegisteredAgentReviewTask = {
	id: "672ff9a8-2759-4d2d-bbcd-de45fbaa594e",
	business_entity_verification_id: "3d66a397-5235-4a4d-9d2c-3bafd886f10a",
	created_at: "2024-03-03T01:29:45.639Z",
	updated_at: null,
	category: "address",
	key: "address_registered_agent",
	status: "warning",
	message:
		"Submitted Office Address is associated with a known Registered Agent",
	label: "Office Address",
	sublabel: "Registered Agent",
	metadata: [],
};

const mockedWatchlistReviewTask = {
	id: "8af16ff9-11e0-4fbd-a2c8-0fe3bf429784",
	business_entity_verification_id: "9b8f21d1-acb7-4c91-9cd2-2f95494f67ef",
	created_at: "2024-02-29T13:45:06.620Z",
	updated_at: null,
	category: "watchlist",
	key: "watchlist",
	status: "failure",
	message: "1 Watchlists hit(s) have been identified",
	label: "Watchlist",
	sublabel: "Hits",
	metadata: [
		{
			id: "9526e3aa-a64e-4ecd-88e5-6d4fd7c435b3",
			type: "watchlist_result",
			metadata: {
				abbr: "SDN",
				title: "Specially Designated Nationals",
				agency: "Office of Foreign Assets Control",
				agency_abbr: "OFAC",
				entity_name: "Test pt50 watchlist hit",
			},
		},
	],
};

const mockedRegistrations = [
	{
		id: "485af7bc-4144-4326-831d-25000c76750a",
		business_entity_verification_id: "f0266e50-32bb-402f-bee0-3894a2a614b9",
		created_at: "2024-02-29T11:40:29.049Z",
		updated_at: null,
		external_id: "90ba7052-3aba-4ba5-9d2a-b3c6b09f928e",
		name: "Similar Name Buziness pt49",
		status: "active",
		sub_status: "GOOD_STANDING",
		status_details: "Active-Good Standing",
		jurisdiction: "DOMESTIC",
		entity_type: "CORPORATION",
		file_number: "FN-XXXXXXX",
		full_addresses: [
			"8990 TURKEY LAKE RD, ORLANDO, FL 32819",
			"354 CIRCLE COURT,BRONX, NY 10468",
		],
		registration_date: "2020-02-24T00:00:00.000Z",
		registration_state: "FL",
		source: "http://search.sunbiz.org/Inquiry/CorporationSearch/ByName",
	},
	{
		id: "ff16872c-0af0-4553-8d90-d36e0279352b",
		business_entity_verification_id: "f0266e50-32bb-402f-bee0-3894a2a614b9",
		created_at: "2024-02-29T11:40:29.049Z",
		updated_at: null,
		external_id: "5dcfb98f-382b-427d-8928-2926fd7690b0",
		name: "Similar Name Buziness pt49",
		status: "active",
		sub_status: null,
		status_details: null,
		jurisdiction: "FOREIGN",
		entity_type: "CORPORATION",
		file_number: "12345135135",
		full_addresses: [
			"8990 TURKEY LAKE RD, ORLANDO, FL 32819",
			"354 CIRCLE COURT,BRONX, NY 10468",
		],
		registration_date: "2020-02-23T00:00:00.000Z",
		registration_state: "CO",
		source: "https://www.sos.state.co.us/biz/BusinessEntityCriteriaExt.do",
	},
];

const mockedAddressSources = [
	{
		id: "db886a45-9acf-47ad-800d-c33df21de8cc",
		business_entity_verification_id: "f0266e50-32bb-402f-bee0-3894a2a614b9",
		created_at: "2024-02-29T11:40:29.047Z",
		updated_at: null,
		external_id: "50742bd2-3dc0-42a9-8cbe-6b18ccd1d5f2",
		external_registration_id: "90ba7052-3aba-4ba5-9d2a-b3c6b09f928e",
		full_address: "8990 Turkey Lake Rd, Orlando, FL 32819",
		address_line_1: "8990 Turkey Lake Rd",
		address_line_2: null,
		city: "Orlando",
		state: "FL",
		postal_code: "32819",
		lat: 40.52,
		long: 30.4,
		submitted: true,
		deliverable: true,
		cmra: false,
		address_property_type: null,
	},
	{
		id: "4a59d696-adbe-4bfe-a123-71f12a88f96c",
		business_entity_verification_id: "f0266e50-32bb-402f-bee0-3894a2a614b9",
		created_at: "2024-02-28T11:40:29.047Z",
		updated_at: null,
		external_id: "dbaa991f-5f25-4617-9ffb-4713c1737190",
		external_registration_id: "90ba7052-3aba-4ba5-9d2a-b3c6b09f928e",
		full_address: "354 Circle Ct, Bronx, NY 10468",
		address_line_1: "354 Circle Ct",
		address_line_2: null,
		city: "Bronx",
		state: "NY",
		postal_code: "10468",
		lat: null,
		long: null,
		submitted: false,
		deliverable: true,
		cmra: false,
		address_property_type: null,
	},
];

const mockedBusinessVerificationDetails = {
	status: "success",
	message: "Business Verification status fetched successfully.",
	data: {
		businessEntityVerification: {
			id: "f0266e50-32bb-402f-bee0-3894a2a614b9",
			created_at: "2024-02-29T11:40:27.566Z",
			updated_at: null,
			business_integration_task_id: "3102257f-6ff3-48bc-bfdb-b813bb48a0a0",
			external_id: "b429156b-dd02-4712-845b-1e094d902a45",
			business_id: "ddf8053b-bd4a-468f-8f9a-eed5c79b4cfb",
			name: "Similar Name Business pt49",
			status: "in_review",
			tin: "111220002",
		},
		reviewTasks: [
			mockedBusinessNameReviewTask,
			mockedAddressVerificationReviewTask,
			mockedRegisteredAgentReviewTask,
			{
				id: "c505f9d6-0177-4598-8c6e-30cdac22a198",
				business_entity_verification_id: "f0266e50-32bb-402f-bee0-3894a2a614b9",
				created_at: "2024-02-29T11:40:29.043Z",
				updated_at: null,
				category: "address",
				key: "address_deliverability",
				status: "success",
				message:
					"The USPS is able to deliver mail to the submitted Office Address",
				label: "Office Address",
				sublabel: "Deliverable",
				metadata: [],
			},
			{
				id: "03d53bad-dec3-4d24-9836-073a9355c5cb",
				business_entity_verification_id: "f0266e50-32bb-402f-bee0-3894a2a614b9",
				created_at: "2024-02-29T11:40:29.043Z",
				updated_at: null,
				category: "address",
				key: "address_property_type",
				status: "success",
				message: "Submitted Office Address is a Commercial property",
				label: "Office Address",
				sublabel: "Commercial",
				metadata: [],
			},
			{
				id: "5322cc60-67b5-4bb0-b584-f25040bc5884",
				business_entity_verification_id: "f0266e50-32bb-402f-bee0-3894a2a614b9",
				created_at: "2024-02-29T11:40:29.043Z",
				updated_at: null,
				category: "sos",
				key: "sos_match",
				status: "success",
				message:
					"The business is Active in the state of the submitted Office Address",
				label: "SOS Filings",
				sublabel: "Submitted Active",
				metadata: [],
			},
			{
				id: "78f4d84d-f4fa-466c-baf3-3524ace39f82",
				business_entity_verification_id: "f0266e50-32bb-402f-bee0-3894a2a614b9",
				created_at: "2024-02-29T11:40:29.043Z",
				updated_at: null,
				category: "sos",
				key: "sos_active",
				status: "success",
				message: "2 of 2 filings are Active",
				label: "SOS Filings",
				sublabel: "Active",
				metadata: [],
			},
			{
				id: "6a29e1d6-e9a6-4528-8fdc-29491da8c338",
				business_entity_verification_id: "f0266e50-32bb-402f-bee0-3894a2a614b9",
				created_at: "2024-02-29T11:40:29.043Z",
				updated_at: null,
				category: "sos",
				key: "sos_domestic_sub_status",
				status: "success",
				message: "The domestic registration is in Good Standing.",
				label: "SOS Domestic Sub‑status",
				sublabel: "Good Standing",
				metadata: [],
			},
			{
				id: "36827776-3d96-4ab3-92a8-9e79977a78a1",
				business_entity_verification_id: "f0266e50-32bb-402f-bee0-3894a2a614b9",
				created_at: "2024-02-29T11:40:29.043Z",
				updated_at: null,
				category: "sos",
				key: "sos_domestic",
				status: "success",
				message: "Active domestic filing found",
				label: "SOS Filings",
				sublabel: "Domestic Active",
				metadata: [],
			},
			{
				id: "96b1b137-7e7d-4b69-b9a1-350b73ec7ed6",
				business_entity_verification_id: "f0266e50-32bb-402f-bee0-3894a2a614b9",
				created_at: "2024-02-29T11:40:29.043Z",
				updated_at: null,
				category: "tin",
				key: "tin",
				status: "success",
				message:
					"The IRS has a record for the submitted TIN and Business Name combination",
				label: "TIN Match",
				sublabel: "Found",
				metadata: [],
			},
			mockedWatchlistReviewTask,
			{
				id: "1e0bb48a-d98a-4366-a7b4-212482c1050c",
				business_entity_verification_id: "f0266e50-32bb-402f-bee0-3894a2a614b9",
				created_at: "2024-02-29T11:40:29.043Z",
				updated_at: null,
				category: "bankruptcies",
				key: "bankruptcies",
				status: "success",
				message: "The business has no bankruptcy filings",
				label: "Bankruptcies",
				sublabel: "None Found",
				metadata: [],
			},
		],
		registrations: mockedRegistrations,
		addressSources: mockedAddressSources,
	},
};
// #endregion

describe("getBusinessReviewTask", () => {
	it("should return the business name review task", () => {
		const reviewTask = getBusinessReviewTask(
			mockedBusinessVerificationDetails.data.reviewTasks,
		);

		expect(reviewTask?.key).toEqual("name");
		expect(reviewTask).toStrictEqual(mockedBusinessNameReviewTask);
	});
});

describe("getBusinessNameMatches", () => {
	it("should return the metadata from a business name review task metadata item", () => {
		const mockedBusinessNameReviewTask = getBusinessNameMatches(
			mockedBusinessVerificationDetails.data.reviewTasks,
			[],
		);

		const expected = [
			{
				name: "Similar Name Business pt49",
				submitted: true,
			},
			{
				name: "Similar Name Buziness pt49",
				submitted: false,
			},
		];

		expect(mockedBusinessNameReviewTask).toEqual(expected);
	});
});

describe("getSortedRegistrations", () => {
	it("should return registrations sorted by registration_date", () => {
		const expected = [
			{ ...mockedRegistrations[1] },
			{ ...mockedRegistrations[0] },
		];
		expect(getSortedRegistrations(mockedRegistrations)).toEqual(expected);
	});
});

describe("getSortedAddressSources", () => {
	it("should return address sources sorted by created_at", () => {
		const expected = [
			{ ...mockedAddressSources[1] },
			{ ...mockedAddressSources[0] },
		];
		expect(getSortedAddressSources(mockedAddressSources)).toEqual(expected);
	});
});

describe("getWatchlistReviewTask", () => {
	it("should return the watchlist review task", () => {
		const reviewTask = getWatchlistReviewTask(
			mockedBusinessVerificationDetails.data.reviewTasks,
		);

		expect(reviewTask?.key).toEqual("watchlist");
		expect(reviewTask).toStrictEqual(mockedWatchlistReviewTask);
	});
});

describe("getWatchlistHits", () => {
	it("should return the metadata from a watchlist review task metadata item", () => {
		const watchlistHits = getWatchlistHits(
			mockedBusinessVerificationDetails.data.reviewTasks,
		);

		const expected = [
			{
				abbr: "SDN",
				title: "Specially Designated Nationals",
				agency: "Office of Foreign Assets Control",
				agency_abbr: "OFAC",
				entity_name: "Test pt50 watchlist hit",
			},
		];

		expect(watchlistHits).toEqual(expected);
	});
});

describe("titleExistsInWatchlistHits", () => {
	it("should return true if the title exists in watchlist hits", () => {
		const hits = [
			{
				abbr: "SDN",
				title: "Specially Designated Nationals",
				agency: "Office of Foreign Assets Control",
				agency_abbr: "OFAC",
				entity_name: "Test pt50 watchlist hit",
			},
			{
				abbr: "UN",
				title: "United Nations Sanctions",
				agency: "United Nations",
				agency_abbr: "UN",
				entity_name: "Test pt51 watchlist hit",
			},
		];

		const titleExists = titleExistsInWatchlistHits(
			"Specially Designated Nationals",
			hits,
		);
		expect(titleExists).toBe(true);
	});

	it("should return false if the title does not exist in watchlist hits", () => {
		const hits = [
			{
				abbr: "SDN",
				title: "Specially Designated Nationals",
				agency: "Office of Foreign Assets Control",
				agency_abbr: "OFAC",
				entity_name: "Test pt50 watchlist hit",
			},
			{
				abbr: "UN",
				title: "United Nations Sanctions",
				agency: "United Nations",
				agency_abbr: "UN",
				entity_name: "Test pt51 watchlist hit",
			},
		];

		const titleDoesNotExist = titleExistsInWatchlistHits(
			"Non-Existent Title",
			hits,
		);
		expect(titleDoesNotExist).toBe(false);
	});
});

describe("getAddressVerificationReviewTask", () => {
	it("should return the address verification review task", () => {
		const reviewTask = getAddressVerificationReviewTask(
			mockedBusinessVerificationDetails.data.reviewTasks,
		);

		expect(reviewTask?.key).toEqual("address_verification");
		expect(reviewTask).toStrictEqual(mockedAddressVerificationReviewTask);
	});
});

describe("getRegisteredAgentReviewTask", () => {
	it("should return the address registered agent review task", () => {
		const reviewTask = getRegisteredAgentReviewTask(
			mockedBusinessVerificationDetails.data.reviewTasks,
		);

		expect(reviewTask?.key).toEqual("address_registered_agent");
		expect(reviewTask).toStrictEqual(mockedRegisteredAgentReviewTask);
	});
});
