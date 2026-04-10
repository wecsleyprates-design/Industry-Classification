import { equifaxAdapter } from "../equifaxAdapter";
import { getEntityMatchingMetadata } from "../../../lib/getEntityMatchingMetadata";
import { ENTITY_MATCHING_FACT_NAMES } from "../../../lib";
import { entityMatchingProcessFunction } from "../../shared/entityMatchingProcessFunction";
import type { IntegrationFactEntityMatchingMetadata } from "../../types";

jest.mock("../../../lib/getEntityMatchingMetadata");

/** Mock constants */
const mockGetEntityMatchingMetadata = getEntityMatchingMetadata as jest.MockedFunction<
	typeof getEntityMatchingMetadata
>;

describe("equifaxAdapter", () => {
	/** Factory function for base entity matching metadata */
	const createBaseMetadata = (
		overrides: Partial<IntegrationFactEntityMatchingMetadata> = {}
	): IntegrationFactEntityMatchingMetadata => ({
		names: ["Test Business Inc"],
		originalAddresses: [
			{
				line_1: "123 Main St",
				apartment: null,
				city: "New York",
				state: "NY",
				postal_code: "10001",
				country: "US"
			}
		],
		...overrides
	});

	beforeEach(() => {
		jest.clearAllMocks();
	});

	describe("adapter structure", () => {
		it("should have correct fact names", () => {
			expect(equifaxAdapter.factNames).toEqual(ENTITY_MATCHING_FACT_NAMES);
		});

		it("should use entityMatchingProcessFunction", () => {
			expect(equifaxAdapter.process).toBe(entityMatchingProcessFunction);
		});
	});

	describe("getMetadata", () => {
		it("should return metadata from getEntityMatchingMetadata unchanged", async () => {
			/** Arrange */
			const baseMetadata = createBaseMetadata();
			mockGetEntityMatchingMetadata.mockResolvedValue(baseMetadata);

			/** Act */
			const result = await equifaxAdapter.getMetadata("business-123");

			/** Assert */
			expect(result).toEqual(baseMetadata);
		});

		it("should pass business ID to getEntityMatchingMetadata", async () => {
			/** Arrange */
			const businessID = "test-business-456";
			mockGetEntityMatchingMetadata.mockResolvedValue(createBaseMetadata());

			/** Act */
			await equifaxAdapter.getMetadata(businessID);

			/** Assert */
			expect(mockGetEntityMatchingMetadata).toHaveBeenCalledWith(businessID);
		});

		it("should return undefined when metadata is not found", async () => {
			/** Arrange */
			mockGetEntityMatchingMetadata.mockResolvedValue(undefined);

			/** Act */
			const result = await equifaxAdapter.getMetadata("business-123");

			/** Assert */
			expect(result).toBeUndefined();
		});
	});
});
