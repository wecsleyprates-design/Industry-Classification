import express, { type ErrorRequestHandler } from "express";
import request from "supertest";

import { envConfig } from "#configs/index";
import { validatePurgedBusinessHelper } from "#helpers";
import { errorMiddleware } from "#middlewares/index";
import { jsend, verifyToken } from "#utils/index";

import { DataScrapeApiError, DataScrapeApiErrorCodes } from "../dataScrapeApiError";
import { getDataScrapeService } from "../dataScrapeService";
import {
	alternateBusinessID,
	buildRouteSearchSuccessResponse,
	buildValidSearchBusinessBody,
	businessID as validBusinessID,
	routeSuccessMessage
} from "./test.utils";

/*
 * Scope: this file explains only the HTTP-facing regression coverage added for the
 * search-business-details API. It does not document the full DataScrapeService
 * implementation; that behavior is covered in the sibling searchSerpAPI tests.
 *
 * Real in this harness:
 * - Express request handling through the real data-scrape routes
 * - Middleware ordering for auth, schema validation, purged-business checks, and
 *   error formatting
 * - Controller argument mapping from request body to searchSerpAPI input
 *
 * Mocked in this harness:
 * - The data scrape module and service factory
 * - verifyToken
 * - validatePurgedBusinessHelper
 *
 * Public route order under test:
 * validateUser -> validateTypedSchema(schema.dataScrape) -> validatePurgedBusiness -> searchForBusiness
 *
 * Internal route order under test:
 * validateTypedSchema(schema.dataScrape) -> validatePurgedBusiness -> searchForBusiness
 */

/*
 * Mock boundary: the router is loaded only after replacing modules that would
 * otherwise call external services or construct a real DataScrapeService. That
 * keeps these tests focused on HTTP contracts, middleware ordering, and
 * controller-to-service argument mapping.
 */
jest.mock("../dataScrape", () => ({
	getGoogleProfileMatchResult: jest.fn(),
	searchGoogleProfileMatchResult: jest.fn()
}));

jest.mock("../dataScrapeService", () => ({
	getDataScrapeService: jest.fn()
}));

jest.mock("#helpers", () => ({
	logger: {
		info: jest.fn(),
		error: jest.fn(),
		debug: jest.fn(),
		warn: jest.fn()
	},
	validatePurgedBusinessHelper: jest.fn()
}));

jest.mock("#helpers/index", () => ({
	logger: {
		info: jest.fn(),
		error: jest.fn(),
		debug: jest.fn(),
		warn: jest.fn()
	},
	validatePurgedBusinessHelper: jest.fn()
}));
jest.mock("#utils/index", () => {
	const actual = jest.requireActual("#utils/index");
	return {
		...actual,
		verifyToken: jest.fn()
	};
});

const dataScrapeRoutes = require("../routes");

const validBody = buildValidSearchBusinessBody();

const mockGetDataScrapeService = getDataScrapeService as jest.MockedFunction<typeof getDataScrapeService>;
const mockValidatePurgedBusinessHelper = validatePurgedBusinessHelper as jest.MockedFunction<
	typeof validatePurgedBusinessHelper
>;
const mockVerifyToken = verifyToken as jest.MockedFunction<typeof verifyToken>;
const mockSearchSerpAPI = jest.fn();

/*
 * createApp mirrors the minimal production stack needed for this route contract:
 * jsend shapes success and fail payloads, express.json parses request bodies, the
 * real router is mounted under /api/v1, and errorMiddleware formats thrown
 * DataScrapeApiError instances into the same jsend envelope clients see in the app.
 */
const createApp = () => {
	const app = express();
	app.use(jsend());
	app.use(express.json({ limit: "20MB" }));
	app.use("/api/v1", dataScrapeRoutes);

	const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
		errorMiddleware(error, req, res);
	};
	app.use(errorHandler);

	return app;
};

