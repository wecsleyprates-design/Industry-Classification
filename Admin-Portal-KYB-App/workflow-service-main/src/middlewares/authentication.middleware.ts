import { envConfig } from "#configs";
import { ERROR_CODES, ROLES, ROLE_ID } from "#constants/index";
import { verifyToken } from "#utils";
import { StatusCodes } from "http-status-codes";
import { type ResponseWithLocals, UserInfo } from "#types/common";
import { NextFunction, Request, Response } from "express";

class AuthenticationMiddlewareError extends Error {
	status: StatusCodes;
	errorCode: (typeof ERROR_CODES)[keyof typeof ERROR_CODES];
	constructor(message: string, httpStatus: StatusCodes, errorCode: (typeof ERROR_CODES)[keyof typeof ERROR_CODES]) {
		super(message);
		this.name = "AuthenticationMiddlewareError";
		this.status = httpStatus;
		this.errorCode = errorCode;
	}
}

export const validateUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
	try {
		if (!envConfig.WORTH_ADMIN_USER_POOL_ID || !envConfig.CUSTOMER_USER_POOL_ID) {
			throw new AuthenticationMiddlewareError(
				"Environment not properly configured",
				StatusCodes.INTERNAL_SERVER_ERROR,
				ERROR_CODES.INVALID
			);
		}
		const authHeader = req.get("authorization");
		if (!authHeader) {
			throw new AuthenticationMiddlewareError(
				"Authorization header not present",
				StatusCodes.UNAUTHORIZED,
				ERROR_CODES.UNAUTHENTICATED
			);
		}

		if (!authHeader.startsWith("Bearer")) {
			throw new AuthenticationMiddlewareError(
				"Invalid Authorization header type",
				StatusCodes.BAD_REQUEST,
				ERROR_CODES.INVALID
			);
		}

		const token = authHeader.split(" ")[1];

		const tokenData = (await verifyToken(token)) as {
			iss: string;
			"cognito:groups"?: string[];
			"custom:customer_id": string;
			"custom:id": string;
			"cognito:username": string;
			"custom:access_token": string;
			email?: string;
			given_name?: string;
			family_name?: string;
			role?: { id: number; code: string };
			[key: string]: unknown;
		};

		// Create UserInfo object with proper structure
		const userInfo: UserInfo = {
			user_id: tokenData["custom:id"],
			email: tokenData.email ?? "",
			given_name: tokenData.given_name ?? "",
			family_name: tokenData.family_name ?? "",
			customer_id: tokenData["custom:customer_id"] ?? "",
			sub_user_id: tokenData["cognito:username"],
			access_token: token,
			role: { id: ROLE_ID.APPLICANT, code: ROLES.APPLICANT },
			subrole_id: tokenData["custom:subrole_id"] as string | undefined,
			...tokenData
		};

		if (tokenData.iss.includes(envConfig.WORTH_ADMIN_USER_POOL_ID)) {
			userInfo.role = {
				id: ROLE_ID.ADMIN,
				code: ROLES.ADMIN
			};
		} else if (tokenData.iss.includes(envConfig.CUSTOMER_USER_POOL_ID)) {
			userInfo.role = {
				id: ROLE_ID.CUSTOMER,
				code: ROLES.CUSTOMER
			};
			// Ensure customer_id is set for customer users
			userInfo.customer_id =
				tokenData["custom:customer_id"] ?? (tokenData["custom:custommer_id"] as string | undefined) ?? "";
		} else {
			userInfo.role = {
				id: ROLE_ID.APPLICANT,
				code: ROLES.APPLICANT
			};
		}

		const typedRes = res as ResponseWithLocals;
		typedRes.locals.user = userInfo;
		return next();
	} catch (error) {
		return next(error);
	}
};
