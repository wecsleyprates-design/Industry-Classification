import { sendWebhookEvent } from "#common/index";
import { WEBHOOK_EVENTS } from "#constants";
import type { FactName, FactOverride } from "#lib/facts/types";
import { ManualIntegration } from "../manualIntegration";

jest.mock("#helpers/LaunchDarkly", () => ({
	getFlagValue: jest.fn().mockResolvedValue(false)
}));

jest.mock("#common/index", () => ({
	...jest.requireActual("#common/index"),
	sendWebhookEvent: jest.fn().mockResolvedValue(undefined)
}));

const mockPatchBusinessDisplayProfile = jest.fn().mockResolvedValue(undefined);

jest.mock("#clients/case/caseServiceClient", () => ({
	CaseServiceClient: jest.fn().mockImplementation(() => ({
		patchBusinessDisplayProfile: mockPatchBusinessDisplayProfile
	}))
}));

const mockSendWebhookEvent = sendWebhookEvent as jest.MockedFunction<typeof sendWebhookEvent>;

const BUSINESS_ID = "00000000-0000-0000-0000-000000000001";
const USER_ID = "00000000-0000-0000-0000-000000000002";
const CONNECTION_ID = "00000000-0000-0000-0000-000000000003";

function makeOverride(value: any, comment: string | null = null): FactOverride {
	return {
		value,
		comment,
		source: "manual",
		userID: USER_ID as any,
		timestamp: new Date()
	};
}

/** Invoke the private static merge helper used by updateFactOverride and processFactOverrideEvent */
function computeNextFactOverrideState(
	method: "DELETE" | "PATCH" | "PUT",
	providedOverrides: Partial<Record<FactName, Pick<FactOverride, "value" | "comment">>>,
	currentFactOverrides: Partial<Record<FactName, FactOverride>> | undefined,
	meta: { userID: string; timestamp: Date }
): Partial<Record<FactName, FactOverride>> {
	return (ManualIntegration as any).computeNextFactOverrideState(
		method,
		providedOverrides,
		currentFactOverrides,
		meta
	);
}

function syncCaseBusinessDisplayProfileFromFactOverrides(params: {
	method: "DELETE" | "PATCH" | "PUT";
	businessID: string;
	userID: string;
	record: Partial<Record<FactName, FactOverride | Pick<FactOverride, "value" | "comment">>>;
	newFactOverrides: Partial<Record<FactName, FactOverride>>;
}): Promise<void> {
	return (ManualIntegration as any).syncCaseBusinessDisplayProfileFromFactOverrides(params);
}

