import axios from "axios";
import { logger } from "#helpers/logger";
import { CaseServiceClient } from "../caseServiceClient";

jest.mock("axios");

const mockedAxios = axios as jest.Mocked<typeof axios>;

describe("CaseServiceClient", () => {
	describe("patchBusinessDisplayProfile", () => {
		beforeEach(() => {
			jest.clearAllMocks();
			mockedAxios.patch.mockResolvedValue({ data: {} } as never);
		});

		it("PATCHes the internal display-profile URL with body and JSON headers", async () => {
			const client = new CaseServiceClient();
			const businessId = "11111111-1111-1111-1111-111111111111";
			const userId = "22222222-2222-2222-2222-222222222222";

			await client.patchBusinessDisplayProfile(businessId as never, {
				userId: userId as never,
				name: "Acme LLC",
				dba_names: [{ name: "Acme Store" }]
			});

			expect(mockedAxios.patch).toHaveBeenCalledTimes(1);
			// CASE_BASE_URL may be empty (relative path) or absolute; path segment is stable.
			expect(mockedAxios.patch).toHaveBeenCalledWith(
				expect.stringContaining(
					`/api/v1/internal/businesses/${businessId}/display-profile`
				),
				{
					userId: "22222222-2222-2222-2222-222222222222",
					name: "Acme LLC",
					dba_names: [{ name: "Acme Store" }]
				},
				{ headers: { "Content-Type": "application/json" } }
			);
		});

		it("logs and resolves when PATCH fails (does not throw)", async () => {
			mockedAxios.patch.mockRejectedValueOnce(new Error("network"));

			const client = new CaseServiceClient();
			const businessId = "11111111-1111-1111-1111-111111111111";
			const userId = "22222222-2222-2222-2222-222222222222";

			await expect(
				client.patchBusinessDisplayProfile(businessId as never, {
					userId: userId as never,
					name: "X"
				})
			).resolves.toBeUndefined();

			expect(logger.error).toHaveBeenCalledWith(
				expect.objectContaining({
					message: expect.stringContaining("Failed to PATCH display profile")
				})
			);
		});
	});
});
