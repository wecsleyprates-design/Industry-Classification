import { extractAddressMatchStatusFromDatasourceFields, extractRecordStatusFromTruliooResponse } from "../utils";

/**
 * Helper to build a minimal clientData with DatasourceResults.DatasourceFields.
 * Mirrors the Trulioo response structure:
 *   clientData.serviceData[].fullServiceDetails.Record.DatasourceResults[].DatasourceFields[]
 */
function buildClientData(
	datasourceResults: Array<{
		DatasourceName?: string;
		DatasourceFields?: Array<{ FieldName: string; Status: string }>;
	}>
): Record<string, unknown> {
	return {
		serviceData: [
			{
				fullServiceDetails: {
					Record: {
						DatasourceResults: datasourceResults
					}
				}
			}
		]
	};
}

describe("extractAddressMatchStatusFromDatasourceFields", () => {
	it("should return undefined when clientData is undefined", () => {
		expect(extractAddressMatchStatusFromDatasourceFields(undefined)).toBeUndefined();
	});

	it("should return undefined when clientData is empty", () => {
		expect(extractAddressMatchStatusFromDatasourceFields({})).toBeUndefined();
	});

	it("should return undefined when serviceData is missing", () => {
		expect(extractAddressMatchStatusFromDatasourceFields({ foo: "bar" })).toBeUndefined();
	});

	it("should return undefined when DatasourceResults is missing", () => {
		const clientData = {
			serviceData: [{ fullServiceDetails: { Record: {} } }]
		};
		expect(extractAddressMatchStatusFromDatasourceFields(clientData)).toBeUndefined();
	});

	it("should return undefined when DatasourceFields is empty (no address fields found)", () => {
		const clientData = buildClientData([
			{ DatasourceName: "Business Essentials", DatasourceFields: [] }
		]);
		expect(extractAddressMatchStatusFromDatasourceFields(clientData)).toBeUndefined();
	});

	it("should return undefined when only non-address fields are present", () => {
		const clientData = buildClientData([
			{
				DatasourceName: "Business Essentials",
				DatasourceFields: [
					{ FieldName: "BusinessName", Status: "match" },
					{ FieldName: "BusinessRegistrationNumber", Status: "match" }
				]
			}
		]);
		expect(extractAddressMatchStatusFromDatasourceFields(clientData)).toBeUndefined();
	});

	it("should return 'match' when all address fields are 'match' (StateProvinceCode ignored)", () => {
		const clientData = buildClientData([
			{
				DatasourceName: "Address Validation",
				DatasourceFields: [
					{ FieldName: "BusinessName", Status: "match" },
					{ FieldName: "Address1", Status: "match" },
					{ FieldName: "StreetName", Status: "match" },
					{ FieldName: "City", Status: "match" },
					{ FieldName: "PostalCode", Status: "match" },
					{ FieldName: "StateProvinceCode", Status: "nomatch" }
				]
			}
		]);
		// StateProvinceCode is excluded — its nomatch does not affect the result
		expect(extractAddressMatchStatusFromDatasourceFields(clientData)).toBe("match");
	});

	it("should return 'match' when address fields are 'match' or 'missing'", () => {
		const clientData = buildClientData([
			{
				DatasourceName: "Address Validation",
				DatasourceFields: [
					{ FieldName: "Address1", Status: "match" },
					{ FieldName: "StreetName", Status: "match" },
					{ FieldName: "City", Status: "match" },
					{ FieldName: "PostalCode", Status: "missing" },
					{ FieldName: "StateProvinceCode", Status: "nomatch" }
				]
			}
		]);
		// StateProvinceCode nomatch is ignored
		expect(extractAddressMatchStatusFromDatasourceFields(clientData)).toBe("match");
	});

	it("should return 'nomatch' when any address field has 'nomatch' in Address Validation", () => {
		const clientData = buildClientData([
			{
				DatasourceName: "Address Validation",
				DatasourceFields: [
					{ FieldName: "Address1", Status: "nomatch" },
					{ FieldName: "StreetName", Status: "match" },
					{ FieldName: "City", Status: "match" },
					{ FieldName: "PostalCode", Status: "match" }
				]
			}
		]);
		expect(extractAddressMatchStatusFromDatasourceFields(clientData)).toBe("nomatch");
	});

	it("should return 'nomatch' if only PostalCode has 'nomatch' in Address Validation", () => {
		const clientData = buildClientData([
			{
				DatasourceName: "Address Validation",
				DatasourceFields: [
					{ FieldName: "Address1", Status: "match" },
					{ FieldName: "StreetName", Status: "match" },
					{ FieldName: "City", Status: "match" },
					{ FieldName: "PostalCode", Status: "nomatch" }
				]
			}
		]);
		expect(extractAddressMatchStatusFromDatasourceFields(clientData)).toBe("nomatch");
	});

	it("should return 'nomatch' if StreetName has 'nomatch' even if others match", () => {
		const clientData = buildClientData([
			{
				DatasourceName: "Address Validation",
				DatasourceFields: [
					{ FieldName: "Address1", Status: "match" },
					{ FieldName: "BuildingNumber", Status: "match" },
					{ FieldName: "StreetName", Status: "nomatch" },
					{ FieldName: "StreetType", Status: "match" },
					{ FieldName: "City", Status: "match" },
					{ FieldName: "PostalCode", Status: "match" },
					{ FieldName: "StateProvinceCode", Status: "match" }
				]
			}
		]);
		expect(extractAddressMatchStatusFromDatasourceFields(clientData)).toBe("nomatch");
	});

	it("should use Comprehensive View when available, even if individual datasources have nomatch", () => {
		const clientData = buildClientData([
			{
				DatasourceName: "Business Insights 531971",
				DatasourceFields: [
					{ FieldName: "Address1", Status: "match" },
					{ FieldName: "City", Status: "match" },
					{ FieldName: "PostalCode", Status: "match" }
				]
			},
			{
				DatasourceName: "Business Insights 773174",
				DatasourceFields: [
					{ FieldName: "Address1", Status: "nomatch" },
					{ FieldName: "StreetName", Status: "nomatch" },
					{ FieldName: "City", Status: "match" }
				]
			},
			{
				DatasourceName: "Comprehensive View",
				DatasourceFields: [
					{ FieldName: "Address1", Status: "match" },
					{ FieldName: "StreetName", Status: "match" },
					{ FieldName: "City", Status: "match" },
					{ FieldName: "PostalCode", Status: "match" }
				]
			}
		]);
		// Comprehensive View says match → result should be "match" (ignoring individual datasource nomatch)
		expect(extractAddressMatchStatusFromDatasourceFields(clientData)).toBe("match");
	});

	it("should return 'nomatch' when Comprehensive View itself has nomatch", () => {
		const clientData = buildClientData([
			{
				DatasourceName: "Business Insights 531971",
				DatasourceFields: [
					{ FieldName: "Address1", Status: "match" },
					{ FieldName: "City", Status: "match" }
				]
			},
			{
				DatasourceName: "Comprehensive View",
				DatasourceFields: [
					{ FieldName: "Address1", Status: "nomatch" },
					{ FieldName: "StreetName", Status: "nomatch" },
					{ FieldName: "City", Status: "match" },
					{ FieldName: "PostalCode", Status: "nomatch" }
				]
			}
		]);
		expect(extractAddressMatchStatusFromDatasourceFields(clientData)).toBe("nomatch");
	});

	it("should fallback to all datasources when no Comprehensive View exists and detect genuine nomatch", () => {
		const clientData = buildClientData([
			{
				DatasourceName: "Business Essentials",
				DatasourceFields: [
					{ FieldName: "Address1", Status: "nomatch" },
					{ FieldName: "City", Status: "match" },
					{ FieldName: "PostalCode", Status: "match" }
				]
			},
			{
				DatasourceName: "Address Validation",
				DatasourceFields: [
					{ FieldName: "Address1", Status: "match" },
					{ FieldName: "City", Status: "match" },
					{ FieldName: "PostalCode", Status: "match" }
				]
			}
		]);
		// No Comprehensive View → checks all datasources → Business Essentials has Address1:nomatch
		expect(extractAddressMatchStatusFromDatasourceFields(clientData)).toBe("nomatch");
	});

	it("should return 'nomatch' via fallback when any datasource has genuine address field nomatch", () => {
		const clientData = buildClientData([
			{
				DatasourceName: "Business Insights",
				DatasourceFields: [
					{ FieldName: "Address1", Status: "nomatch" },
					{ FieldName: "City", Status: "match" }
				]
			},
			{
				DatasourceName: "Address Validation",
				DatasourceFields: [
					{ FieldName: "Address1", Status: "match" },
					{ FieldName: "StreetName", Status: "match" },
					{ FieldName: "City", Status: "match" },
					{ FieldName: "PostalCode", Status: "match" }
				]
			}
		]);
		// Business Insights Address1:nomatch → "nomatch" (genuine mismatch detected)
		expect(extractAddressMatchStatusFromDatasourceFields(clientData)).toBe("nomatch");
	});

	it("should handle flowData structure (serviceData inside flowData)", () => {
		const clientData = {
			flowData: {
				"flow-step-1": {
					serviceData: [
						{
							fullServiceDetails: {
								Record: {
									DatasourceResults: [
										{
											DatasourceName: "Comprehensive View",
											DatasourceFields: [
												{ FieldName: "Address1", Status: "nomatch" },
												{ FieldName: "City", Status: "match" }
											]
										}
									]
								}
							}
						}
					]
				}
			}
		};
		expect(extractAddressMatchStatusFromDatasourceFields(clientData)).toBe("nomatch");
	});

	it("should return 'match' when all address fields are missing (no nomatch) in Address Validation", () => {
		const clientData = buildClientData([
			{
				DatasourceName: "Address Validation",
				DatasourceFields: [
					{ FieldName: "Address1", Status: "missing" },
					{ FieldName: "City", Status: "missing" }
				]
			}
		]);
		expect(extractAddressMatchStatusFromDatasourceFields(clientData)).toBe("match");
	});

	it("should handle DatasourceResults with no DatasourceFields property", () => {
		const clientData = buildClientData([
			{
				DatasourceName: "Business Essentials"
				// No DatasourceFields
			}
		]);
		expect(extractAddressMatchStatusFromDatasourceFields(clientData)).toBeUndefined();
	});

	it("should match the Slack scenario: Martin & Consulting Inc. with red address fields in Comprehensive View", () => {
		// From Slack screenshots: Martin & Consulting Inc. with wrong address (Silversmith Drive)
		// Comprehensive View shows address fields as red (nomatch)
		const clientData = buildClientData([
			{
				DatasourceName: "Business Insights 530975",
				DatasourceFields: [
					{ FieldName: "Address1", Status: "nomatch" },
					{ FieldName: "BuildingNumber", Status: "nomatch" },
					{ FieldName: "StreetName", Status: "nomatch" },
					{ FieldName: "City", Status: "nomatch" },
					{ FieldName: "PostalCode", Status: "nomatch" }
				]
			},
			{
				DatasourceName: "Comprehensive View",
				DatasourceFields: [
					{ FieldName: "BusinessName", Status: "match" },
					{ FieldName: "BusinessRegistrationNumber", Status: "match" },
					{ FieldName: "Address1", Status: "nomatch" },
					{ FieldName: "BuildingNumber", Status: "nomatch" },
					{ FieldName: "StreetName", Status: "nomatch" },
					{ FieldName: "StreetType", Status: "missing" },
					{ FieldName: "City", Status: "nomatch" },
					{ FieldName: "StateProvinceCode", Status: "match" },
					{ FieldName: "PostalCode", Status: "nomatch" }
				]
			}
		]);
		// Comprehensive View has nomatch on address → nomatch
		expect(extractAddressMatchStatusFromDatasourceFields(clientData)).toBe("nomatch");
	});

	it("should match the Slack scenario: verified address with all green in Comprehensive View", () => {
		// From Slack screenshots: correct address (498 Beresford Ave)
		// Comprehensive View shows all green, but Business Insights 773174 has nomatch (secondary data source)
		const clientData = buildClientData([
			{
				DatasourceName: "Business Insights 531971",
				DatasourceFields: [
					{ FieldName: "Address1", Status: "match" },
					{ FieldName: "StreetName", Status: "match" },
					{ FieldName: "City", Status: "match" },
					{ FieldName: "PostalCode", Status: "match" }
				]
			},
			{
				DatasourceName: "Business Insights 773174",
				DatasourceFields: [
					{ FieldName: "Address1", Status: "nomatch" },
					{ FieldName: "StreetName", Status: "nomatch" },
					{ FieldName: "City", Status: "match" },
					{ FieldName: "PostalCode", Status: "missing" }
				]
			},
			{
				DatasourceName: "Comprehensive View",
				DatasourceFields: [
					{ FieldName: "BusinessName", Status: "match" },
					{ FieldName: "Address1", Status: "match" },
					{ FieldName: "BuildingNumber", Status: "match" },
					{ FieldName: "StreetName", Status: "match" },
					{ FieldName: "StreetType", Status: "match" },
					{ FieldName: "City", Status: "match" },
					{ FieldName: "StateProvinceCode", Status: "match" },
					{ FieldName: "PostalCode", Status: "match" }
				]
			}
		]);
		// Comprehensive View has all match → match (even though 773174 has nomatch)
		expect(extractAddressMatchStatusFromDatasourceFields(clientData)).toBe("match");
	});

	it("should return 'match' when Business Insights only has StateProvinceCode:nomatch (UK abbreviated state codes)", () => {
		// UK scenario: Business Insights has StateProvinceCode:nomatch (submitted "DBY" vs registered "Derby")
		// but all other address fields match. StateProvinceCode is excluded from ADDRESS_FIELD_NAMES,
		// so the result is "match" — the address IS correct, just the state code format differs.
		const clientData = buildClientData([
			{
				DatasourceName: "Business Insights 344568",
				DatasourceFields: [
					{ FieldName: "BusinessName", Status: "match" },
					{ FieldName: "BusinessRegistrationNumber", Status: "match" },
					{ FieldName: "Address1", Status: "match" },
					{ FieldName: "City", Status: "match" },
					{ FieldName: "PostalCode", Status: "match" },
					{ FieldName: "StateProvinceCode", Status: "nomatch" }
				]
			},
			{
				DatasourceName: "Address Validation",
				DatasourceFields: []
			},
			{
				DatasourceName: "BRNValidation",
				DatasourceFields: []
			}
		]);
		expect(extractAddressMatchStatusFromDatasourceFields(clientData)).toBe("match");
	});

	it("should return 'match' when Business Insights has all address fields match (no Comprehensive View)", () => {
		const clientData = buildClientData([
			{
				DatasourceName: "Business Insights",
				DatasourceFields: [
					{ FieldName: "Address1", Status: "match" },
					{ FieldName: "City", Status: "match" },
					{ FieldName: "PostalCode", Status: "match" }
				]
			}
		]);
		expect(extractAddressMatchStatusFromDatasourceFields(clientData)).toBe("match");
	});

	it("should return 'nomatch' when Business Insights has genuine City/PostalCode nomatch (wrong address)", () => {
		// UK negative test: submitted London but registered address is Derby.
		// Business Insights correctly reports City:nomatch, PostalCode:nomatch.
		// StateProvinceCode:nomatch is ignored, but City/PostalCode catch the real mismatch.
		const clientData = buildClientData([
			{
				DatasourceName: "Business Insights 344568",
				DatasourceFields: [
					{ FieldName: "BusinessName", Status: "nomatch" },
					{ FieldName: "BusinessRegistrationNumber", Status: "match" },
					{ FieldName: "Address1", Status: "nomatch" },
					{ FieldName: "StreetName", Status: "nomatch" },
					{ FieldName: "StreetType", Status: "nomatch" },
					{ FieldName: "City", Status: "nomatch" },
					{ FieldName: "PostalCode", Status: "nomatch" },
					{ FieldName: "BuildingNumber", Status: "nomatch" },
					{ FieldName: "StateProvinceCode", Status: "nomatch" }
				]
			},
			{
				DatasourceName: "Address Validation",
				DatasourceFields: []
			}
		]);
		expect(extractAddressMatchStatusFromDatasourceFields(clientData)).toBe("nomatch");
	});

	it("should return 'match' in Comprehensive View when only StateProvinceCode has nomatch (UK Coffee Matters scenario)", () => {
		// UK Coffee Matters scenario: Comprehensive View has StateProvinceCode:nomatch
		// (submitted "ESS" vs registered "Southend-On-Sea") but all other fields match.
		const clientData = buildClientData([
			{
				DatasourceName: "Comprehensive View",
				DatasourceFields: [
					{ FieldName: "BusinessName", Status: "match" },
					{ FieldName: "BusinessRegistrationNumber", Status: "match" },
					{ FieldName: "Address1", Status: "match" },
					{ FieldName: "StreetName", Status: "match" },
					{ FieldName: "StreetType", Status: "match" },
					{ FieldName: "PostalCode", Status: "match" },
					{ FieldName: "City", Status: "match" },
					{ FieldName: "BuildingNumber", Status: "match" },
					{ FieldName: "StateProvinceCode", Status: "nomatch" }
				]
			}
		]);
		expect(extractAddressMatchStatusFromDatasourceFields(clientData)).toBe("match");
	});

	it("should return undefined for UK-style response with empty DatasourceFields on all datasources", () => {
		// UK businesses via Trulioo: all DatasourceFields are empty [], no Comprehensive View exists.
		// extractAddressMatchStatusFromDatasourceFields returns undefined; the caller
		// then falls back to RecordStatus via extractRecordStatusFromTruliooResponse.
		const clientData = {
			flowData: {
				"6930781000d6c1209c2e0a21": {
					serviceData: [
						{
							nodeTitle: "Business Insights",
							serviceStatus: "COMPLETED",
							fullServiceDetails: {
								Record: {
									RecordStatus: "match",
									DatasourceResults: [
										{ DatasourceName: "Address Validation", DatasourceFields: [], Errors: [{ Code: "3001", Message: "State / Province / County changed" }] },
										{ DatasourceName: "BRNValidation", DatasourceFields: [] },
										{ DatasourceName: "Business Documents 793633", DatasourceFields: [] }
									]
								}
							}
						}
					]
				}
			}
		};
		// DatasourceFields-based extraction returns undefined (no address fields found)
		expect(extractAddressMatchStatusFromDatasourceFields(clientData)).toBeUndefined();
	});

	it("should correctly evaluate real Trulioo response: Martin & Consulting Inc. with wrong address (Silversmith Drive)", () => {
		// Real raw response from Trulioo (from Mauricio, 2026-02-13).
		// Business: Martin & Consulting Inc., submitted address: 1455 Silversmith Drive, Oakville, ON
		// Registered address: 498 Beresford Ave, Toronto, ON
		// Expected: "nomatch" because Comprehensive View address fields are all red.
		const clientData = {
			flowData: {
				"6930781000d6c1209c2e0a21": {
					serviceData: [
						{
							nodeTitle: "Business Insights",
							serviceStatus: "COMPLETED",
							fullServiceDetails: {
								Record: {
									RecordStatus: "match",
									DatasourceResults: [
										{ DatasourceName: "Address Validation", DatasourceFields: [] },
										{ DatasourceName: "BRNValidation", DatasourceFields: [] },
										{ DatasourceName: "Business Essentials 778120", DatasourceFields: [] },
										{
											DatasourceName: "Business Insights 531971",
											DatasourceFields: [
												{ FieldName: "BusinessName", Status: "match" },
												{ FieldName: "BusinessRegistrationNumber", Status: "match" },
												{ FieldName: "Address1", Status: "nomatch" },
												{ FieldName: "StreetName", Status: "nomatch" },
												{ FieldName: "StreetType", Status: "nomatch" },
												{ FieldName: "PostalCode", Status: "nomatch" },
												{ FieldName: "City", Status: "nomatch" },
												{ FieldName: "BuildingNumber", Status: "nomatch" },
												{ FieldName: "StateProvinceCode", Status: "match" }
											]
										},
										{
											DatasourceName: "Business Insights 773174",
											DatasourceFields: [
												{ FieldName: "BusinessName", Status: "match" },
												{ FieldName: "Address1", Status: "nomatch" },
												{ FieldName: "StreetName", Status: "nomatch" },
												{ FieldName: "City", Status: "nomatch" },
												{ FieldName: "StateProvinceCode", Status: "match" }
											]
										},
										{ DatasourceName: "Business Insights 812165", DatasourceFields: [] },
										{
											DatasourceName: "Comprehensive View",
											DatasourceFields: [
												{ FieldName: "BusinessName", Status: "match" },
												{ FieldName: "BusinessRegistrationNumber", Status: "match" },
												{ FieldName: "Address1", Status: "nomatch" },
												{ FieldName: "StreetName", Status: "nomatch" },
												{ FieldName: "StreetType", Status: "nomatch" },
												{ FieldName: "PostalCode", Status: "nomatch" },
												{ FieldName: "City", Status: "nomatch" },
												{ FieldName: "BuildingNumber", Status: "nomatch" },
												{ FieldName: "StateProvinceCode", Status: "match" }
											]
										},
										{ DatasourceName: "Language Intelligence", DatasourceFields: [] }
									]
								}
							}
						}
					]
				}
			}
		};
		expect(extractAddressMatchStatusFromDatasourceFields(clientData)).toBe("nomatch");
	});
});

