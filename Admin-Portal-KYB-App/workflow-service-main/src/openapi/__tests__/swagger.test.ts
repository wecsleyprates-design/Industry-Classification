import request from "supertest";
import { app } from "../../app";

// Mock uuid module to fix ESM import issues
jest.mock("uuid", () => ({
	v4: jest.fn(() => "mock-uuid-123")
}));

describe("Swagger Documentation", () => {
	describe("GET /api-docs", () => {
		it("should serve Swagger UI", async () => {
			const response = await request(app).get("/api-docs");

			// Swagger UI might redirect, so we accept both 200 and 301
			expect([200, 301]).toContain(response.status);
			if (response.status === 200) {
				expect(response.headers["content-type"]).toMatch(/text\/html/);
				expect(response.text).toContain("swagger-ui");
			}
		});
	});

	describe("GET /docs", () => {
		it("should redirect to /api-docs", async () => {
			const response = await request(app).get("/docs");

			expect(response.status).toBe(302);
			expect(response.headers.location).toBe("/api-docs");
		});
	});
});
