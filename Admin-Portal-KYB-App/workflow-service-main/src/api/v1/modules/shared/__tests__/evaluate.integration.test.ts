import request from "supertest";
import express from "express";
import { Utils, Workflows } from "@joinworth/types";
import { controller } from "../controller";
import { monitoringEvaluationManager } from "#core";
import { jsend } from "#utils";
import { ApiError } from "#types/common";
import { ERROR_MESSAGES, RESPONSE_STATUS, SUCCESS_MESSAGES } from "#constants/workflow.constants";
import { StatusCodes } from "http-status-codes";
import { WORKFLOW_ERROR_CODES_COMBINED as ERROR_CODES } from "#constants";

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

jest.mock("#core", () => ({
	sharedRuleManager: {
		createRule: jest.fn(),
		updateRule: jest.fn()
	},
	monitoringEvaluationManager: {
		evaluateRules: jest.fn()
	}
}));

const RULE_ID = "550e8400-e29b-41d4-a716-446655440000";
const EVALUATION_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
const BUSINESS_ID = "7b3e9c2a-4d1f-4e8b-9c6a-2f8e1d0b7c55";
const CUSTOMER_ID = "c0ffee00-0000-4000-8000-000000000001";

const validEvaluateBody = {
	currentState: { status: "open", facts: { country: "US" } },
	ruleIds: [RULE_ID]
};

