export interface IcaItem {
	ica: string;
	isDefault: boolean;
}

export interface IntegrationSettingsForm {
	consumerKey?: string;
	keyPassword?: string;
	icas: IcaItem[];
	keyFile?: any;
	isActive: boolean;
}

export interface IntegrationSettingsResponseData {
	accessedAt: string;
	customer_id: string;
	createdAt: string;
	updatedAt: string;
	status: string;
	storage_data: IntegrationSettingsStorageData;
}

export interface IntegrationSettingsStorageData {
	icas: IcaItem[];
	consumerKey: string;
	customerName?: string;
	isActive: boolean;
	acquirerId?: string; // Legacy field for backward compatibility
}

export type IntegrationSettingsResponse = {
	data: IntegrationSettingsResponseData | null;
	status: string;
	message: string;
} | null;

export interface IntegrationSettingsBody {
	customerId: string;
	customerName: string;
	consumerKey?: string;
	icas?: IcaItem[];
	keyPassword?: string;
	keyFile?: any;
	isActive: boolean;
}

export interface IntegrationSettingsPayload {
	tenant_id?: string;
	storage_data: IntegrationSettingsStorageData;
}

export type ConnectionStatus = {
	status: "connected" | "not-connected" | "expired" | "error";
	message: string;
	isActive: boolean;
	expiresAt?: string;
};

type CustomerBusiness = {
	customer_id: string;
	business_id: string;
};

export type RunMatchBulkRequestBody = CustomerBusiness[];

export interface RunMatchBulkResponse {
	status: string;
	message: string;
	data: {
		requestId: string;
		ok: Record<string, string>;
	};
}
