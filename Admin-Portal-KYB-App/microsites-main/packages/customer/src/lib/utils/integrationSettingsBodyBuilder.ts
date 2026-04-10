import {
	saveIntegrationSettings,
	updateIntegrationSettings,
} from "@/services/api/integration.service";
import {
	type IntegrationSettingsBody,
	type IntegrationSettingsResponse,
} from "@/types/IntegrationSettings";

export const strategyMap = {
	create: {
		buildBody,
		api: async (
			customerId: string,
			payload: FormData,
		): Promise<IntegrationSettingsResponse> => {
			return await saveIntegrationSettings(customerId, payload);
		},
	},
	update: {
		buildBody,
		api: async (
			customerId: string,
			payload: FormData,
		): Promise<IntegrationSettingsResponse> => {
			return await updateIntegrationSettings(customerId, payload);
		},
	},
};

/**
 * Creates the storage data object for secrets
 */
function createStorageData(data: IntegrationSettingsBody) {
	const {
		customerName,
		consumerKey,
		keyPassword,
		acquirerId,
		keyFile,
		isActive = false,
	} = data;

	const formData = new FormData();

	// Append the file
	if (keyFile) {
		formData.append("keyFile", keyFile);
	}

	// Append the form fields
	formData.append("customerName", customerName);

	if (consumerKey) {
		formData.append("consumerKey", consumerKey);
	}

	if (acquirerId) {
		formData.append("acquirerId", acquirerId);
	}

	formData.append("isActive", isActive ? "true" : "false");

	if (keyPassword) {
		formData.append("keyPassword", keyPassword);
	}

	return formData;
}

/**
 * Builds request body for creating a new secret
 */
function buildBody(data: IntegrationSettingsBody): FormData {
	const formData = createStorageData(data);
	return formData;
}