describe("POST /shared/rules/evaluate — Integration", () => {
	const mockEvaluate = monitoringEvaluationManager.evaluateRules as jest.MockedFunction<
		typeof monitoringEvaluationManager.evaluateRules
	>;

	const createTestApp = () => {
		const app = express();
		app.use(express.json());
		app.use(jsend());

		app.post(
			"/shared/rules/evaluate",
			Utils.validateBody(Workflows.Shared.Evaluations.EvaluateRulesRequestSchema, {
				unrecognizedKeys: "loose",
				mutate: true
			}),
			controller.evaluateRules
		);

		app.use((err: Error, _req: express.Request, res: express.Response, next: express.NextFunction) => {
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
					status: err.status >= StatusCodes.INTERNAL_SERVER_ERROR ? RESPONSE_STATUS.ERROR : RESPONSE_STATUS.FAIL,
					message: err.message,
					errorCode: err.errorCode
				});
			}
			return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
				status: RESPONSE_STATUS.ERROR,
				message: ERROR_MESSAGES.GENERIC_INTERNAL_SERVER_ERROR
			});
		});

		return app;
	};

	let app: express.Express;

	beforeEach(() => {
		jest.clearAllMocks();
		app = createTestApp();
	});

	describe("happy path", () => {
		it("returns 200 with message, evaluation_id, and results including rule_name", async () => {
			const evalResult = {
				evaluation_id: EVALUATION_ID,
				results: [
					{
						rule_id: RULE_ID,
						rule_name: "Monitoring rule",
						matched: true,
						conditions: {},
						true_conditions: [],
						false_conditions: []
					}
				]
			};
			mockEvaluate.mockResolvedValue(evalResult);

			const res = await request(app)
				.post("/shared/rules/evaluate")
				.send({
					...validEvaluateBody,
					evaluationId: EVALUATION_ID,
					businessId: BUSINESS_ID,
					customerId: CUSTOMER_ID,
					previousState: { status: "draft" }
				})
				.expect(StatusCodes.OK);

			expect(res.body).toMatchObject({
				status: RESPONSE_STATUS.SUCCESS,
				message: SUCCESS_MESSAGES.EVALUATION_COMPLETED,
				data: {
					evaluation_id: EVALUATION_ID,
					results: [
						expect.objectContaining({
							rule_id: RULE_ID,
							rule_name: "Monitoring rule",
							matched: true
						})
					]
				}
			});
			expect(mockEvaluate).toHaveBeenCalledWith(
				expect.objectContaining({
					currentState: validEvaluateBody.currentState,
					ruleIds: validEvaluateBody.ruleIds,
					evaluationId: EVALUATION_ID,
					businessId: BUSINESS_ID,
					customerId: CUSTOMER_ID,
					previousState: { status: "draft" }
				})
			);
		});

		it("returns 200 when manager omits evaluation_id", async () => {
			mockEvaluate.mockResolvedValue({
				results: [
					{
						rule_id: RULE_ID,
						rule_name: "R",
						matched: false,
						conditions: {},
						true_conditions: [],
						false_conditions: []
					}
				]
			});

			const res = await request(app).post("/shared/rules/evaluate").send(validEvaluateBody).expect(StatusCodes.OK);

			expect(res.body.data).not.toHaveProperty("evaluation_id");
			expect(res.body.data.results).toHaveLength(1);
		});

		it("accepts customerId null (preprocessed to optional) and forwards body without customerId", async () => {
			mockEvaluate.mockResolvedValue({ results: [] });

			await request(app)
				.post("/shared/rules/evaluate")
				.send({ ...validEvaluateBody, customerId: null })
				.expect(StatusCodes.OK);

			expect(mockEvaluate).toHaveBeenCalledWith(
				expect.objectContaining({
					ruleIds: validEvaluateBody.ruleIds,
					currentState: validEvaluateBody.currentState
				})
			);
			const passed = mockEvaluate.mock.calls[0][0] as Record<string, unknown>;
			expect(passed.customerId).toBeUndefined();
		});

		it("allows extra root-level properties without failing validation (loose)", async () => {
			mockEvaluate.mockResolvedValue({ results: [] });

			await request(app)
				.post("/shared/rules/evaluate")
				.send({
					...validEvaluateBody,
					traceId: "corr-123",
					source: "case-service"
				})
				.expect(StatusCodes.OK);

			expect(mockEvaluate).toHaveBeenCalled();
		});
	});

	describe("validation errors (400)", () => {
		it("rejects when ruleIds is missing", async () => {
			const res = await request(app)
				.post("/shared/rules/evaluate")
				.send({ currentState: {} })
				.expect(StatusCodes.BAD_REQUEST);

			expect(res.body.status).toBe(RESPONSE_STATUS.FAIL);
			expect(res.body.message).toMatch(/ruleIds/i);
			expect(mockEvaluate).not.toHaveBeenCalled();
		});

		it("rejects when ruleIds is empty", async () => {
			const res = await request(app)
				.post("/shared/rules/evaluate")
				.send({ currentState: {}, ruleIds: [] })
				.expect(StatusCodes.BAD_REQUEST);

			expect(res.body.status).toBe(RESPONSE_STATUS.FAIL);
			expect(mockEvaluate).not.toHaveBeenCalled();
		});

		it("rejects when currentState is missing", async () => {
			await request(app)
				.post("/shared/rules/evaluate")
				.send({ ruleIds: [RULE_ID] })
				.expect(StatusCodes.BAD_REQUEST);

			expect(mockEvaluate).not.toHaveBeenCalled();
		});

		it("rejects invalid customerId", async () => {
			await request(app)
				.post("/shared/rules/evaluate")
				.send({ ...validEvaluateBody, customerId: "not-a-uuid" })
				.expect(StatusCodes.BAD_REQUEST);

			expect(mockEvaluate).not.toHaveBeenCalled();
		});

		it("rejects invalid businessId when provided", async () => {
			await request(app)
				.post("/shared/rules/evaluate")
				.send({ ...validEvaluateBody, businessId: "bad" })
				.expect(StatusCodes.BAD_REQUEST);

			expect(mockEvaluate).not.toHaveBeenCalled();
		});

		it("rejects ruleIds entry that is an empty string", async () => {
			await request(app)
				.post("/shared/rules/evaluate")
				.send({ currentState: {}, ruleIds: [""] })
				.expect(StatusCodes.BAD_REQUEST);

			expect(mockEvaluate).not.toHaveBeenCalled();
		});
	});

	describe("manager errors", () => {
		it("returns 400 when manager throws ApiError 400", async () => {
			mockEvaluate.mockRejectedValue(
				new ApiError("Rule needs previousState", StatusCodes.BAD_REQUEST, ERROR_CODES.INVALID)
			);

			const res = await request(app)
				.post("/shared/rules/evaluate")
				.send(validEvaluateBody)
				.expect(StatusCodes.BAD_REQUEST);

			expect(res.body).toMatchObject({
				status: RESPONSE_STATUS.FAIL,
				message: "Rule needs previousState",
				errorCode: ERROR_CODES.INVALID
			});
		});

		it("returns 404 when manager throws ApiError 404", async () => {
			mockEvaluate.mockRejectedValue(new ApiError("Rule not found", StatusCodes.NOT_FOUND, ERROR_CODES.INVALID));

			const res = await request(app)
				.post("/shared/rules/evaluate")
				.send(validEvaluateBody)
				.expect(StatusCodes.NOT_FOUND);

			expect(res.body).toMatchObject({
				status: RESPONSE_STATUS.FAIL,
				message: "Rule not found"
			});
		});
	});
});
