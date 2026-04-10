import request from "supertest";
import express from "express";
import { validateIdParam } from "#middlewares";
import { Utils, Workflows } from "@joinworth/types";
import { controller } from "../controller";
import { sharedRuleManager } from "#core";
import { jsend } from "#utils";
import { ApiError } from "#types/common";
import { RESPONSE_STATUS, SUCCESS_MESSAGES } from "#constants/workflow.constants";
import { StatusCodes } from "http-status-codes";

interface TestResponse {
	status: string;
	data?: Record<string, unknown>;
	message?: string;
}

interface ValidationError extends Error {
	details?: Record<string, unknown>;
	status?: number;
}

jest.mock("#database", () => ({}));
jest.mock("#helpers/redis", () => ({}));
jest.mock("#helpers/bullQueue", () => ({}));
jest.mock("#helpers/logger", () => ({
	logger: {
		info: jest.fn(),
		error: jest.fn(),
		warn: jest.fn(),
		debug: jest.fn(),
		child: jest.fn(() => ({
			info: jest.fn(),
			error: jest.fn(),
			warn: jest.fn(),
			debug: jest.fn()
		}))
	},
	pinoHttpLogger: jest.fn()
}));

jest.mock("#configs", () => ({
	envConfig: {
		DB_HOST: "localhost",
		DB_PORT: 5432,
		DB_NAME: "test",
		DB_USER: "test",
		DB_PASSWORD: "test"
	},
	workflowConfig: { processingQueue: { delay: 120000 } }
}));

jest.mock("#middlewares", () => {
	const actual = jest.requireActual<typeof import("#middlewares")>("#middlewares");
	return {
		...actual,
		validateUser: (_req: unknown, res: unknown, next: unknown): void => {
			(res as { locals: { user: unknown } }).locals.user = {
				user_id: "550e8400-e29b-41d4-a716-446655440000",
				email: "test@example.com",
				given_name: "Test",
				family_name: "User",
				customer_id: "660e8400-e29b-41d4-a716-446655440001",
				role: { id: 1, code: "ADMIN" }
			};
			(next as () => void)();
		},
		validateSubroleForWrite: (_req: unknown, _res: unknown, next: unknown): void => {
			(next as () => void)();
		},
		createValidateSubroleForWrite:
			() =>
			(_req: unknown, _res: unknown, next: unknown): void => {
				(next as () => void)();
			}
	};
});

jest.mock("#core", () => ({
	sharedRuleManager: {
		createRule: jest.fn(),
		updateRule: jest.fn(),
		getRuleDetailsBatchByIds: jest.fn()
	}
}));

const RULE_ID = "550e8400-e29b-41d4-a716-446655440000";
const VERSION_ID = "660e8400-e29b-41d4-a716-446655440001";
const CONTEXT_ID = "770e8400-e29b-41d4-a716-446655440002";
const INITIATED_BY_USER_ID = "880e8400-e29b-41d4-a716-446655440088";

const validConditions = {
	operator: "AND" as const,
	conditions: [{ field: "facts.country", operator: "=" as const, value: "US" }]
};

const validCreateBody = {
	context_type: "monitoring",
	context_id: CONTEXT_ID,
	name: "Test Rule",
	description: "Optional description",
	conditions: validConditions,
	initiated_by_user_id: INITIATED_BY_USER_ID
};

