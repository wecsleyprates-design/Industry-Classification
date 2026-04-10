export interface IntegrationSettingsStorageData {
	acquirerId: string;
	consumerKey: string;
	customerName?: string;
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

export interface IntegrationSettingsBody {
	customerId: string;
	customerName: string;
	consumerKey?: string;
	acquirerId?: string;
	keyPassword?: string;
	keyFile?: any;
	isActive: boolean;
}

export type IntegrationSettingsResponse = {
	data: IntegrationSettingsResponseData | null;
	status: string;
	message: string;
} | null;

export type ConnectionStatus = {
	status: "connected" | "not-connected" | "expired" | "error";
	message: string;
	isActive: boolean;
	expiresAt?: string;
};

export interface IntegrationSettingsForm {
	consumerKey?: string;
	keyPassword?: string;
	acquirerId?: string;
	keyFile?: any; // Mixed type from Yup
	isActive: boolean;
}
