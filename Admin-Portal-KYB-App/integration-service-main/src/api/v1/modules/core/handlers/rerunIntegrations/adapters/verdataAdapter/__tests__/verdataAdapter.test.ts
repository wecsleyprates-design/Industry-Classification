import { verdataAdapter } from "../verdataAdapter";
import { allFacts, FactEngineWithDefaultOverrides, FactRules } from "#lib/facts";
import type { BusinessAddress } from "#helpers/api";
import type { IntegrationProcessFunctionParams } from "../../types";
import { CaseServiceClient } from "#clients";
import { getFlagValue } from "#helpers";
import { FEATURE_FLAGS } from "#constants";
import { defaultAdapterProcessFunction } from "../../shared/defaultAdapterProcessFunction";
import { processWithExistingBusinessScoreTrigger } from "../../shared/processWithExistingScoreTrigger";
import type { FactName } from "#lib/facts/types";
import type { UUID } from "crypto";

jest.mock("#lib/facts");
jest.mock("#helpers/LaunchDarkly", () => ({
	getFlagValue: jest.fn()
}));
jest.mock("#clients", () => ({
	CaseServiceClient: jest.fn()
}));
jest.mock("../../shared/defaultAdapterProcessFunction", () => ({
	defaultAdapterProcessFunction: jest.fn().mockResolvedValue(["task-default"])
}));
jest.mock("../../shared/processWithExistingScoreTrigger", () => ({
	processWithExistingBusinessScoreTrigger: jest.fn().mockResolvedValue(["task-existing"])
}));

const mockAllFacts = allFacts as unknown as { filter: jest.Mock };
const mockFactEngineWithDefaultOverrides = FactEngineWithDefaultOverrides as jest.MockedClass<
	typeof FactEngineWithDefaultOverrides
>;
const mockGetFlagValue = getFlagValue as jest.MockedFunction<typeof getFlagValue>;
const mockCaseServiceClient = CaseServiceClient as jest.MockedClass<typeof CaseServiceClient>;
const mockDefaultAdapterProcessFunction = defaultAdapterProcessFunction as jest.MockedFunction<
	typeof defaultAdapterProcessFunction
>;
const mockProcessWithExistingBusinessScoreTrigger = processWithExistingBusinessScoreTrigger as jest.MockedFunction<
	typeof processWithExistingBusinessScoreTrigger
>;