describe("ManualIntegration", () => {
	describe("computeNextFactOverrideState (merge/replace logic)", () => {
		const meta = { userID: USER_ID, timestamp: new Date() };

		describe("DELETE", () => {
			it("removes only the keys present in providedOverrides and keeps the rest", () => {
				const current = {
					business_name: makeOverride("Acme Inc"),
					website: makeOverride("https://acme.com"),
					primary_address: makeOverride({ country: "US" })
				};
				const provided = {
					business_name: { value: null, comment: null },
					website: { value: null, comment: null }
				};
				const result = computeNextFactOverrideState("DELETE", provided, current, meta);
				expect(Object.keys(result)).toEqual(["primary_address"]);
				expect(result.primary_address).toEqual(current.primary_address);
			});

			it("returns empty object when all current keys are in providedOverrides", () => {
				const current = {
					business_name: makeOverride("Acme"),
					website: makeOverride("https://acme.com")
				};
				const provided = {
					business_name: { value: null, comment: null },
					website: { value: null, comment: null }
				};
				const result = computeNextFactOverrideState("DELETE", provided, current, meta);
				expect(result).toEqual({});
			});

			it("returns copy of current when providedOverrides is empty", () => {
				const current = {
					business_name: makeOverride("Acme"),
					website: makeOverride("https://acme.com")
				};
				const result = computeNextFactOverrideState("DELETE", {}, current, meta);
				expect(result).toEqual(current);
			});

			it("handles current being undefined by returning empty object", () => {
				const provided = { business_name: { value: null, comment: null } };
				const result = computeNextFactOverrideState("DELETE", provided, undefined, meta);
				expect(result).toEqual({});
			});
		});

		describe("PATCH", () => {
			it("merges providedOverrides into current and adds new keys", () => {
				const current = {
					business_name: makeOverride("Old Name"),
					website: makeOverride("https://old.com")
				};
				const provided = {
					business_name: { value: "New Name", comment: "updated" },
					primary_address: { value: { country: "GB" }, comment: null }
				};
				const result = computeNextFactOverrideState("PATCH", provided, current, meta);
				expect(Object.keys(result).sort()).toEqual(["business_name", "primary_address", "website"]);
				expect(result.business_name?.value).toBe("New Name");
				expect(result.business_name?.comment).toBe("updated");
				expect(result.website).toEqual(current.website);
				expect(result.primary_address?.value).toEqual({ country: "GB" });
				expect(result.primary_address?.source).toBe("manual");
				expect(result.primary_address?.userID).toBe(USER_ID);
			});

			it("starts from empty when current is undefined", () => {
				const provided = { business_name: { value: "Only", comment: null } };
				const result = computeNextFactOverrideState("PATCH", provided, undefined, meta);
				expect(result).toEqual({
					business_name: {
						value: "Only",
						comment: null,
						source: "manual",
						userID: USER_ID,
						timestamp: meta.timestamp
					}
				});
			});
		});

		describe("PUT", () => {
			it("replaces entire state with only the provided keys", () => {
				const current = {
					business_name: makeOverride("Old"),
					website: makeOverride("https://old.com"),
					primary_address: makeOverride({ country: "US" })
				};
				const provided = {
					website: { value: "https://new.com", comment: "replaced" }
				};
				const result = computeNextFactOverrideState("PUT", provided, current, meta);
				expect(Object.keys(result)).toEqual(["website"]);
				expect(result.website?.value).toBe("https://new.com");
				expect(result.website?.comment).toBe("replaced");
			});

			it("ignores current when PUT with new keys only", () => {
				const current = { business_name: makeOverride("Unused") };
				const provided = { primary_address: { value: { country: "CA" }, comment: null } };
				const result = computeNextFactOverrideState("PUT", provided, current, meta);
				expect(Object.keys(result)).toEqual(["primary_address"]);
				expect(result.primary_address?.value).toEqual({ country: "CA" });
			});
		});
	});

	describe("syncCaseBusinessDisplayProfileFromFactOverrides", () => {
		beforeEach(() => {
			mockPatchBusinessDisplayProfile.mockClear();
		});

		it("no-ops for DELETE", async () => {
			await syncCaseBusinessDisplayProfileFromFactOverrides({
				method: "DELETE",
				businessID: BUSINESS_ID,
				userID: USER_ID,
				record: { legal_name: { value: "X", comment: null } },
				newFactOverrides: { legal_name: makeOverride("X") }
			});
			expect(mockPatchBusinessDisplayProfile).not.toHaveBeenCalled();
		});

		it("no-ops when record omits legal_name and dba", async () => {
			await syncCaseBusinessDisplayProfileFromFactOverrides({
				method: "PATCH",
				businessID: BUSINESS_ID,
				userID: USER_ID,
				record: { business_name: { value: "X", comment: null } },
				newFactOverrides: { business_name: makeOverride("X") }
			});
			expect(mockPatchBusinessDisplayProfile).not.toHaveBeenCalled();
		});

		it("no-ops when legal_name is present but resolved value is only whitespace and dba is absent", async () => {
			await syncCaseBusinessDisplayProfileFromFactOverrides({
				method: "PATCH",
				businessID: BUSINESS_ID,
				userID: USER_ID,
				record: { legal_name: { value: "   ", comment: null } },
				newFactOverrides: { legal_name: makeOverride("   ") }
			});
			expect(mockPatchBusinessDisplayProfile).not.toHaveBeenCalled();
		});

		it("PATCHes name and trimmed dba_names when both keys are in the record", async () => {
			await syncCaseBusinessDisplayProfileFromFactOverrides({
				method: "PATCH",
				businessID: BUSINESS_ID,
				userID: USER_ID,
				record: {
					legal_name: { value: "  Legal  ", comment: null },
					dba: { value: ["  A  ", "", "B"], comment: null }
				},
				newFactOverrides: {
					legal_name: makeOverride("  Legal  "),
					dba: makeOverride(["  A  ", "", "B"])
				}
			});
			expect(mockPatchBusinessDisplayProfile).toHaveBeenCalledWith(BUSINESS_ID, {
				userId: USER_ID,
				name: "Legal",
				dba_names: [{ name: "A" }, { name: "B" }]
			});
		});

		it("maps string dba to a single-element dba_names array", async () => {
			await syncCaseBusinessDisplayProfileFromFactOverrides({
				method: "PUT",
				businessID: BUSINESS_ID,
				userID: USER_ID,
				record: { dba: { value: "  One DBA  ", comment: null } },
				newFactOverrides: { dba: makeOverride("  One DBA  ") }
			});
			expect(mockPatchBusinessDisplayProfile).toHaveBeenCalledWith(BUSINESS_ID, {
				userId: USER_ID,
				dba_names: [{ name: "One DBA" }]
			});
		});

		it("maps null dba to an empty dba_names array", async () => {
			await syncCaseBusinessDisplayProfileFromFactOverrides({
				method: "PATCH",
				businessID: BUSINESS_ID,
				userID: USER_ID,
				record: { dba: { value: null, comment: null } },
				newFactOverrides: { dba: makeOverride(null) }
			});
			expect(mockPatchBusinessDisplayProfile).toHaveBeenCalledWith(BUSINESS_ID, {
				userId: USER_ID,
				dba_names: []
			});
		});

		it("maps non-array, non-string dba values to an empty dba_names array", async () => {
			await syncCaseBusinessDisplayProfileFromFactOverrides({
				method: "PATCH",
				businessID: BUSINESS_ID,
				userID: USER_ID,
				record: { dba: { value: 123 as unknown as string, comment: null } },
				newFactOverrides: { dba: makeOverride(123 as unknown as string) }
			});
			expect(mockPatchBusinessDisplayProfile).toHaveBeenCalledWith(BUSINESS_ID, {
				userId: USER_ID,
				dba_names: []
			});
		});
	});

	describe("updateFactOverride", () => {
		const connection = {
			id: CONNECTION_ID,
			business_id: BUSINESS_ID,
			customer_id: "00000000-0000-0000-0000-000000000004",
			platform_id: 100
		};
		let manualIntegration: ManualIntegration;
		let mockSend: jest.Mock;
		let getCurrentFactOverridesSpy: jest.SpyInstance;
		let saveRawResponseToDBSpy: jest.SpyInstance;
		let generateEventSpy: jest.SpyInstance;
		let fetchFactValuesSpy: jest.SpyInstance;

		beforeEach(() => {
			mockSendWebhookEvent.mockClear();
			manualIntegration = new ManualIntegration(connection as any);
			mockSend = jest.fn().mockResolvedValue(undefined);
			(manualIntegration as any).kafkaProducer = { send: mockSend };
			getCurrentFactOverridesSpy = jest.spyOn(manualIntegration, "getCurrentFactOverrides");
			saveRawResponseToDBSpy = jest.spyOn(manualIntegration as any, "saveRawResponseToDB").mockResolvedValue({});
			generateEventSpy = jest
				.spyOn(manualIntegration as any, "generateIntegrationDataUploadedEvent")
				.mockImplementation(async (record: any, ctx: any) => ({
					id: "evt-1",
					business_id: connection.business_id,
					customer_id: connection.customer_id,
					user_id: USER_ID,
					created_at: new Date(),
					data: record,
					trigger: `factOverride:${ctx.method}`
				}));
			fetchFactValuesSpy = jest.spyOn(manualIntegration as any, "fetchFactValues").mockResolvedValue({});
		});

		afterEach(() => {
			jest.restoreAllMocks();
		});

		it("DELETE: returns merged state without deleted keys and Kafka payload has original record", async () => {
			const current = {
				business_name: makeOverride("Acme"),
				website: makeOverride("https://acme.com"),
				primary_address: makeOverride({ country: "US" })
			};
			getCurrentFactOverridesSpy.mockResolvedValue(current);
			const record = {
				business_name: { value: null, comment: null },
				website: { value: null, comment: null }
			};

			const result = await manualIntegration.updateFactOverride(record, {
				method: "DELETE",
				userID: USER_ID as any
			});

			expect(Object.keys(result)).toEqual(["primary_address"]);
			expect(result.primary_address).toEqual(current.primary_address);
			expect(saveRawResponseToDBSpy).toHaveBeenCalledTimes(1);
			const [eventPassedToDb] = saveRawResponseToDBSpy.mock.calls[0];
			expect(eventPassedToDb.data).toEqual(result);
			expect(mockSend).toHaveBeenCalledWith({
				topic: expect.any(String),
				messages: [
					{
						key: BUSINESS_ID,
						value: expect.objectContaining({
							event: expect.any(String),
							data: record,
							trigger: "factOverride:DELETE"
						})
					}
				]
			});
		});

		it("PATCH: returns merged state and saves full state to DB while Kafka gets original record", async () => {
			const current = { business_name: makeOverride("Old") };
			getCurrentFactOverridesSpy.mockResolvedValue(current);
			const record = {
				business_name: { value: "New Name", comment: "patched" },
				website: { value: "https://new.com", comment: null }
			};

			const result = await manualIntegration.updateFactOverride(record, {
				method: "PATCH",
				userID: USER_ID as any
			});

			expect(Object.keys(result).sort()).toEqual(["business_name", "website"]);
			expect(result.business_name?.value).toBe("New Name");
			expect(result.website?.value).toBe("https://new.com");
			const [eventPassedToDb] = saveRawResponseToDBSpy.mock.calls[0];
			expect(eventPassedToDb.data).toEqual(result);
			expect(mockSend.mock.calls[0][0].messages[0].value.data).toEqual(record);
		});

		it("PUT: returns only provided keys and Kafka payload is original record", async () => {
			const current = {
				business_name: makeOverride("Old"),
				website: makeOverride("https://old.com")
			};
			getCurrentFactOverridesSpy.mockResolvedValue(current);
			const record = { primary_address: { value: { country: "GB" }, comment: null } };

			const result = await manualIntegration.updateFactOverride(record, {
				method: "PUT",
				userID: USER_ID as any
			});

			expect(Object.keys(result)).toEqual(["primary_address"]);
			expect(result.primary_address?.value).toEqual({ country: "GB" });
			expect(mockSend.mock.calls[0][0].messages[0].value.data).toEqual(record);
		});

		it("should fire a FACT_OVERRIDE_UPDATED webhook event with the correct data", async () => {
			const createdAt = new Date("2025-01-15T12:00:00.000Z");
			const caseId = "00000000-0000-0000-0000-000000000099";
			generateEventSpy.mockImplementationOnce(async (record: any, ctx: any) => ({
				id: "evt-1",
				business_id: connection.business_id,
				customer_id: connection.customer_id,
				case_id: caseId,
				user_id: USER_ID,
				created_at: createdAt,
				data: record,
				trigger: `factOverride:${ctx.method}`
			}));

			const current = { business_name: makeOverride("Old") };
			getCurrentFactOverridesSpy.mockResolvedValue(current);
			const record = { business_name: { value: "New Name", comment: "patched" } };

			const result = await manualIntegration.updateFactOverride(record, {
				method: "PATCH",
				userID: USER_ID as any
			});

			expect(mockSendWebhookEvent).toHaveBeenCalledTimes(1);
			expect(mockSendWebhookEvent).toHaveBeenCalledWith(connection.customer_id, WEBHOOK_EVENTS.FACT_OVERRIDE_UPDATED, {
				business_id: connection.business_id,
				case_id: caseId,
				method: "PATCH",
				user_id: USER_ID,
				updated_at: createdAt.toISOString(),
				data: { business_name: result.business_name }
			});
		});
	});

	describe("isValidAccountingValue", () => {
		let manualIntegration: ManualIntegration;

		beforeEach(() => {
			manualIntegration = new ManualIntegration();
		});

		it("should return false for null values", () => {
			// Access private method via type assertion for testing
			const isValid = (manualIntegration as any).isValidAccountingValue(null);
			expect(isValid).toBe(false);
		});

		it("should return false for undefined values", () => {
			const isValid = (manualIntegration as any).isValidAccountingValue(undefined);
			expect(isValid).toBe(false);
		});

		it("should return false for zero number", () => {
			const isValid = (manualIntegration as any).isValidAccountingValue(0);
			expect(isValid).toBe(false);
		});

		it("should return false for zero string", () => {
			const isValid = (manualIntegration as any).isValidAccountingValue("0");
			expect(isValid).toBe(false);
		});

		it("should return true for non-zero positive number", () => {
			const isValid = (manualIntegration as any).isValidAccountingValue(1000);
			expect(isValid).toBe(true);
		});

		it("should return true for non-zero negative number", () => {
			const isValid = (manualIntegration as any).isValidAccountingValue(-500);
			expect(isValid).toBe(true);
		});

		it("should return true for non-zero string number", () => {
			const isValid = (manualIntegration as any).isValidAccountingValue("1500.50");
			expect(isValid).toBe(true);
		});

		it("should return false for NaN", () => {
			const isValid = (manualIntegration as any).isValidAccountingValue(NaN);
			expect(isValid).toBe(false);
		});

		it("should return false for non-numeric string", () => {
			const isValid = (manualIntegration as any).isValidAccountingValue("not-a-number");
			expect(isValid).toBe(false);
		});
	});
});