describe("extractRecordStatusFromTruliooResponse", () => {
	it("should return undefined when clientData is undefined", () => {
		expect(extractRecordStatusFromTruliooResponse(undefined)).toBeUndefined();
	});

	it("should return undefined when clientData is empty", () => {
		expect(extractRecordStatusFromTruliooResponse({})).toBeUndefined();
	});

	it("should return undefined when no serviceData or flowData", () => {
		expect(extractRecordStatusFromTruliooResponse({ foo: "bar" })).toBeUndefined();
	});

	it("should return 'match' from serviceData[].fullServiceDetails.Record.RecordStatus", () => {
		const clientData = {
			serviceData: [
				{
					fullServiceDetails: {
						Record: {
							RecordStatus: "match",
							DatasourceResults: []
						}
					}
				}
			]
		};
		expect(extractRecordStatusFromTruliooResponse(clientData)).toBe("match");
	});

	it("should return 'nomatch' when RecordStatus is 'nomatch'", () => {
		const clientData = {
			serviceData: [
				{
					fullServiceDetails: {
						Record: {
							RecordStatus: "nomatch",
							DatasourceResults: []
						}
					}
				}
			]
		};
		expect(extractRecordStatusFromTruliooResponse(clientData)).toBe("nomatch");
	});

	it("should return undefined when RecordStatus is an unexpected value", () => {
		const clientData = {
			serviceData: [
				{
					fullServiceDetails: {
						Record: {
							RecordStatus: "partial",
							DatasourceResults: []
						}
					}
				}
			]
		};
		expect(extractRecordStatusFromTruliooResponse(clientData)).toBeUndefined();
	});

	it("should extract 'match' from flowData structure (UK-style response)", () => {
		const clientData = {
			flowData: {
				"6930781000d6c1209c2e0a21": {
					serviceData: [
						{
							nodeTitle: "Business Insights",
							serviceStatus: "COMPLETED",
							fullServiceDetails: {
								Record: {
									RecordStatus: "match",
									DatasourceResults: [
										{ DatasourceName: "Address Validation", DatasourceFields: [] },
										{ DatasourceName: "BRNValidation", DatasourceFields: [] }
									]
								}
							}
						}
					]
				}
			}
		};
		expect(extractRecordStatusFromTruliooResponse(clientData)).toBe("match");
	});

	it("should return 'nomatch' when multiple records have mixed statuses (nomatch is dominant)", () => {
		const clientData = {
			serviceData: [
				{
					fullServiceDetails: {
						Record: {
							RecordStatus: "match",
							DatasourceResults: []
						}
					}
				},
				{
					fullServiceDetails: {
						Record: {
							RecordStatus: "nomatch",
							DatasourceResults: []
						}
					}
				}
			]
		};
		expect(extractRecordStatusFromTruliooResponse(clientData)).toBe("nomatch");
	});

	it("should handle case-insensitive RecordStatus", () => {
		const clientData = {
			serviceData: [
				{
					fullServiceDetails: {
						Record: {
							RecordStatus: "Match",
							DatasourceResults: []
						}
					}
				}
			]
		};
		expect(extractRecordStatusFromTruliooResponse(clientData)).toBe("match");
	});

	it("should return undefined when Record is missing", () => {
		const clientData = {
			serviceData: [
				{
					fullServiceDetails: {}
				}
			]
		};
		expect(extractRecordStatusFromTruliooResponse(clientData)).toBeUndefined();
	});

	it("UK real scenario: FPA Consulting Limited (GB) — DatasourceFields empty but RecordStatus is match", () => {
		// This is the exact scenario from FAST-273: UK business has empty DatasourceFields
		// but RecordStatus: "match" on the KYB response.
		const clientData = {
			flowData: {
				"6930781000d6c1209c2e0a21": {
					serviceData: [
						{
							nodeType: "trulioo_kyb_insights",
							nodeTitle: "Business Insights",
							serviceStatus: "COMPLETED",
							match: true,
							fullServiceDetails: {
								Record: {
									RecordStatus: "match",
									RuleName: "RuleScript - BusinessVerify_v218",
									DatasourceResults: [
										{
											DatasourceName: "Address Validation",
											DatasourceFields: [],
											Errors: [{ Code: "3001", Message: "State / Province / County changed" }],
											AppendedFields: [
												{ Data: "1 St. Andrews House 1 Vernon Gate", FieldName: "Address1" },
												{ Data: "Derby", FieldName: "City" },
												{ Data: "DE1 1UJ", FieldName: "PostalCode" },
												{ Data: "GB", FieldName: "Country" }
											]
										},
										{ DatasourceName: "BRNValidation", DatasourceFields: [] },
										{ DatasourceName: "Business Documents 793633", DatasourceFields: [] }
									]
								}
							}
						}
					]
				}
			}
		};
		// DatasourceFields-based returns undefined (all empty)
		expect(extractAddressMatchStatusFromDatasourceFields(clientData)).toBeUndefined();
		// RecordStatus-based returns "match"
		expect(extractRecordStatusFromTruliooResponse(clientData)).toBe("match");
	});
});
