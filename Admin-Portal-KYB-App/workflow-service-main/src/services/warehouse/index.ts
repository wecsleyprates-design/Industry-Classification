export type {
	WarehouseResponse,
	WarehouseServiceConfig,
	WarehouseServiceError,
	WarehouseFact,
	WarehouseFactValue,
	WarehouseFactsData,
	WarehouseFactResponse,
	WarehouseFactsRequest
} from "./types";

import { WarehouseService } from "./warehouseService";

export const warehouseService = new WarehouseService();
