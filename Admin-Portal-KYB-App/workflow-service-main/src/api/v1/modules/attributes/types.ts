import { type Request } from "express";
import type { GetAttributeCatalogQuery } from "#types/workflow-dtos";

export interface GetAttributeCatalogRequest extends Omit<Request, "query" | "params"> {
	params: {
		customerId: string;
	};
	query: GetAttributeCatalogQuery;
}