describe("Shared Rules - Integration Tests", () => {
	const createTestApp = () => {
		const app = express();
		app.use(express.json());
		app.use(jsend());

		app.post(
			"/shared/internal/rules/details",
			Utils.validateBody(Workflows.Shared.Rules.GetSharedRuleDetailsBatchRequestSchema),
			controller.getRuleDetailsBatch
		);
		app.post(
			"/shared/internal/rules",
			Utils.validateBody(Workflows.Shared.Rules.CreateSharedRuleRequestSchema),
			controller.createRule
		);
		app.put(
			"/shared/internal/rules/:id",
			validateIdParam,
			Utils.validateBody(Workflows.Shared.Rules.UpdateSharedRuleRequestSchema),
			controller.updateRule
		);

		app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
			if (res.headersSent) return next(err);
			if (err.name === "ValidationMiddlewareError") {
				const vErr = err as ValidationError;
				return res.status(vErr.status ?? StatusCodes.BAD_REQUEST).json({
					status: RESPONSE_STATUS.FAIL,
					message: err.message,
					data: vErr.details
				});
			}
			if (err instanceof ApiError) {
				return res.status(err.status).json({
					status: RESPONSE_STATUS.ERROR,
					message: err.message
				});
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

	describe("POST /shared/internal/rules - Successful requests", () => {
		it("should create a rule and return 201 with rule_id and version_id", async () => {
			(sharedRuleManager.createRule as jest.Mock).mockResolvedValue({
				rule_id: RULE_ID,
				version_id: VERSION_ID
			});

			const app = createTestApp();
			const response = await request(app)
				.post("/shared/internal/rules")
				.set("Content-Type", "application/json")
				.send(validCreateBody);

			expect(response.status).toBe(StatusCodes.CREATED);
			expect(response.body).toMatchObject({
				status: RESPONSE_STATUS.SUCCESS,
				data: { rule_id: RULE_ID, version_id: VERSION_ID },
				message: SUCCESS_MESSAGES.RULE_CREATED
			});
			expect(sharedRuleManager.createRule).toHaveBeenCalledWith(
				{
					context_type: "monitoring",
					context_id: CONTEXT_ID,
					name: validCreateBody.name,
					description: validCreateBody.description ?? undefined,
					conditions: validConditions
				},
				INITIATED_BY_USER_ID
			);
		});

		it("should create a rule with OR group in conditions", async () => {
			const bodyWithOr = {
				context_type: "monitoring",
				context_id: CONTEXT_ID,
				name: "Rule with OR",
				initiated_by_user_id: INITIATED_BY_USER_ID,
				conditions: {
					operator: "AND",
					conditions: [
						{ field: "facts.amount", operator: ">", value: 100 },
						{
							operator: "OR",
							conditions: [
								{ field: "facts.country", operator: "=", value: "US" },
								{ field: "facts.country", operator: "=", value: "CA" }
							]
						}
					]
				}
			};
			(sharedRuleManager.createRule as jest.Mock).mockResolvedValue({
				rule_id: RULE_ID,
				version_id: VERSION_ID
			});

			const app = createTestApp();
			const response = await request(app)
				.post("/shared/internal/rules")
				.set("Content-Type", "application/json")
				.send(bodyWithOr);

			expect(response.status).toBe(StatusCodes.CREATED);
			expect((response.body as TestResponse).data).toHaveProperty("rule_id", RULE_ID);
			expect((response.body as TestResponse).data).toHaveProperty("version_id", VERSION_ID);
		});
	});

	describe("POST /shared/internal/rules - Payload validation errors", () => {
		it("should return 400 for invalid context_type", async () => {
			const app = createTestApp();
			const response = await request(app)
				.post("/shared/internal/rules")
				.set("Content-Type", "application/json")
				.send({
					...validCreateBody,
					context_type: "case"
				});

			expect(response.status).toBe(StatusCodes.BAD_REQUEST);
			expect((response.body as TestResponse).status).toBe(RESPONSE_STATUS.FAIL);
			expect((response.body as TestResponse).message).toMatch(/context_type|monitoring/i);
			expect(sharedRuleManager.createRule).not.toHaveBeenCalled();
		});

		it("should return 400 for context_id not a UUID", async () => {
			const app = createTestApp();
			const response = await request(app)
				.post("/shared/internal/rules")
				.set("Content-Type", "application/json")
				.send({
					...validCreateBody,
					context_id: "not-a-uuid"
				});

			expect(response.status).toBe(StatusCodes.BAD_REQUEST);
			expect((response.body as TestResponse).status).toBe(RESPONSE_STATUS.FAIL);
			expect(sharedRuleManager.createRule).not.toHaveBeenCalled();
		});

		it("should return 400 for empty name", async () => {
			const app = createTestApp();
			const response = await request(app)
				.post("/shared/internal/rules")
				.set("Content-Type", "application/json")
				.send({
					...validCreateBody,
					name: ""
				});

			expect(response.status).toBe(StatusCodes.BAD_REQUEST);
			expect((response.body as TestResponse).status).toBe(RESPONSE_STATUS.FAIL);
			expect(sharedRuleManager.createRule).not.toHaveBeenCalled();
		});

		it("should return 400 for conditions with root operator not AND", async () => {
			const app = createTestApp();
			const response = await request(app)
				.post("/shared/internal/rules")
				.set("Content-Type", "application/json")
				.send({
					...validCreateBody,
					conditions: {
						operator: "OR",
						conditions: [{ field: "x", operator: "=", value: 1 }]
					}
				});

			expect(response.status).toBe(StatusCodes.BAD_REQUEST);
			expect((response.body as TestResponse).status).toBe(RESPONSE_STATUS.FAIL);
			expect(sharedRuleManager.createRule).not.toHaveBeenCalled();
		});

		it("should return 400 for nested AND in conditions", async () => {
			const app = createTestApp();
			const response = await request(app)
				.post("/shared/internal/rules")
				.set("Content-Type", "application/json")
				.send({
					...validCreateBody,
					conditions: {
						operator: "AND",
						conditions: [
							{
								operator: "AND",
								conditions: [{ field: "facts.country", operator: "=", value: "US" }]
							}
						]
					}
				});

			expect(response.status).toBe(StatusCodes.BAD_REQUEST);
			expect((response.body as TestResponse).status).toBe(RESPONSE_STATUS.FAIL);
			expect((response.body as TestResponse).message).toMatch(/OR|nest|AND/i);
			expect(sharedRuleManager.createRule).not.toHaveBeenCalled();
		});

		it("should return 400 for invalid condition operator", async () => {
			const app = createTestApp();
			const response = await request(app)
				.post("/shared/internal/rules")
				.set("Content-Type", "application/json")
				.send({
					...validCreateBody,
					conditions: {
						operator: "AND",
						conditions: [{ field: "x", operator: "INVALID_OP", value: 1 }]
					}
				});

			expect(response.status).toBe(StatusCodes.BAD_REQUEST);
			expect((response.body as TestResponse).status).toBe(RESPONSE_STATUS.FAIL);
			expect(sharedRuleManager.createRule).not.toHaveBeenCalled();
		});

		it("should return 400 for condition missing value", async () => {
			const app = createTestApp();
			const response = await request(app)
				.post("/shared/internal/rules")
				.set("Content-Type", "application/json")
				.send({
					...validCreateBody,
					conditions: {
						operator: "AND",
						conditions: [{ field: "facts.amount", operator: ">=" }]
					}
				});

			expect(response.status).toBe(StatusCodes.BAD_REQUEST);
			expect((response.body as TestResponse).status).toBe(RESPONSE_STATUS.FAIL);
			expect(sharedRuleManager.createRule).not.toHaveBeenCalled();
		});

		it("should return 400 for missing required fields", async () => {
			const app = createTestApp();
			const response = await request(app)
				.post("/shared/internal/rules")
				.set("Content-Type", "application/json")
				.send({});

			expect(response.status).toBe(StatusCodes.BAD_REQUEST);
			expect((response.body as TestResponse).status).toBe(RESPONSE_STATUS.FAIL);
			expect(sharedRuleManager.createRule).not.toHaveBeenCalled();
		});
	});

	describe("PUT /shared/internal/rules/:id - Successful requests", () => {
		it("should update metadata only and return 200 without version_id", async () => {
			(sharedRuleManager.updateRule as jest.Mock).mockResolvedValue({});

			const app = createTestApp();
			const response = await request(app)
				.put(`/shared/internal/rules/${RULE_ID}`)
				.set("Content-Type", "application/json")
				.send({
					name: "Updated Name",
					description: "New desc",
					initiated_by_user_id: INITIATED_BY_USER_ID
				});

			expect(response.status).toBe(StatusCodes.OK);
			expect(response.body).toMatchObject({
				status: RESPONSE_STATUS.SUCCESS,
				data: { rule_id: RULE_ID },
				message: SUCCESS_MESSAGES.RULE_UPDATED
			});
			expect(response.body.data).not.toHaveProperty("version_id");
			expect(sharedRuleManager.updateRule).toHaveBeenCalledWith(
				RULE_ID,
				expect.objectContaining({
					name: "Updated Name",
					description: "New desc",
					created_by: INITIATED_BY_USER_ID
				})
			);
		});

		it("should update conditions and return 200 with version_id and version_number", async () => {
			(sharedRuleManager.updateRule as jest.Mock).mockResolvedValue({
				version_id: VERSION_ID,
				version_number: 2
			});

			const app = createTestApp();
			const response = await request(app)
				.put(`/shared/internal/rules/${RULE_ID}`)
				.set("Content-Type", "application/json")
				.send({ conditions: validConditions, initiated_by_user_id: INITIATED_BY_USER_ID });

			expect(response.status).toBe(StatusCodes.OK);
			expect(response.body.data).toMatchObject({
				rule_id: RULE_ID,
				version_id: VERSION_ID,
				version_number: 2
			});
			expect(sharedRuleManager.updateRule).toHaveBeenCalledWith(
				RULE_ID,
				expect.objectContaining({ conditions: validConditions, created_by: INITIATED_BY_USER_ID })
			);
		});
	});

	describe("PUT /shared/internal/rules/:id - Param validation errors", () => {
		it("should return 400 for invalid id (not UUID)", async () => {
			const app = createTestApp();
			const response = await request(app)
				.put("/shared/internal/rules/not-a-uuid")
				.set("Content-Type", "application/json")
				.send({ name: "Updated", initiated_by_user_id: INITIATED_BY_USER_ID });

			expect(response.status).toBe(StatusCodes.BAD_REQUEST);
			// Param validation throws ApiError → response status "error" in our handler
			expect([RESPONSE_STATUS.FAIL, RESPONSE_STATUS.ERROR]).toContain((response.body as TestResponse).status);
			expect(sharedRuleManager.updateRule).not.toHaveBeenCalled();
		});

		it("should return 400 for empty id (trailing slash)", async () => {
			// Request to /shared/internal/rules/ may give :id = "" depending on Express; validateIdParam returns 400
			const app = createTestApp();
			const response = await request(app)
				.put("/shared/internal/rules/")
				.set("Content-Type", "application/json")
				.send({ name: "Updated", initiated_by_user_id: INITIATED_BY_USER_ID });

			expect([400, 404]).toContain(response.status);
		});
	});

	describe("PUT /shared/internal/rules/:id - Payload validation errors", () => {
		it("should return 400 for empty body (missing initiated_by_user_id)", async () => {
			(sharedRuleManager.updateRule as jest.Mock).mockResolvedValue({});

			const app = createTestApp();
			const response = await request(app)
				.put(`/shared/internal/rules/${RULE_ID}`)
				.set("Content-Type", "application/json")
				.send({});

			expect(response.status).toBe(StatusCodes.BAD_REQUEST);
			expect((response.body as TestResponse).status).toBe(RESPONSE_STATUS.FAIL);
			expect((response.body as TestResponse).message).toMatch(/initiated_by_user_id|required|Invalid/i);
			expect(sharedRuleManager.updateRule).not.toHaveBeenCalled();
		});

		it("should return 400 when only initiated_by_user_id is sent (no field updates)", async () => {
			const app = createTestApp();
			const response = await request(app)
				.put(`/shared/internal/rules/${RULE_ID}`)
				.set("Content-Type", "application/json")
				.send({ initiated_by_user_id: INITIATED_BY_USER_ID });

			expect(response.status).toBe(StatusCodes.BAD_REQUEST);
			expect((response.body as TestResponse).status).toBe(RESPONSE_STATUS.FAIL);
			expect((response.body as TestResponse).message).toMatch(/at least one|name|description|conditions/i);
			expect(sharedRuleManager.updateRule).not.toHaveBeenCalled();
		});

		it("should return 400 for invalid conditions when updating", async () => {
			const app = createTestApp();
			const response = await request(app)
				.put(`/shared/internal/rules/${RULE_ID}`)
				.set("Content-Type", "application/json")
				.send({
					initiated_by_user_id: INITIATED_BY_USER_ID,
					conditions: {
						operator: "OR",
						conditions: [{ field: "x", operator: "=", value: 1 }]
					}
				});

			expect(response.status).toBe(StatusCodes.BAD_REQUEST);
			expect((response.body as TestResponse).status).toBe(RESPONSE_STATUS.FAIL);
			expect(sharedRuleManager.updateRule).not.toHaveBeenCalled();
		});
	});

	describe("PUT /shared/internal/rules/:id - Not found and service errors", () => {
		it("should return 404 when rule does not exist", async () => {
			const notFoundError = new ApiError("Rule not found", StatusCodes.NOT_FOUND, "WORKFLOW_NOT_FOUND");
			(sharedRuleManager.updateRule as jest.Mock).mockRejectedValue(notFoundError);

			const app = createTestApp();
			const response = await request(app)
				.put(`/shared/internal/rules/${RULE_ID}`)
				.set("Content-Type", "application/json")
				.send({ name: "Updated", initiated_by_user_id: INITIATED_BY_USER_ID });

			expect(response.status).toBe(StatusCodes.NOT_FOUND);
			expect((response.body as TestResponse).status).toBe(RESPONSE_STATUS.ERROR);
			expect((response.body as TestResponse).message).toBe("Rule not found");
		});

		it("should return 500 when manager throws unexpected error", async () => {
			(sharedRuleManager.updateRule as jest.Mock).mockRejectedValue(new Error("Database error"));

			const app = createTestApp();
			const response = await request(app)
				.put(`/shared/internal/rules/${RULE_ID}`)
				.set("Content-Type", "application/json")
				.send({ name: "Updated", initiated_by_user_id: INITIATED_BY_USER_ID });

			expect(response.status).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
			expect((response.body as TestResponse).status).toBe(RESPONSE_STATUS.ERROR);
		});

		it("should return 500 when createRule throws", async () => {
			(sharedRuleManager.createRule as jest.Mock).mockRejectedValue(new Error("DB error"));

			const app = createTestApp();
			const response = await request(app)
				.post("/shared/internal/rules")
				.set("Content-Type", "application/json")
				.send(validCreateBody);

			expect(response.status).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
			expect((response.body as TestResponse).status).toBe(RESPONSE_STATUS.ERROR);
		});
	});

	describe("POST /shared/internal/rules/details", () => {
		const MISSING_ID = "770e8400-e29b-41d4-a716-446655440099";
		const created = new Date("2025-03-01T10:00:00.000Z");
		const versionCreated = new Date("2025-03-02T11:00:00.000Z");

		it("should return 200 with rules and missing_rule_ids", async () => {
			(sharedRuleManager.getRuleDetailsBatchByIds as jest.Mock).mockResolvedValue({
				rules: [
					{
						rule_id: RULE_ID,
						name: "Test Rule",
						description: "Optional description",
						latest_version_number: 1,
						conditions: validConditions,
						rule_created_at: created,
						version_created_at: versionCreated
					}
				],
				missing_rule_ids: [MISSING_ID]
			});

			const app = createTestApp();
			const response = await request(app)
				.post("/shared/internal/rules/details")
				.set("Content-Type", "application/json")
				.send({ rule_ids: [RULE_ID, MISSING_ID] });

			expect(response.status).toBe(StatusCodes.OK);
			expect(response.body).toMatchObject({
				status: RESPONSE_STATUS.SUCCESS,
				message: SUCCESS_MESSAGES.RULE_DETAILS_RETRIEVED,
				data: {
					rules: [
						{
							rule_id: RULE_ID,
							name: "Test Rule",
							description: "Optional description",
							latest_version_number: 1,
							conditions: validConditions,
							rule_created_at: created.toISOString(),
							version_created_at: versionCreated.toISOString()
						}
					],
					missing_rule_ids: [MISSING_ID]
				}
			});
			expect(sharedRuleManager.getRuleDetailsBatchByIds).toHaveBeenCalledWith([RULE_ID, MISSING_ID]);
		});

		it("should return 400 when rule_ids is empty", async () => {
			const app = createTestApp();
			const response = await request(app)
				.post("/shared/internal/rules/details")
				.set("Content-Type", "application/json")
				.send({ rule_ids: [] });

			expect(response.status).toBe(StatusCodes.BAD_REQUEST);
			expect((response.body as TestResponse).status).toBe(RESPONSE_STATUS.FAIL);
			expect(sharedRuleManager.getRuleDetailsBatchByIds).not.toHaveBeenCalled();
		});

		it("should return 400 when a rule_id is not a valid UUID", async () => {
			const app = createTestApp();
			const response = await request(app)
				.post("/shared/internal/rules/details")
				.set("Content-Type", "application/json")
				.send({ rule_ids: ["not-a-uuid"] });

			expect(response.status).toBe(StatusCodes.BAD_REQUEST);
			expect((response.body as TestResponse).status).toBe(RESPONSE_STATUS.FAIL);
			expect(sharedRuleManager.getRuleDetailsBatchByIds).not.toHaveBeenCalled();
		});
	});
});
