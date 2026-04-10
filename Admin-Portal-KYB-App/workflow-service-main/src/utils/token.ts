import { ERROR_CODES } from "#constants/index";
import { cognito } from "#lib/index";
import { StatusCodes } from "http-status-codes";
import jwt, { type JwtPayload } from "jsonwebtoken";

export const verifyToken = async (token: string) => {
	try {
		const decodedToken = await cognito.verifyCognitoToken(token, "id");

		return decodedToken;
	} catch (err) {
		if (err && typeof err === "object") {
			const error = err as Record<string, unknown>;
			if (error.name === "TokenExpiredError") {
				error.message = "User Session Expired";
			}

			error.status = StatusCodes.UNAUTHORIZED;
			error.errorCode = ERROR_CODES.UNAUTHENTICATED;
		}
		throw err;
	}
};

export const decodeToken = (token: string, options: jwt.DecodeOptions): JwtPayload => {
	return jwt.decode(token, options) as JwtPayload;
};
