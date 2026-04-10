import { AttributeManager } from "#core/attributes";
import { catchAsync } from "#utils/catchAsync";
import { StatusCodes } from "http-status-codes";
import { SUCCESS_MESSAGES } from "#constants";
import { type Request, type Response } from "express";
import type { GetAttributeCatalogRequest } from "./types";
import { GetAttributeCatalogRequestValidator } from "#core/validators/GetAttributeCatalogRequestValidator";
import { normalizeCatalogOperatorTypeParam } from "#core/attributes/catalogOperators";
import type { UserInfo } from "#types/common";

const attributeManager = new AttributeManager();
const validator = new GetAttributeCatalogRequestValidator();

export const controller = {
	/**
	 * Retrieves the attribute catalog grouped by context
	 * @param req - Express request object with customerId in params and optional query params (source, context, active, operators)
	 * @param res - Express response object
	 */
	getAttributeCatalog: catchAsync(async (req: Request, res: Response) => {
		const attributeCatalogReq = req as unknown as GetAttributeCatalogRequest;
		const { customerId } = attributeCatalogReq.params;
		const query = attributeCatalogReq.query;
		const { source, context, active, operators: operatorsFilterRaw } = query;
		const operatorType = normalizeCatalogOperatorTypeParam(operatorsFilterRaw);
		const userInfo: UserInfo = res.locals.user as UserInfo;

		await validator.validate(customerId, userInfo);

		const result = await attributeManager.getAttributeCatalog(
			{
				...(source && { source }),
				...(context && { context }),
				...(active !== undefined && { active })
			},
			customerId,
			operatorType
		);

		res.jsend.success(result, SUCCESS_MESSAGES.ATTRIBUTE_CATALOG_RETRIEVED as string, StatusCodes.OK);
	})
};