describe("search-business-details routes", () => {
	/*
	 * Suite baseline:
	 * - envConfig pool ids are populated so validateUser does not fail before auth logic
	 * - verifyToken resolves a worth-admin style issuer so authenticated public requests continue
	 * - validatePurgedBusiness still runs, but the helper resolves falsy so requests are treated
	 *   as not purged and proceed to the controller
	 * - getDataScrapeService resolves a stable object whose searchSerpAPI mock we can assert on
	 */
	beforeEach(() => {
		jest.clearAllMocks();

		envConfig.ENV = "test";
		envConfig.WORTH_ADMIN_USER_POOL_ID = "worth-admin-pool";
		envConfig.CUSTOMER_USER_POOL_ID = "customer-pool";

		mockSearchSerpAPI.mockResolvedValue(buildRouteSearchSuccessResponse());
		mockGetDataScrapeService.mockResolvedValue({
			searchSerpAPI: mockSearchSerpAPI
		} as any);
		mockValidatePurgedBusinessHelper.mockResolvedValue(false);
		mockVerifyToken.mockResolvedValue({
			iss: "https://cognito-idp.us-east-1.amazonaws.com/worth-admin-pool",
			"custom:id": "user-id",
			"cognito:username": "sub-user-id"
		} as any);
	});

	/*
	 * What this proves:
	 * - an authenticated request can traverse the entire public route stack
	 * - controller.searchForBusiness still maps businessDbaName to businessDbaNames: [value]
	 * - optional flags keep their original names and values when passed to searchSerpAPI
	 * - the purged-business helper still receives the business id from the route param
	 *
	 * Regression value:
	 * if controller mapping changes or the public middleware chain skips one of these steps,
	 * the API can silently return valid-looking 200 responses while sending the wrong search
	 * payload to the service layer.
	 */
	it("returns a public success response and maps controller fields for an authenticated request", async () => {
		const response = await request(createApp())
			.post(`/api/v1/businesses/${validBusinessID}/search-business-details`)
			.set("Authorization", "Bearer test-token")
			.send({
				...validBody,
				businessDbaName: "Worth Alias",
				persistGoogleReviews: false,
				is_bulk: true
			});

		expect(response.status).toBe(200);
		expect(response.body).toMatchObject({
			status: "success",
			message: routeSuccessMessage
		});
		expect(mockGetDataScrapeService).toHaveBeenCalledWith(validBusinessID);
		expect(mockSearchSerpAPI).toHaveBeenCalledWith({
			businessID: validBusinessID,
			businessName: validBody.businessName,
			businessDbaNames: ["Worth Alias"],
			businessAddress: validBody.businessAddress,
			persistGoogleReviews: false,
			is_bulk: true
		});
		expect(mockValidatePurgedBusinessHelper).toHaveBeenCalledWith(validBusinessID);
	});

	/*
	 * What this proves:
	 * - the internal route still bypasses validateUser and therefore never calls verifyToken
	 * - omitting businessDbaName continues to normalize to an empty array
	 * - omitted optional flags stay undefined rather than being coerced to a default value
	 *
	 * Regression value:
	 * internal callers rely on this route to skip auth and preserve controller defaults, so
	 * any accidental alignment with the public route would break background and service-to-service use.
	 */
	it("returns an internal success response without auth and maps an omitted DBA to an empty array", async () => {
		const response = await request(createApp())
			.post(`/api/v1/internal/businesses/${alternateBusinessID}/search-business-details`)
			.send(validBody);

		expect(response.status).toBe(200);
		expect(response.body).toMatchObject({
			status: "success",
			message: routeSuccessMessage
		});
		expect(mockVerifyToken).not.toHaveBeenCalled();
		expect(mockSearchSerpAPI).toHaveBeenCalledWith({
			businessID: alternateBusinessID,
			businessName: validBody.businessName,
			businessDbaNames: [],
			businessAddress: validBody.businessAddress,
			persistGoogleReviews: undefined,
			is_bulk: undefined
		});
	});

	/*
	 * Regression value:
	 * the public route must fail before the controller or mocked service run when the
	 * Authorization header is absent. A 401 here protects against accidentally exposing
	 * the public endpoint as if it were the internal one.
	 */
	it("returns a jsend fail response when the public route is missing authorization", async () => {
		const response = await request(createApp())
			.post(`/api/v1/businesses/${validBusinessID}/search-business-details`)
			.send(validBody);

		expect(response.status).toBe(401);
		expect(response.body).toMatchObject({
			status: "fail",
			message: "Authorization header not present",
			errorCode: "UNAUTHENTICATED"
		});
		expect(mockSearchSerpAPI).not.toHaveBeenCalled();
	});

	/*
	 * What this proves:
	 * - a DataScrapeApiError thrown by the mocked service still flows through catchAsync
	 *   and errorMiddleware
	 * - DS_I0005 remains a 400 jsend fail response with the expected error code and message
	 *
	 * Regression value:
	 * this locks down the client-visible HTTP contract for service errors so callers do not
	 * suddenly see a generic 500 or lose the typed error code they already depend on.
	 */
	it("returns a jsend fail response when the service raises a DataScrapeApiError", async () => {
		mockSearchSerpAPI.mockRejectedValueOnce(new DataScrapeApiError(DataScrapeApiErrorCodes.DS_I0005));

		const response = await request(createApp())
			.post(`/api/v1/businesses/${validBusinessID}/search-business-details`)
			.set("Authorization", "Bearer test-token")
			.send(validBody);

		expect(response.status).toBe(400);
		expect(response.body).toMatchObject({
			status: "fail",
			message: "Unable to Search API",
			errorCode: "DS_I0005"
		});
	});

	/*
	 * Schema validation matrix for the internal route.
	 *
	 * Each row proves the same high-level contract:
	 * - validateTypedSchema rejects bad params or body values before the controller runs
	 * - the response shape stays InvalidSchemaError with an issues[] path that pinpoints the field
	 * - searchSerpAPI is never called when input validation fails
	 *
	 * Distinct regression guards covered by the rows:
	 * - invalid UUID in params.businessID
	 * - missing businessName
	 * - missing businessAddress
	 * - persistGoogleReviews with the wrong type
	 * - is_bulk with the wrong type
	 */
	it.each([
		{
			name: "rejects an invalid UUID on the internal route",
			path: "/api/v1/internal/businesses/not-a-uuid/search-business-details",
			body: validBody,
			expectedPath: ["params", "businessID"]
		},
		{
			name: "rejects a missing businessName on the internal route",
			path: `/api/v1/internal/businesses/${validBusinessID}/search-business-details`,
			body: {
				businessAddress: validBody.businessAddress
			},
			expectedPath: ["body", "businessName"]
		},
		{
			name: "rejects a missing businessAddress on the internal route",
			path: `/api/v1/internal/businesses/${validBusinessID}/search-business-details`,
			body: {
				businessName: validBody.businessName
			},
			expectedPath: ["body", "businessAddress"]
		},
		{
			name: "rejects a non-boolean persistGoogleReviews on the internal route",
			path: `/api/v1/internal/businesses/${validBusinessID}/search-business-details`,
			body: {
				...validBody,
				persistGoogleReviews: "true"
			},
			expectedPath: ["body", "persistGoogleReviews"]
		},
		{
			name: "rejects a non-boolean is_bulk on the internal route",
			path: `/api/v1/internal/businesses/${validBusinessID}/search-business-details`,
			body: {
				...validBody,
				is_bulk: 1
			},
			expectedPath: ["body", "is_bulk"]
		}
	])("$name", async ({ path, body, expectedPath }) => {
		const response = await request(createApp()).post(path).send(body);

		expect(response.status).toBe(400);
		expect(response.body.name).toBe("InvalidSchemaError");
		expect(response.body.issues).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					path: expectedPath
				})
			])
		);
		expect(mockSearchSerpAPI).not.toHaveBeenCalled();
	});

	/*
	 * What this proves:
	 * - authentication success on the public route does not skip later schema validation
	 * - params.businessID is still validated after validateUser completes
	 *
	 * Regression value:
	 * this protects the middleware ordering on the public route. Without it, a valid token
	 * could allow malformed ids to reach the service layer simply because auth already passed.
	 */
	it("still validates the public route when authentication succeeds", async () => {
		const response = await request(createApp())
			.post("/api/v1/businesses/not-a-uuid/search-business-details")
			.set("Authorization", "Bearer test-token")
			.send(validBody);

		expect(response.status).toBe(400);
		expect(response.body.name).toBe("InvalidSchemaError");
		expect(response.body.issues).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					path: ["params", "businessID"]
				})
			])
		);
	});
});
