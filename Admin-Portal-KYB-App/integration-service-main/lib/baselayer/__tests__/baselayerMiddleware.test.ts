import { Request, Response, NextFunction } from "express";
import { baselayerSvixVerify, errorOnInvalidBaselayerSignature } from "../baselayer.middleware";
import { VerificationApiError } from "#api/v1/modules/verification/error";
import { logger } from "#helpers/index";

const mockVerify = jest.fn();

jest.mock("#configs/index", () => ({
	envConfig: {
		BASELAYER_WEBHOOK_SECRET: "whsec_test_secret_for_svix"
	}
}));

jest.mock("#helpers/index", () => ({
	logger: {
		warn: jest.fn(),
		error: jest.fn(),
		info: jest.fn()
	}
}));

jest.mock("svix", () => ({
	Webhook: jest.fn().mockImplementation(() => ({
		verify: mockVerify
	}))
}));

describe("Baselayer Webhook Middleware", () => {
	let req: Partial<Request>;
	let res: { locals: Record<string, unknown> };
	let next: NextFunction;

	beforeEach(() => {
		jest.clearAllMocks();
		mockVerify.mockReset();
		req = {
			get: jest.fn(),
			body: {}
		};
		res = {
			locals: {}
		};
		next = jest.fn();
	});

	describe("baselayerSvixVerify", () => {
		it("should set res.locals.invalidBaselayerSignature when Svix headers are missing", () => {
			const buf = Buffer.from(JSON.stringify({ id: "search-1", state: "COMPLETED" }));
			(req.get as jest.Mock).mockImplementation((name: string) => {
				if (name === "svix-id") return "msg_123";
				return undefined;
			});

			baselayerSvixVerify(req as Request, res as unknown as Response, buf);

			expect(res.locals.invalidBaselayerSignature).toBe(true);
			expect(logger.error).toHaveBeenCalledWith("Baselayer webhook missing Svix headers");
			expect(mockVerify).not.toHaveBeenCalled();
		});

		it("should set res.locals.invalidBaselayerSignature when Svix verify throws", () => {
			const payload = { id: "search-1" };
			const buf = Buffer.from(JSON.stringify(payload));
			(req.get as jest.Mock).mockImplementation((name: string) => {
				const headers: Record<string, string> = {
					"svix-id": "msg_abc",
					"svix-timestamp": "1234567890",
					"svix-signature": "v1,signature"
				};
				return headers[name];
			});
			mockVerify.mockImplementation(() => {
				throw new Error("bad signature");
			});

			baselayerSvixVerify(req as Request, res as unknown as Response, buf);

			expect(res.locals.invalidBaselayerSignature).toBe(true);
			expect(mockVerify).toHaveBeenCalledWith(JSON.stringify(payload), {
				"svix-id": "msg_abc",
				"svix-timestamp": "1234567890",
				"svix-signature": "v1,signature"
			});
			expect(logger.error).toHaveBeenCalledWith(
				{ err: expect.any(Error) },
				"Invalid Baselayer / Svix webhook signature"
			);
		});

		it("should not set res.locals.invalidBaselayerSignature when Svix verify succeeds", () => {
			const payload = { id: "search-1", state: "COMPLETED" };
			const buf = Buffer.from(JSON.stringify(payload));
			(req.get as jest.Mock).mockImplementation((name: string) => {
				const headers: Record<string, string> = {
					"svix-id": "msg_valid",
					"svix-timestamp": "1234567890",
					"svix-signature": "v1,valid"
				};
				return headers[name];
			});
			mockVerify.mockImplementation(() => undefined);

			baselayerSvixVerify(req as Request, res as unknown as Response, buf);

			expect(res.locals.invalidBaselayerSignature).toBeUndefined();
			expect(mockVerify).toHaveBeenCalled();
		});
	});

	describe("errorOnInvalidBaselayerSignature", () => {
		it("should throw VerificationApiError if res.locals.invalidBaselayerSignature is true", () => {
			res.locals.invalidBaselayerSignature = true;

			expect(() => {
				errorOnInvalidBaselayerSignature(req as Request, res as unknown as Response, next);
			}).toThrow(VerificationApiError);
		});

		it("should call next() if res.locals.invalidBaselayerSignature is not set", () => {
			errorOnInvalidBaselayerSignature(req as Request, res as unknown as Response, next);

			expect(next).toHaveBeenCalled();
		});
	});
});
