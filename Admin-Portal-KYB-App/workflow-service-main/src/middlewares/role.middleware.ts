import { ERROR_CODES, type ROLES } from "#constants/index";
import { StatusCodes } from "http-status-codes";
import { type Request, type Response, type NextFunction } from "express";
import { type ResponseWithLocals, RoleMiddlewareError } from "#types/common";

export const validateRole = (...roles: ROLES[]) => {
	return (req: Request, res: Response, next: NextFunction) => {
		const typedRes = res as ResponseWithLocals;
		const { role } = typedRes.locals.user;

		if (roles.length > 0 && !roles.includes(role.code as ROLES)) {
			throw new RoleMiddlewareError("Role Not Allowed", StatusCodes.UNAUTHORIZED, ERROR_CODES.UNAUTHORIZED);
		}

		return next();
	};
};
