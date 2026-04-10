import { ERROR_CODES, ROLES } from "#constants";
import { StatusCodes } from "http-status-codes";
import { type Request, type Response, type NextFunction } from "express";
import { type ResponseWithLocals, RoleMiddlewareError } from "#types/common";
import { logger } from "#helpers/logger";

type AllowedRoles = ReadonlyArray<(typeof ROLES)[keyof typeof ROLES]>;

const DEFAULT_ALLOWED_ROLES: AllowedRoles = [ROLES.ADMIN];

/**
 * Creates a middleware that validates the user has one of the allowed roles for write operations.
 * @param allowedRoles - List of role codes that are allowed (e.g. [ROLES.ADMIN] or [ROLES.ADMIN, ROLES.CUSTOMER])
 * @param resourceLabel - Optional label for error messages
 * @returns Express middleware
 */
export const createValidateSubroleForWrite =
	(
		allowedRoles: AllowedRoles = DEFAULT_ALLOWED_ROLES,
		resourceLabel: string = "workflows"
	): ((req: Request, res: Response, next: NextFunction) => Promise<void>) =>
	async (req: Request, res: Response, next: NextFunction): Promise<void> => {
		const typedRes = res as ResponseWithLocals;
		try {
			const { role } = typedRes.locals.user;

			if (allowedRoles.includes(role.code as (typeof ROLES)[keyof typeof ROLES])) {
				return next();
			}

			const roleLabel =
				role.code === ROLES.APPLICANT ? "Applicant" : role.code === ROLES.CUSTOMER ? "Customer" : "User";
			throw new RoleMiddlewareError(
				`${roleLabel} role does not have write access to ${resourceLabel}`,
				StatusCodes.UNAUTHORIZED,
				ERROR_CODES.UNAUTHORIZED
			);
		} catch (error) {
			if (error instanceof RoleMiddlewareError) {
				throw error;
			}

			logger.error(
				{
					error,
					subrole_id: typedRes.locals.user.subrole_id,
					user_id: typedRes.locals.user.user_id,
					role: typedRes.locals.user.role.code
				},
				"Error validating subrole for write access"
			);

			if (error instanceof Error && (error.message.includes("timeout") || error.message.includes("network"))) {
				throw new RoleMiddlewareError(
					"Auth Service error while validating subrole",
					StatusCodes.INTERNAL_SERVER_ERROR,
					ERROR_CODES.INVALID
				);
			}

			throw new RoleMiddlewareError(
				"Unable to validate subrole permissions",
				StatusCodes.UNAUTHORIZED,
				ERROR_CODES.UNAUTHORIZED
			);
		}
	};

export const validateSubroleForWrite = createValidateSubroleForWrite(DEFAULT_ALLOWED_ROLES, "workflows");
