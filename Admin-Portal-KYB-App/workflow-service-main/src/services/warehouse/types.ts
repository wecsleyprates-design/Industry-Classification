export interface WarehouseFact {
	name: string;
	value: unknown;
	description?: string;
	alternatives: unknown[];
	dependencies?: string[];
}

export interface WarehouseResponse {
	scope: string;
	id: string;
	data: Record<string, WarehouseFact>;
	calculated_at: string;
}

export interface WarehouseServiceConfig {
	baseURL?: string;
	healthPath?: string;
	timeout?: number;
}

export interface WarehouseServiceError {
	status: number;
	errorCode: string;
	message: string;
}

export interface WarehouseFactValue {
	name: string;
	value: unknown;
	description?: string;
	alternatives: unknown[];
	dependencies?: string[];
}

export interface WarehouseFactResponse {
	collected_at: string;
	business_id: string;
	name: string;
	value: WarehouseFactValue;
	received_at: string;
	created_at: string | null;
	updated_at: string | null;
}

export interface WarehouseFactsRequest {
	facts_required: string[];
}

export interface WarehouseFactsData {
	[key: string]: unknown;
}
