import request from "supertest";
import { app } from "../../app";
import { type TestApiResponse } from "#types/common";

// Mock uuid module to fix ESM import issues
jest.mock("uuid", () => ({
	v4: jest.fn(() => "mock-uuid-123")
}));

describe("API Endpoints", () => {
	describe("Health Check", () => {
		it("should return health status", async () => {
			const response = await request(app).get("/api/health");

			expect(response.status).toBe(200);
			expect(response.body).toHaveProperty("status", "success");
			const body = response.body as TestApiResponse;
			expect(body.data).toHaveProperty("name");
			expect(body.data).toHaveProperty("version");
			expect(body.data).toHaveProperty("timestamp");
		});
	});
});