describe("verdataAdapter", () => {
	const businessID = "test-business-id";
	const mockCustomerId = "customer-uuid-1";

	const createMockBusinessAddress = (overrides: Partial<BusinessAddress> = {}): BusinessAddress => ({
		line_1: "123 Main St",
		apartment: null,
		city: "Anytown",
		state: "NY",
		postal_code: "12345",
		country: "US",
		mobile: null,
		is_primary: true,
		...overrides
	});

	const mockGetBusinessById = jest.fn();

	beforeEach(() => {
		jest.clearAllMocks();
		mockAllFacts.filter = jest.fn().mockReturnValue([]);
		mockCaseServiceClient.mockImplementation(
			() =>
				({
					getBusinessById: mockGetBusinessById
				}) as unknown as CaseServiceClient
		);
		mockGetBusinessById.mockResolvedValue({
			data: { customer_id: mockCustomerId }
		});
	});

	describe("factNames", () => {
		it("should declare the Verdata fact dependencies", () => {
			expect(verdataAdapter.factNames).toEqual(["business_name", "dba", "primary_address", "addresses", "tin"]);
		});
	});

	describe("getMetadata", () => {
		it("should build order metadata from business name, primary address, and optional tin", async () => {
			const mockGetResolvedFact = jest.fn((factName: string) => {
				const facts: Partial<Record<FactName, { value: unknown }>> = {
					business_name: { value: "Test Business Inc" },
					dba: { value: undefined },
					primary_address: { value: createMockBusinessAddress() },
					addresses: { value: undefined },
					tin: { value: "12-3456789" }
				};
				return facts[factName as FactName];
			});

			mockFactEngineWithDefaultOverrides.mockImplementation(
				() =>
					({
						applyRules: jest.fn(),
						getResolvedFact: mockGetResolvedFact
					}) as unknown as FactEngineWithDefaultOverrides
			);

			const result = await verdataAdapter.getMetadata(businessID);

			expect(result).toEqual({
				business_id: businessID,
				name: "Test Business Inc",
				address_line_1: "123 Main St",
				city: "Anytown",
				state: "NY",
				zip5: "12345",
				ein: "12-3456789"
			});
		});

		it("should set name_dba when dba list contains a name different from the legal name", async () => {
			const mockGetResolvedFact = jest.fn((factName: string) => {
				const facts: Partial<Record<FactName, { value: unknown }>> = {
					business_name: { value: "Acme Corp" },
					dba: { value: ["acme corp", "Other DBA LLC"] },
					primary_address: { value: createMockBusinessAddress() },
					addresses: { value: undefined },
					tin: { value: undefined }
				};
				return facts[factName as FactName];
			});

			mockFactEngineWithDefaultOverrides.mockImplementation(
				() =>
					({
						applyRules: jest.fn(),
						getResolvedFact: mockGetResolvedFact
					}) as unknown as FactEngineWithDefaultOverrides
			);

			const result = await verdataAdapter.getMetadata(businessID);

			expect(result?.name).toBe("Acme Corp");
			expect(result?.name_dba).toBe("Other DBA LLC");
		});

		it("should use first dba as name when business_name is missing", async () => {
			const mockGetResolvedFact = jest.fn((factName: string) => {
				const facts: Partial<Record<FactName, { value: unknown }>> = {
					business_name: { value: undefined },
					dba: { value: ["Trade Name Only"] },
					primary_address: { value: createMockBusinessAddress() },
					addresses: { value: undefined },
					tin: { value: undefined }
				};
				return facts[factName as FactName];
			});

			mockFactEngineWithDefaultOverrides.mockImplementation(
				() =>
					({
						applyRules: jest.fn(),
						getResolvedFact: mockGetResolvedFact
					}) as unknown as FactEngineWithDefaultOverrides
			);

			const result = await verdataAdapter.getMetadata(businessID);

			expect(result?.name).toBe("Trade Name Only");
		});

		it("should include address_line_2 when primary address has apartment", async () => {
			const mockGetResolvedFact = jest.fn((factName: string) => {
				const facts: Partial<Record<FactName, { value: unknown }>> = {
					business_name: { value: "Test Business Inc" },
					dba: { value: undefined },
					primary_address: { value: createMockBusinessAddress({ apartment: "Suite 9" }) },
					addresses: { value: undefined },
					tin: { value: undefined }
				};
				return facts[factName as FactName];
			});

			mockFactEngineWithDefaultOverrides.mockImplementation(
				() =>
					({
						applyRules: jest.fn(),
						getResolvedFact: mockGetResolvedFact
					}) as unknown as FactEngineWithDefaultOverrides
			);

			const result = await verdataAdapter.getMetadata(businessID);

			expect(result?.address_line_2).toBe("Suite 9");
		});

		it("should truncate zip5 to five characters from postal_code", async () => {
			const mockGetResolvedFact = jest.fn((factName: string) => {
				const facts: Partial<Record<FactName, { value: unknown }>> = {
					business_name: { value: "Test Business Inc" },
					dba: { value: undefined },
					primary_address: { value: createMockBusinessAddress({ postal_code: "12345-6789" }) },
					addresses: { value: undefined },
					tin: { value: undefined }
				};
				return facts[factName as FactName];
			});

			mockFactEngineWithDefaultOverrides.mockImplementation(
				() =>
					({
						applyRules: jest.fn(),
						getResolvedFact: mockGetResolvedFact
					}) as unknown as FactEngineWithDefaultOverrides
			);

			const result = await verdataAdapter.getMetadata(businessID);

			expect(result?.zip5).toBe("12345");
		});

		it("should parse first addresses string when primary_address is missing", async () => {
			const mockGetResolvedFact = jest.fn((factName: string) => {
				const facts: Partial<Record<FactName, { value: unknown }>> = {
					business_name: { value: "Test Business Inc" },
					dba: { value: undefined },
					primary_address: { value: undefined },
					addresses: { value: ["456 Secondary St, Springfield, IL, 62701"] },
					tin: { value: undefined }
				};
				return facts[factName as FactName];
			});

			mockFactEngineWithDefaultOverrides.mockImplementation(
				() =>
					({
						applyRules: jest.fn(),
						getResolvedFact: mockGetResolvedFact
					}) as unknown as FactEngineWithDefaultOverrides
			);

			const result = await verdataAdapter.getMetadata(businessID);

			expect(result).toMatchObject({
				business_id: businessID,
				name: "Test Business Inc",
				address_line_1: "456 Secondary St",
				city: "Springfield",
				state: "IL",
				zip5: "62701"
			});
		});
	});

	describe("FactEngine integration", () => {
		it("should initialize FactEngine with filtered facts and apply highest-confidence rules", async () => {
			const mockApplyRules = jest.fn();
			const mockGetResolvedFact = jest.fn(() => ({ value: undefined }));

			mockFactEngineWithDefaultOverrides.mockImplementation(
				() =>
					({
						applyRules: mockApplyRules,
						getResolvedFact: mockGetResolvedFact
					}) as unknown as FactEngineWithDefaultOverrides
			);

			mockAllFacts.filter = jest.fn().mockReturnValue([]);

			await verdataAdapter.getMetadata(businessID);

			expect(mockFactEngineWithDefaultOverrides).toHaveBeenCalledWith([], { business: businessID });
			expect(mockApplyRules).toHaveBeenCalledWith(FactRules.factWithHighestConfidence);
		});

		it("should filter allFacts to Verdata fact names only", async () => {
			const mockFilteredFacts = [{ name: "business_name" }];
			const mockFilter = jest.fn().mockReturnValue(mockFilteredFacts);
			mockAllFacts.filter = mockFilter;

			const mockApplyRules = jest.fn();
			const mockGetResolvedFact = jest.fn(() => ({ value: undefined }));

			mockFactEngineWithDefaultOverrides.mockImplementation(
				() =>
					({
						applyRules: mockApplyRules,
						getResolvedFact: mockGetResolvedFact
					}) as unknown as FactEngineWithDefaultOverrides
			);

			await verdataAdapter.getMetadata(businessID);

			const filterFn = mockFilter.mock.calls[0][0] as (f: { name: string }) => boolean;
			expect(filterFn({ name: "business_name" })).toBe(true);
			expect(filterFn({ name: "tin" })).toBe(true);
			expect(filterFn({ name: "website" })).toBe(false);
		});
	});

	describe("isValidMetadata", () => {
		it.each([
			{
				description: "returns true for a complete Verdata order",
				metadata: {
					business_id: businessID,
					name: "Acme",
					address_line_1: "1 Main",
					city: "NYC",
					state: "NY",
					zip5: "10001"
				},
				expected: true
			},
			{
				description: "returns false for undefined",
				metadata: undefined,
				expected: false
			},
			{
				description: "returns false when required fields are empty strings",
				metadata: {
					business_id: businessID,
					name: "",
					address_line_1: "",
					city: "",
					state: "",
					zip5: ""
				},
				expected: false
			}
		])("$description", ({ metadata, expected }) => {
			const result = verdataAdapter.isValidMetadata?.(metadata as never);
			expect(result).toBe(expected);
		});
	});

	describe("process", () => {
		const createProcessParams = (
			overrides?: Partial<IntegrationProcessFunctionParams>
		): IntegrationProcessFunctionParams => ({
			business_id: businessID,
			scoreTriggerId: "score-trigger-1" as UUID,
			metadata: {
				business_id: businessID,
				name: "Acme",
				address_line_1: "1 Main",
				city: "NYC",
				state: "NY",
				zip5: "10001"
			},
			platform: {} as IntegrationProcessFunctionParams["platform"],
			task_code: "fetch_public_records",
			connection_id: "conn-1",
			platform_code: "VERDATA",
			platform_id: 1,
			...overrides
		});

		it("should call defaultAdapterProcessFunction when PAT_874_CM_APP_EDITING flag is enabled", async () => {
			mockGetFlagValue.mockResolvedValue(true);

			const params = createProcessParams();
			const result = await verdataAdapter.process(params);

			expect(mockGetFlagValue).toHaveBeenCalledWith(FEATURE_FLAGS.PAT_874_CM_APP_EDITING, {
				key: "customer",
				kind: "customer",
				customer_id: mockCustomerId
			});
			expect(mockDefaultAdapterProcessFunction).toHaveBeenCalledWith(params);
			expect(mockProcessWithExistingBusinessScoreTrigger).not.toHaveBeenCalled();
			expect(result).toEqual(["task-default"]);
		});

		it("should call processWithExistingBusinessScoreTrigger when flag is disabled", async () => {
			mockGetFlagValue.mockResolvedValue(false);

			const result = await verdataAdapter.process(createProcessParams());

			expect(mockProcessWithExistingBusinessScoreTrigger).toHaveBeenCalledWith(
				businessID,
				"VERDATA",
				"fetch_public_records"
			);
			expect(mockDefaultAdapterProcessFunction).not.toHaveBeenCalled();
			expect(result).toEqual(["task-existing"]);
		});

		it("should throw when case service returns no business", async () => {
			mockGetBusinessById.mockResolvedValue({ data: undefined });

			await expect(verdataAdapter.process(createProcessParams())).rejects.toThrow(
				`Business not found for business_id: ${businessID}`
			);
			expect(mockGetFlagValue).not.toHaveBeenCalled();
		});
	});

	describe("checkRunnable", () => {
		it("should default to true", async () => {
			expect(verdataAdapter.checkRunnable).toBeDefined();
			await expect(verdataAdapter.checkRunnable({})).resolves.toBe(true);
		});
	});
});
