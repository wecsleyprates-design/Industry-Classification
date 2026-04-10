import { api } from "@/lib/api";
import {
	type createCustomerWebhookEndpointResponse,
	type CreateWebhookCustomerResponse,
	type CreateWebhookPayload,
	type deleteCustomerWebhookEndpointResponse,
	type DeleteWebhookEndpoint,
	type EditWebhookEndpointEventPayload,
	type GetCustomerWebhookResponse,
	type GetWebhookEndpointByIdResponse,
	type GetWebhookEndpointSecretResponse,
	type GetWebhookEndpointsResponse,
	type getWebhookEventLogsResponse,
	type GetWebhookEventsResponse,
	type ResendMessageLogPayload,
} from "@/types/webhooks";

import MICROSERVICE from "@/constants/Microservices";

export const getCustomerWebhookInfo = async (
	customerId: string,
): Promise<GetCustomerWebhookResponse> => {
	const url: string = `${MICROSERVICE.NOTIFICATION}/webhooks/customers/${customerId}`;
	const { data } = await api.get(url);
	return data;
};

export const createWebhookCustomer = async (
	customerId: string,
): Promise<CreateWebhookCustomerResponse> => {
	const url: string = `${MICROSERVICE.NOTIFICATION}/webhooks/customers/${customerId} `;

	const { data } = await api.post(url);
	return data;
};

export const createWebhookEndpoint = async (
	payload: CreateWebhookPayload,
): Promise<createCustomerWebhookEndpointResponse> => {
	const { body, customerId } = payload;
	const url: string = `${MICROSERVICE.NOTIFICATION}/webhooks/customers/${customerId}/endpoints`;
	const { data } = await api.post(url, body);
	return data;
};

export const getWebhookEndpoints = async (
	customerId: string,
): Promise<GetWebhookEndpointsResponse> => {
	const url: string = `${MICROSERVICE.NOTIFICATION}/webhooks/customers/${customerId}/endpoints`;
	const { data } = await api.get(url);
	return data;
};

export const getWebhookEndpointById = async (
	customerId: string,
	endpointId: string,
): Promise<GetWebhookEndpointByIdResponse> => {
	const url: string = `${MICROSERVICE.NOTIFICATION}/webhooks/customers/${customerId}/endpoints/${endpointId}`;
	const { data } = await api.get(url);
	return data;
};

export const getWebhookEndpointSecret = async (
	customerId: string,
	endpointId: string,
): Promise<GetWebhookEndpointSecretResponse> => {
	const url: string = `${MICROSERVICE.NOTIFICATION}/webhooks/customers/${customerId}/endpoints/${endpointId}/secret`;
	const { data } = await api.get(url);
	return data;
};

export const getWebhookEvents = async (): Promise<GetWebhookEventsResponse> => {
	const url: string = `${MICROSERVICE.NOTIFICATION}/webhooks/core-events`;
	const { data } = await api.get(url);
	return data;
};

export const editWebhookEndpointEvents = async (
	payload: EditWebhookEndpointEventPayload,
): Promise<createCustomerWebhookEndpointResponse> => {
	const { body, customerId, endpointId } = payload;
	const url: string = `${MICROSERVICE.NOTIFICATION}/webhooks/customers/${customerId}/endpoints/${endpointId}`;
	const { data } = await api.put(url, body);
	return data;
};

export const getWebhookEventLogs = async (
	customerId: string,
	endpointId: string,
): Promise<getWebhookEventLogsResponse> => {
	const url: string = `${MICROSERVICE.NOTIFICATION}/webhooks/customers/${customerId}/endpoints/${endpointId}/logs`;
	const { data } = await api.get(url);
	return data;
};

export const resendMessageLog = async (
	payload: ResendMessageLogPayload,
): Promise<createCustomerWebhookEndpointResponse> => {
	const { customerId, endpointId, messageId } = payload;
	const url: string = `${MICROSERVICE.NOTIFICATION}/webhooks/customers/${customerId}/endpoints/${endpointId}/messages/${messageId}/resend`;
	const { data } = await api.post(url);
	return data;
};

export const deleteWebhookEndpoint = async (
	payload: DeleteWebhookEndpoint,
): Promise<deleteCustomerWebhookEndpointResponse> => {
	const { customerId, endpointId } = payload;

	const url: string = `${MICROSERVICE.NOTIFICATION}/webhooks/customers/${customerId}/endpoints/${endpointId}`;
	const { data } = await api.delete(url);
	return data;
};
