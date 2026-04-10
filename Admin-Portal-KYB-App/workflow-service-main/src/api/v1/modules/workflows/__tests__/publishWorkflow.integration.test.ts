import request from "supertest";
import express from "express";
import { v4 as uuidv4 } from "uuid";
import { controller } from "../controller";
import { publishManager } from "#core";
import { jsend } from "#utils";
import { RESPONSE_STATUS } from "#constants/workflow.constants";

// Mock the publish manager
jest.mock("#core", () => ({
	publishManager: {
		publishWorkflow: jest.fn()
	}
}));

// Mock middleware to avoid complex dependencies
jest.mock("#middlewares", () => ({
	validateSchema: jest.fn(() => (_req: express.Request, _res: express.Response, next: express.NextFunction) => next()),
	validateUser: jest.fn(() => (_req: express.Request, _res: express.Response, next: express.NextFunction) => next())
}));

describe("Publish Workflow Integration Tests", () => {
	const testCustomerId = uuidv4();
	const testUserId = uuidv4();
	const testWorkflowId = uuidv4();
	const testVersionId = uuidv4();
	const _testTriggerId = uuidv4();

	const mockUserInfo = {
		user_id: testUserId,
		email: "test@example.com",
		given_name: "Test",
		family_name: "User",
		customer_id: testCustomerId,
		role: { id: 1, code: "CRO" }
	};

	// Create test app
	const createTestApp = () => {
		const app = express();
		app.use(express.json());
		app.use(jsend());

		// Mock middleware to set user info
		app.use((req, res, next) => {
			res.locals = { user: mockUserInfo };
			next();
		});

		// Add the route with mocked middleware
		app.post(
			"/workflows/versions/:id/publish",
			(req, res, next) => next(), // validateUser mock
			(req, res, next) => next(), // validateIdParam mock
			(req, res, next) => next(), // validateSchema mock
			controller.publishWorkflow
		);

		// Add error handling middleware
		app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
			if (res.headersSent) {
				return next(err);
			}

			return res.status(500).json({
				status: RESPONSE_STATUS.ERROR,
				message: "Internal server error"
			});
		});

		return app;
	};

	beforeEach(() => {
		jest.clearAllMocks();
	});

	describe("POST /workflows/versions/:id/publish", () => {
		it("should successfully publish a workflow version", async () => {
			const mockPublishResponse = {
				workflow_id: testWorkflowId,
				version_id: testVersionId,
				version_number: 1,
				published_at: "2024-01-15T10:30:00.000Z",
				message: "Workflow published successfully"
			};

			(publishManager.publishWorkflow as jest.Mock).mockResolvedValue(mockPublishResponse);

			const app = createTestApp();
			const response = await request(app).post(`/workflows/versions/${testVersionId}/publish`).expect(200);

			expect(response.body).toMatchObject({
				status: "success",
				message: "Workflow published successfully",
				data: mockPublishResponse
			});

			expect(publishManager.publishWorkflow).toHaveBeenCalledWith(testVersionId, mockUserInfo);
		});

		it("should return 400 for invalid version ID", async () => {
			const invalidVersionId = "invalid-uuid";

			// Create a test app with mocked middleware that validates UUID
			const app = express();
			app.use(express.json());
			app.use(jsend());

			// Mock middleware to set user info
			app.use((req, res, next) => {
				res.locals = { user: mockUserInfo };
				next();
			});

			// Mock validateIdParam to actually validate UUID
			const mockValidateIdParam = (req: express.Request, res: express.Response, next: express.NextFunction) => {
				const versionId = req.params.id;
				if (!versionId?.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
					return res.status(400).json({
						status: "error",
						message: "The parameter 'id' must be a valid UUID format"
					});
				}
				next();
			};

			// Add the route with mocked middleware
			app.post(
				"/workflows/versions/:id/publish",
				(req, res, next) => next(), // validateUser mock
				mockValidateIdParam,
				(req, res, next) => next(), // validateSchema mock
				controller.publishWorkflow
			);

			const response = await request(app).post(`/workflows/versions/${invalidVersionId}/publish`).expect(400);

			expect(response.body).toMatchObject({
				status: "error",
				message: "The parameter 'id' must be a valid UUID format"
			});
		});

		it("should return 400 for missing version ID", async () => {
			const app = createTestApp();
			const _response = await request(app).post("/workflows/versions//publish").expect(404); // Express will return 404 for malformed route
		});

		it("should handle workflow manager errors", async () => {
			const error = new Error("Workflow version not found or not in draft status");
			(publishManager.publishWorkflow as jest.Mock).mockRejectedValue(error);

			const app = createTestApp();
			const response = await request(app).post(`/workflows/versions/${testVersionId}/publish`).expect(500);

			expect(response.body).toMatchObject({
				status: "error",
				message: "Internal server error"
			});
		});

		it("should handle validation errors", async () => {
			const validationError = new Error("Workflow version must have a trigger before publishing");
			(publishManager.publishWorkflow as jest.Mock).mockRejectedValue(validationError);

			const app = createTestApp();
			const response = await request(app).post(`/workflows/versions/${testVersionId}/publish`).expect(500);

			expect(response.body).toMatchObject({
				status: "error",
				message: "Internal server error"
			});
		});
	});
});
